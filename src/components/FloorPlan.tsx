import { useRef, useCallback } from 'react';
import { useStore } from '../hooks/useStore';
import { STORE, SCALE } from '../data/storeLayout';
import type { Section, Zone } from '../types/domain';

export default function FloorPlan() {
  const { state, dispatch, totalItems } = useStore();
  const planRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);

  const w = STORE.width * SCALE;
  const h = STORE.height * SCALE;

  /* ── Drag (structure mode only) ──────────────────── */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, block: Section | Zone, kind: 'section' | 'zone') => {
      if (state.mode !== 'structure' || block.locked) return;
      e.preventDefault();
      dragRef.current = { id: block.id, startX: e.clientX, startY: e.clientY, origX: block.x, origY: block.y };

      const onMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const dx = (ev.clientX - dragRef.current.startX) / (SCALE * state.zoom);
        const dy = (ev.clientY - dragRef.current.startY) / (SCALE * state.zoom);
        const nx = Math.round((dragRef.current.origX + dx) * 10) / 10;
        const ny = Math.round((dragRef.current.origY + dy) * 10) / 10;
        if (kind === 'section') dispatch({ type: 'MOVE_SECTION', id: dragRef.current.id, x: nx, y: ny });
        else dispatch({ type: 'MOVE_ZONE', id: dragRef.current.id, x: nx, y: ny });
      };
      const onUp = () => {
        dragRef.current = null;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [state.mode, state.zoom, dispatch],
  );

  /* ── Click (inventory mode → drill down) ─────────── */
  const handleClick = useCallback(
    (sectionId: string) => {
      if (state.mode === 'inventory') {
        dispatch({ type: 'SELECT_SECTION', id: sectionId });
      }
    },
    [state.mode, dispatch],
  );

  /* ── Zoom ─────────────────────────────────────────── */
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const newZoom = Math.min(2.5, Math.max(0.4, state.zoom - e.deltaY * 0.001));
      dispatch({ type: 'SET_ZOOM', zoom: newZoom });
    },
    [state.zoom, dispatch],
  );

  return (
    <div className="canvas-area" onWheel={handleWheel}>
      <div className="canvas-container">
        <div
          className="floor-plan"
          ref={planRef}
          style={{
            width: w,
            height: h,
            transform: `scale(${state.zoom})`,
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
                borderColor: z.color,
                color: z.color,
                background: `${z.color}11`,
              }}
              onMouseDown={(e) => handleMouseDown(e, z, 'zone')}
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

            return (
              <div
                key={sec.id}
                className={[
                  'section-block',
                  isSelected && 'section-block--selected',
                  isDraggable && 'section-block--draggable',
                  state.mode === 'structure' && isSelected && 'section-block--editing',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{
                  left: sec.x * SCALE,
                  top: sec.y * SCALE,
                  width: sec.w * SCALE,
                  height: sec.h * SCALE,
                  background: sec.color,
                }}
                onMouseDown={(e) => handleMouseDown(e, sec, 'section')}
                onClick={() => handleClick(sec.id)}
              >
                <span className="section-block__number">{sec.number}</span>
                <span className="section-block__label">{sec.label}</span>
                {items > 0 && <span className="section-block__badge">{items} art.</span>}
                {sec.locked && <span className="lock-badge">🔒</span>}
              </div>
            );
          })}

          <div className="front-label">ENTRÉE</div>
        </div>
      </div>

      {/* Zoom Controls */}
      <div className="zoom-controls">
        <button className="zoom-btn" onClick={() => dispatch({ type: 'SET_ZOOM', zoom: Math.min(2.5, state.zoom + 0.15) })}>+</button>
        <div className="zoom-level">{Math.round(state.zoom * 100)}%</div>
        <button className="zoom-btn" onClick={() => dispatch({ type: 'SET_ZOOM', zoom: Math.max(0.4, state.zoom - 0.15) })}>−</button>
        <button className="zoom-btn" onClick={() => dispatch({ type: 'SET_ZOOM', zoom: 1 })} title="Réinitialiser">⌂</button>
      </div>
    </div>
  );
}
