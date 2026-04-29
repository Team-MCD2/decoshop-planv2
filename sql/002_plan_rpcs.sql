-- ════════════════════════════════════════════════════════════════════════════
--  DECO SHOP — Plan V2 RPCs (atomic snapshot save / load)
-- ════════════════════════════════════════════════════════════════════════════
--
--  Two server-side functions that let the SPA persist its entire layout
--  with a single round-trip each, atomically. This is what keeps the
--  client-side `lib/db.ts` dead simple — the diff-and-write logic lives
--  here, in a transaction, where Postgres can guarantee consistency.
--
--  ▸ public.plan_load_layout()                  → returns the full snapshot
--  ▸ public.plan_replace_layout(payload jsonb)  → atomic delete+reinsert
--
--  Both functions are SECURITY INVOKER (run as the caller) so RLS still
--  applies. They are granted to anon + authenticated to match the policy
--  set in `001_plan_tables.sql`. See the threat-model note in that file
--  before tightening.
--
--  Run AFTER `001_plan_tables.sql`. Idempotent (CREATE OR REPLACE).
-- ════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. plan_load_layout() — fetch the full snapshot
-- ─────────────────────────────────────────────────────────────────────────────
-- Returns a JSON object shaped exactly like the client-side `SavedLayout`
-- type, so the SPA can hydrate React state with zero post-processing:
--
--   {
--     "version":  1,
--     "exists":   true|false,         -- false = DB is empty, use seed
--     "sections": [ { id, number, label, x, y, w, h, color, ...,
--                     shelves: [ { id, index, hauteur_cm, capacite,
--                                  items: [ { id, title, qty, ... } ] } ] } ],
--     "zones":    [ { id, label, x, y, w, h, color, ... } ]
--   }
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.plan_load_layout()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_section_count integer;
  v_zone_count    integer;
  v_sections      jsonb;
  v_zones         jsonb;
begin
  select count(*) into v_section_count from public.plan_sections;
  select count(*) into v_zone_count    from public.plan_zones;

  -- Sections with their shelves and items, all nested.
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',         s.id,
        'number',     s.number,
        'label',      s.label,
        'desc',       s.description,
        'category',   s.category,
        'icon',       s.icon,
        'color',      s.color,
        'x',          s.x,
        'y',          s.y,
        'w',          s.w,
        'h',          s.h,
        'isComptoir', s.is_comptoir,
        'locked',     s.is_locked,
        'shelves',    coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id',         sh.id,
                'index',      sh.index,
                'hauteur_cm', sh.hauteur_cm,
                'capacite',   sh.capacite,
                'items',      coalesce(
                  (
                    select jsonb_agg(
                      jsonb_build_object(
                        'id',         it.id,
                        'title',      it.title,
                        'sku',        nullif(it.sku, ''),
                        'vendor',     nullif(it.vendor, ''),
                        'price',      it.price,
                        'qty',        it.qty,
                        'image',      nullif(it.image, ''),
                        'article_id', it.article_id
                      )
                      order by it.position, it.created_at
                    )
                    from public.plan_shelf_items it
                    where it.shelf_id = sh.id
                  ),
                  '[]'::jsonb
                )
              )
              order by sh.index
            )
            from public.plan_shelves sh
            where sh.section_id = s.id
          ),
          '[]'::jsonb
        )
      )
      order by s.number nulls last, s.id
    ),
    '[]'::jsonb
  ) into v_sections
  from public.plan_sections s;

  -- Zones (no children).
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',     z.id,
        'label',  z.label,
        'type',   z.type,
        'desc',   z.description,
        'icon',   z.icon,
        'color',  z.color,
        'x',      z.x,
        'y',      z.y,
        'w',      z.w,
        'h',      z.h,
        'locked', z.is_locked
      )
      order by z.id
    ),
    '[]'::jsonb
  ) into v_zones
  from public.plan_zones z;

  return jsonb_build_object(
    'version',  1,
    'exists',   (v_section_count > 0 or v_zone_count > 0),
    'sections', v_sections,
    'zones',    v_zones
  );
