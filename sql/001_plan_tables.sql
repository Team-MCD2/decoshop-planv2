-- ════════════════════════════════════════════════════════════════════════════
--  DECO SHOP — Plan V2 Schema (additive migration)
-- ════════════════════════════════════════════════════════════════════════════
--
--  This migration ADDS tables for the floor-plan editor. It does NOT touch
--  the existing `public.articles` table or any other existing structure.
--
--  ▸ IDEMPOTENT: Safe to run multiple times (IF NOT EXISTS everywhere).
--  ▸ ADDITIVE: No ALTER/DROP on existing tables.
--  ▸ FOREIGN KEYS: `plan_shelf_items.article_id` optionally references
--    `public.articles(id)` to link floor-plan placements to real inventory.
--
-- ════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. plan_sections — Floor plan sections (product areas)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.plan_sections (
  id           text           primary key,
  number       integer,
  label        text           not null default '',
  description  text           not null default '',
  category     text           not null default '',
  icon         text           not null default '',
  color        text           not null default '#D4AF37',

  -- Position & size (metres from top-left)
  x            numeric(6, 2)  not null default 0,
  y            numeric(6, 2)  not null default 0,
  w            numeric(6, 2)  not null default 1.5,
  h            numeric(6, 2)  not null default 1.2,

  is_comptoir  boolean        not null default false,
  is_locked    boolean        not null default false,

  created_at   timestamptz    not null default now(),
  updated_at   timestamptz    not null default now()
);

comment on table public.plan_sections is
  'Floor plan sections for DecoShop Plan V2. One row = one product zone on the 2D plan.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. plan_zones — Functional zones (entrance, checkout, office, etc.)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.plan_zones (
  id           text           primary key,
  label        text           not null default '',
  type         text           not null default '',
  description  text           not null default '',
  icon         text           not null default '',
  color        text           not null default '#6366F1',

  x            numeric(6, 2)  not null default 0,
  y            numeric(6, 2)  not null default 0,
  w            numeric(6, 2)  not null default 1.5,
  h            numeric(6, 2)  not null default 1.2,

  is_locked    boolean        not null default false,

  created_at   timestamptz    not null default now(),
  updated_at   timestamptz    not null default now()
);

comment on table public.plan_zones is
  'Functional zones on the DecoShop floor plan (entrance, checkout, stock, etc.).';


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. plan_shelves — Shelves within sections
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.plan_shelves (
  id           text           primary key,
  section_id   text           not null references public.plan_sections(id) on delete cascade,
  index        integer        not null default 0,
  hauteur_cm   integer        not null default 0,
  capacite     integer        not null default 12,

  created_at   timestamptz    not null default now(),
  updated_at   timestamptz    not null default now()
);

comment on table public.plan_shelves is
  'Shelves stacked vertically within a plan section. Index 0 = floor level.';

create index if not exists idx_plan_shelves_section on public.plan_shelves (section_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. plan_shelf_items — Products placed on shelves
-- ─────────────────────────────────────────────────────────────────────────────
-- This is the join table: a shelf can hold many items. When article_id is set,
-- it links to the existing articles catalog. When null, it's a free-text item.
create table if not exists public.plan_shelf_items (
  id           text           primary key,
  shelf_id     text           not null references public.plan_shelves(id) on delete cascade,
  title        text           not null default '',
  sku          text           not null default '',
  vendor       text           not null default '',
  price        numeric(12, 2),
  qty          integer        not null default 1,
  image        text           not null default '',
  position     integer        not null default 0,

  -- Optional FK to the existing articles catalog.
  -- SET NULL on delete so removing an article doesn't break shelf placements.
  article_id   text           references public.articles(id) on delete set null,

  created_at   timestamptz    not null default now(),
  updated_at   timestamptz    not null default now()
);

comment on table public.plan_shelf_items is
  'Products placed on shelves. Links to articles catalog via article_id (optional).';

create index if not exists idx_plan_shelf_items_shelf   on public.plan_shelf_items (shelf_id);
create index if not exists idx_plan_shelf_items_article on public.plan_shelf_items (article_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Row Level Security — match existing articles pattern (deny all for anon)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.plan_sections    enable row level security;
alter table public.plan_zones       enable row level security;
alter table public.plan_shelves     enable row level security;
alter table public.plan_shelf_items enable row level security;

-- Allow authenticated users (service role or logged-in) full access:
do $$
begin
  -- plan_sections
  if not exists (select 1 from pg_policies where policyname = 'plan_sections_all_auth' and tablename = 'plan_sections') then
    create policy plan_sections_all_auth on public.plan_sections for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;

  -- plan_zones
  if not exists (select 1 from pg_policies where policyname = 'plan_zones_all_auth' and tablename = 'plan_zones') then
    create policy plan_zones_all_auth on public.plan_zones for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;

  -- plan_shelves
  if not exists (select 1 from pg_policies where policyname = 'plan_shelves_all_auth' and tablename = 'plan_shelves') then
    create policy plan_shelves_all_auth on public.plan_shelves for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;

  -- plan_shelf_items
  if not exists (select 1 from pg_policies where policyname = 'plan_shelf_items_all_auth' and tablename = 'plan_shelf_items') then
    create policy plan_shelf_items_all_auth on public.plan_shelf_items for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;
end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Updated-at trigger (auto-update updated_at on row changes)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply trigger to all plan tables:
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_plan_sections_updated') then
    create trigger trg_plan_sections_updated before update on public.plan_sections for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_plan_zones_updated') then
    create trigger trg_plan_zones_updated before update on public.plan_zones for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_plan_shelves_updated') then
    create trigger trg_plan_shelves_updated before update on public.plan_shelves for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_plan_shelf_items_updated') then
    create trigger trg_plan_shelf_items_updated before update on public.plan_shelf_items for each row execute function public.set_updated_at();
  end if;
end $$;


-- ════════════════════════════════════════════════════════════════════════════
--  Done. Verify:
--    SELECT table_name FROM information_schema.tables
--    WHERE table_schema = 'public' AND table_name LIKE 'plan_%';
-- ════════════════════════════════════════════════════════════════════════════
