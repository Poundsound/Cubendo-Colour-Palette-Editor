import { useState } from 'react';
import { getColorName } from '../utils/colorUtils';

export function SwatchDisplay({
  id,
  color,
  showColorNames = false,
  onRemove,
  onCopy,
  copied,
  onSwatchClick,
  selected,
  isDragging,
  isHoverTarget,
  isRowDragging = false,
  canDrag = true,
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      data-swatch-id={id}
      className="sortable-item"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 4,
        position: 'relative',
        outline: selected ? '2px solid #ff4d4d' : 'none',
        outlineOffset: 0,
        pointerEvents: isDragging ? 'none' : 'auto',
        opacity: isDragging ? 0.2 : 1,
        cursor: canDrag ? 'grab' : 'default',
        touchAction: 'none',
      }}
      tabIndex={0}
      aria-label={`Color swatch ${color}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onSwatchClick(id, e);
        }
      }}
      onDoubleClick={(e) => onSwatchClick(id, e)}
      onMouseEnter={() => !isDragging && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        style={{
          width: '100%',
          aspectRatio: '1',
          background: color,
          borderRadius: 8,
          border: isHovered && !isDragging ? '2px solid #4a9eff' : '2px solid #222',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          boxShadow: isHovered && !isDragging ? '0 4px 12px #0009' : '0 1px 6px #0006',
          cursor: canDrag ? (isDragging ? 'grabbing' : 'grab') : 'default',
          transition: isDragging ? 'none' : 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'visible',
          transform: isHovered && !isDragging ? 'scale(1.05)' : 'scale(1)',
          animation: isHoverTarget
            ? 'swatchPulse 600ms ease-in-out infinite'
            : (isRowDragging ? 'rowSwatchPulse 600ms ease-in-out infinite' : 'none'),
          transformOrigin: 'center',
          willChange: isHoverTarget ? 'transform' : 'auto',
        }}
        title="Double-click to edit, click and hold to reorder"
      >
        <button
          data-xbtn="1"
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            fontSize: 16,
            background: '#fff',
            border: 'none',
            cursor: 'pointer',
            borderRadius: '50%',
            width: 22,
            height: 22,
            minWidth: 0,
            minHeight: 0,
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px #0002',
            color: '#c00',
            fontWeight: 900,
            zIndex: 30,
            opacity: 0.8,
            transition: 'opacity 0.15s',
            pointerEvents: 'auto',
          }}
          onClick={(e) => {
            e.stopPropagation();
            onRemove(id, e.shiftKey);
          }}
          title="Remove color"
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.8'; }}
        >
          ×
        </button>
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 8,
          boxShadow: 'inset 0 2px 8px #0004',
          pointerEvents: 'none',
        }} />
      </div>
      <span
        data-hex="1"
        style={{
          color: '#1a1a1a',
          background: '#fffef9f0',
          fontSize: 13,
          borderRadius: 0,
          padding: '3px 8px',
          fontWeight: 800,
          letterSpacing: '0.6px',
          boxShadow: '0 1px 4px #0002',
          userSelect: 'all',
          display: 'block',
          textAlign: 'center',
          cursor: 'pointer',
          width: '100%',
          marginTop: 4,
          whiteSpace: 'nowrap',
          fontFamily: showColorNames ? 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' : 'Fira Mono, monospace',
          boxSizing: 'border-box',
        }}
        title={showColorNames ? 'Click to copy color name' : 'Click to copy color code'}
        tabIndex={0}
        onMouseDown={(e) => {
          e.stopPropagation();
          onCopy(id);
        }}
        onClick={(e) => {
          e.stopPropagation();
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            onCopy(id);
          }
        }}
      >
        {copied ? 'Copied!' : (showColorNames ? getColorName(color) : color)}
      </span>
    </div>
  );
}