end;
$$;

comment on function public.plan_load_layout() is
  'Returns the full DecoShop floor plan as a single JSON snapshot, '
  'shaped identically to the client-side SavedLayout type.';

revoke all     on function public.plan_load_layout() from public;
grant  execute on function public.plan_load_layout() to anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. plan_replace_layout(payload jsonb) — atomic snapshot save
-- ─────────────────────────────────────────────────────────────────────────────
-- Takes the same JSON shape that `plan_load_layout` emits and replaces the
-- entire floor plan with it, in a single transaction. Strategy:
--
--   1. DELETE FROM plan_zones    (no children)
--   2. DELETE FROM plan_sections (cascades to plan_shelves → plan_shelf_items)
--   3. INSERT all zones from the payload
--   4. INSERT all sections, then their shelves, then their items
--
-- Items whose `article_id` doesn't match an existing `public.articles.id`
-- are silently dropped (FK is `on delete set null`, so any orphan id is
-- coerced to NULL and the placement still saves). The summary count of
-- dropped IDs is returned to the caller for UI feedback.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.plan_replace_layout(p_payload jsonb)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = public, pg_temp
as $$
declare
  v_section_count integer := 0;
  v_zone_count    integer := 0;
  v_shelf_count   integer := 0;
  v_item_count    integer := 0;
  v_dropped_items integer := 0;
