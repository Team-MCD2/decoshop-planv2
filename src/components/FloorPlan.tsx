import { useEffect, useRef, useState } from 'react';
import { useStore } from '../hooks/useStore';
import { STORE, SCALE } from '../data/storeLayout';
import type { Section, Zone } from '../types/domain';

// Drag-info shape kept in component state so we can render the live
// dimension badge while a drag/resize/rotate gesture is in progress.
interface DragInfo {
  id: string;
  /** 'move' | 'rotate' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' */
  type: string;
}

export default function FloorPlan() {
  const { state, dispatch, totalItems } = useStore();
  const planRef = useRef<HTMLDivElement>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number; type: string; origW?: number; origH?: number; origRot?: number } | null>(null);

  // Sprint E.2 — live dimension badge. Set on pointerdown, cleared on
  // pointerup/cancel. Component re-renders during drag because the
  // section's x/y/w/h/rotation are dispatched on every pointermove, so
  // `state.sections` updates in lockstep with the cursor.
  const [dragInfo, setDragInfo] = useState<DragInfo | null>(null);

  const w = STORE.width * SCALE;
  const h = STORE.height * SCALE;

  // Native non-passive wheel listener — React's `onWheel` attaches a passive
  // listener so `e.preventDefault()` is a no-op. We need preventDefault to
  // stop the page from scrolling behind the canvas while the user zooms.
  useEffect(() => {
    const el = canvasAreaRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Sign: scroll up (negative deltaY) zooms in; scroll down zooms out.
      // Reducer clamps to [0.4, 2.5].
      dispatch({ type: 'ZOOM_BY', delta: -e.deltaY * 0.001 });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [dispatch]);

  /* ── Drag, Resize, Rotate (structure mode only) ── */
  // Plain functions — React Compiler handles memoization. The lint rule
  // `react-hooks/preserve-manual-memoization` forbids manual useCallback
  // when the compiler is enabled.
  const handlePointerDown = (e: React.PointerEvent, block: Section | Zone, kind: 'section' | 'zone', type: string = 'move') => {
      if (state.mode !== 'structure' || block.locked) return;
      e.stopPropagation();
      e.preventDefault();

      // If just clicking to select in structure mode
      if (kind === 'section') {
        dispatch({ type: 'SELECT_SECTION', id: block.id });
      }

      dragRef.current = { 
        id: block.id, 
        startX: e.clientX, 
        startY: e.clientY, 
        origX: block.x, 
        origY: block.y, 
        type,
        origW: block.w,
        origH: block.h,
        origRot: block.rotation || 0
      };

      // Surface drag state to render the floating dimension badge.
      // Sections only — zones don't get a badge for V2 simplicity.
      if (kind === 'section') setDragInfo({ id: block.id, type });

      const cx = (block.x + block.w / 2) * SCALE * state.zoom;
      const cy = (block.y + block.h / 2) * SCALE * state.zoom;
      const rect = planRef.current?.getBoundingClientRect();
      const absCx = (rect?.left || 0) + cx;
      const absCy = (rect?.top || 0) + cy;

      const onMove = (ev: PointerEvent) => {
        if (!dragRef.current) return;
        const { startX, startY, origX, origY, origW = 1, origH = 1, type: dragType, id } = dragRef.current;
        
        const dx = (ev.clientX - startX) / (SCALE * state.zoom);
        const dy = (ev.clientY - startY) / (SCALE * state.zoom);

        if (dragType === 'rotate') {
          const angle = Math.atan2(ev.clientY - absCy, ev.clientX - absCx);
          let deg = (angle * 180) / Math.PI;
          if (ev.shiftKey) deg = Math.round(deg / 45) * 45;
          else deg = Math.round(deg);
          const newRot = Math.round(deg + 90) % 360;
          if (kind === 'section') dispatch({ type: 'UPDATE_SECTION', id, updates: { rotation: newRot } });
          return;
        }

        if (dragType === 'move') {
          // E — soft-clamp inside the store walls so a careless fling
          // can't park a section off-canvas. Width/height never change
          // during a move, so the clamp range is just [0, STORE − size].
          let nx = origX + dx;
          let ny = origY + dy;
          nx = Math.max(0, Math.min(STORE.width - origW, nx));
          ny = Math.max(0, Math.min(STORE.height - origH, ny));
          nx = Math.round(nx * 10) / 10;
          ny = Math.round(ny * 10) / 10;
          if (kind === 'section') dispatch({ type: 'UPDATE_SECTION', id, updates: { x: nx, y: ny } });
          else dispatch({ type: 'MOVE_ZONE', id, x: nx, y: ny });
          return;
        }

        // Resize — base math: each direction in `dragType` moves the
        // corresponding edge. Min size clamp at 0.5 m so the section
        // never collapses to nothing.
        let nx = origX;
        let ny = origY;
        let nw = origW;
        let nh = origH;

        if (dragType.includes('e')) nw = Math.max(0.5, origW + dx);
        if (dragType.includes('w')) { nw = Math.max(0.5, origW - dx); nx = origX + (origW - nw); }
        if (dragType.includes('s')) nh = Math.max(0.5, origH + dy);
        if (dragType.includes('n')) { nh = Math.max(0.5, origH - dy); ny = origY + (origH - nh); }

        // E.3 — Shift on a corner locks the aspect ratio. Pick the
        // dimension that changed more (in relative terms) and derive
        // the other from origW/origH so the visual stays proportional.
        const isCorner = dragType.length === 2;
        if (ev.shiftKey && isCorner && origH > 0) {
          const ratio = origW / origH;
          const dwRel = Math.abs(nw - origW) / origW;
          const dhRel = Math.abs(nh - origH) / origH;
          if (dwRel >= dhRel) {
            nh = Math.max(0.5, nw / ratio);
          } else {
            nw = Math.max(0.5, nh * ratio);
          }
          // Re-anchor west/north edges if they were the dragged side
          // — otherwise the section would jump when the locked dim changes.
          if (dragType.includes('w')) nx = origX + (origW - nw);
          if (dragType.includes('n')) ny = origY + (origH - nh);
        }

        // E.3 — Alt resizes from the center: keep the section's center
        // fixed and grow/shrink symmetrically. Applied AFTER size is
        // settled so it works for both plain and aspect-locked drags.
        if (ev.altKey) {
          nx = origX + (origW - nw) / 2;
          ny = origY + (origH - nh) / 2;
        }

        // E — soft-clamp into the store walls. If the section would
        // overshoot a wall, shrink the dimension by the overshoot so the
        // wall stops the resize cleanly (no deformation, no drift).
        if (nx < 0) { nw = nw + nx; nx = 0; }
        if (ny < 0) { nh = nh + ny; ny = 0; }
        if (nx + nw > STORE.width)  nw = STORE.width  - nx;
        if (ny + nh > STORE.height) nh = STORE.height - ny;
        nw = Math.max(0.5, nw);
        nh = Math.max(0.5, nh);

        nx = Math.round(nx * 10) / 10;
        ny = Math.round(ny * 10) / 10;
        nw = Math.round(nw * 10) / 10;
        nh = Math.round(nh * 10) / 10;

        if (kind === 'section') dispatch({ type: 'UPDATE_SECTION', id, updates: { x: nx, y: ny, w: nw, h: nh } });
      };

      // All gesture-end paths route through `cleanup()` so the listeners
      // and ref/state are torn down in one place no matter how the drag
      // ends (release, cancel, Escape).
      const cleanup = () => {
        dragRef.current = null;
        setDragInfo(null);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        window.removeEventListener('keydown', onKey);
      };
      const onUp = () => cleanup();

      // D — Escape during a drag/resize/rotate reverts the section to its
      // pre-drag geometry (Figma/Word convention). Zones revert position
      // only, since `MOVE_ZONE` is the only zone-mutating action wired up.
      const onKey = (ev: KeyboardEvent) => {
        if (ev.key !== 'Escape' || !dragRef.current) return;
        ev.preventDefault();
        const { id, origX, origY, origW = 1, origH = 1, origRot = 0 } = dragRef.current;
        if (kind === 'section') {
          dispatch({
            type: 'UPDATE_SECTION',
            id,
            updates: { x: origX, y: origY, w: origW, h: origH, rotation: origRot },
          });
        } else {
          dispatch({ type: 'MOVE_ZONE', id, x: origX, y: origY });
        }
        cleanup();
      };

      // Pointer Events unify mouse, touch and pen input. `pointercancel`
      // fires if the OS pre-empts the gesture (e.g. system swipe) — we
      // treat it like pointerup to release the drag cleanly.
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
      window.addEventListener('keydown', onKey);
    };

  /* ── Click (inventory mode → drill down) ───────── */
  const handleClick = (e: React.MouseEvent, sectionId: string) => {
    e.stopPropagation();
    if (state.mode === 'inventory') {
      dispatch({ type: 'SELECT_SECTION', id: sectionId });
    } else if (state.mode === 'structure') {
      dispatch({ type: 'SELECT_SECTION', id: sectionId });
    }
  };

  /* ── Background Click ── */
  const handleBgClick = () => {
    if (state.mode === 'structure') {
      dispatch({ type: 'DRILL_HOME' });
    }
  };

  return (
    <div className="canvas-area" ref={canvasAreaRef} onClick={handleBgClick}>
      <div className="canvas-container">
        <div
          className="floor-plan"
          ref={planRef}
          style={{
            width: w,
            height: h,
            transform: `scale(${state.zoom})`,
            backgroundImage: state.mode === 'structure' ? 'radial-gradient(rgba(255,255,255,0.1) 1px, transparent 1px)' : 'none',
            backgroundSize: `${SCALE}px ${SCALE}px`
          }}
        >
          {/* Zones */}
          {state.zones.map((z) => (
            <div
              key={z.id}
              className="zone-block"
              style={{
                left: z.x * SCALE,
                top: z.y * SCALE,
                width: z.w * SCALE,
                height: z.h * SCALE,
                transform: `rotate(${z.rotation || 0}deg)`,
                borderColor: z.color,
                color: z.color,
                background: `${z.color}11`,
              }}
              onPointerDown={(e) => handlePointerDown(e, z, 'zone')}
            >
              <span className="zone-block__icon">{z.icon}</span>
              <span className="zone-block__label">{z.label}</span>
              {z.locked && <span className="lock-badge">🔒</span>}
            </div>
          ))}

          {/* Sections */}
          {state.sections.map((sec) => {
            const items = totalItems(sec.id);
            const isSelected = state.selectedSectionId === sec.id;
            const isDraggable = state.mode === 'structure' && !sec.locked;
            const isEditing = state.mode === 'structure' && isSelected;

            return (
              <div
                key={sec.id}
                className={[
                  'section-block',
                  isSelected && 'section-block--selected',
                  isDraggable && 'section-block--draggable',
                  isEditing && 'section-block--editing',
                ].filter(Boolean).join(' ')}
                style={{
                  left: sec.x * SCALE,
                  top: sec.y * SCALE,
                  width: sec.w * SCALE,
                  height: sec.h * SCALE,
                  background: sec.color,
                  transform: `rotate(${sec.rotation || 0}deg)`
                }}
                onPointerDown={(e) => handlePointerDown(e, sec, 'section')}
                onClick={(e) => handleClick(e, sec.id)}
              >
                <span className="section-block__number">{sec.number}</span>
                {/* Prefer the descriptive category over the bare "Section N" label.
                    For user-created sections without a desc, fall back to label. */}
                <span className="section-block__label">{sec.desc || sec.label}</span>
                {items > 0 && <span className="section-block__badge">{items} art.</span>}
                {sec.locked && <span className="lock-badge">🔒</span>}

                {/* Resize handles \u2014 Word/Figma layout: 4 corners (free 2D resize) +
                    4 edges (1D resize) + rotation handle. The reducer dispatch
                    in `handlePointerDown` already supports `n`/`s`/`e`/`w`/`ne`/etc.
                    via string-includes (see the resize math near line 94). */}
                {isEditing && !sec.locked && (
                  <>
                    {/* Corners */}
                    <div className="resize-handle resize-handle--nw" onPointerDown={(e) => handlePointerDown(e, sec, 'section', 'nw')} />
                    <div className="resize-handle resize-handle--ne" onPointerDown={(e) => handlePointerDown(e, sec, 'section', 'ne')} />
                    <div className="resize-handle resize-handle--sw" onPointerDown={(e) => handlePointerDown(e, sec, 'section', 'sw')} />
                    <div className="resize-handle resize-handle--se" onPointerDown={(e) => handlePointerDown(e, sec, 'section', 'se')} />
                    {/* Edges (1D resize) */}
                    <div className="resize-handle resize-handle--n" onPointerDown={(e) => handlePointerDown(e, sec, 'section', 'n')} />
                    <div className="resize-handle resize-handle--s" onPointerDown={(e) => handlePointerDown(e, sec, 'section', 's')} />
                    <div className="resize-handle resize-handle--e" onPointerDown={(e) => handlePointerDown(e, sec, 'section', 'e')} />
                    <div className="resize-handle resize-handle--w" onPointerDown={(e) => handlePointerDown(e, sec, 'section', 'w')} />
                    {/* Rotation handle (above the section) */}
                    <div
                      className="resize-handle resize-handle--rotate"
                      onPointerDown={(e) => handlePointerDown(e, sec, 'section', 'rotate')}
                      title="Tourner"
                    >
                      ⟳
                    </div>
                  </>
                )}
              </div>
            );
          })}

          {/* Sprint E.2 — live dimension badge. Mounted only while a drag /
              resize / rotate gesture is in flight. Pinned in screen-space
              (no rotate transform) so it stays readable on rotated sections. */}
          {dragInfo && (() => {
            const sec = state.sections.find((s) => s.id === dragInfo.id);
            if (!sec) return null;
            let label: string;
            if (dragInfo.type === 'move') {
              label = `${sec.x.toFixed(1)} m, ${sec.y.toFixed(1)} m`;
            } else if (dragInfo.type === 'rotate') {
              label = `${sec.rotation ?? 0}°`;
            } else {
              label = `${sec.w.toFixed(1)} m × ${sec.h.toFixed(1)} m`;
            }
            return (
              <div
                className="dim-badge"
                style={{
                  left: (sec.x + sec.w / 2) * SCALE,
                  top: sec.y * SCALE - 38,
                }}
              >
                {label}
              </div>
            );
          })()}

          <div className="front-label">ENTRÉE</div>
        </div>
      </div>

      {/* Zoom Controls */}
      <div className="zoom-controls">
        <button className="zoom-btn" onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SET_ZOOM', zoom: Math.min(2.5, state.zoom + 0.15) }); }}>+</button>
        <div className="zoom-level">{Math.round(state.zoom * 100)}%</div>
        <button className="zoom-btn" onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SET_ZOOM', zoom: Math.max(0.4, state.zoom - 0.15) }); }}>−</button>
        <button className="zoom-btn" onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SET_ZOOM', zoom: 1 }); }} title="Réinitialiser">⌂</button>
      </div>
    </div>
  );
}