begin
  -- Validate the payload shape: must be an object with `sections` and `zones`
  -- arrays. We don't enforce content here — Postgres types catch the rest.
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'plan_replace_layout: payload must be a JSON object'
      using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_payload->'sections', '[]'::jsonb)) <> 'array' then
    raise exception 'plan_replace_layout: payload.sections must be an array'
      using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_payload->'zones', '[]'::jsonb)) <> 'array' then
    raise exception 'plan_replace_layout: payload.zones must be an array'
      using errcode = '22023';
  end if;

  -- Step 1-2: clear existing rows (cascades handle children).
  delete from public.plan_zones;
  delete from public.plan_sections;

  -- Step 3: insert zones.
  insert into public.plan_zones (
    id, label, type, description, icon, color,
    x, y, w, h, is_locked
  )
  select
    coalesce(z->>'id',    'zone-' || gen_random_uuid()::text),
    coalesce(z->>'label', ''),
    coalesce(z->>'type',  ''),
    coalesce(z->>'desc',  ''),
    coalesce(z->>'icon',  ''),
    coalesce(z->>'color', '#6366F1'),
    coalesce((z->>'x')::numeric, 0),
    coalesce((z->>'y')::numeric, 0),
    coalesce((z->>'w')::numeric, 1),
    coalesce((z->>'h')::numeric, 1),
    coalesce((z->>'locked')::boolean, false)
  from jsonb_array_elements(coalesce(p_payload->'zones', '[]'::jsonb)) as z;
  get diagnostics v_zone_count = row_count;

  -- Step 4a: insert sections.
  insert into public.plan_sections (
    id, number, label, description, category, icon, color,
    x, y, w, h, is_comptoir, is_locked
  )
  select
    coalesce(s->>'id', 'sec-' || gen_random_uuid()::text),
    nullif(s->>'number', '')::integer,
    coalesce(s->>'label', ''),
    coalesce(s->>'desc',  ''),
    coalesce(s->>'category', ''),
    coalesce(s->>'icon',  ''),
    coalesce(s->>'color', '#D4AF37'),
    coalesce((s->>'x')::numeric, 0),
    coalesce((s->>'y')::numeric, 0),
    coalesce((s->>'w')::numeric, 1.5),
    coalesce((s->>'h')::numeric, 1.2),
    coalesce((s->>'isComptoir')::boolean, false),
    coalesce((s->>'locked')::boolean, false)
  from jsonb_array_elements(coalesce(p_payload->'sections', '[]'::jsonb)) as s;
  get diagnostics v_section_count = row_count;

  -- Step 4b: insert shelves (one row per shelf across all sections).
  with src as (
    select
      s->>'id' as section_id,
      sh
    from
      jsonb_array_elements(coalesce(p_payload->'sections', '[]'::jsonb)) as s,
      jsonb_array_elements(coalesce(s->'shelves', '[]'::jsonb))           as sh
  )
  insert into public.plan_shelves (
    id, section_id, index, hauteur_cm, capacite
  )
  select
    coalesce(sh->>'id', section_id || '-shelf-' || (sh->>'index')),
    section_id,
    coalesce((sh->>'index')::integer, 0),
    coalesce((sh->>'hauteur_cm')::integer, 0),
    coalesce((sh->>'capacite')::integer, 12)
  from src;
  get diagnostics v_shelf_count = row_count;

  -- Step 4c: insert items (one row per item across all shelves).
  -- We resolve article_id against public.articles; non-matches → NULL.
  with src as (
    select
      sh->>'id' as shelf_id,
      it,
      row_number() over (partition by sh->>'id' order by 1) - 1 as position
    from
      jsonb_array_elements(coalesce(p_payload->'sections', '[]'::jsonb))   as s,
      jsonb_array_elements(coalesce(s->'shelves',       '[]'::jsonb))      as sh,
      jsonb_array_elements(coalesce(sh->'items',        '[]'::jsonb))      as it
  )
  insert into public.plan_shelf_items (
    id, shelf_id, title, sku, vendor, price, qty, image, position, article_id
  )
  select
    coalesce(it->>'id', 'item-' || gen_random_uuid()::text),
    shelf_id,
    coalesce(it->>'title', ''),
    coalesce(it->>'sku',    ''),
    coalesce(it->>'vendor', ''),
    nullif(it->>'price', '')::numeric,
    coalesce((it->>'qty')::integer, 1),
    coalesce(it->>'image', ''),
    position::integer,
    -- Resolve article_id; if the FK doesn't match, the column gets NULL.
    case
      when it->>'article_id' is null or it->>'article_id' = '' then null
      when exists (select 1 from public.articles a where a.id = it->>'article_id')
        then it->>'article_id'
      else null
    end
  from src;
  get diagnostics v_item_count = row_count;

  -- Count items that were submitted with an article_id that didn't resolve.
  select count(*) into v_dropped_items
  from
    jsonb_array_elements(coalesce(p_payload->'sections', '[]'::jsonb))   as s,
    jsonb_array_elements(coalesce(s->'shelves',       '[]'::jsonb))      as sh,
    jsonb_array_elements(coalesce(sh->'items',        '[]'::jsonb))      as it
  where
    it->>'article_id' is not null
    and it->>'article_id' <> ''
    and not exists (select 1 from public.articles a where a.id = it->>'article_id');

  return jsonb_build_object(
    'sections_inserted',     v_section_count,
    'zones_inserted',        v_zone_count,
    'shelves_inserted',      v_shelf_count,
    'items_inserted',        v_item_count,
    'article_ids_unresolved', v_dropped_items,
    'saved_at',              now()
  );
end;
$$;

comment on function public.plan_replace_layout(jsonb) is
  'Atomic snapshot save: replaces the entire floor plan with the JSON payload. '
  'Returns counts of inserted rows and how many article_id references failed to resolve.';

revoke all     on function public.plan_replace_layout(jsonb) from public;
grant  execute on function public.plan_replace_layout(jsonb) to anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════════
--  Smoke test (paste in SQL Editor after running this file):
--
--    -- Round-trip empty payload — should return all counts at 0
--    select public.plan_replace_layout(
--      jsonb_build_object('version', 1, 'sections', '[]'::jsonb, 'zones', '[]'::jsonb)
--    );
--
--    -- Read it back — should return { version, exists: false, sections: [], zones: [] }
--    select public.plan_load_layout();
-- ════════════════════════════════════════════════════════════════════════════
