import { useState, useEffect, useCallback, useRef, useLayoutEffect, useMemo } from 'react';
import './App.css';
import { saveAs } from 'file-saver';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { DndProvider, useDrag, useDrop, useDragLayer } from 'react-dnd';
import { HTML5Backend, getEmptyImage } from 'react-dnd-html5-backend';
import { v4 as uuidv4 } from 'uuid';
import { parseDefaultsXml, extractEventColors, updateEventColors } from './utils/cubaseXml';
import { FileIcon, FolderIcon, BulbIcon } from './components/Icons';
import LogoCubendo from './logo/Logo_Cubendo.svg';
import { ImportIcon, ExportIcon, BackupIcon, AddIcon, EyedropperIcon, PresetsIcon, SaveIcon, LoadIcon, TrashIcon, UndoIcon, RedoIcon, SwatchModeIcon, RowModeIcon, ChevronLeftIcon, ChevronRightIcon } from './icons';

const MAX_PALETTE_COLORS = 128;
const COPY_ERROR_MESSAGE = 'Unable to copy colour to the clipboard. Please copy it manually.';
const PREVIEW_SWATCH_LIMIT = 128;
const DND_ITEM_TYPES = {
  SWATCH: 'SWATCH',
};

const PRESET_CARD_BODY_WIDTH = 168;

const SOCIAL_ICON_RENDERERS = {
  youtube: () => (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <path
        d="M10 4c-3.3 0-5.9.3-6.8.4-.8.1-1.4.7-1.6 1.5C1.4 7 1.2 8.5 1.2 10s.2 3 .4 3.9c.2.8.8 1.4 1.6 1.5.9.1 3.5.4 6.8.4s5.9-.3 6.8-.4c.8-.1 1.4-.7 1.6-1.5.2-.9.4-2.4.4-3.9s-.2-3-.4-3.9c-.2-.8-.8-1.4-1.6-1.5C15.9 4.3 13.3 4 10 4Zm-2 4.5 5 3-5 3v-6Z"
        fill="currentColor"
      />
    </svg>
  ),
  globe: () => (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <path
        d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm5.53 7h-2.36c-.19-1.57-.72-3.05-1.54-4.25A6.02 6.02 0 0 1 15.53 9ZM10 3.5c.46 0 1.58 1.36 2.05 3.5H7.95C8.42 4.86 9.54 3.5 10 3.5ZM7.3 9h5.4c.07.5.1 1 .1 1.5 0 .5-.03 1-.1 1.5H7.3A15.8 15.8 0 0 1 7.2 10.5c0-.5.03-1 .1-1.5ZM4.47 11h2.36c.19 1.57.72 3.05 1.54 4.25A6.02 6.02 0 0 1 4.47 11Zm2.36-2H4.47A6.02 6.02 0 0 1 8.37 4.75C7.55 5.95 7.02 7.43 6.83 9Zm2.12 7.5c-.46 0-1.58-1.36-2.05-3.5h4.1c-.47 2.14-1.59 3.5-2.05 3.5Zm1.86-1.25c.82-1.2 1.35-2.68 1.54-4.25h2.36a6.02 6.02 0 0 1-3.9 4.25Z"
        fill="currentColor"
      />
    </svg>
  ),
};

const CURATED_PRESET_META = {
  'cpe-preset-poundsound': {
    title: 'PoundSound',
    subtitle: 'Custom colour palette',
    socialLinks: [
      {
        icon: 'youtube',
        label: 'YouTube',
        url: 'https://youtube.com/@poundsound?si=XLQiDHDwN_90E1Vn',
      },
      {
        icon: 'globe',
        label: 'Website',
        url: 'https://www.poundsound.uk',
      },
    ],
  },
  'cpe-preset-jason-graves': {
    title: 'Jason Graves',
    subtitle: 'Award winning composer',
    socialLinks: [
      {
        icon: 'youtube',
        label: 'YouTube',
        url: 'https://www.youtube.com/@JasonGravesMusic'
      },
      {
        icon: 'globe',
        label: 'Website',
        url: 'https://jasongraves.com/'
      }
    ],
  },
};

function hslToHex(h, s, l) {
  const hue = ((h % 360) + 360) % 360;
  const sat = Math.max(0, Math.min(1, s));
  const light = Math.max(0, Math.min(1, l));

  if (sat === 0) {
    const value = Math.round(light * 255);
    const channel = value.toString(16).padStart(2, '0');
    return `#${channel}${channel}${channel}`.toUpperCase();
  }

  const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat;
  const p = 2 * light - q;
  const hueToChannel = (t) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const r = hueToChannel(hue / 360 + 1 / 3);
  const g = hueToChannel(hue / 360);
  const b = hueToChannel(hue / 360 - 1 / 3);

  const toHex = (val) => Math.round(val * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

const randomHex = () => `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0').toUpperCase()}`;

const clamp01 = (value) => Math.max(0, Math.min(1, value));

function hexToHsl(hex) {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return [0, 0, 0];

  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === r) {
      h = ((g - b) / delta) % 6;
    } else if (max === g) {
      h = (b - r) / delta + 2;
    } else {
      h = (r - g) / delta + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  return [h, s, l];
}

function isAchromatic(hex) {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return r === g && g === b;
}

function getColorName(hex) {
  const [h, s, l] = hexToHsl(hex);
  if (Number.isNaN(l)) return hex.toUpperCase();

  if (s <= 0.08) {
    if (l <= 0.08) return 'Black';
    if (l <= 0.2) return 'Charcoal Grey';
    if (l <= 0.35) return 'Dark Grey';
    if (l <= 0.6) return 'Mid Grey';
    if (l <= 0.8) return 'Light Grey';
    return 'Near White';
  }

  const familyLabels = {
    red: 'Red',
    orange: 'Orange',
    yellow: 'Yellow',
    green: 'Green',
    cyan: 'Teal',
    blue: 'Blue',
    magenta: 'Magenta',
    grey: 'Grey',
  };

  const family = getHueFamily(h);
  const base = familyLabels[family] || 'Color';

  let prefix = '';
  if (l <= 0.2) prefix = 'Deep ';
  else if (l <= 0.35) prefix = 'Dark ';
  else if (l >= 0.78) prefix = 'Bright ';
  else if (l >= 0.65) prefix = 'Light ';

  if (s >= 0.78 && l >= 0.35 && l <= 0.7) {
    prefix = prefix || 'Vivid ';
  }

  return `${prefix}${base}`.trim();
}

function DraggableSwatchGrid({
  id,
  color,
  index,
  onRemove,
  onCopy,
  copied,
  onSwatchClick,
  selected,
  moveColor,
  draggingItemId,
  setDraggingItemId,
  onDragEnd,
  canDrag = true,
  showColorNames = false,
}) {
  const ref = useRef(null);

  const [{ isDragging }, drag, dragPreview] = useDrag(() => ({
    type: 'SWATCH_GRID',
    item: () => {
      setDraggingItemId(id);
      return { id, index };
    },
    canDrag: () => !!canDrag,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    end: () => {
      setDraggingItemId(null);
      onDragEnd();
    },
  }), [id, index, setDraggingItemId, onDragEnd, canDrag]);

  useEffect(() => {
    dragPreview(getEmptyImage(), { captureDraggingState: true });
  }, [dragPreview]);

  const [{ isOver, canDrop }, drop] = useDrop({
    accept: 'SWATCH_GRID',
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
    hover: (item) => {
      if (!ref.current) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;

      moveColor(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });

  drag(drop(ref));

  const isActiveDrag = isDragging || draggingItemId === id;

  return (
    <div
      ref={ref}
      style={{
        opacity: isActiveDrag ? 0.4 : 1,
        cursor: canDrag ? (isActiveDrag ? 'grabbing' : 'grab') : 'default',
        position: 'relative',
      }}
    >
      <SwatchDisplay
        id={id}
        color={color}
        showColorNames={showColorNames}
        onRemove={onRemove}
        onCopy={onCopy}
        copied={copied}
        onSwatchClick={onSwatchClick}
        selected={selected}
        isDragging={isActiveDrag}
        isHoverTarget={!isActiveDrag && isOver && canDrop}
        isRowDragging={false}
        canDrag={canDrag}
      />
    </div>
  );
}

function SwatchDisplay({
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

// Row component using @hello-pangea/dnd's Draggable
// Row component with drag handle for row-level reordering
function DraggableRow({ rowIndex, rowId, colors, onSwatchClick, handleRemoveColor, onCopyColor, copiedIndex, columns, canDrag, showColorNames = false }) {
  return (
    <Draggable draggableId={rowId} index={rowIndex} type="ROW" isDragDisabled={!canDrag}>
      {(provided, snapshot) => {
        const style = {
          ...provided.draggableProps.style,
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        };
        
        if (snapshot.isDragging) {
          style.background = '#252525';
          style.borderRadius = '8px';
          style.padding = '4px';
          style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.5)';
          style.animation = 'rowPulse 700ms ease-in-out infinite';
          style.willChange = 'background-color, box-shadow';
        }
        
        return (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`sortable-row ${snapshot.isDragging ? 'dragging' : ''}`}
          style={style}
        >
          {/* Drag handle button */}
          <div
            {...provided.dragHandleProps}
            style={{
              cursor: canDrag ? 'grab' : 'not-allowed',
              padding: '8px',
              background: canDrag ? '#2a2a2a' : '#3a1f1f',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              color: canDrag ? '#888' : '#ff7777',
              fontWeight: 900,
              userSelect: 'none',
              flexShrink: 0,
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!canDrag) return;
              e.currentTarget.style.background = '#333';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              if (!canDrag) return;
              e.currentTarget.style.background = '#2a2a2a';
              e.currentTarget.style.color = '#888';
            }}
            title={canDrag ? 'Drag to reorder entire row' : 'Add more colors to drag this row'}
          >
            {canDrag ? '⋮⋮' : '✕'}
          </div>
          {/* Row grid - NOT draggable individually when in row mode */}
          <div style={{ 
            flex: 1,
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            gap: 8,
          }}>
              {colors.map((c) => (
              <SwatchDisplay
                key={c.id}
                id={c.id}
                color={c.color}
                  showColorNames={showColorNames}
                onRemove={handleRemoveColor}
                onCopy={onCopyColor}
                copied={copiedIndex === c.id}
                onSwatchClick={onSwatchClick}
                selected={false}
                isDragging={false}
                isRowDragging={snapshot.isDragging}
              />
            ))}
          </div>
        </div>
        );
      }}
    </Draggable>
  );
}

function CustomDragLayer({ colors }) {
  const { isDragging, item, currentOffset } = useDragLayer((monitor) => ({
    isDragging: monitor.isDragging(),
    item: monitor.getItem(),
    currentOffset: monitor.getClientOffset(),
  }));

  if (!isDragging || !item || !currentOffset) {
    return null;
  }

  const active = (item.index != null && colors[item.index]) || colors.find((entry) => entry.id === item.id);
  const hex = active ? active.color : '#000000';

  const size = 64;
  const x = currentOffset.x - size / 2;
  const y = currentOffset.y - size / 2;

  return (
    <div style={{ position: 'fixed', pointerEvents: 'none', inset: 0, zIndex: 1500 }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          transform: `translate(${x}px, ${y}px)`,
        }}
      >
        <div
          style={{
            width: size,
            height: size,
            borderRadius: 8,
            border: '2px solid #4a9eff',
            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.4)',
            background: hex,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        />
      </div>
    </div>
  );
}

function getHueFamily(h) {
  // h: 0-360, returns a string family
  if (h === null || isNaN(h)) return 'grey';
  if (h < 15 || h >= 345) return 'red';
  if (h < 45) return 'orange';
  if (h < 70) return 'yellow';
  if (h < 170) return 'green';
  if (h < 200) return 'cyan';
  if (h < 260) return 'blue';
  if (h < 320) return 'magenta';
  return 'red';
}

// --- Palette Balancer ---
function balancePaletteIteration(colors, options = {}) {
  const { preserveSaturation = false } = options;
  if (!colors.length) return colors;
  // Convert all to HSL and assign family
  const hslArr = colors.map(c => {
    if (isAchromatic(c.color)) {
      return { ...c, h: null, s: 0, l: hexToHsl(c.color)[2], family: 'grey' };
    }
    const [h, s, l] = hexToHsl(c.color);
    return { ...c, h, s, l, family: getHueFamily(h) };
  });
  // Group by family
  const families = {};
  hslArr.forEach(c => {
    if (!families[c.family]) families[c.family] = [];
    families[c.family].push(c);
  });
  // Balance each family
  let balanced = [];
  const SATURATION_BOOST = preserveSaturation ? 1 : 1.15; // Boost factor for chromatic colors
  for (const fam in families) {
    const group = families[fam];
    // Sort by lightness (darkest to lightest)
    const sorted = [...group].sort((a, b) => a.l - b.l);
    const n = sorted.length;
    if (n <= 2) {
      balanced = balanced.concat(sorted);
      continue;
    }
    const first = sorted[0];
    const last = sorted[n - 1];
    for (let i = 0; i < n; i++) {
      const orig = sorted[i];
      if (i === 0 || i === n - 1) {
        balanced.push(orig);
      } else {
        const t = i / (n - 1);
        if (fam === 'grey') {
          // Only interpolate lightness
          const l = first.l + (last.l - first.l) * t;
          balanced.push({ ...orig, color: hslToHex(0, 0, l) });
        } else {
          // For chromatic: keep hue, adjust saturation/lightness depending on mode
          const baseLightness = first.l + (last.l - first.l) * t;

          if (preserveSaturation) {
            const pastelCeiling = 0.55;
            const pastelPull = 0.7;
            const lowSatDampen = 0.94;
            const pastelLightAnchor = 0.68;
            const pastelLightBlend = 0.35;

            const clampTarget = Math.min(orig.s, pastelCeiling);
            const blendedS = orig.s + (clampTarget - orig.s) * pastelPull;
            const softenedS = orig.s < 0.22 ? orig.s * lowSatDampen : blendedS;
            const adjustedS = clamp01(softenedS);

            const adjustedL = clamp01(baseLightness + (pastelLightAnchor - baseLightness) * pastelLightBlend);

            balanced.push({ ...orig, color: hslToHex(orig.h, adjustedS, adjustedL) });
          } else {
            const boostedS = Math.min(1, orig.s * SATURATION_BOOST);
            balanced.push({ ...orig, color: hslToHex(orig.h, boostedS, baseLightness) });
          }
        }
      }
    }
  }
  // Restore original order by id
  const idToColor = Object.fromEntries(balanced.map(({ id, color }) => [id, color]));
  return colors.map(({ id }) => ({ id, color: idToColor[id] }));
}

function calculateHarmonyScore(colors) {
  if (!colors.length) return 0;

  const groups = {};
  colors.forEach((entry) => {
    const { color } = entry;
    if (isAchromatic(color)) {
      const [, , l] = hexToHsl(color);
      groups.grey = groups.grey || [];
      groups.grey.push({ l, h: null, s: 0 });
      return;
    }
    const [h, s, l] = hexToHsl(color);
    const family = getHueFamily(h);
    groups[family] = groups[family] || [];
    groups[family].push({ h, s, l });
  });

  let weightedScore = 0;
  let weightTotal = 0;

  Object.values(groups).forEach((bucket) => {
    const size = bucket.length;
    if (size === 0) return;
    if (size === 1) {
      weightedScore += 100;
      weightTotal += 1;
      return;
    }

    const sortedByLightness = [...bucket].sort((a, b) => a.l - b.l);
    const minL = sortedByLightness[0].l;
    const maxL = sortedByLightness[size - 1].l;
    const range = Math.max(0.0001, maxL - minL);
    const idealStep = range / (size - 1);

    let lightnessDeviation = 0;
    sortedByLightness.forEach((entry, idx) => {
      const expected = minL + idealStep * idx;
      lightnessDeviation += Math.abs(entry.l - expected);
    });

    const normalizedLightness = lightnessDeviation / (size * range);

    const avgSat = sortedByLightness.reduce((sum, entry) => sum + entry.s, 0) / size;
    const satSpread = sortedByLightness.reduce((sum, entry) => sum + Math.abs(entry.s - avgSat), 0) / size;
    const normalizedSat = satSpread / Math.max(0.0001, avgSat || 1);

    const rawScore = 100
      - Math.min(100, normalizedLightness * 120)
      - Math.min(25, normalizedSat * 25);

    weightedScore += Math.max(0, rawScore) * size;
    weightTotal += size;
  });

  return weightTotal ? weightedScore / weightTotal : 0;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const clonePalette = (palette) => palette.map((entry) => ({ ...entry }));

function BalanceModeToggle({ isGentle, onToggle, disabled, isBalancing }) {
  const knobLeft = isGentle ? 40 : 4;
  const knobColor = isGentle ? '#f2994a' : '#2ecc71';
  const borderColor = isGentle ? '#3a3a3a' : '#3a3a3a';
  const baseBackground = '#1f1f1f';
  const hoverBackground = '#262626';
  const [background, setBackground] = useState(baseBackground);

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isGentle}
      disabled={disabled}
      title={isGentle ? 'Switch back to harmonise mode' : 'Switch to pastelise mode to preserve saturation'}
      style={{
        width: 72,
        height: 32,
        borderRadius: 999,
        border: `1px solid ${borderColor}`,
        background,
        position: 'relative',
        padding: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'background 0.2s ease',
        outline: 'none',
      }}
      onMouseEnter={() => {
        if (disabled) return;
        setBackground(hoverBackground);
      }}
      onMouseLeave={() => {
        setBackground(baseBackground);
      }}
      onFocus={() => {
        if (disabled) return;
        setBackground(hoverBackground);
      }}
      onBlur={() => setBackground(baseBackground)}
      aria-label={isGentle ? 'Gentle pastelise mode selected. Activate to switch to harmonise.' : 'Harmonise mode selected. Activate to switch to pastelise.'}
    >
      <span
        style={{
          position: 'absolute',
          top: 4,
          left: knobLeft,
          width: 28,
          height: 24,
          borderRadius: 999,
          background: knobColor,
          boxShadow: '0 4px 10px rgba(0,0,0,0.25)',
          transition: 'left 0.2s ease, background 0.2s ease',
        }}
      />
      <span
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 6px',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2ecc71', opacity: isGentle ? 0.28 : 0.8, transition: 'opacity 0.2s ease' }} />
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f2994a', opacity: isGentle ? 0.8 : 0.28, transition: 'opacity 0.2s ease' }} />
      </span>
      {isBalancing && (
        <span
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 999,
            border: '2px solid rgba(255,255,255,0.15)',
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        />
      )}
    </button>
  );
}

function palettesEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].id !== b[i].id) return false;
    if (a[i].color !== b[i].color) return false;
  }
  return true;
}

export default function App() {
  const [colors, setColors] = useState([]); // [{id, color}]
  const [xmlDoc, setXmlDoc] = useState(null);
  const [error, setError] = useState('');
  const [gradientStart, setGradientStart] = useState('#000000');
  const [gradientEndPct, setGradientEndPct] = useState(60); // 0-100, default 60%
  const [gradientSteps, setGradientSteps] = useState(8);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const copyTimeoutRef = useRef(null);
  const [gradientSaturation, setGradientSaturation] = useState(1.0);
  const [editingSat, setEditingSat] = useState(false);
  const [editingEnd, setEditingEnd] = useState(false);
  const [eyedropper, setEyedropper] = useState(null);
  const [presets, setPresets] = useState([]);
  const [presetName, setPresetName] = useState('');
  const [columns, setColumns] = useState(8);
  const [dragMode, setDragMode] = useState('SWATCH'); // 'SWATCH' or 'ROW'
  const [showHelp, setShowHelp] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showPresetLibrary, setShowPresetLibrary] = useState(false);
  const [curatedPresets, setCuratedPresets] = useState([]);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [pendingXmlFile, setPendingXmlFile] = useState(null);
  const [importModalError, setImportModalError] = useState('');
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [hasViewedTerms, setHasViewedTerms] = useState(false);
  const [hasCreatedBackup, setHasCreatedBackup] = useState(false);
  const [hasSkippedBackup, setHasSkippedBackup] = useState(false);
  const [showBackupHelp, setShowBackupHelp] = useState(false);
  const [hasViewedBackupHelp, setHasViewedBackupHelp] = useState(false);
  const [needsBackupConfirm, setNeedsBackupConfirm] = useState(false);
  // Toggle for swatch labels: hex codes vs color names
  const [showColorNames, setShowColorNames] = useState(() => {
    try {
      const saved = localStorage.getItem('cpe-show-color-names');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('cpe-show-color-names', JSON.stringify(showColorNames));
    } catch {
      // ignore persistence errors
    }
  }, [showColorNames]);
  const gridRef = useRef(null);
  const mainScrollRef = useRef(null);
  const swatchGridRef = useRef(null); // SWATCH mode grid container
  const [swatchDragReady, setSwatchDragReady] = useState(false);
  const eyedropperActiveRef = useRef(false); // Prevent multiple simultaneous eyedropper instances
  const [isBalancing, setIsBalancing] = useState(false);
  const [balanceProgress, setBalanceProgress] = useState(0);
  const [balanceScore, setBalanceScore] = useState(null);
  const [balanceMode, setBalanceMode] = useState('vibrant'); // 'vibrant' | 'gentle'
  const prevColorCountRef = useRef(0);
  const [originalOrder, setOriginalOrder] = useState(null);
  const balanceSessionRef = useRef(null);
  const paletteAtCapacity = colors.length >= MAX_PALETTE_COLORS;
  const screenPickSupported = useMemo(() => typeof window !== 'undefined' && 'EyeDropper' in window, []);
  const backupDisabled = !pendingXmlFile || !hasAcceptedTerms;
  const importDisabled = !pendingXmlFile || !hasAcceptedTerms || needsBackupConfirm || (!hasCreatedBackup && !hasSkippedBackup);
  // Disable Skip when a backup is already created to avoid conflicting choices
  const skipDisabled = backupDisabled || hasCreatedBackup;
  const importPalette = hasAcceptedTerms
    ? {
        termsBg: '#1f3c24',
        termsBorder: '2px solid rgba(65, 214, 122, 0.6)',
        termsHeading: '#dfffe9',
        termsBody: '#b6f2c6',
        checkboxAccent: '#41d67a',
    successBorder: '#41d67a',
        readButtonBg: '#4d1f20',
        readButtonBorder: '2px solid rgba(240, 91, 91, 0.7)',
        readButtonText: '#ffeaea',
        readButtonHover: '#662828',
        dropBackground: '#1e2f24',
        dropBorder: '3px dashed rgba(65, 214, 122, 0.65)',
        dropTitle: '#f2fff7',
        dropHelper: '#badcc7',
        fileHeading: '#f2fff7',
        fileMeta: '#c5e7d4',
        backupPanelBackground: '#371d1d',
        backupPanelBorder: '3px solid rgba(240, 91, 91, 0.55)',
        createButtonBg: '#8f3a3a',
        createButtonBorder: '3px solid rgba(240, 91, 91, 0.55)',
        createButtonText: '#ffeaea',
        createButtonHover: '#a84545',
        skipButtonBg: '#35332d',
        skipButtonBorder: '3px solid rgba(240, 195, 106, 0.6)',
        skipButtonText: '#ffecc6',
        skipButtonHover: '#424038',
        helpButtonBg: '#4d1f20',
        helpButtonBorder: '3px solid rgba(240, 91, 91, 0.8)',
        helpButtonText: '#ffe0e0',
        helpButtonHover: '#5f2425',
        infoTitle: '#f2fff7',
        infoText: '#cadfcf',
      }
    : {
        termsBg: '#46351a',
        termsBorder: '2px solid rgba(240, 195, 106, 0.65)',
        termsHeading: '#fff3d4',
        termsBody: '#f5d991',
        checkboxAccent: '#f0c36a',
    successBorder: '#41d67a',
        readButtonBg: '#4d1f20',
        readButtonBorder: '2px solid rgba(240, 91, 91, 0.7)',
        readButtonText: '#ffeaea',
        readButtonHover: '#662828',
        dropBackground: '#362a1a',
        dropBorder: '3px dashed rgba(240, 195, 106, 0.65)',
        dropTitle: '#fff3d4',
        dropHelper: '#f1d9a3',
        fileHeading: '#fff3d4',
        fileMeta: '#f1dea9',
        backupPanelBackground: '#371d1d',
        backupPanelBorder: '3px solid rgba(240, 91, 91, 0.55)',
        createButtonBg: '#8f3a3a',
        createButtonBorder: '3px solid rgba(240, 91, 91, 0.55)',
        createButtonText: '#ffeaea',
        createButtonHover: '#a84545',
        skipButtonBg: '#35332d',
        skipButtonBorder: '3px solid rgba(240, 195, 106, 0.6)',
        skipButtonText: '#ffecc6',
        skipButtonHover: '#424038',
        helpButtonBg: '#4d1f20',
        helpButtonBorder: '3px solid rgba(240, 91, 91, 0.8)',
        helpButtonText: '#ffdede',
        helpButtonHover: '#5f2425',
        infoTitle: '#fff3d4',
        infoText: '#f1dea9',
      };

  const hasSelectedXml = Boolean(pendingXmlFile);
  const fileSectionBackground = '#2a2a2a';
  const fileSectionBorder = '1px solid rgba(255,255,255,0.08)';
  const fileSectionHeading = importPalette.fileHeading;
  const fileSectionSubtle = hasSelectedXml ? importPalette.fileMeta : 'rgba(255,255,255,0.6)';
  // Keep the drop zone in yellow theme until a file is loaded
  const fileDropBackground = hasSelectedXml ? '#1e2f24' : '#362a1a';
  const fileDropBorder = hasSelectedXml ? '3px dashed rgba(65, 214, 122, 0.65)' : '3px dashed rgba(240, 195, 106, 0.65)';
  const fileDropTitle = hasSelectedXml ? '#f2fff7' : '#fff3d4';
  const fileDropHelper = hasSelectedXml ? '#badcc7' : '#f1d9a3';
  const termsCheckboxAccent = importPalette.checkboxAccent;
  const termsLabelColor = importPalette.termsHeading;
  const termsInfoColor = importPalette.termsBody;
  const termsCardBackground = importPalette.termsBg;
  const termsCardBorder = importPalette.termsBorder;
  // Backup/Skip panel theming
  const isBackupComplete = hasCreatedBackup === true;
  const isSkipSelected = !isBackupComplete && hasSkippedBackup === true;

  const backupPanelBackground = isBackupComplete
    ? '#1d3326' // green
    : (isSkipSelected ? '#3a2a12' /* orange */ : importPalette.backupPanelBackground /* red */);
  const backupPanelBorder = isBackupComplete
    ? '3px solid rgba(65, 214, 122, 0.65)'
    : (isSkipSelected ? '3px solid rgba(240, 195, 106, 0.65)' : importPalette.backupPanelBorder);
  const backupBodyColor = isBackupComplete ? '#e6fff2' : (isSkipSelected ? '#fff1d6' : '#ffe4e4');
  const backupSubtleText = isBackupComplete ? '#c3f0d5' : (isSkipSelected ? '#ffe3ad' : '#ffc9c9');
  const backupHintBackground = isBackupComplete
    ? 'rgba(65, 214, 122, 0.12)'
    : (isSkipSelected ? 'rgba(240, 195, 106, 0.15)' : 'rgba(240, 91, 91, 0.15)');
  const backupHintBorder = isBackupComplete
    ? '1px solid rgba(65, 214, 122, 0.35)'
    : (isSkipSelected ? '1px solid rgba(240, 195, 106, 0.45)' : '1px solid rgba(240, 91, 91, 0.35)');
  const backupHintText = isBackupComplete ? '#f0fff8' : (isSkipSelected ? '#fff5db' : '#ffecec');
  const termsCardGlow = hasAcceptedTerms ? '0 0 0 3px rgba(65,214,122,0.12)' : '0 0 0 3px rgba(240,195,106,0.12)';
  const readButtonBorder = hasViewedTerms ? '2px solid rgba(65, 214, 122, 0.6)' : importPalette.readButtonBorder;
  const readButtonDefaultBg = hasViewedTerms ? '#245233' : importPalette.readButtonBg;
  const gatedSectionStyle = hasAcceptedTerms
    ? { transition: 'filter 0.25s ease, opacity 0.25s ease' }
    : {
        filter: 'blur(3px)',
        opacity: 0.4,
        pointerEvents: 'none',
        userSelect: 'none',
        transition: 'filter 0.25s ease, opacity 0.25s ease'
      };
  const backupHelpButtonBackground = hasViewedBackupHelp ? '#29583a' : importPalette.helpButtonBg;
  const backupHelpButtonBorder = hasViewedBackupHelp ? '3px solid rgba(65, 214, 122, 0.6)' : importPalette.helpButtonBorder;
  const backupHelpButtonText = hasViewedBackupHelp ? '#f0fff6' : importPalette.helpButtonText;

  const displayedPercentRaw = isBalancing ? balanceProgress : (balanceScore ?? 0);
  const displayedPercent = Math.round(Math.min(100, Math.max(0, displayedPercentRaw)));
  const arcRadius = 52;
  const arcCircumference = 2 * Math.PI * arcRadius;
  const arcDashOffset = arcCircumference * (1 - displayedPercent / 100);

  const isGentleBalance = balanceMode === 'gentle';
  const balanceAccentPrimary = isGentleBalance ? '#f2994a' : '#2ecc71';
  const balanceAccentSecondary = isGentleBalance ? '#f2c94c' : '#27ae60';
  const balanceBackgroundIdle = isGentleBalance ? '#2c1f12' : '#15221b';
  const balanceBackgroundActive = isGentleBalance ? '#3a2816' : '#0f2419';
  const balanceBorder = isGentleBalance ? '#d27a33' : '#285a3d';
  const balanceInnerBackground = isGentleBalance ? '#2d1e12' : '#0f1f17';
  const balanceOuterShadow = isGentleBalance ? '0 8px 20px rgba(120, 60, 20, 0.35)' : '0 8px 20px rgba(12, 40, 26, 0.35)';
  const balanceInnerShadow = isGentleBalance ? '0 10px 20px rgba(120, 60, 20, 0.45)' : '0 10px 20px rgba(10, 32, 22, 0.45)';
  const balanceMeterBackground = isGentleBalance ? '#3d2212' : '#1a3526';
  const balanceStatusColor = isGentleBalance ? (isBalancing ? '#ffd9a3' : '#f2994a') : (isBalancing ? '#7fffb3' : '#2ecc71');
  const balanceButtonText = isGentleBalance ? '#fff3e3' : '#f2fff1';
  const balanceTriangleFill = isGentleBalance ? 'rgba(242, 153, 74, 0.2)' : 'rgba(46,204,113,0.2)';

  const resetBalanceUi = useCallback(() => {
    setIsBalancing(false);
    setBalanceProgress(0);
    setBalanceScore(null);
  }, []);

  const cancelBalance = useCallback(() => {
    const session = balanceSessionRef.current;
    if (session && !session.cancelled) {
      session.cancelled = true;
    }
  }, []);
  
  // Track currently dragging item to apply visual state
  const [draggingItemId, setDraggingItemId] = useState(null);

  // FLIP animation: store previous rects of swatches between renders
  // Removed FLIP bookkeeping in minimal mode

  const createScrollRestorer = useCallback(() => {
    if (dragMode !== 'SWATCH') return null;
    const container = mainScrollRef.current ?? swatchGridRef.current ?? gridRef.current ?? null;
    if (!container) return null;
    const saved = {
      container,
      top: container.scrollTop,
      left: container.scrollLeft,
    };
    const savedWindow = { x: window.scrollX, y: window.scrollY };
    return () => {
      const restore = () => {
        if (saved.container) {
          saved.container.scrollTop = saved.top;
          saved.container.scrollLeft = saved.left;
        } else {
          window.scrollTo(savedWindow.x, savedWindow.y);
        }
      };
      requestAnimationFrame(() => {
        restore();
        requestAnimationFrame(restore);
      });
    };
  }, [dragMode, gridRef, mainScrollRef, swatchGridRef]);

  // Fancy FLIP animations disabled for minimal, robust DnD

  useLayoutEffect(() => {
    const container = gridRef.current;
    if (!container) return;

    const baseMin = typeof window !== 'undefined' ? window.innerHeight * 0.6 : 0;

    if (colors.length === 0) {
      container.style.minHeight = '60vh';
      return;
    }

    if (dragMode === 'SWATCH' && swatchGridRef.current) {
      const gridHeight = swatchGridRef.current.scrollHeight;
      const desired = Math.max(gridHeight + 32, baseMin);
      container.style.minHeight = `${desired}px`;
      return;
    }

    const contentHeight = container.scrollHeight;
    const desired = Math.max(contentHeight, baseMin);
    container.style.minHeight = `${desired}px`;
  }, [colors.length, columns, dragMode]);

  // When entering SWATCH mode, defer enabling dragging until providers/sources mount
  useEffect(() => {
    if (dragMode === 'SWATCH') {
      setSwatchDragReady(false);
      const timer1 = requestAnimationFrame(() => {
        const timer2 = requestAnimationFrame(() => {
          setSwatchDragReady(true);
        });
        return () => cancelAnimationFrame(timer2);
      });
      return () => cancelAnimationFrame(timer1);
    } else {
      setSwatchDragReady(false);
    }
  }, [dragMode]);

  // When colors are first populated (e.g., after XML import) in SWATCH mode, ensure drag is ready
  useEffect(() => {
    const prev = prevColorCountRef.current;
    const curr = colors.length;
    prevColorCountRef.current = curr;
    if (dragMode === 'SWATCH' && prev === 0 && curr > 0) {
      setSwatchDragReady(false);
      const timer1 = requestAnimationFrame(() => {
        const timer2 = requestAnimationFrame(() => {
          setSwatchDragReady(true);
        });
        return () => cancelAnimationFrame(timer2);
      });
      return () => cancelAnimationFrame(timer1);
    }
  }, [colors.length, dragMode]);
  
  // Use ref to track the current order without triggering re-renders
  const dragOrderRef = useRef(colors);
  
  // Update ref when colors change from other sources
  useEffect(() => {
    dragOrderRef.current = colors;
  }, [colors]);

  useEffect(() => {
    if (showImportModal) {
      setHasAcceptedTerms(false);
      setShowTermsModal(false);
      setHasViewedTerms(false);
      setHasCreatedBackup(false);
      setHasSkippedBackup(false);
      setShowBackupHelp(false);
      setHasViewedBackupHelp(false);
      setNeedsBackupConfirm(false);
    }
  }, [showImportModal]);

  // Lock background scroll when the import modal is open and center its content
  useEffect(() => {
    if (!showImportModal) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [showImportModal]);
  
  // React-DND move callback for SWATCH mode (updates ref only during drag)
  const moveColor = useCallback((dragIndex, hoverIndex) => {
    const newColors = [...dragOrderRef.current];
    const [draggedItem] = newColors.splice(dragIndex, 1);
    newColors.splice(hoverIndex, 0, draggedItem);
    dragOrderRef.current = newColors;
    
    // Only update state (trigger re-render) occasionally to show visual feedback
    // But don't update too often to prevent performance issues
  }, []);
  
  // Custom color editor state
  const [colorEditor, setColorEditor] = useState(null); // { id, color, h, s, v } or null
  // Gradient color picker state
  const [gradientEditor, setGradientEditor] = useState(null); // { startH, startS, startV, endH, endS, endV, manualMode } or null
  const [gradientManualEnd, setGradientManualEnd] = useState(false); // Toggle for manual end color
  const [gradientEndColor, setGradientEndColor] = useState('#FFFFFF'); // Manual end color

  // Track if a drag is in progress to prevent color picker popup
  // const [isDragging, setIsDragging] = useState(false);

  // Load presets from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cubase-color-presets');
      if (saved) {
        setPresets(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load presets:', e);
    }
  }, []);

  useEffect(() => {
    try {
      const modules = import.meta.glob('./presets/*.json', {
        eager: true,
        import: 'default',
      });

      const loaded = Object.entries(modules).flatMap(([path, payload]) => {
        const rawColors = Array.isArray(payload)
          ? payload
          : (payload && Array.isArray(payload.colors) ? payload.colors : []);
        if (!rawColors.length) return [];

        const fileName = path.split('/').pop() || 'preset';
        const baseName = fileName.replace(/\.json$/i, '');
        const slug = baseName
          .toString()
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || baseName.toLowerCase();

        if (slug === 'cpe-preset-test') {
          return [];
        }

        const meta = CURATED_PRESET_META[slug] || {};
        const colors = rawColors.map((hex) =>
          typeof hex === 'string' ? hex.trim().toUpperCase() : ''
        ).filter((hex) => /^#[0-9A-F]{6}$/.test(hex));
        if (!colors.length) return [];

        return [{
          id: `curated-${slug}`,
          name: meta.title || baseName,
          description: meta.subtitle || '',
          colors,
          colorCount: colors.length,
          createdAt: null,
          slug,
          metaKey: slug,
          source: 'curated',
          socialLinks: meta.socialLinks || [],
        }];
      });

      setCuratedPresets(loaded);
    } catch (err) {
      console.error('Failed to load curated presets:', err);
    }
  }, []);

  useEffect(() => {
    if (!colors.length) {
      if (originalOrder) setOriginalOrder(null);
      return;
    }
    if (!originalOrder) {
      setOriginalOrder(colors.map((c) => c.id));
    }
  }, [colors, originalOrder]);

  const canRestoreOriginal = useMemo(() => {
    if (!xmlDoc || !originalOrder || originalOrder.length === 0 || colors.length === 0) return false;
    const idSet = new Set(colors.map((c) => c.id));
    return originalOrder.some((id) => idSet.has(id));
  }, [colors, originalOrder, xmlDoc]);

  const presetLibrary = useMemo(() => {
    const unique = new Map();
    [...curatedPresets, ...presets].forEach((preset) => {
      if (!preset || !Array.isArray(preset.colors)) return;
      unique.set(preset.id ?? `${preset.name}-${unique.size}`, preset);
    });
    const ordered = Array.from(unique.values());
    ordered.sort((a, b) => {
      const keyA = (a.metaKey || a.slug || '').toLowerCase();
      const keyB = (b.metaKey || b.slug || '').toLowerCase();
      const isMarcusA = keyA.includes('poundsound');
      const isMarcusB = keyB.includes('poundsound');
      if (isMarcusA && !isMarcusB) return -1;
      if (!isMarcusA && isMarcusB) return 1;
      return 0;
    });
    return ordered;
  }, [curatedPresets, presets]);

  // DnD-kit sensors
  // Sensors removed - @hello-pangea/dnd handles this automatically

  // Add undo/redo state
  const [history, setHistory] = useState([]); // stack of previous color arrays
  const [future, setFuture] = useState([]); // stack of undone color arrays

  // Exit eyedropper on outside click or Escape
  useEffect(() => {
    if (!eyedropper) return;
    const handleDown = e => {
      // If click is outside palette-grid, exit
      if (!e.target.closest('.palette-grid')) setEyedropper(null);
    };
    const handleEsc = e => {
      if (e.key === 'Escape') setEyedropper(null);
    };
    window.addEventListener('mousedown', handleDown);
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('mousedown', handleDown);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [eyedropper]);



  // Helper to push to history (only if changed)
  const pushHistory = useCallback((newColors, options = {}) => {
  const { preserveScroll = false } = options;
  const restoreScroll = preserveScroll ? createScrollRestorer() : null;
    setHistory(h => [...h, clonePalette(colors)]);
    setFuture([]);
    setColors(clonePalette(newColors));
    if (restoreScroll) restoreScroll();
  }, [colors, createScrollRestorer]);

  // Apply the final order when drag ends
  const handleDragEnd = useCallback(() => {
    const finalOrder = dragOrderRef.current;
    setDraggingItemId(null);
    if (!Array.isArray(finalOrder)) return;

    const orderChanged = finalOrder.length !== colors.length || finalOrder.some((item, index) => item.id !== colors[index]?.id);
    if (!orderChanged) return;

    pushHistory(finalOrder.slice(), { preserveScroll: true });
  }, [colors, pushHistory]);

  // Screen pick helper (adds a new swatch)
  const handleScreenPickAddNew = useCallback(() => {
    // Prevent multiple simultaneous eyedropper instances
    if (eyedropperActiveRef.current) {
      console.debug('Eyedropper already active, ignoring...');
      return;
    }

    // Guard conditions
    if (!xmlDoc) {
      console.debug('No XML document loaded');
      return;
    }
    if (colors.length >= MAX_PALETTE_COLORS) {
      setError(`Palette limit reached (${MAX_PALETTE_COLORS}). Remove a color before adding another.`);
      return;
    }
    if (!screenPickSupported) {
      alert('Screen Eyedropper not supported in this browser.');
      return;
    }

    try {
      eyedropperActiveRef.current = true;
      const eye = new window.EyeDropper();
      eye.open()
        .then((result) => {
          if (result && result.sRGBHex) {
            const newHex = result.sRGBHex.toUpperCase();
            const newId = uuidv4();
            scrollTargetIdRef.current = newId;
            pushHistory([...colors, { id: newId, color: newHex }]);
          }
        })
        .catch((err) => {
          if (err && err.name !== 'AbortError') {
            console.debug('Screen pick failed:', err);
          }
        })
        .finally(() => {
          eyedropperActiveRef.current = false;
        });
    } catch (err) {
      eyedropperActiveRef.current = false;
      console.debug('EyeDropper init failed:', err);
    }
  }, [colors, pushHistory, xmlDoc, screenPickSupported]);

  const handleCopyColor = useCallback((id) => {
    const target = colors.find((swatch) => swatch.id === id);
    if (!target) return;
    const hexValue = target.color;

    const markCopied = () => {
      setError((prev) => (prev === COPY_ERROR_MESSAGE ? '' : prev));
      setCopiedIndex(id);
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => {
        setCopiedIndex(null);
        copyTimeoutRef.current = null;
      }, 1500);
    };

    const fallbackCopy = () => {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = hexValue;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        markCopied();
      } catch (fallbackErr) {
        console.error('Clipboard fallback copy failed:', fallbackErr);
        setCopiedIndex(null);
        setError(COPY_ERROR_MESSAGE);
      }
    };

    try {
      const hasClipboardApi = typeof navigator !== 'undefined'
        && navigator.clipboard
        && typeof navigator.clipboard.writeText === 'function';

      if (hasClipboardApi) {
        navigator.clipboard.writeText(hexValue)
          .then(markCopied)
          .catch(() => {
            fallbackCopy();
          });
      } else {
        fallbackCopy();
      }
    } catch (errCopy) {
      console.error('Clipboard copy failed:', errCopy);
      fallbackCopy();
    }
  }, [colors, setError]);

  // After adding new colors, scroll newly added swatch into view if outside viewport
  const scrollTargetIdRef = useRef(null);
  const scrollNewSwatchIntoView = useCallback(() => {
    const id = scrollTargetIdRef.current;
    if (!id) return;
    const el = document.querySelector(`[data-swatch-id="${id}"]`);
    const container = mainScrollRef.current ?? swatchGridRef.current ?? gridRef.current ?? null;
    if (!el || !container) {
      return;
    }
    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const pad = 8;
    const currentTop = container.scrollTop;
    let nextTop = null;
    if (eRect.top < cRect.top + pad) {
      nextTop = currentTop - (cRect.top - eRect.top) - pad;
    } else if (eRect.bottom > cRect.bottom - pad) {
      nextTop = currentTop + (eRect.bottom - cRect.bottom) + pad;
    }
    if (nextTop != null) {
      container.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
    }
    // Briefly highlight the target swatch
    el.classList.add('swatch-added-highlight');
    setTimeout(() => el.classList.remove('swatch-added-highlight'), 900);
    scrollTargetIdRef.current = null;
  }, []);

  useLayoutEffect(() => {
    if (!scrollTargetIdRef.current) return;
    // Wait a frame to ensure DOM nodes are laid out
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => {
        scrollNewSwatchIntoView();
      });
      return () => cancelAnimationFrame(raf2);
    });
    return () => cancelAnimationFrame(raf1);
  }, [colors, scrollNewSwatchIntoView]);

  // Store the latest handler in a ref to avoid re-registering the event listener
  const handleScreenPickRef = useRef(handleScreenPickAddNew);
  useEffect(() => {
    handleScreenPickRef.current = handleScreenPickAddNew;
  }, [handleScreenPickAddNew]);

  // Global shortcut: press 'E' to pick any on-screen color and add as a new swatch
  useEffect(() => {
    const onKey = (e) => {
      // Ignore if typing in an input/textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      
      if (e.key.toLowerCase() === 'e') {
        if (e.repeat) return; // avoid auto-repeat spamming
        e.preventDefault(); // Prevent any default behavior
        handleScreenPickRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []); // Empty deps - only register once

  // Global shortcut: press 'R' to toggle between SWATCH and ROW drag modes
  const toggleDragMode = useCallback(() => {
    // Guard conditions: requires XML loaded and at least one color
    if (!xmlDoc || colors.length === 0) return;
    setDragMode((m) => (m === 'SWATCH' ? 'ROW' : 'SWATCH'));
  }, [xmlDoc, colors.length]);

  const toggleDragModeRef = useRef(toggleDragMode);
  useEffect(() => {
    toggleDragModeRef.current = toggleDragMode;
  }, [toggleDragMode]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        toggleDragModeRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Track desired columns based on container width (responsive breakpoints)
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const computeCols = () => {
      // Always use 8 columns as requested
      setColumns(8);
    };
    computeCols();
    const ro = new ResizeObserver(() => computeCols());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Undo
  const handleUndo = () => {
    if (history.length === 0) return;
    setFuture(f => [clonePalette(colors), ...f]);
    setColors(clonePalette(history[history.length - 1]));
    setHistory(h => h.slice(0, -1));
    resetBalanceUi();
  };

  // Redo
  const handleRedo = () => {
    if (future.length === 0) return;
    setHistory(h => [...h, clonePalette(colors)]);
    setColors(clonePalette(future[0]));
    setFuture(f => f.slice(1));
    resetBalanceUi();
  };

  const closeImportModal = useCallback(() => {
    setShowImportModal(false);
    setPendingXmlFile(null);
    setImportModalError('');
    setHasAcceptedTerms(false);
    setShowTermsModal(false);
    setHasViewedTerms(false);
    setHasCreatedBackup(false);
    setHasSkippedBackup(false);
    setShowBackupHelp(false);
    setHasViewedBackupHelp(false);
  }, []);

  const handleCloseBackupHelp = useCallback(() => {
    setShowBackupHelp(false);
    setHasViewedBackupHelp(true);
  }, []);

  const loadXmlDocumentFromFile = useCallback(async (file) => {
    if (!file) {
      const message = 'No file selected.';
      setImportModalError(message);
      setError(message);
      return false;
    }
    setError('');
    setImportModalError('');
    try {
      const text = await file.text();
      const doc = parseDefaultsXml(text);
      const hexes = extractEventColors(doc);
      if (!hexes) {
        throw new Error('Could not find Event Colors in this Defaults.xml');
      }
      setXmlDoc(doc);
      const imported = hexes
        .slice(0, MAX_PALETTE_COLORS)
        .map(hex => ({ id: uuidv4(), color: hex }));
      setColors(imported);
      setOriginalOrder(imported.map((c) => c.id));
      setHistory([]);
      setFuture([]);
      if (hexes.length > MAX_PALETTE_COLORS) {
        const message = `Imported ${hexes.length} colors but only the first ${MAX_PALETTE_COLORS} were loaded.`;
        setError(message);
        setImportModalError(message);
      }
      return true;
    } catch (err) {
      console.error(err);
      const message = String(err.message || 'Failed to parse XML.');
      setImportModalError(message);
      setError(message);
      return false;
    }
  }, []);

  const handleFileSelection = useCallback((file) => {
    if (!hasAcceptedTerms) {
      setImportModalError('Please acknowledge the terms before choosing a Defaults.xml.');
      setPendingXmlFile(null);
      setHasCreatedBackup(false);
      setHasSkippedBackup(false);
      setShowBackupHelp(false);
      setHasViewedBackupHelp(false);
      setNeedsBackupConfirm(false);
      return;
    }
    if (!file) {
      setImportModalError('No file selected.');
      setPendingXmlFile(null);
      setHasCreatedBackup(false);
      setHasSkippedBackup(false);
      setShowBackupHelp(false);
      setHasViewedBackupHelp(false);
      setNeedsBackupConfirm(false);
      return;
    }
    if (!file.name.toLowerCase().endsWith('.xml')) {
      setImportModalError('Please choose a .xml file.');
      setPendingXmlFile(null);
      setHasCreatedBackup(false);
      setHasSkippedBackup(false);
      setShowBackupHelp(false);
      setHasViewedBackupHelp(false);
      setNeedsBackupConfirm(false);
      return;
    }
    setPendingXmlFile(file);
    setImportModalError('');
    setError('');
    setHasCreatedBackup(false);
    setHasSkippedBackup(false);
    setShowBackupHelp(false);
    setHasViewedBackupHelp(false);
    setNeedsBackupConfirm(false);
  }, [hasAcceptedTerms]);

  const openXmlFileDialog = useCallback(() => {
    if (!hasAcceptedTerms) {
      setImportModalError('Please acknowledge the terms before choosing a Defaults.xml.');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xml';
    input.onchange = (event) => {
      const selected = event.target.files?.[0];
      handleFileSelection(selected);
    };
    input.click();
  }, [handleFileSelection, hasAcceptedTerms]);

  const handleImportPendingXml = useCallback(async () => {
    if (!pendingXmlFile) {
      setImportModalError('Select a Defaults.xml file first.');
      return;
    }
    if (!hasAcceptedTerms) {
      setImportModalError('Please acknowledge the terms before importing.');
      return;
    }
    if (!hasCreatedBackup && !hasSkippedBackup) {
      setImportModalError('Create a backup or choose to skip before importing.');
      return;
    }
    setImportModalError('');
    const success = await loadXmlDocumentFromFile(pendingXmlFile);
    if (success) {
      // Keep pendingXmlFile around so the user can create a backup after import if desired
      closeImportModal();
    }
  }, [closeImportModal, hasAcceptedTerms, hasCreatedBackup, hasSkippedBackup, loadXmlDocumentFromFile, pendingXmlFile]);

  const handleToggleSkipBackup = useCallback(() => {
    if (!pendingXmlFile) {
      setImportModalError('Select a Defaults.xml file first.');
      return;
    }
    if (!hasAcceptedTerms) {
      setImportModalError('Please acknowledge the terms before skipping the backup.');
      return;
    }
    setImportModalError('');
    setHasSkippedBackup((prev) => !prev);
  }, [hasAcceptedTerms, pendingXmlFile]);

  const handleBackupPendingXml = useCallback(() => {
    if (!pendingXmlFile) {
      setImportModalError('Select a Defaults.xml file first.');
      return;
    }
    if (!hasAcceptedTerms) {
      setImportModalError('Please acknowledge the terms before creating a backup.');
      return;
    }
    const doFallbackDownload = () => {
      const baseName = pendingXmlFile.name.replace(/\.xml$/i, '') || 'Defaults';
      const cleaned = baseName.replace(/\s*\(backup\)$/i, '').trim();
      const suggestedName = `${cleaned} (backup).xml`;
      saveAs(pendingXmlFile, suggestedName);
      setNeedsBackupConfirm(true);
      setHasCreatedBackup(false);
      setHasSkippedBackup(false);
      setImportModalError('');
    };

    try {
      const hasFS = typeof window !== 'undefined' && 'showSaveFilePicker' in window;
      if (!hasFS) {
        doFallbackDownload();
        return;
      }

      const baseName = pendingXmlFile.name.replace(/\.xml$/i, '') || 'Defaults';
      const cleaned = baseName.replace(/\s*\(backup\)$/i, '').trim();
      const suggestedName = `${cleaned} (backup).xml`;

      const opts = {
        suggestedName,
        types: [
          {
            description: 'XML file',
            accept: { 'application/xml': ['.xml'] },
          },
        ],
      };

      // @ts-ignore optional browser API
      window.showSaveFilePicker(opts)
        .then(async (handle) => {
          const writable = await handle.createWritable();
          const buf = await pendingXmlFile.arrayBuffer();
          await writable.write(new Blob([buf], { type: 'application/xml' }));
          await writable.close();
          setHasCreatedBackup(true);
          setNeedsBackupConfirm(false);
          setHasSkippedBackup(false);
          setImportModalError('');
        })
        .catch((err) => {
          // User canceled or API error; do not mark as backed up
          const name = (err && err.name) || '';
          if (name === 'AbortError' || name === 'NotAllowedError') {
            setImportModalError('Backup was canceled. No file was saved.');
          } else {
            setImportModalError('Unable to save using this browser. Please use the download option and confirm.');
            doFallbackDownload();
          }
        });
    } catch {
      // Any unexpected error -> fallback
      doFallbackDownload();
    }
  }, [hasAcceptedTerms, pendingXmlFile]);

  // Download updated XML
  const handleDownload = () => {
    if (!xmlDoc) return;
    // Only update Event Colors, leave everything else intact
    const doc = updateEventColors(xmlDoc, colors.map(c => c.color));
    const serializer = new window.XMLSerializer();
    const xml = serializer.serializeToString(doc);
    const blob = new Blob([xml], { type: 'application/xml' });
    saveAs(blob, 'Defaults.xml');
  };

  // Edit a color
  // Remove a color
  const handleRemoveColor = (id, deleteRow = false) => {
    if (!deleteRow) {
      pushHistory(colors.filter(c => c.id !== id));
      return;
    }
    // Delete entire row containing this id
    const idx = colors.findIndex(c => c.id === id);
    if (idx === -1) return;
    const row = Math.floor(idx / columns);
    const start = row * columns;
    const end = Math.min(start + columns, colors.length);
    const remaining = colors.filter((_, i) => i < start || i >= end);
  pushHistory(remaining);
  };

  // Delete all colors - gate behind confirmation modal
  const handleDeleteAll = () => {
    if (colors.length === 0) return;
    setShowDeleteAllConfirm(true);
  };

  const confirmDeleteAll = () => {
    setShowDeleteAllConfirm(false);
    if (colors.length > 0) {
      pushHistory([]);
    }
  };

  const cancelDeleteAll = () => {
    setShowDeleteAllConfirm(false);
  };

  // Add a new color (default black)
  const handleAddColor = () => {
    if (paletteAtCapacity) {
      setError(`Palette limit reached (${MAX_PALETTE_COLORS}). Remove a color before adding another.`);
      return;
    }
    const newId = uuidv4();
    scrollTargetIdRef.current = newId;
    pushHistory([...colors, { id: newId, color: '#000000' }]);
  };

  const handleRandomizePalette = () => {
    if (colors.length === 0) return;
    cancelBalance();
    const randomized = colors.map((swatch) => ({ ...swatch, color: randomHex() }));
    pushHistory(randomized, { preserveScroll: true, skipFlip: true });
    setError('');
    resetBalanceUi();
  };

  // Compute end color based on start color and percentage, clamped so 100% is not pure white
  const MAX_LIGHTEN = 0.7; // 0.7 = 70% toward white at 100%
  const computedGradientEnd = gradientManualEnd 
    ? gradientEndColor 
    : lighten(gradientStart, (gradientEndPct / 100) * MAX_LIGHTEN);
  const gradientControlsLocked = gradientManualEnd;

  const hexToHSV = useCallback((hex) => {
    if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      return { h: 0, s: 0, v: 0 };
    }
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    let h = 0;
    if (delta !== 0) {
      if (max === r) h = ((g - b) / delta) % 6;
      else if (max === g) h = (b - r) / delta + 2;
      else h = (r - g) / delta + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    const s = max === 0 ? 0 : (delta / max) * 100;
    const v = max * 100;
    return { h, s, v };
  }, []);

  const openGradientEditor = useCallback(() => {
    const startHSV = hexToHSV(gradientStart);
    const endHSV = hexToHSV(computedGradientEnd);
    setGradientEditor({
      startH: startHSV.h,
      startS: startHSV.s,
      startV: startHSV.v,
      endH: endHSV.h,
      endS: endHSV.s,
      endV: endHSV.v,
      manualMode: gradientManualEnd,
    });
  }, [computedGradientEnd, gradientManualEnd, gradientStart, hexToHSV]);

  useEffect(() => {
    if (gradientControlsLocked) {
      setEditingSat(false);
      setEditingEnd(false);
    }
  }, [gradientControlsLocked]);

  useEffect(() => {
    if (!gradientEditor || gradientEditor.manualMode) return;
    const nextEnd = hexToHSV(computedGradientEnd);
    const deltaH = Math.abs((gradientEditor.endH ?? 0) - nextEnd.h);
    const deltaS = Math.abs((gradientEditor.endS ?? 0) - nextEnd.s);
    const deltaV = Math.abs((gradientEditor.endV ?? 0) - nextEnd.v);
    if (deltaH < 0.1 && deltaS < 0.1 && deltaV < 0.1) return;
    setGradientEditor(prev => (prev ? { ...prev, endH: nextEnd.h, endS: nextEnd.s, endV: nextEnd.v } : prev));
  }, [computedGradientEnd, gradientEditor, hexToHSV]);

  // Handle drag end for reordering swatches with @hello-pangea/dnd
  const onDragEnd = (result) => {
    const { source, destination, type } = result;
    
    // Dropped outside the list
    if (!destination) return;
    
    // No movement
    if (source.index === destination.index) return;
    
    if (type === 'SWATCH') {
      // Individual swatch drag
      console.log('Swatch drag end - from:', source.index, 'to:', destination.index);
      
      const newColors = Array.from(colors);
      const [removed] = newColors.splice(source.index, 1);
      newColors.splice(destination.index, 0, removed);
      
      pushHistory(newColors);
    } else if (type === 'ROW') {
      // Row drag - move entire row
      console.log('Row drag end - from:', source.index, 'to:', destination.index);
      const rows = [];
      for (let start = 0; start < colors.length; start += columns) {
        const end = Math.min(start + columns, colors.length);
        rows.push(colors.slice(start, end));
      }

      const newRows = [...rows];
      const [movedRow] = newRows.splice(source.index, 1);
      newRows.splice(destination.index, 0, movedRow);

      const firstPartialIndex = newRows.findIndex(row => row.length < columns);
      const hasInvalidPlacement = firstPartialIndex !== -1 && firstPartialIndex !== newRows.length - 1;

      if (hasInvalidPlacement) {
        setError('');
        return;
      }

      const flattened = newRows.reduce((acc, row) => acc.concat(row), []);
      pushHistory(flattened);
    }
  };

  // Helper: lighten a hex color by percent (0-1)
  function lighten(hex, percent) {
    let rgb = hex.replace('#','').match(/.{2}/g).map(x => parseInt(x,16));
    rgb = rgb.map(v => Math.round(v + (255-v)*percent));
    return '#' + rgb.map(x => x.toString(16).padStart(2,'0')).join('').toUpperCase();
  }

  // Apply gradient to colors
  const handleApplyGradient = () => {
    // Use simple RGB interpolation matching the preview
    const gradientColors = [];
    for (let i = 0; i < gradientSteps; i++) {
      const t = i / (gradientSteps - 1);
      const r1 = parseInt(gradientStart.slice(1, 3), 16);
      const g1 = parseInt(gradientStart.slice(3, 5), 16);
      const b1 = parseInt(gradientStart.slice(5, 7), 16);
      const r2 = parseInt(computedGradientEnd.slice(1, 3), 16);
      const g2 = parseInt(computedGradientEnd.slice(3, 5), 16);
      const b2 = parseInt(computedGradientEnd.slice(5, 7), 16);
      const r = Math.round(r1 + (r2 - r1) * t);
      const g = Math.round(g1 + (g2 - g1) * t);
      const b = Math.round(b1 + (b2 - b1) * t);
      gradientColors.push(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase());
    }
    const slotsRemaining = Math.max(0, MAX_PALETTE_COLORS - colors.length);
    if (slotsRemaining === 0) {
      setError(`Palette limit reached (${MAX_PALETTE_COLORS}). Remove a color before adding another.`);
      return;
    }
    const colorsToAdd = gradientColors.slice(0, slotsRemaining).map(hex => ({ id: uuidv4(), color: hex }));
    if (colorsToAdd.length > 0) {
      scrollTargetIdRef.current = colorsToAdd[colorsToAdd.length - 1].id;
    }
    pushHistory([...colors, ...colorsToAdd]);
    if (colorsToAdd.length < gradientColors.length) {
      setError(`Added ${colorsToAdd.length} gradient colors. ${gradientColors.length - colorsToAdd.length} could not be added due to the ${MAX_PALETTE_COLORS} color limit.`);
    }
  };

  // Swatch click handler for eyedropper
  const handleSwatchClick = (id, e) => {
    if (eyedropper) {
      // If in eyedropper mode, copy this swatch's color to target
      if (id !== eyedropper.targetId) {
        const srcColor = colors.find(c => c.id === id)?.color;
        if (srcColor) {
          pushHistory(colors.map(c => c.id === eyedropper.targetId ? { ...c, color: srcColor } : c));
        }
      }
      setEyedropper(null);
      e.stopPropagation();
      return;
    }
    // Note: Shift selection moved to drag handle, not the swatch body
    // Ctrl+click: duplicate swatch next to itself
    if (e.ctrlKey) {
      if (colors.length >= MAX_PALETTE_COLORS) {
        setError(`Palette limit reached (${MAX_PALETTE_COLORS}). Remove a color before duplicating.`);
        e.stopPropagation();
        return;
      }
      const idx = colors.findIndex(c => c.id === id);
      if (idx !== -1) {
        const newColor = { ...colors[idx], id: uuidv4() };
        const newColors = [
          ...colors.slice(0, idx + 1),
          newColor,
          ...colors.slice(idx + 1)
        ];
        pushHistory(newColors);
      }
      e.stopPropagation();
      return;
    }
    // If Alt/Option is held, activate eyedropper
    if (e.altKey || e.getModifierState('AltGraph') || (navigator.platform.includes('Mac') && e.metaKey)) {
      setEyedropper({ targetId: id });
      e.stopPropagation();
      return;
    }
    // Default: open custom color editor
    const currentColor = colors.find(c => c.id === id)?.color;
    if (currentColor) {
      // Calculate HSV from hex
      const r = parseInt(currentColor.slice(1, 3), 16) / 255;
      const g = parseInt(currentColor.slice(3, 5), 16) / 255;
      const b = parseInt(currentColor.slice(5, 7), 16) / 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const delta = max - min;
      let h = 0;
      if (delta !== 0) {
        if (max === r) h = ((g - b) / delta) % 6;
        else if (max === g) h = (b - r) / delta + 2;
        else h = (r - g) / delta + 4;
        h *= 60;
        if (h < 0) h += 360;
      }
      const s = max === 0 ? 0 : (delta / max) * 100;
      const v = max * 100;
      setColorEditor({ id, color: currentColor, h, s, v });
    }
    e.stopPropagation();
  };

  // When user presses a swatch drag handle, allow Shift to select that row
  // Row dragging is now handled by @hello-pangea/dnd - no manual handlers needed

  // Tools: palette transforms and eyedropper controls
  const handleReversePalette = () => {
    if (colors.length < 2) return;
    pushHistory([...colors].reverse(), { skipFlip: true });
  };

  const handleShufflePalette = () => {
    if (colors.length < 2) return;
    const shuffled = [...colors]
      .map(v => ({ v, r: Math.random() }))
      .sort((a, b) => a.r - b.r)
      .map(({ v }) => v);
    pushHistory(shuffled);
  };

  const handleFlipPalette = () => {
    if (colors.length < 2 || columns <= 0) return;
    const mirrored = [];
    for (let start = 0; start < colors.length; start += columns) {
      const row = colors.slice(start, Math.min(start + columns, colors.length));
      mirrored.push(...row.slice().reverse());
    }
    pushHistory(mirrored, { preserveScroll: true, skipFlip: true });
  };

  const handleInvertPalette = () => {
    if (colors.length < 2 || columns <= 0) return;
    const rows = [];
    for (let start = 0; start < colors.length; start += columns) {
      rows.push(colors.slice(start, Math.min(start + columns, colors.length)));
    }
    let inverted = [];
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      inverted = inverted.concat(rows[i]);
    }
    if (inverted.length !== colors.length) {
      inverted = inverted.slice(0, colors.length);
    }
    pushHistory(inverted, { preserveScroll: true, skipFlip: true });
  };

  // Navigate between colors while the color editor is open
  const goToAdjacentSwatch = useCallback((direction) => {
    if (!colorEditor) return;
    const idx = colors.findIndex(c => c.id === colorEditor.id);
    if (idx === -1) return; // Not a swatch (e.g., gradient-start) or no longer present
    const nextIndex = direction === 'prev' ? idx - 1 : idx + 1;
    if (nextIndex < 0 || nextIndex >= colors.length) return;
    const nextSwatch = colors[nextIndex];
    const hsv = hexToHSV(nextSwatch.color);
    setColorEditor({ id: nextSwatch.id, color: nextSwatch.color, h: hsv.h, s: hsv.s, v: hsv.v });
  }, [colorEditor, colors, hexToHSV]);

  // While the color editor is open, allow ArrowLeft/ArrowRight to navigate
  useEffect(() => {
    if (!colorEditor) return;
    const onKey = (e) => {
      const tag = e.target.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable;
      if (isInput) return; // don't hijack when typing or using sliders
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToAdjacentSwatch('prev');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToAdjacentSwatch('next');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [colorEditor, goToAdjacentSwatch]);

  const handleSortByHue = () => {
    const sorted = [...colors].sort((a, b) => {
      const [ha,, la] = hexToHsl(a.color);
      const [hb,, lb] = hexToHsl(b.color);
      if (ha === hb) return la - lb;
      return ha - hb;
    });
    pushHistory(sorted, { skipFlip: true });
  };

  const handleSortBySaturation = () => {
    const sorted = [...colors].sort((a, b) => {
      const [,sa, la] = hexToHsl(a.color);
      const [,sb, lb] = hexToHsl(b.color);
      if (sa === sb) return la - lb;
      return sa - sb;
    });
    pushHistory(sorted, { skipFlip: true });
  };

  const handleSortByLightness = () => {
    const sorted = [...colors].sort((a, b) => {
      const [, , la] = hexToHsl(a.color);
      const [, , lb] = hexToHsl(b.color);
      return la - lb;
    });
    pushHistory(sorted, { skipFlip: true });
  };

  const handleRestoreOriginal = useCallback(() => {
    if (!canRestoreOriginal) return;
    const lookup = new Map(colors.map((swatch) => [swatch.id, swatch]));
    const baseOrder = originalOrder
      .map((id) => lookup.get(id))
      .filter(Boolean);
    if (!baseOrder.length) return;
    const originalIdSet = new Set(originalOrder);
    const extras = colors.filter((swatch) => !originalIdSet.has(swatch.id));
    let reordered = [...baseOrder, ...extras];
    if (reordered.length !== colors.length) {
      // Append any remaining stragglers just in case (should not happen but keeps ids intact)
      const seen = new Set(reordered.map((swatch) => swatch.id));
      colors.forEach((swatch) => {
        if (!seen.has(swatch.id)) {
          reordered.push(swatch);
          seen.add(swatch.id);
        }
      });
    }
    const alreadyOriginal = reordered.length === colors.length && reordered.every((swatch, idx) => swatch.id === colors[idx]?.id);
    if (alreadyOriginal) return;
    pushHistory(reordered, { preserveScroll: true });
  }, [canRestoreOriginal, colors, originalOrder, pushHistory]);

  // Eyedropper button removed with top toolbar; keep Alt-click on swatches and global screen pick (E)

  // Removed focused-swatches screen-pick variant to match new global add-new behavior

  // --- Debugging / dev tools ---
  // Log colors state on change
  useEffect(() => {
    console.log('Colors:', colors);
  }, [colors]);

  useEffect(() => () => {
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = null;
    }
  }, []);

  const handleBalancePalette = useCallback(async () => {
    if (colors.length < 2 || isBalancing) return;

  const originalColors = clonePalette(colors);
    const preserveSaturation = balanceMode === 'gentle';

    const session = { cancelled: false };
    balanceSessionRef.current = session;
    const shouldAbort = () => session.cancelled || balanceSessionRef.current !== session;

    setIsBalancing(true);
    setBalanceProgress(0);
    setBalanceScore(null);

    let cancelled = false;

    try {
  let workingColors = clonePalette(originalColors);
  let bestColors = clonePalette(workingColors);
      let bestScore = calculateHarmonyScore(workingColors);

      const iterations = Math.max(10, Math.min(60, colors.length * 2));

      for (let step = 0; step < iterations; step += 1) {
        if (shouldAbort()) {
          cancelled = true;
          break;
        }

        await sleep(80);

        if (shouldAbort()) {
          cancelled = true;
          break;
        }

        const nextColors = balancePaletteIteration(workingColors, { preserveSaturation });
  workingColors = clonePalette(nextColors);

        if (shouldAbort()) {
          cancelled = true;
          break;
        }

        setColors(workingColors);

        if (shouldAbort()) {
          cancelled = true;
          break;
        }

        const nextScore = calculateHarmonyScore(workingColors);

        if (nextScore >= bestScore - 0.001) {
          bestScore = nextScore;
          bestColors = clonePalette(workingColors);
        }

        const animatedProgress = Math.min(99, Math.round(((step + 1) / iterations) * 100));
        setBalanceProgress(animatedProgress);
        setBalanceScore(Math.round(Math.min(100, nextScore)));

        if (nextScore >= 99.5) {
          if (shouldAbort()) {
            cancelled = true;
            break;
          }
          setBalanceProgress(100);
          break;
        }
      }

      if (cancelled || shouldAbort()) {
        cancelled = true;
        return;
      }

      await sleep(120);

      if (shouldAbort()) {
        cancelled = true;
        return;
      }

      const finalColors = clonePalette(bestColors);
      const changed = !palettesEqual(originalColors, finalColors);

      if (changed) {
        setHistory((prev) => [...prev, clonePalette(originalColors)]);
        setFuture([]);
        setColors(clonePalette(finalColors));
      }

      setBalanceProgress(100);
      setBalanceScore(Math.round(Math.min(100, bestScore)));
    } finally {
      if (balanceSessionRef.current === session) {
        balanceSessionRef.current = null;
      }
      if (cancelled || session.cancelled) {
        setBalanceProgress(0);
        setBalanceScore(null);
      }
      setIsBalancing(false);
    }
  }, [balanceMode, colors, isBalancing, setColors, setFuture, setHistory]);

  // Save current palette as a preset
  const handleSavePreset = () => {
    const trimmed = presetName.trim();
    if (!trimmed || colors.length === 0) return;
    const newPreset = {
      id: uuidv4(),
      name: trimmed,
      description: '',
      colors: colors.map(c => c.color),
      colorCount: colors.length,
      createdAt: new Date().toISOString()
    };
    const updated = [...presets, newPreset];
    setPresets(updated);
    localStorage.setItem('cubase-color-presets', JSON.stringify(updated));
    setPresetName('');
  };

  // Load a preset
  const handleLoadPreset = (preset) => {
    const mapped = preset.colors.map(color => ({ id: uuidv4(), color }));
    const truncated = mapped.slice(0, MAX_PALETTE_COLORS);
    setOriginalOrder(truncated.map((c) => c.id));
    pushHistory(truncated);
    // Reset balance tools/UI when a preset is loaded
    cancelBalance();
    resetBalanceUi();
    if (mapped.length > MAX_PALETTE_COLORS) {
      setError(`Preset contains ${mapped.length} colors. Only the first ${MAX_PALETTE_COLORS} were loaded.`);
    }
  };

  // Delete a preset
  const handleDeletePreset = (presetId) => {
    const updated = presets.filter(p => p.id !== presetId);
    setPresets(updated);
    localStorage.setItem('cubase-color-presets', JSON.stringify(updated));
  };

  // Round-trip test removed per request

  // Create backup
  const handleCreateBackup = () => {
    if (!xmlDoc) {
      alert('Please import a Defaults.xml file first.');
      return;
    }
    const serializer = new window.XMLSerializer();
    const xml = serializer.serializeToString(xmlDoc);
    const blob = new Blob([xml], { type: 'application/xml' });
    saveAs(blob, 'Defaults (backup).xml');
  };

  return (
    <div className="app">
      {/* Header Toolbar */}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Import XML */}
          <button
            onClick={() => setShowImportModal(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#2a2a2a', color: '#fff', border: '1px solid #333', borderRadius: 7, padding: '7px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 13, transition: 'background 0.15s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#333'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#2a2a2a'}
          >
            <ImportIcon />
            Import XML
          </button>

          {/* Create Backup */}
          <button onClick={handleCreateBackup} disabled={!xmlDoc} style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#2a2a2a', color: '#fff', border: '1px solid #333', borderRadius: 7, padding: '7px 14px', fontWeight: 600, fontSize: 13, opacity: !xmlDoc?0.5:1, cursor: !xmlDoc?'not-allowed':'pointer', transition: 'background 0.15s'
          }}
          onMouseEnter={(e) => { if (xmlDoc) e.currentTarget.style.background = '#333'; }}
          onMouseLeave={(e) => { if (xmlDoc) e.currentTarget.style.background = '#2a2a2a'; }}
          >
            <BackupIcon />
            Backup
          </button>

          {/* Export XML */}
          <button onClick={handleDownload} disabled={colors.length===0} style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#2a2a2a', color: '#fff', border: '1px solid #333', borderRadius: 7, padding: '7px 14px', fontWeight: 600, fontSize: 13, opacity: colors.length===0?0.5:1, cursor: colors.length===0?'not-allowed':'pointer', transition: 'background 0.15s'
          }}
          onMouseEnter={(e) => { if (colors.length > 0) e.currentTarget.style.background = '#333'; }}
          onMouseLeave={(e) => { if (colors.length > 0) e.currentTarget.style.background = '#2a2a2a'; }}
          >
            <ExportIcon />
            Export XML
          </button>

          {/* Divider */}
          <div style={{ width: 1, height: 24, background: '#333', margin: '0 4px' }} />

          {/* Label mode toggle: Hex <-> Names */}
          <button
            onClick={() => setShowColorNames(v => !v)}
            title={showColorNames ? 'Showing color names (click to show hex codes)' : 'Showing hex codes (click to show color names)'}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: showColorNames ? '#2f2a1a' : '#2a2a2a',
              color: '#fff', border: '1px solid #333', borderRadius: 7, padding: '7px 12px',
              width: 96,  // fixed width so label switch doesn't shift layout
              cursor: 'pointer', fontWeight: 700, fontSize: 12, letterSpacing: '0.4px', transition: 'background 0.15s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = showColorNames ? '#3a2f1b' : '#333'}
            onMouseLeave={(e) => e.currentTarget.style.background = showColorNames ? '#2f2a1a' : '#2a2a2a'}
            aria-pressed={showColorNames}
          >
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18,
              background: showColorNames ? '#e6c26a' : '#444', color: '#1a1a1a', borderRadius: 4, fontSize: 11, fontWeight: 900,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15)'
            }}>
              {showColorNames ? 'Aa' : '#'}
            </span>
            {showColorNames ? 'Names' : 'Hex'}
          </button>

          {/* Add Color */}
          <button
            onClick={handleAddColor}
            disabled={!xmlDoc || paletteAtCapacity}
            title={!xmlDoc ? 'Import XML first' : paletteAtCapacity ? `Palette limit reached (${MAX_PALETTE_COLORS})` : 'Add a new color'}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#2a2a2a', color: '#fff', border: '1px solid #333', borderRadius: 7, padding: '7px 14px', cursor: (!xmlDoc || paletteAtCapacity) ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13, opacity: (!xmlDoc || paletteAtCapacity) ? 0.5 : 1, transition: 'background 0.15s'
            }}
            onMouseEnter={(e) => { if (xmlDoc && !paletteAtCapacity) e.currentTarget.style.background = '#333'; }}
            onMouseLeave={(e) => { if (xmlDoc && !paletteAtCapacity) e.currentTarget.style.background = '#2a2a2a'; }}
          >
            <AddIcon />
            Add Color
          </button>

          {/* Randomize Palette */}
          <button
            onClick={handleRandomizePalette}
            disabled={colors.length === 0}
            title={colors.length === 0 ? 'Add some colors first' : 'Roll a fresh random palette'}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#2a2a2a', color: '#fff', border: '1px solid #333', borderRadius: 7, padding: '7px 14px', cursor: colors.length === 0 ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13, opacity: colors.length === 0 ? 0.5 : 1, transition: 'background 0.15s, transform 0.2s'
            }}
            onMouseEnter={(e) => {
              if (colors.length > 0) {
                e.currentTarget.style.background = '#333';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (colors.length > 0) {
                e.currentTarget.style.background = '#2a2a2a';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="4" y="4" width="7" height="7" rx="1.4" stroke="#fff" strokeWidth="1.5" />
              <rect x="13" y="4" width="7" height="7" rx="1.4" stroke="#fff" strokeWidth="1.5" />
              <rect x="4" y="13" width="7" height="7" rx="1.4" stroke="#fff" strokeWidth="1.5" />
              <circle cx="16.5" cy="16.5" r="3.5" fill="#fff" />
            </svg>
            Randomize
          </button>

          {/* Screen Eyedropper */}
          <button
            onPointerDown={(e) => {
              // Only left-click/touch/pen
              if (e.button != null && e.button !== 0) return;
              e.preventDefault();
              handleScreenPickAddNew();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleScreenPickAddNew();
              }
            }}
            disabled={!xmlDoc || paletteAtCapacity || !screenPickSupported}
            title={!xmlDoc ? 'Import XML first' : !screenPickSupported ? 'Screen eyedropper not supported' : paletteAtCapacity ? 'Palette is full' : 'Pick any on-screen color (shortcut: E)'}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#2a2a2a', color: '#fff', border: '1px solid #333', borderRadius: 7, padding: '7px 14px', cursor: !xmlDoc || paletteAtCapacity || !screenPickSupported ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13, opacity: !xmlDoc || paletteAtCapacity || !screenPickSupported ? 0.5 : 1, transition: 'background 0.15s'
            }}
            onMouseEnter={(e) => { if (xmlDoc && !paletteAtCapacity && screenPickSupported) e.currentTarget.style.background = '#333'; }}
            onMouseLeave={(e) => { if (xmlDoc && !paletteAtCapacity && screenPickSupported) e.currentTarget.style.background = '#2a2a2a'; }}
          >
            <EyedropperIcon />
            Eyedropper
          </button>
        </div>
        <div className="header-controls" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Undo button */}
          <button
            onClick={handleUndo}
            disabled={history.length===0}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#2a2a2a', color: '#fff', border: '1px solid #333', borderRadius: 7, padding: '7px 14px', fontWeight: 600, fontSize: 13, opacity: history.length===0?0.5:1, cursor: history.length===0?'not-allowed':'pointer', transition: 'background 0.15s'
            }}
            onMouseEnter={(e) => { if (history.length > 0) e.currentTarget.style.background = '#333'; }}
            onMouseLeave={(e) => { if (history.length > 0) e.currentTarget.style.background = '#2a2a2a'; }}
          >
            <UndoIcon size={14} />
            Undo
          </button>
          {/* Redo button (restored) */}
          <button
            onClick={handleRedo}
            disabled={future.length===0}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#2a2a2a', color: '#fff', border: '1px solid #333', borderRadius: 7, padding: '7px 14px', fontWeight: 600, fontSize: 13, opacity: future.length===0?0.5:1, cursor: future.length===0?'not-allowed':'pointer', transition: 'background 0.15s'
            }}
            onMouseEnter={(e) => { if (future.length > 0) e.currentTarget.style.background = '#333'; }}
            onMouseLeave={(e) => { if (future.length > 0) e.currentTarget.style.background = '#2a2a2a'; }}
          >
            <RedoIcon size={14} />
            Redo
          </button>

          {/* Divider */}
          <div style={{ width: 1, height: 24, background: '#333', margin: '0 4px' }} />

          {/* Delete All */}
          <button
            onClick={handleDeleteAll}
            disabled={colors.length === 0}
            aria-label="Delete All Colors"
            title="Delete All Colors"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#2a2a2a', color: '#ff4d4d', border: '1px solid #ff4d4d', borderRadius: 7, padding: '7px 14px', fontWeight: 600, fontSize: 13, opacity: colors.length===0?0.5:1, cursor: colors.length===0?'not-allowed':'pointer', transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => { 
              if (colors.length > 0) {
                e.currentTarget.style.background = '#ff4d4d';
                e.currentTarget.style.color = '#fff';
              }
            }}
            onMouseLeave={(e) => { 
              if (colors.length > 0) {
                e.currentTarget.style.background = '#2a2a2a';
                e.currentTarget.style.color = '#ff4d4d';
              }
            }}
          >
            <TrashIcon />
            Delete All
          </button>

        </div>
      </header>

      {showDeleteAllConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 12000,
            backdropFilter: 'blur(4px)'
          }}
          onClick={cancelDeleteAll}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-all-heading"
        >
          <div
            style={{
              background: '#1a1a1a',
              borderRadius: 12,
              padding: 24,
              minWidth: 260,
              maxWidth: 340,
              border: '1px solid #333',
              boxShadow: '0 10px 36px rgba(0,0,0,0.55)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 18,
              textAlign: 'center'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div id="delete-all-heading" style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>
              Delete all colors?
            </div>
            <div style={{ fontSize: 14, color: '#bbb', lineHeight: 1.6 }}>
              <p style={{ margin: '0 0 6px 0' }}>This removes every swatch from the palette.</p>
              <p style={{ margin: 0 }}>You can undo afterwards.</p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
              <button
                type="button"
                style={{
                  background: '#2a2a2a',
                  color: '#eee',
                  border: '1px solid #444',
                  borderRadius: 7,
                  padding: '8px 18px',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  transition: 'background 0.15s'
                }}
                onClick={cancelDeleteAll}
                onMouseEnter={e => { e.currentTarget.style.background = '#333'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#2a2a2a'; }}
              >
                Cancel
              </button>
              <button
                type="button"
                style={{
                  background: '#ff4d4d',
                  color: '#fff',
                  border: '1px solid #ff6a6a',
                  borderRadius: 7,
                  padding: '8px 18px',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  boxShadow: '0 3px 12px rgba(255,77,77,0.35)',
                  transition: 'background 0.15s'
                }}
                onClick={confirmDeleteAll}
                onMouseEnter={e => { e.currentTarget.style.background = '#ff5d5d'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#ff4d4d'; }}
              >
                Delete Everything
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Color Editor Modal with react-colorful */}
      {colorEditor && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            backdropFilter: 'blur(4px)'
          }}
          onClick={() => setColorEditor(null)}
        >
          <div
            className="custom-color-picker"
            style={{
              background: '#1a1a1a',
              borderRadius: 12,
              padding: 24,
              minWidth: 340,
              border: '1px solid #333',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
            }}
            onClick={e => e.stopPropagation()}
          >
            {(() => {
              const idx = colors.findIndex(c => c.id === colorEditor.id);
              const hasPrev = idx > 0;
              const hasNext = idx !== -1 && idx < colors.length - 1;
              return (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Color editor</div>
                  <div style={{ display: 'inline-flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => goToAdjacentSwatch('prev')}
                      disabled={!hasPrev}
                      title="Previous colour"
                      style={{
                        width: 40,
                        height: 36,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: hasPrev ? '#3a3a3a' : '#252525',
                        color: hasPrev ? '#fff' : '#666',
                        border: hasPrev ? '2px solid #555' : '2px solid #333',
                        borderRadius: 8,
                        cursor: hasPrev ? 'pointer' : 'not-allowed',
                        opacity: 1,
                        transition: 'all 0.15s',
                        boxShadow: hasPrev ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
                        fontSize: 20,
                        fontWeight: 700
                      }}
                      onMouseEnter={(e) => { if (hasPrev) { e.currentTarget.style.background = '#4a4a4a'; e.currentTarget.style.borderColor = '#666'; } }}
                      onMouseLeave={(e) => { if (hasPrev) { e.currentTarget.style.background = '#3a3a3a'; e.currentTarget.style.borderColor = '#555'; } }}
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={() => goToAdjacentSwatch('next')}
                      disabled={!hasNext}
                      title="Next colour"
                      style={{
                        width: 40,
                        height: 36,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: hasNext ? '#3a3a3a' : '#252525',
                        color: hasNext ? '#fff' : '#666',
                        border: hasNext ? '2px solid #555' : '2px solid #333',
                        borderRadius: 8,
                        cursor: hasNext ? 'pointer' : 'not-allowed',
                        opacity: 1,
                        transition: 'all 0.15s',
                        boxShadow: hasNext ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
                        fontSize: 20,
                        fontWeight: 700
                      }}
                      onMouseEnter={(e) => { if (hasNext) { e.currentTarget.style.background = '#4a4a4a'; e.currentTarget.style.borderColor = '#666'; } }}
                      onMouseLeave={(e) => { if (hasNext) { e.currentTarget.style.background = '#3a3a3a'; e.currentTarget.style.borderColor = '#555'; } }}
                    >
                      ›
                    </button>
                  </div>
                </div>
              );
            })()}
            
            {/* Custom SV Picker + Hue Slider */}
            {(() => {
              const hsvToHex = (h, s, v) => {
                s /= 100;
                v /= 100;
                const c = v * s;
                const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
                const m = v - c;
                let r = 0, g = 0, b = 0;
                if (h < 60) { r = c; g = x; b = 0; }
                else if (h < 120) { r = x; g = c; b = 0; }
                else if (h < 180) { r = 0; g = c; b = x; }
                else if (h < 240) { r = 0; g = x; b = c; }
                else if (h < 300) { r = x; g = 0; b = c; }
                else { r = c; g = 0; b = x; }
                const toHex = (n) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
                return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
              };

              const updateColor = (newH, newS, newV) => {
                const newColor = hsvToHex(newH, newS, newV);
                setColorEditor({ ...colorEditor, color: newColor, h: newH, s: newS, v: newV });
                if (colorEditor.id === 'gradient-start') {
                  setGradientStart(newColor);
                } else {
                  pushHistory(colors.map(c => c.id === colorEditor.id ? { ...c, color: newColor } : c));
                }
              };

              // Use stored HSV values from colorEditor state
              const { h, s, v } = colorEditor;

              return (
                <>
                  {/* Saturation-Value Picker */}
                  <div
                    className="custom-color-picker"
                    style={{
                      width: '100%',
                      height: 200,
                      borderRadius: 8,
                      position: 'relative',
                      background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${h}, 100%, 50%))`,
                      cursor: 'crosshair',
                      marginBottom: 16,
                      border: '2px solid #333'
                    }}
                    onMouseDown={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const updateFromMouse = (clientX, clientY) => {
                        const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                        const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
                        const newS = x * 100;
                        const newV = (1 - y) * 100;
                        updateColor(h, newS, newV);
                      };
                      updateFromMouse(e.clientX, e.clientY);
                      
                      const onMove = (e) => updateFromMouse(e.clientX, e.clientY);
                      const onUp = () => {
                        document.removeEventListener('mousemove', onMove);
                        document.removeEventListener('mouseup', onUp);
                      };
                      document.addEventListener('mousemove', onMove);
                      document.addEventListener('mouseup', onUp);
                    }}
                  >
                    {/* Cursor indicator */}
                    <div
                      style={{
                        position: 'absolute',
                        left: `${s}%`,
                        top: `${100 - v}%`,
                        width: 20,
                        height: 20,
                        border: '3px solid white',
                        borderRadius: '50%',
                        transform: 'translate(-50%, -50%)',
                        pointerEvents: 'none',
                        boxShadow: '0 0 4px rgba(0,0,0,0.5)'
                      }}
                    />
                  </div>

                  {/* Hue Slider */}
                  <div className="custom-color-picker" style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <label style={{ color: '#aaa', fontSize: 12, fontWeight: 600 }}>H</label>
                      <span style={{ color: '#666', fontSize: 11, fontFamily: 'monospace' }}>{Math.round(h)}°</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      value={h}
                      onChange={(e) => {
                        updateColor(parseFloat(e.target.value), s, v);
                      }}
                      style={{
                        width: '100%',
                        height: 32,
                        borderRadius: 6,
                        background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                        border: '2px solid #333',
                        appearance: 'none',
                        cursor: 'pointer',
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* Saturation Slider */}
                  <div className="custom-color-picker" style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <label style={{ color: '#aaa', fontSize: 12, fontWeight: 600 }}>S</label>
                      <span style={{ color: '#666', fontSize: 11, fontFamily: 'monospace' }}>{Math.round(s)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={s}
                      onChange={(e) => {
                        updateColor(h, parseFloat(e.target.value), v);
                      }}
                      style={{
                        width: '100%',
                        height: 32,
                        borderRadius: 6,
                        background: `linear-gradient(to right, hsl(${h}, 0%, ${v / 2}%), hsl(${h}, 100%, 50%))`,
                        border: '2px solid #333',
                        appearance: 'none',
                        cursor: 'pointer',
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* Value/Brightness Slider */}
                  <div className="custom-color-picker" style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <label style={{ color: '#aaa', fontSize: 12, fontWeight: 600 }}>V</label>
                      <span style={{ color: '#666', fontSize: 11, fontFamily: 'monospace' }}>{Math.round(v)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={v}
                      onChange={(e) => {
                        updateColor(h, s, parseFloat(e.target.value));
                      }}
                      style={{
                        width: '100%',
                        height: 32,
                        borderRadius: 6,
                        background: `linear-gradient(to right, #000, hsl(${h}, ${s}%, 50%))`,
                        border: '2px solid #333',
                        appearance: 'none',
                        cursor: 'pointer',
                        outline: 'none'
                      }}
                    />
                  </div>
                </>
              );
            })()}

            {/* Color Preview, Hex, and Name */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 8,
                    background: colorEditor.color,
                    border: '2px solid #333',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)',
                    flexShrink: 0
                  }}
                />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                  <input
                    type="text"
                    value={colorEditor.color}
                    maxLength={7}
                    onChange={(e) => {
                      let val = e.target.value.toUpperCase();
                      if (!val.startsWith('#')) val = '#' + val;
                      if (/^#[0-9A-F]{6}$/.test(val)) {
                        // Calculate HSV from the new hex value
                        const r = parseInt(val.slice(1, 3), 16) / 255;
                        const g = parseInt(val.slice(3, 5), 16) / 255;
                        const b = parseInt(val.slice(5, 7), 16) / 255;
                        const max = Math.max(r, g, b);
                        const min = Math.min(r, g, b);
                        const delta = max - min;
                        let newH = colorEditor.h; // Preserve hue if color is grayscale
                        if (delta !== 0) {
                          if (max === r) newH = ((g - b) / delta) % 6;
                          else if (max === g) newH = (b - r) / delta + 2;
                          else newH = (r - g) / delta + 4;
                          newH *= 60;
                          if (newH < 0) newH += 360;
                        }
                        const newS = max === 0 ? 0 : (delta / max) * 100;
                        const newV = max * 100;
                        setColorEditor({ ...colorEditor, color: val, h: newH, s: newS, v: newV });
                        if (colorEditor.id === 'gradient-start') {
                          setGradientStart(val);
                        } else {
                          pushHistory(colors.map(c => c.id === colorEditor.id ? { ...c, color: val } : c));
                        }
                      }
                    }}
                    style={{
                      width: '100%',
                      fontSize: 15,
                      fontFamily: 'monospace',
                      fontWeight: 600,
                      padding: '10px 14px',
                      background: '#252525',
                      border: '1px solid #444',
                      borderRadius: 8,
                      color: '#fff',
                      textAlign: 'center',
                      boxSizing: 'border-box'
                    }}
                    spellCheck={false}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    data-form-type="other"
                  />
                  <div style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: '#ffffff',
                    textAlign: 'center',
                    padding: '10px 14px',
                    background: '#252525',
                    border: '1px solid #444',
                    borderRadius: 8,
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {getColorName(colorEditor.color)}
                  </div>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setColorEditor(null)}
              style={{
                width: '100%',
                padding: '12px',
                background: '#2a2a2a',
                border: '1px solid #444',
                borderRadius: 8,
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#333'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#2a2a2a'}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Gradient Color Editor Modal - Dual Picker */}
      {gradientEditor && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            backdropFilter: 'blur(4px)'
          }}
          onClick={() => setGradientEditor(null)}
        >
          <div
            className="custom-color-picker"
            style={{
              background: '#1a1a1a',
              borderRadius: 12,
              padding: 24,
              minWidth: 700,
              maxWidth: '90vw',
              border: '1px solid #333',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Gradient Editor</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={gradientEditor.manualMode}
                  onChange={(e) => {
                    const isManual = e.target.checked;
                    setGradientManualEnd(isManual);
                    setGradientEditor({ ...gradientEditor, manualMode: isManual });
                    
                    // If switching to manual mode, set the gradient end color to the current end color
                    if (isManual) {
                      const hsvToHex = (h, s, v) => {
                        s /= 100;
                        v /= 100;
                        const c = v * s;
                        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
                        const m = v - c;
                        let r = 0, g = 0, b = 0;
                        if (h < 60) { r = c; g = x; b = 0; }
                        else if (h < 120) { r = x; g = c; b = 0; }
                        else if (h < 180) { r = 0; g = c; b = x; }
                        else if (h < 240) { r = 0; g = x; b = c; }
                        else if (h < 300) { r = x; g = 0; b = c; }
                        else { r = c; g = 0; b = x; }
                        const toHex = (n) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
                        return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
                      };
                      setGradientEndColor(hsvToHex(gradientEditor.endH, gradientEditor.endS, gradientEditor.endV));
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                />
                <span>Manual End Color</span>
              </label>
            </div>

            {/* Gradient Preview with Steps Selector */}
            {(() => {
              const hsvToHex = (h, s, v) => {
                s /= 100;
                v /= 100;
                const c = v * s;
                const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
                const m = v - c;
                let r = 0, g = 0, b = 0;
                if (h < 60) { r = c; g = x; b = 0; }
                else if (h < 120) { r = x; g = c; b = 0; }
                else if (h < 180) { r = 0; g = c; b = x; }
                else if (h < 240) { r = 0; g = x; b = c; }
                else if (h < 300) { r = x; g = 0; b = c; }
                else { r = c; g = 0; b = x; }
                const toHex = (n) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
                return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
              };

              const startColor = hsvToHex(gradientEditor.startH, gradientEditor.startS, gradientEditor.startV);
              const endColor = hsvToHex(gradientEditor.endH, gradientEditor.endS, gradientEditor.endV);
              
              // Generate gradient colors based on selected steps
              const activeSteps = gradientSteps;
              const totalPreviewBlocks = 8;
              const gradientColors = [];
              
              for (let i = 0; i < activeSteps; i++) {
                const t = i / (activeSteps - 1);
                const r1 = parseInt(startColor.slice(1, 3), 16);
                const g1 = parseInt(startColor.slice(3, 5), 16);
                const b1 = parseInt(startColor.slice(5, 7), 16);
                const r2 = parseInt(endColor.slice(1, 3), 16);
                const g2 = parseInt(endColor.slice(3, 5), 16);
                const b2 = parseInt(endColor.slice(5, 7), 16);
                const r = Math.round(r1 + (r2 - r1) * t);
                const g = Math.round(g1 + (g2 - g1) * t);
                const b = Math.round(b1 + (b2 - b1) * t);
                gradientColors.push(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase());
              }

              return (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#aaa' }}>Preview</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, color: '#888', fontWeight: 600 }}>Steps:</span>
                      <input
                        type="number"
                        min={2}
                        max={8}
                        value={gradientSteps}
                        onChange={(e) => {
                          const next = Number(e.target.value);
                          const clamped = Number.isFinite(next) ? Math.min(8, Math.max(2, next)) : 2;
                          setGradientSteps(clamped);
                        }}
                        style={{
                          width: 46,
                          fontSize: 12,
                          borderRadius: 4,
                          border: '1px solid #444',
                          background: '#161616',
                          color: '#fff',
                          padding: '2px 6px',
                          textAlign: 'center',
                          fontWeight: 600
                        }}
                        aria-label="Gradient steps"
                      />
                      <button 
                        onClick={() => setGradientSteps(4)} 
                        style={{ 
                          background: gradientSteps === 4 ? '#4a9eff' : '#2b2b2b', 
                          color: gradientSteps === 4 ? '#fff' : '#ddd', 
                          border: '1px solid #444', 
                          borderRadius: 4, 
                          padding: '3px 10px', 
                          fontSize: 11, 
                          cursor: 'pointer', 
                          fontWeight: 600, 
                          transition: 'all 0.15s' 
                        }}
                      >
                        4
                      </button>
                      <button 
                        onClick={() => setGradientSteps(8)} 
                        style={{ 
                          background: gradientSteps === 8 ? '#4a9eff' : '#2b2b2b', 
                          color: gradientSteps === 8 ? '#fff' : '#ddd', 
                          border: '1px solid #444', 
                          borderRadius: 4, 
                          padding: '3px 10px', 
                          fontSize: 11, 
                          cursor: 'pointer', 
                          fontWeight: 600, 
                          transition: 'all 0.15s' 
                        }}
                      >
                        8
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4, height: 32, borderRadius: 6, overflow: 'hidden', border: '1px solid #444' }}>
                    {Array.from({ length: totalPreviewBlocks }).map((_, i) => {
                      const isActive = i < activeSteps;
                      const color = isActive ? gradientColors[i] : '#1a1a1a';
                      return (
                        <div 
                          key={i} 
                          style={{ 
                            background: color,
                            opacity: isActive ? 1 : 0.3,
                            border: isActive ? 'none' : '1px dashed #444'
                          }} 
                          title={isActive ? color : 'Inactive'}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {gradientEditor && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#bbb', fontSize: 12, fontWeight: 600 }}>Auto End Lightness</span>
                  <span style={{ color: gradientEditor.manualMode ? '#555' : '#888', fontSize: 12, fontFamily: 'monospace', fontWeight: 600 }}>
                    {gradientEndPct}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={gradientEndPct}
                  onChange={e => setGradientEndPct(Number(e.target.value))}
                  disabled={gradientEditor.manualMode}
                  style={{ width: '100%', opacity: gradientEditor.manualMode ? 0.35 : 1, cursor: gradientEditor.manualMode ? 'not-allowed' : 'pointer' }}
                  title={gradientEditor.manualMode ? 'Switch off Manual End Color to adjust' : 'Adjust the auto-generated end lightness'}
                  aria-label="Auto end lightness"
                />
              </div>
            )}
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {/* Start Color Picker */}
              {(() => {
                const hsvToHex = (h, s, v) => {
                  s /= 100;
                  v /= 100;
                  const c = v * s;
                  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
                  const m = v - c;
                  let r = 0, g = 0, b = 0;
                  if (h < 60) { r = c; g = x; b = 0; }
                  else if (h < 120) { r = x; g = c; b = 0; }
                  else if (h < 180) { r = 0; g = c; b = x; }
                  else if (h < 240) { r = 0; g = x; b = c; }
                  else if (h < 300) { r = x; g = 0; b = c; }
                  else { r = c; g = 0; b = x; }
                  const toHex = (n) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
                  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
                };

                const { startH, startS, startV, endH, endS, endV } = gradientEditor;
                const startColor = hsvToHex(startH, startS, startV);
                const endColor = hsvToHex(endH, endS, endV);

                const updateStart = (newH, newS, newV) => {
                  const newColor = hsvToHex(newH, newS, newV);
                  setGradientStart(newColor);
                  
                  // If in auto mode, update end color based on the new start color
                  if (!gradientEditor.manualMode) {
                    // Recalculate end color from the new start color
                    const autoEndColor = lighten(newColor, (gradientEndPct / 100) * MAX_LIGHTEN);
                    const endHSV = (() => {
                      const r = parseInt(autoEndColor.slice(1, 3), 16) / 255;
                      const g = parseInt(autoEndColor.slice(3, 5), 16) / 255;
                      const b = parseInt(autoEndColor.slice(5, 7), 16) / 255;
                      const max = Math.max(r, g, b);
                      const min = Math.min(r, g, b);
                      const delta = max - min;
                      let h = 0;
                      if (delta !== 0) {
                        if (max === r) h = ((g - b) / delta) % 6;
                        else if (max === g) h = (b - r) / delta + 2;
                        else h = (r - g) / delta + 4;
                        h *= 60;
                        if (h < 0) h += 360;
                      }
                      const s = max === 0 ? 0 : (delta / max) * 100;
                      const v = max * 100;
                      return { h, s, v };
                    })();
                    setGradientEditor({ ...gradientEditor, startH: newH, startS: newS, startV: newV, endH: endHSV.h, endS: endHSV.s, endV: endHSV.v });
                  } else {
                    setGradientEditor({ ...gradientEditor, startH: newH, startS: newS, startV: newV });
                  }
                };

                const updateEnd = (newH, newS, newV) => {
                  const newColor = hsvToHex(newH, newS, newV);
                  setGradientEndColor(newColor);
                  setGradientEditor({ ...gradientEditor, endH: newH, endS: newS, endV: newV });
                };

                return (
                  <>
                    {/* Start Color Section */}
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 12 }}>Start Color</div>
                      
                      {/* SV Picker */}
                      <div
                        className="custom-color-picker"
                        style={{
                          width: '100%',
                          height: 180,
                          borderRadius: 8,
                          position: 'relative',
                          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${startH}, 100%, 50%))`,
                          cursor: 'crosshair',
                          marginBottom: 12,
                          border: '2px solid #333'
                        }}
                        onMouseDown={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const updateFromMouse = (clientX, clientY) => {
                            const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                            const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
                            const newS = x * 100;
                            const newV = (1 - y) * 100;
                            updateStart(startH, newS, newV);
                          };
                          updateFromMouse(e.clientX, e.clientY);
                          
                          const onMove = (e) => updateFromMouse(e.clientX, e.clientY);
                          const onUp = () => {
                            document.removeEventListener('mousemove', onMove);
                            document.removeEventListener('mouseup', onUp);
                          };
                          document.addEventListener('mousemove', onMove);
                          document.addEventListener('mouseup', onUp);
                        }}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            left: `${startS}%`,
                            top: `${100 - startV}%`,
                            width: 18,
                            height: 18,
                            border: '3px solid white',
                            borderRadius: '50%',
                            transform: 'translate(-50%, -50%)',
                            pointerEvents: 'none',
                            boxShadow: '0 0 4px rgba(0,0,0,0.5)'
                          }}
                        />
                      </div>

                      {/* H Slider */}
                      <div className="custom-color-picker" style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <label style={{ color: '#aaa', fontSize: 11, fontWeight: 600 }}>H</label>
                          <span style={{ color: '#666', fontSize: 10, fontFamily: 'monospace' }}>{Math.round(startH)}°</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="360"
                          value={startH}
                          onChange={(e) => updateStart(parseFloat(e.target.value), startS, startV)}
                          style={{
                            width: '100%',
                            height: 24,
                            borderRadius: 6,
                            background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                            border: '2px solid #333',
                            appearance: 'none',
                            cursor: 'pointer',
                            outline: 'none'
                          }}
                        />
                      </div>

                      {/* S Slider */}
                      <div className="custom-color-picker" style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <label style={{ color: '#aaa', fontSize: 11, fontWeight: 600 }}>S</label>
                          <span style={{ color: '#666', fontSize: 10, fontFamily: 'monospace' }}>{Math.round(startS)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={startS}
                          onChange={(e) => updateStart(startH, parseFloat(e.target.value), startV)}
                          style={{
                            width: '100%',
                            height: 24,
                            borderRadius: 6,
                            background: `linear-gradient(to right, hsl(${startH}, 0%, ${startV / 2}%), hsl(${startH}, 100%, 50%))`,
                            border: '2px solid #333',
                            appearance: 'none',
                            cursor: 'pointer',
                            outline: 'none'
                          }}
                        />
                      </div>

                      {/* V Slider */}
                      <div className="custom-color-picker" style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <label style={{ color: '#aaa', fontSize: 11, fontWeight: 600 }}>V</label>
                          <span style={{ color: '#666', fontSize: 10, fontFamily: 'monospace' }}>{Math.round(startV)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={startV}
                          onChange={(e) => updateStart(startH, startS, parseFloat(e.target.value))}
                          style={{
                            width: '100%',
                            height: 24,
                            borderRadius: 6,
                            background: `linear-gradient(to right, #000, hsl(${startH}, ${startS}%, 50%))`,
                            border: '2px solid #333',
                            appearance: 'none',
                            cursor: 'pointer',
                            outline: 'none'
                          }}
                        />
                      </div>

                      {/* Color Preview and Name */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <div
                            style={{
                              width: 50,
                              height: 50,
                              borderRadius: 8,
                              background: startColor,
                              border: '2px solid #333',
                              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)',
                              flexShrink: 0
                            }}
                          />
                          <div style={{ flex: 1, fontSize: 13, fontFamily: 'monospace', fontWeight: 600, color: '#fff', textAlign: 'center' }}>
                            {startColor}
                          </div>
                        </div>
                        <div style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: '#888',
                          textAlign: 'center',
                          padding: '6px 10px',
                          background: '#252525',
                          border: '1px solid #444',
                          borderRadius: 6
                        }}>
                          {getColorName(startColor)}
                        </div>
                      </div>
                    </div>

                    {/* End Color Section */}
                    <div style={{ opacity: gradientEditor.manualMode ? 1 : 0.5, pointerEvents: gradientEditor.manualMode ? 'auto' : 'none' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 12 }}>
                        End Color {!gradientEditor.manualMode && <span style={{ fontSize: 11, color: '#888' }}>(auto)</span>}
                      </div>
                      
                      {/* SV Picker */}
                      <div
                        className="custom-color-picker"
                        style={{
                          width: '100%',
                          height: 180,
                          borderRadius: 8,
                          position: 'relative',
                          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${endH}, 100%, 50%))`,
                          cursor: gradientEditor.manualMode ? 'crosshair' : 'not-allowed',
                          marginBottom: 12,
                          border: '2px solid #333'
                        }}
                        onMouseDown={(e) => {
                          if (!gradientEditor.manualMode) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const updateFromMouse = (clientX, clientY) => {
                            const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                            const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
                            const newS = x * 100;
                            const newV = (1 - y) * 100;
                            updateEnd(endH, newS, newV);
                          };
                          updateFromMouse(e.clientX, e.clientY);
                          
                          const onMove = (e) => updateFromMouse(e.clientX, e.clientY);
                          const onUp = () => {
                            document.removeEventListener('mousemove', onMove);
                            document.removeEventListener('mouseup', onUp);
                          };
                          document.addEventListener('mousemove', onMove);
                          document.addEventListener('mouseup', onUp);
                        }}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            left: `${endS}%`,
                            top: `${100 - endV}%`,
                            width: 18,
                            height: 18,
                            border: '3px solid white',
                            borderRadius: '50%',
                            transform: 'translate(-50%, -50%)',
                            pointerEvents: 'none',
                            boxShadow: '0 0 4px rgba(0,0,0,0.5)'
                          }}
                        />
                      </div>

                      {/* H Slider */}
                      <div className="custom-color-picker" style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <label style={{ color: '#aaa', fontSize: 11, fontWeight: 600 }}>H</label>
                          <span style={{ color: '#666', fontSize: 10, fontFamily: 'monospace' }}>{Math.round(endH)}°</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="360"
                          value={endH}
                          onChange={(e) => updateEnd(parseFloat(e.target.value), endS, endV)}
                          disabled={!gradientEditor.manualMode}
                          style={{
                            width: '100%',
                            height: 24,
                            borderRadius: 6,
                            background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                            border: '2px solid #333',
                            appearance: 'none',
                            cursor: gradientEditor.manualMode ? 'pointer' : 'not-allowed',
                            outline: 'none',
                            opacity: gradientEditor.manualMode ? 1 : 0.5
                          }}
                        />
                      </div>

                      {/* S Slider */}
                      <div className="custom-color-picker" style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <label style={{ color: '#aaa', fontSize: 11, fontWeight: 600 }}>S</label>
                          <span style={{ color: '#666', fontSize: 10, fontFamily: 'monospace' }}>{Math.round(endS)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={endS}
                          onChange={(e) => updateEnd(endH, parseFloat(e.target.value), endV)}
                          disabled={!gradientEditor.manualMode}
                          style={{
                            width: '100%',
                            height: 24,
                            borderRadius: 6,
                            background: `linear-gradient(to right, hsl(${endH}, 0%, ${endV / 2}%), hsl(${endH}, 100%, 50%))`,
                            border: '2px solid #333',
                            appearance: 'none',
                            cursor: gradientEditor.manualMode ? 'pointer' : 'not-allowed',
                            outline: 'none',
                            opacity: gradientEditor.manualMode ? 1 : 0.5
                          }}
                        />
                      </div>

                      {/* V Slider */}
                      <div className="custom-color-picker" style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <label style={{ color: '#aaa', fontSize: 11, fontWeight: 600 }}>V</label>
                          <span style={{ color: '#666', fontSize: 10, fontFamily: 'monospace' }}>{Math.round(endV)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={endV}
                          onChange={(e) => updateEnd(endH, endS, parseFloat(e.target.value))}
                          disabled={!gradientEditor.manualMode}
                          style={{
                            width: '100%',
                            height: 24,
                            borderRadius: 6,
                            background: `linear-gradient(to right, #000, hsl(${endH}, ${endS}%, 50%))`,
                            border: '2px solid #333',
                            appearance: 'none',
                            cursor: gradientEditor.manualMode ? 'pointer' : 'not-allowed',
                            outline: 'none',
                            opacity: gradientEditor.manualMode ? 1 : 0.5
                          }}
                        />
                      </div>
                      {/* Color Preview and Name */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <div
                            style={{
                              width: 50,
                              height: 50,
                              borderRadius: 8,
                              background: endColor,
                              border: '2px solid #333',
                              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)',
                              flexShrink: 0
                            }}
                          />
                          <div style={{ flex: 1, fontSize: 13, fontFamily: 'monospace', fontWeight: 600, color: '#fff', textAlign: 'center' }}>
                            {endColor}
                          </div>
                        </div>
                        <div style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: '#888',
                          textAlign: 'center',
                          padding: '6px 10px',
                          background: '#252525',
                          border: '1px solid #444',
                          borderRadius: 6
                        }}>
                          {getColorName(endColor)}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Path info removed as requested */}
            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
              <button
                type="button"
                disabled={paletteAtCapacity}
                title={paletteAtCapacity ? `Palette limit reached (${MAX_PALETTE_COLORS})` : 'Add this gradient to the palette'}
                onClick={() => {
                  if (paletteAtCapacity || !gradientEditor) return;
                  const hsvToHex = (h, s, v) => {
                    s /= 100; v /= 100; const c = v * s; const x = c * (1 - Math.abs(((h / 60) % 2) - 1)); const m = v - c; let r=0,g=0,b=0;
                    if (h < 60) { r = c; g = x; b = 0; } else if (h < 120) { r = x; g = c; b = 0; } else if (h < 180) { r = 0; g = c; b = x; } else if (h < 240) { r = 0; g = x; b = c; } else if (h < 300) { r = x; g = 0; b = c; } else { r = c; g = 0; b = x; }
                    const toHex = (n) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
                    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
                  };
                  const start = hsvToHex(gradientEditor.startH, gradientEditor.startS, gradientEditor.startV);
                  const end = hsvToHex(gradientEditor.endH, gradientEditor.endS, gradientEditor.endV);
                  const steps = gradientSteps;
                  const newColors = [];
                  for (let i = 0; i < steps; i++) {
                    const t = i / (steps - 1);
                    const sr = parseInt(start.slice(1,3),16), sg = parseInt(start.slice(3,5),16), sb = parseInt(start.slice(5,7),16);
                    const er = parseInt(end.slice(1,3),16), eg = parseInt(end.slice(3,5),16), eb = parseInt(end.slice(5,7),16);
                    const r = Math.round(sr + (er - sr) * t);
                    const g = Math.round(sg + (eg - sg) * t);
                    const b = Math.round(sb + (eb - sb) * t);
                    const hex = `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`.toUpperCase();
                    newColors.push({ id: uuidv4(), color: hex });
                  }
                  const remainingSlots = MAX_PALETTE_COLORS - colors.length;
                  const toAdd = newColors.slice(0, remainingSlots);
                  if (toAdd.length > 0) {
                    // Remember the first new swatch so we can scroll to it (background scrolls even while editor is open)
                    scrollTargetIdRef.current = toAdd[0].id;
                    // Push the new colors (keep editor open)
                    pushHistory([...colors, ...toAdd]);
                  }
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: paletteAtCapacity ? '#1f2a3d' : '#1f6bff',
                  border: '1px solid #2a63ff',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: paletteAtCapacity ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s, transform 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (!paletteAtCapacity) {
                    e.currentTarget.style.background = '#1558d6';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = paletteAtCapacity ? '#1f2a3d' : '#1f6bff';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setGradientEditor(null)}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#2a2a2a',
                  border: '1px solid #444',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#333'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#2a2a2a'}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

        {showPresetLibrary && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.82)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 13000,
              backdropFilter: 'blur(5px)'
            }}
            onClick={() => setShowPresetLibrary(false)}
          >
            <div
              style={{
                width: 'min(960px, 90vw)',
                maxHeight: '80vh',
                overflow: 'hidden',
                borderRadius: 16,
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 22px 45px rgba(0,0,0,0.55)',
                background: 'linear-gradient(160deg, #101014 0%, #161820 35%, #101014 100%)',
                display: 'flex',
                flexDirection: 'column'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Preset Library</div>
                  <div style={{ fontSize: 13, color: '#c5d1ff', marginTop: 4 }}>Browse saved palettes or curated collections.</div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPresetLibrary(false)}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 999,
                    padding: '6px 14px',
                    color: '#fff',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              </div>

              <div style={{ padding: 24, overflowY: 'auto' }}>
                {presetLibrary.length === 0 ? (
                  <div style={{
                    color: '#9ca8d9',
                    fontSize: 14,
                    textAlign: 'center',
                    padding: '40px 20px',
                    borderRadius: 12,
                    border: '1px dashed rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.03)'
                  }}>
                    Save a palette or import preset packs to see them here.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'row', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    {presetLibrary.map((preset) => {
                      const previewColors = preset.colors.slice(0, PREVIEW_SWATCH_LIMIT);
                      const normalizedKey = (preset.metaKey || preset.slug || preset.name || '')
                        .toString()
                        .trim()
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-');
                      const curatedMeta = CURATED_PRESET_META[normalizedKey];
                      const resolvedTitle = curatedMeta?.title || preset.name || 'Untitled Preset';
                      const resolvedSubtitle = curatedMeta?.subtitle || preset.description?.trim() || `${preset.colorCount} colours · Custom Palette`;
                      const socialLinks = (curatedMeta?.socialLinks || preset.socialLinks || []).map((link, index) => {
                        const url = link.url?.startsWith('http') ? link.url : `https://${link.url?.replace(/^\/+/, '')}`;
                        return {
                          ...link,
                          url,
                          key: `${preset.id}-${index}`,
                          icon: link.icon || link.label,
                        };
                      });
                      const hasSocialLinks = socialLinks.length > 0;
                      const isCurated = preset.source === 'curated';
                      return (
                        <div
                          key={preset.id}
                          style={{
                            borderRadius: 14,
                            padding: 16,
                            background: 'rgba(18,20,28,0.9)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            boxShadow: '0 12px 24px rgba(0,0,0,0.35)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 12,
                            width: PRESET_CARD_BODY_WIDTH + 32,
                            alignItems: 'center',
                            flex: '0 0 auto',
                            minHeight: 420
                          }}
                        >
                          <div style={{ textAlign: 'center', width: PRESET_CARD_BODY_WIDTH }}>
                            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '0.03em' }}>{resolvedTitle}</div>
                            <div style={{ fontSize: 12, color: '#8fa1d9', marginTop: 4, wordBreak: 'break-word', lineHeight: 1.4 }}>{resolvedSubtitle}</div>
                          </div>

                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(8, 16px)',
                              gridAutoRows: '16px',
                              gap: 3,
                              padding: 4,
                              background: 'rgba(18,20,28,0.0)',
                              borderRadius: 8,
                              border: '1px solid rgba(255,255,255,0.05)',
                              gridAutoFlow: 'row',
                              justifyContent: 'center',
                              alignContent: 'start',
                              width: PRESET_CARD_BODY_WIDTH,
                              margin: '0 auto',
                              minHeight: 309
                            }}
                          >
                            {previewColors.map((color, index) => (
                              <div
                                key={`${preset.id}-preview-${index}`}
                                style={{
                                  width: 16,
                                  height: 16,
                                  borderRadius: 3,
                                  background: color,
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.22)',
                                  border: '1px solid rgba(255,255,255,0.08)'
                                }}
                                title={color}
                              />
                            ))}
                          </div>

                          {preset.colors.length > previewColors.length && (
                            <div style={{ fontSize: 11, color: '#7182ba', fontWeight: 600 }}>
                              +{preset.colors.length - previewColors.length} more swatches
                            </div>
                          )}

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto', width: PRESET_CARD_BODY_WIDTH, alignItems: 'center' }}>
                            {hasSocialLinks ? (
                              <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                                {socialLinks.map((link) => (
                                  <a
                                    key={link.key}
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      width: 36,
                                      height: 36,
                                      borderRadius: '50%',
                                      border: '1px solid rgba(255,255,255,0.12)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: '#f2f6ff',
                                      fontSize: 11,
                                      fontWeight: 800,
                                      letterSpacing: '0.04em',
                                      textDecoration: 'none',
                                      background: 'rgba(255,255,255,0.04)',
                                      transition: 'transform 0.15s, border-color 0.15s'
                                    }}
                                    title={link.label}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.transform = 'translateY(-1px)';
                                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.35)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.transform = 'translateY(0)';
                                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                                    }}
                                    aria-label={`${link.label} for ${resolvedTitle}`}
                                  >
                                    {(() => {
                                      const normalizedIcon = (link.icon || '').toString().toLowerCase();
                                      const renderIcon = SOCIAL_ICON_RENDERERS[normalizedIcon];
                                      if (typeof renderIcon === 'function') {
                                        return renderIcon();
                                      }
                                      const fallback = link.label?.slice(0, 2)?.toUpperCase() || 'Go';
                                      return fallback;
                                    })()}
                                  </a>
                                ))}
                              </div>
                            ) : (
                              <div style={{
                                color: '#7182ba',
                                fontSize: 11,
                                fontWeight: 600,
                                border: '1px dashed rgba(255,255,255,0.08)',
                                borderRadius: 10,
                                padding: '8px 10px',
                                textAlign: 'center',
                                width: '100%'
                              }}>
                                Social links available soon.
                              </div>
                            )}

                            <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  handleLoadPreset(preset);
                                  setShowPresetLibrary(false);
                                }}
                                style={{
                                  flex: 1,
                                  background: 'linear-gradient(135deg, #516dff 0%, #6a8dff 100%)',
                                  border: 'none',
                                  borderRadius: 8,
                                  padding: '8px 12px',
                                  color: '#fff',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  fontSize: 13,
                                  boxShadow: '0 8px 18px rgba(81, 109, 255, 0.28)'
                                }}
                              >
                                Apply
                              </button>
                              {!isCurated && (
                                <button
                                  type="button"
                                  onClick={() => handleDeletePreset(preset.id)}
                                  style={{
                                    width: 42,
                                    background: 'rgba(255,77,77,0.12)',
                                    border: '1px solid rgba(255,77,77,0.35)',
                                    borderRadius: 8,
                                    color: '#ff8d8d',
                                    fontWeight: 800,
                                    cursor: 'pointer'
                                  }}
                                  title="Delete preset"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      {/* Import XML Modal */}
      {showImportModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 10000,
            backdropFilter: 'blur(4px)',
            padding: 16
          }}
          onClick={closeImportModal}
        >
          <div
            className="custom-color-picker"
            style={{
              background: '#1a1a1a',
              borderRadius: 12,
              padding: 24,
              minWidth: 500,
              // Force a wider modal so the new two-column layout is visible
              width: 'min(1040px, 94vw)',
              maxWidth: '94vw',
              maxHeight: '88vh',
              overflow: 'auto',
              border: '1px solid #333',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 16, textAlign: 'center', letterSpacing: '0.04em' }}>
              Import Window
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ flex: '2 1 420px', minWidth: 340, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div
                  style={{
                    background: termsCardBackground,
                    border: termsCardBorder,
                    borderRadius: 14,
                    boxShadow: termsCardGlow,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    transition: 'background 0.25s ease, border 0.25s ease, box-shadow 0.25s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={hasAcceptedTerms}
                        onChange={(e) => {
                          setHasAcceptedTerms(e.target.checked);
                          if (e.target.checked) {
                            setImportModalError('');
                          }
                        }}
                        style={{ width: 18, height: 18, accentColor: termsCheckboxAccent, cursor: 'pointer' }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 18, fontWeight: 800, color: termsLabelColor, letterSpacing: '0.04em' }}>Accept Terms</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: termsInfoColor }}>Confirm you agree to the Community Terms of Use</span>
                      </div>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowTermsModal(true);
                        setHasViewedTerms(true);
                      }}
                      style={{
                        background: readButtonDefaultBg,
                        border: readButtonBorder,
                        color: hasViewedTerms ? '#e4fff2' : importPalette.readButtonText,
                        borderRadius: 8,
                        padding: '10px 18px',
                        fontWeight: 800,
                        letterSpacing: '0.04em',
                        cursor: 'pointer',
                        textTransform: 'uppercase',
                        transition: 'background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        const hoverBg = hasViewedTerms ? '#2f7a47' : importPalette.readButtonHover;
                        e.currentTarget.style.background = hoverBg;
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.35)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = readButtonDefaultBg;
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      {hasViewedTerms ? 'Read Again' : 'Read'}
                    </button>
                  </div>
                  <div style={{ color: termsInfoColor, fontSize: 12, lineHeight: 1.6 }}>
                    Acceptance is required before choosing a Defaults.xml or creating backups.
                  </div>
                </div>

                <div style={{ position: 'relative' }}>
                  {!hasAcceptedTerms && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        padding: 26,
                        color: termsLabelColor,
                        fontWeight: 700,
                        fontSize: 14,
                        letterSpacing: '0.02em',
                        textShadow: '0 2px 6px rgba(0,0,0,0.6)',
                        pointerEvents: 'none'
                      }}
                    >
                      Accept the terms to unlock the import tools.
                    </div>
                  )}
                  <div style={{ ...gatedSectionStyle, display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div
                      style={{
                        background: fileSectionBackground,
                        borderRadius: 12,
                        border: fileSectionBorder,
                        padding: 18,
                        boxShadow: '0 6px 24px rgba(0,0,0,0.4)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                        transition: 'background 0.3s ease, border 0.3s ease, color 0.3s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: fileSectionHeading, fontWeight: 800, fontSize: 16, letterSpacing: '0.02em' }}>
                          <FolderIcon size={18} color={fileSectionHeading} />
                          <span>Defaults.xml</span>
                        </div>
                        {pendingXmlFile ? (
                          <div style={{ fontFamily: 'Fira Mono, monospace', fontSize: 12, color: fileSectionSubtle, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>{pendingXmlFile.name}</span>
                            <span style={{ fontWeight: 700 }}>{(pendingXmlFile.size / 1024).toFixed(1)} KB</span>
                          </div>
                        ) : (
                          <div style={{ color: fileSectionSubtle, fontSize: 12 }}>No file selected</div>
                        )}
                      </div>

                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          const activeBorder = hasAcceptedTerms
                            ? '3px dashed rgba(65, 214, 122, 0.85)'
                            : '3px dashed rgba(240, 195, 106, 0.85)';
                          const activeBg = '#323232';
                          e.currentTarget.style.border = activeBorder;
                          e.currentTarget.style.background = activeBg;
                        }}
                        onDragLeave={(e) => {
                          e.currentTarget.style.border = fileDropBorder;
                          e.currentTarget.style.background = fileDropBackground;
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.currentTarget.style.border = fileDropBorder;
                          e.currentTarget.style.background = fileDropBackground;
                          if (!hasAcceptedTerms) {
                            setImportModalError('Please acknowledge the terms before choosing a Defaults.xml.');
                            return;
                          }
                          const file = e.dataTransfer.files[0];
                          handleFileSelection(file);
                        }}
                        onClick={() => {
                          if (!hasAcceptedTerms) {
                            setImportModalError('Please acknowledge the terms before choosing a Defaults.xml.');
                            return;
                          }
                          openXmlFileDialog();
                        }}
                        style={{
                          border: fileDropBorder,
                          borderRadius: 16,
                          padding: '26px 20px',
                          background: fileDropBackground,
                          cursor: hasAcceptedTerms ? 'pointer' : 'not-allowed',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 12,
                          minHeight: 160,
                          textAlign: 'center',
                          position: 'relative'
                        }}
                      >
                        {hasSelectedXml && (
                          <div
                            className="ready-pulse"
                            aria-label="Defaults.xml file loaded and ready"
                            title="File loaded"
                            style={{
                              position: 'absolute',
                              top: 10,
                              right: 10,
                              padding: '4px 10px',
                              borderRadius: 999,
                              background: 'rgba(65,214,122,0.2)',
                              border: '1px solid rgba(65,214,122,0.55)',
                              color: '#c7f5dc',
                              fontSize: 11,
                              fontWeight: 800,
                              letterSpacing: '0.06em',
                              textTransform: 'uppercase'
                            }}
                          >
                            Ready
                          </div>
                        )}
                        <div
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: 18,
                            background: '#1f1f1f',
                            border: '1px solid rgba(255,255,255,0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.35)'
                          }}
                        >
                          <LoadIcon size={30} color={fileDropTitle} />
                        </div>
                        {hasSelectedXml ? (
                          <div style={{ display: 'grid', gap: 6, color: fileDropTitle }}>
                            <div style={{ fontSize: 18, fontWeight: 800 }}>FILE LOADED</div>
                            <div style={{ fontFamily: 'Fira Mono, monospace', fontSize: 13, color: fileDropHelper }}>
                              {pendingXmlFile?.name} · {(pendingXmlFile?.size / 1024).toFixed(1)} KB
                            </div>
                            <div style={{ fontSize: 13, color: fileDropHelper }}>Click to choose a different file</div>
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gap: 6 }}>
                            <div
                              style={{
                                color: fileDropTitle,
                                fontSize: 18,
                                fontWeight: 800,
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase'
                              }}
                            >
                              Drop your Defaults.xml file here
                            </div>
                            <div style={{ color: fileDropHelper, fontSize: 14 }}>or click to browse</div>
                          </div>
                        )}
                      </div>

                      {importModalError && (
                        <div style={{ color: '#ff9393', fontSize: 12, fontWeight: 700, letterSpacing: '0.02em' }}>
                          {importModalError}
                        </div>
                      )}

                      {/* Location help merged into the Defaults.xml section */}
                      <div
                        style={{
                          marginTop: 6,
                          background: '#242424',
                          border: '1px solid #3a3a3a',
                          borderRadius: 8,
                          padding: '10px 12px',
                          color: '#cfcfcf',
                          display: 'grid',
                          gap: 8
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', fontWeight: 800 }}>
                          <FolderIcon size={16} color="#d9d9d9" />
                          <span>Find Your Defaults.xml File</span>
                        </div>
                        <div style={{ color: '#dddddd', fontSize: 12 }}>
                          <strong>Windows:</strong> You may need to show hidden folders first (View → Show → Hidden Items in File Explorer)
                        </div>
                        <div style={{ display: 'grid', gap: 8 }}>
                          <div style={{ background: '#1f1f1f', border: '1px solid #3a3a3a', borderRadius: 6, padding: '8px 10px' }}>
                            <div style={{ color: '#ddd', fontWeight: 700, marginBottom: 4 }}>Windows:</div>
                            <div style={{ fontFamily: 'Fira Mono, monospace', color: '#9ec1ff', fontSize: 12, wordBreak: 'break-all' }}>
                              C:\Users\[your-username]\AppData\Roaming\Steinberg\Cubase 14 or Nuendo 14
                            </div>
                          </div>
                          <div style={{ background: '#1f1f1f', border: '1px solid #3a3a3a', borderRadius: 6, padding: '8px 10px' }}>
                            <div style={{ color: '#ddd', fontWeight: 700, marginBottom: 4 }}>macOS:</div>
                            <div style={{ fontFamily: 'Fira Mono, monospace', color: '#9ec1ff', fontSize: 12, wordBreak: 'break-all' }}>
                              /Users/[your-username]/Library/Preferences/Cubase 14 or Nuendo 14
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ position: 'relative' }}>
                      {!pendingXmlFile && (
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 18,
                            textAlign: 'center',
                            color: importPalette.textStrong,
                            fontWeight: 700,
                            fontSize: 13,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            textShadow: '0 4px 10px rgba(0,0,0,0.45)',
                            pointerEvents: 'none'
                          }}
                        >
                          Choose your Defaults.xml to enable the backup tools.
                        </div>
                      )}
                      <div
                        style={{
                          background: backupPanelBackground,
                          borderRadius: 12,
                          border: backupPanelBorder,
                          padding: 18,
                          color: backupBodyColor,
                          boxShadow: '0 6px 24px rgba(0,0,0,0.45)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12,
                          transition: 'background 0.25s ease, border 0.25s ease, color 0.25s ease, filter 0.25s ease, opacity 0.25s ease',
                          filter: pendingXmlFile ? 'none' : 'blur(4px)',
                          opacity: pendingXmlFile ? 1 : 0.35,
                          pointerEvents: pendingXmlFile ? 'auto' : 'none',
                          userSelect: pendingXmlFile ? 'auto' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                          <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#ffffff' }}>
                            Backup strongly recommended
                          </div>
                          <div
                            style={{
                              padding: '4px 10px',
                              borderRadius: 999,
                              background: hasCreatedBackup
                                ? 'rgba(65,214,122,0.2)'
                                : (hasSkippedBackup ? 'rgba(240,195,106,0.2)' : 'rgba(240,91,91,0.2)'),
                              color: hasCreatedBackup
                                ? '#c7f5dc'
                                : (hasSkippedBackup ? '#ffe7b7' : '#ffd6d6'),
                              fontSize: 11,
                              fontWeight: 800,
                              letterSpacing: '0.08em',
                              textTransform: 'uppercase'
                            }}
                          >
                            {hasCreatedBackup ? 'Complete' : (hasSkippedBackup ? 'Skipped' : 'Pending')}
                          </div>
                        </div>
                        {pendingXmlFile ? (
                          <div style={{ fontFamily: 'Fira Mono, monospace', fontSize: 13 }}>
                            {pendingXmlFile.name}
                            <span style={{ color: hasCreatedBackup ? '#8cffb0' : (hasSkippedBackup ? '#ffd07a' : '#ffb4b4'), marginLeft: 10 }}>
                              {(pendingXmlFile.size / 1024).toFixed(1)} KB
                            </span>
                          </div>
                        ) : (
                          <div style={{ fontSize: 13, color: backupBodyColor }}>
                            Select a Defaults.xml above before importing.
                          </div>
                        )}
                        <div style={{ fontSize: 13, color: backupSubtleText, lineHeight: 1.6 }}>
                          Create a copy of your Defaults.xml before importing. You can revert instantly if anything goes wrong. If you have manually created a backup copy, you may choose to skip.
                        </div>
                        {/* Browser popup hint when using fallback download or no FS Access API */}
                        {((!('showSaveFilePicker' in window)) || needsBackupConfirm) && (
                          <div style={{ fontSize: 12, color: backupSubtleText, opacity: 0.85 }}>
                            Tip: Your browser may show a “Save / Don’t save” confirmation. That’s normal for downloads and helps keep you safe.
                          </div>
                        )}
                        <div
                          style={{
                            fontSize: 12,
                            color: backupHintText,
                            background: backupHintBackground,
                            border: backupHintBorder,
                            borderRadius: 6,
                            padding: '10px 12px',
                            lineHeight: 1.6,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                          }}
                        >
                          When restoring, rename the file back to <span style={{ fontFamily: 'Fira Mono, monospace' }}>Defaults.xml</span> before replacing the original.
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'stretch' }}>
                            <button
                              type="button"
                              onClick={pendingXmlFile ? handleBackupPendingXml : undefined}
                              disabled={backupDisabled}
                              title={backupDisabled
                                ? (!pendingXmlFile
                                  ? 'Choose a Defaults.xml first'
                                  : 'Accept the community terms to enable backups.')
                                : 'Download a backup of the selected Defaults.xml'}
                              style={{
                                flex: '1 1 210px',
                                minWidth: 170,
                                background: backupDisabled
                                  ? '#3d361c'
                                  : (hasCreatedBackup ? '#2f9f61' : importPalette.createButtonBg),
                                border: backupDisabled
                                  ? '3px solid #3d361c'
                                  : (hasCreatedBackup ? `3px solid ${importPalette.successBorder}` : importPalette.createButtonBorder),
                                color: hasCreatedBackup ? '#e6fff2' : importPalette.createButtonText,
                                fontWeight: 700,
                                borderRadius: 8,
                                padding: '10px 16px',
                                cursor: backupDisabled ? 'not-allowed' : 'pointer',
                                opacity: backupDisabled ? 0.7 : 1,
                                transition: 'background 0.2s, transform 0.2s, box-shadow 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                justifyContent: 'flex-start'
                              }}
                              onMouseEnter={(e) => {
                                if (backupDisabled) return;
                                const hoverBg = hasCreatedBackup ? '#1f6a3c' : importPalette.createButtonHover;
                                const hoverShadow = hasCreatedBackup
                                  ? '0 6px 16px rgba(49, 217, 108, 0.35)'
                                  : '0 6px 16px rgba(240, 91, 91, 0.35)';
                                e.currentTarget.style.background = hoverBg;
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                e.currentTarget.style.boxShadow = hoverShadow;
                              }}
                              onMouseLeave={(e) => {
                                if (backupDisabled) return;
                                e.currentTarget.style.background = hasCreatedBackup ? '#2f9f61' : importPalette.createButtonBg;
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = 'none';
                              }}
                            >
                              <span
                                aria-hidden="true"
                                style={{
                                  width: 18,
                                  height: 18,
                                  borderRadius: 4,
                                  border: hasCreatedBackup ? `2px solid ${importPalette.successBorder}` : '2px solid rgba(240, 91, 91, 0.55)',
                                  background: hasCreatedBackup ? '#1f6a3c' : 'transparent',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                {hasCreatedBackup ? (
                                  <span style={{ color: '#eafff3', fontSize: 12, fontWeight: 900 }}>✓</span>
                                ) : null}
                              </span>
                              <span>{hasCreatedBackup ? 'Backup Created' : 'Create Backup'}</span>
                            </button>
                            {/* Removed the extra "Choose Defaults.xml" button as requested */}
                            <button
                              type="button"
                              onClick={!skipDisabled ? handleToggleSkipBackup : undefined}
                              disabled={skipDisabled}
                              title={skipDisabled
                                ? (!pendingXmlFile
                                    ? 'Choose a Defaults.xml first'
                                    : (!hasAcceptedTerms
                                      ? 'Accept the community terms to continue.'
                                      : (hasCreatedBackup
                                        ? 'Backup already created. Skipping is disabled.'
                                        : 'Action unavailable.')))
                                : (hasSkippedBackup ? 'Undo skip and require a backup again.' : 'Skip creating a backup (not recommended).')}
                              style={{
                                flex: '1 1 210px',
                                minWidth: 170,
                                background: skipDisabled
                                  ? (hasCreatedBackup ? '#2a2a2a' : '#3a2a12')
                                  : (hasSkippedBackup ? '#7a4b1f' : importPalette.skipButtonBg),
                                border: skipDisabled
                                  ? (hasCreatedBackup ? '3px solid #2a2a2a' : '3px solid #3a2a12')
                                  : (hasSkippedBackup ? '3px solid rgba(240, 195, 106, 0.75)' : importPalette.skipButtonBorder),
                                color: skipDisabled
                                  ? (hasCreatedBackup ? '#9a9a9a' : importPalette.skipButtonText)
                                  : (hasSkippedBackup ? '#fff1d6' : importPalette.skipButtonText),
                                fontWeight: 700,
                                borderRadius: 8,
                                padding: '10px 16px',
                                cursor: skipDisabled ? 'not-allowed' : 'pointer',
                                opacity: skipDisabled ? 0.7 : 1,
                                transition: 'background 0.2s, transform 0.2s, box-shadow 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                justifyContent: 'flex-start'
                              }}
                              onMouseEnter={(e) => {
                                if (skipDisabled) return;
                                const hoverBg = hasSkippedBackup ? '#a3652c' : importPalette.skipButtonHover;
                                const hoverShadow = hasSkippedBackup
                                  ? '0 6px 16px rgba(240, 195, 106, 0.35)'
                                  : '0 6px 16px rgba(224, 176, 74, 0.35)';
                                e.currentTarget.style.background = hoverBg;
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                e.currentTarget.style.boxShadow = hoverShadow;
                              }}
                              onMouseLeave={(e) => {
                                if (skipDisabled) return;
                                e.currentTarget.style.background = hasSkippedBackup ? '#7a4b1f' : importPalette.skipButtonBg;
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = 'none';
                              }}
                            >
                              <span
                                aria-hidden="true"
                                style={{
                                  width: 18,
                                  height: 18,
                                  borderRadius: 4,
                                  border: skipDisabled
                                    ? (hasCreatedBackup ? '2px solid #3a3a3a' : '2px solid rgba(240, 195, 106, 0.55)')
                                    : (hasSkippedBackup ? '2px solid rgba(240, 195, 106, 0.75)' : '2px solid rgba(240, 195, 106, 0.55)'),
                                  background: skipDisabled
                                    ? (hasCreatedBackup ? '#2a2a2a' : 'transparent')
                                    : (hasSkippedBackup ? '#4a3416' : 'transparent'),
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                {skipDisabled
                                  ? (
                                    <span style={{ color: hasCreatedBackup ? '#999' : '#ffe9bd', fontSize: 11, fontWeight: 900 }}>!</span>
                                  )
                                  : (
                                    hasSkippedBackup
                                      ? <span style={{ color: '#ffe4b8', fontSize: 11, fontWeight: 900 }}>!</span>
                                      : <span style={{ color: '#ffe9bd', fontSize: 11, fontWeight: 900 }}>!</span>
                                    )}
                              </span>
                              <span>{hasSkippedBackup ? 'Skip Enabled' : 'Skip Backup'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowBackupHelp(true)}
                              style={{
                                flex: '0 0 auto',
                                background: backupHelpButtonBackground,
                                border: backupHelpButtonBorder,
                                color: backupHelpButtonText,
                                fontWeight: 700,
                                letterSpacing: '0.02em',
                                borderRadius: 6,
                                padding: '8px 14px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                transition: 'background 0.2s ease, border 0.2s ease, box-shadow 0.2s ease, color 0.2s ease'
                              }}
                              onMouseEnter={(e) => {
                                const nextBg = hasViewedBackupHelp ? '#32724a' : importPalette.helpButtonHover;
                                const nextBorder = hasViewedBackupHelp
                                  ? `3px solid ${importPalette.successBorder}`
                                  : importPalette.helpButtonBorder;
                                const nextText = hasViewedBackupHelp ? '#f6fff9' : importPalette.helpButtonText;
                                e.currentTarget.style.background = nextBg;
                                e.currentTarget.style.border = nextBorder;
                                e.currentTarget.style.color = nextText;
                                e.currentTarget.style.boxShadow = hasViewedBackupHelp
                                  ? '0 6px 16px rgba(49, 217, 108, 0.25)'
                                  : '0 6px 16px rgba(240, 91, 91, 0.25)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = backupHelpButtonBackground;
                                e.currentTarget.style.border = backupHelpButtonBorder;
                                e.currentTarget.style.color = backupHelpButtonText;
                                e.currentTarget.style.boxShadow = 'none';
                              }}
                            >
                              <span style={{ fontSize: 12, fontWeight: 900, color: backupHelpButtonText }}>?</span>
                              <span>Help</span>
                            </button>
                          </div>
                          {hasSkippedBackup && (
                            <div
                              style={{
                                fontSize: 12,
                                color: '#ffe7b7',
                                background: 'rgba(200, 150, 50, 0.18)',
                                border: '1px solid rgba(240, 195, 106, 0.6)',
                                borderRadius: 6,
                                padding: '10px 12px',
                                fontWeight: 700,
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase'
                              }}
                            >
                              You chose to import without a backup. Continue only if you understand the risk.
                            </div>
                          )}

                          {needsBackupConfirm && !hasCreatedBackup && !hasSkippedBackup && (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 10,
                                background: '#2b2b2b',
                                border: '1px solid #3a3a3a',
                                borderRadius: 8,
                                padding: '10px 12px',
                                color: '#f2f2f2'
                              }}
                            >
                              <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                                Finish saving your backup. When done, click “I saved it” to continue.
                              </div>
                              <button
                                type="button"
                                onClick={() => { setHasCreatedBackup(true); setNeedsBackupConfirm(false); setHasSkippedBackup(false); setImportModalError(''); }}
                                style={{
                                  background: '#2f9f61',
                                  border: '1px solid #37c576',
                                  color: '#fff',
                                  fontWeight: 700,
                                  borderRadius: 8,
                                  padding: '8px 12px',
                                  cursor: 'pointer'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = '#1f6a3c'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = '#2f9f61'; }}
                              >
                                I saved it
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Location info moved inside the Defaults.xml section above */}
                    {/* Removed: Default Location callout under Import modal to reduce clutter */}
                  </div>
                </div>
              </div>

              <div style={{ flex: '1 1 260px', minWidth: 260, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div
                  style={{
                    background: '#262626',
                    borderRadius: 10,
                    border: '1px solid #2f2f2f', 
                    padding: 16,
                    color: '#dcdcdc',
                    fontSize: 14,
                    lineHeight: 1.8,
                    boxShadow: '0 12px 28px rgba(0,0,0,0.45)',
                    maxHeight: 400,
                    overflowY: 'auto'
                  }}
                >
                  <div style={{ color: '#fff', fontWeight: 800, fontSize: 18, marginBottom: 14, letterSpacing: '0.02em', textTransform: 'uppercase' }}>Steps</div>
                  <ol style={{ margin: 0, paddingLeft: 24, display: 'grid', gap: 8, fontSize: 14, lineHeight: 1.7 }}>
                    <li>Quit Cubase or Nuendo.</li>
                    <li>Choose your Defaults.xml.</li>
                    <li>Create a backup of the original.</li>
                    <li>Import the palette and customize.</li>
                    <li>Export with the Cubendo export button.</li>
                    <li>Launch Cubase or Nuendo.</li>
                    <li>Open Project › Project Colour Settings › Options.</li>
                    <li>Set current set as default and apply.</li>
                    <li>Add a track and open the colour palette.</li>
                    <li>Enjoy the refreshed colours.</li>
                  </ol>
                </div>

                <div
                  style={{
                    background: '#1e1e1f',
                    borderRadius: 10,
                    border: '1px solid #333',
                    padding: 14,
                    color: '#c3c3c3',
                    fontSize: 12,
                    lineHeight: 1.7,
                    boxShadow: '0 10px 24px rgba(0,0,0,0.4)',
                    maxHeight: 220,
                    overflowY: 'auto'
                  }}
                >
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, marginBottom: 10, letterSpacing: '0.02em', textTransform: 'uppercase' }}>Community Disclaimer</div>
                  <div>
                    This editor is community-built and not affiliated with Steinberg. Use at your own risk and always keep backups. Your Defaults.xml stays on your device.
                  </div>
                  <div style={{ marginTop: 8 }}>
                    The maintainer is not responsible for corrupted files, data loss, or any damages from using or misusing this tool.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (pendingXmlFile) {
                      if (!hasAcceptedTerms) {
                        setImportModalError('Please acknowledge the terms before importing.');
                        return;
                      }
                      if (!hasCreatedBackup && !hasSkippedBackup) {
                        setImportModalError('Create a backup or choose to skip before importing.');
                        return;
                      }
                      setImportModalError('');
                      handleImportPendingXml();
                    } else {
                      openXmlFileDialog();
                    }
                  }}
                  disabled={importDisabled}
                  title={(() => {
                    if (!pendingXmlFile) return 'Choose a Defaults.xml file to begin.';
                    if (!hasAcceptedTerms) return 'Accept the community terms to enable importing.';
                    if (needsBackupConfirm) return 'Confirm you saved the backup before importing.';
                    if (!hasCreatedBackup && !hasSkippedBackup) return 'Create a backup or choose skip before importing.';
                    if (hasSkippedBackup) return 'You acknowledged the risk of importing without a backup.';
                    return 'Import the selected Defaults.xml palette.';
                  })()}
                  style={{
                    background: importDisabled
                      ? '#262626'
                      : (hasCreatedBackup ? '#2f9f61' : (hasSkippedBackup ? '#a3652c' : '#f55f5f')),
                    border: importDisabled
                      ? '1px solid #262626'
                      : (hasCreatedBackup ? '1px solid #37c576' : (hasSkippedBackup ? '1px solid #f0c36a' : '1px solid #f97777')),
                    color: '#fff',
                    fontWeight: 800,
                    letterSpacing: '0.03em',
                    borderRadius: 12,
                    padding: '14px 18px',
                    cursor: importDisabled ? 'not-allowed' : 'pointer',
                    opacity: importDisabled ? 0.6 : 1,
                    boxShadow: importDisabled
                      ? 'none'
                      : (hasCreatedBackup
                        ? '0 10px 24px rgba(49, 217, 108, 0.35)'
                        : (hasSkippedBackup
                          ? '0 10px 24px rgba(240, 195, 106, 0.35)'
                          : '0 10px 24px rgba(245, 95, 95, 0.35)')),
                    transition: 'background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (importDisabled) return;
                    const bg = hasCreatedBackup ? '#1f6a3c' : (hasSkippedBackup ? '#7f4f1e' : '#ff6f6f');
                    const shadow = hasCreatedBackup
                      ? '0 12px 28px rgba(49, 217, 108, 0.42)'
                      : (hasSkippedBackup
                        ? '0 12px 28px rgba(240, 195, 106, 0.42)'
                        : '0 12px 28px rgba(255, 111, 111, 0.42)');
                    e.currentTarget.style.background = bg;
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = shadow;
                  }}
                  onMouseLeave={(e) => {
                    const bg = importDisabled ? '#262626' : (hasCreatedBackup ? '#2f9f61' : (hasSkippedBackup ? '#a3652c' : '#f55f5f'));
                    const shadow = importDisabled
                      ? 'none'
                      : (hasCreatedBackup
                        ? '0 10px 24px rgba(49, 217, 108, 0.35)'
                        : (hasSkippedBackup
                          ? '0 10px 24px rgba(240, 195, 106, 0.35)'
                          : '0 10px 24px rgba(245, 95, 95, 0.35)'));
                    e.currentTarget.style.background = bg;
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = shadow;
                  }}
                >
                  {pendingXmlFile ? 'Import Palette' : 'Choose Defaults.xml'}
                </button>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={closeImportModal}
              style={{
                width: '100%',
                marginTop: 20,
                background: '#444',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontWeight: 600,
                fontSize: 14,
                padding: '10px',
                cursor: 'pointer',
                transition: 'background 0.15s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#555'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#444'}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showImportModal && showBackupHelp && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 10002
          }}
          onClick={handleCloseBackupHelp}
        >
          <div
            style={{
              background: '#161616',
              borderRadius: 12,
              border: '1px solid #3a3a3a',
              padding: 28,
              maxWidth: 520,
              width: '90vw',
              maxHeight: '85vh',
              overflow: 'auto',
              color: '#f2f2f2',
              boxShadow: '0 18px 44px rgba(0,0,0,0.6)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 16, color: '#fff4cc' }}>How backups work</div>
            <div style={{ fontSize: 13, lineHeight: 1.7, display: 'grid', gap: 12 }}>
              <p style={{ margin: 0 }}>
                When you click <strong>Create Backup</strong>, Cubendo saves a duplicate of the selected Defaults.xml and appends
                <code style={{ marginLeft: 6, marginRight: 6, padding: '2px 6px', background: '#1f1f1f', borderRadius: 4 }}> (backup).xml</code>
                to the file name. You pick where it is stored, so place it somewhere you can find again.
              </p>
              <p style={{ margin: 0 }}>
                After you import the XML and build your palette, use the exported Defaults.xml from Cubendo to replace the Defaults.xml in your root folder. If the new file causes issues, delete it, copy the backup into the same folder, and rename it back to
                <code style={{ marginLeft: 6, padding: '2px 6px', background: '#1f1f1f', borderRadius: 4 }}>Defaults.xml</code>
                to restore your original configuration.
              </p>
              <p style={{ margin: 0 }}>
                Keep the backup until you are sure the new palette works. You can create additional backups whenever you import a different Defaults.xml.
              </p>
              <p style={{ margin: 0 }}>
                Everything stays on your device because Cubendo processes files locally in your browser and never uploads your Defaults.xml anywhere.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCloseBackupHelp}
              style={{
                marginTop: 22,
                width: '100%',
                background: '#2c2c2c',
                border: '1px solid #3d3d3d',
                color: '#fff',
                fontWeight: 600,
                borderRadius: 8,
                padding: '10px 14px',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#353535'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#2c2c2c'; }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {showImportModal && showTermsModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 10001
          }}
          onClick={() => setShowTermsModal(false)}
        >
          <div
            style={{
              background: '#151515',
              borderRadius: 12,
              border: '1px solid #303030',
              padding: 28,
              maxWidth: 540,
              width: '90vw',
              maxHeight: '85vh',
              overflow: 'auto',
              color: '#e4e4e4',
              boxShadow: '0 18px 40px rgba(0,0,0,0.55)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: '#fff' }}>Community Terms of Use</div>
            <div style={{ fontSize: 13, lineHeight: 1.7, display: 'grid', gap: 12 }}>
              <p style={{ margin: 0 }}>
                This is a free, open-source color editor that I maintain. I try to make it safe and easy to use, but I can’t guarantee it won’t cause any issues. Please back up your Defaults.xml file and check compatibility with your Cubase or Nuendo setup. This tool has been tested with Cubase 14 and Nuendo 14. It should also work with earlier versions, though export formatting may vary slightly, and more testing is needed.
              </p>
              <p style={{ margin: 0 }}>
                By using this tool, you take responsibility for your own backups and project files. I’m not liable for data loss, configuration issues, or other unexpected problems.
              </p>
              <p style={{ margin: 0 }}>
                Please don’t share modified Defaults.xml files in ways that violate Steinberg’s terms. If you want to share color palettes, export them as JSON, these only contain color codes, and the Cubendo tool can convert them back into Defaults.xml for your own projects.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowTermsModal(false)}
              style={{
                marginTop: 22,
                width: '100%',
                background: '#2f2f2f',
                border: '1px solid #404040',
                color: '#fff',
                fontWeight: 600,
                borderRadius: 8,
                padding: '10px 14px',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#3a3a3a'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#2f2f2f'; }}
            >
              Close
            </button>
          </div>
        </div>
      )}
      
      <div className="layout">
        {/* Left Sidebar */}
        <aside className="sidebar left" style={{ padding: 10, gap: 0 }}>

          {/* Round-Trip Test removed */}
          {/* Create Backup moved to right sidebar */}
          {/* Gradient Generator Section */}
          <div style={{ background: '#232323', borderRadius: 10, padding: 12, marginBottom: 6, boxShadow: '0 1px 4px #0002', display: 'flex', flexDirection: 'column', gap: 8, opacity: !xmlDoc ? 0.5 : 1, pointerEvents: !xmlDoc ? 'none' : 'auto', position: 'relative' }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#fff', marginBottom: 4, letterSpacing: '-0.3px' }}>Gradient Generator</div>
            {!xmlDoc && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(35, 35, 35, 0.8)', borderRadius: 10, zIndex: 1 }}>
                <div style={{ color: '#ff4d4d', fontSize: 14, fontWeight: 600, textAlign: 'center', padding: 20 }}>Import XML first</div>
              </div>
            )}
            
            {/* Live Gradient Preview */}
            {(() => {
              // Simple RGB interpolation matching the modal
              const totalPreviewBlocks = 8;
              const activeSteps = gradientSteps;
              const gradientColors = [];
              
              for (let i = 0; i < activeSteps; i++) {
                const t = i / (activeSteps - 1);
                const r1 = parseInt(gradientStart.slice(1, 3), 16);
                const g1 = parseInt(gradientStart.slice(3, 5), 16);
                const b1 = parseInt(gradientStart.slice(5, 7), 16);
                const r2 = parseInt(computedGradientEnd.slice(1, 3), 16);
                const g2 = parseInt(computedGradientEnd.slice(3, 5), 16);
                const b2 = parseInt(computedGradientEnd.slice(5, 7), 16);
                const r = Math.round(r1 + (r2 - r1) * t);
                const g = Math.round(g1 + (g2 - g1) * t);
                const b = Math.round(b1 + (b2 - b1) * t);
                gradientColors.push(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase());
              }
              
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4, height: 32, borderRadius: 6, overflow: 'hidden', border: '1px solid #444' }}>
                  {Array.from({ length: totalPreviewBlocks }).map((_, i) => {
                    const isActive = i < activeSteps;
                    const color = isActive ? gradientColors[i] : '#1a1a1a';
                    return (
                      <div 
                        key={i} 
                        style={{ 
                          background: color,
                          opacity: isActive ? 1 : 0.3,
                          border: isActive ? 'none' : '1px dashed #444'
                        }} 
                        title={isActive ? color : 'Inactive'}
                      />
                    );
                  })}
                </div>
              );
            })()}
            
            {/* Steps control */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <label style={{ flex: 1, color: '#eee', fontSize: 13, fontWeight: 600 }}>
                Steps
              </label>
              <input 
                type="number" 
                min={2} 
                max={8} 
                value={gradientSteps} 
                onChange={e => {
                  const next = Number(e.target.value);
                  const clamped = Number.isFinite(next) ? Math.min(8, Math.max(2, next)) : 2;
                  setGradientSteps(clamped);
                }} 
                style={{ 
                  width: 56, 
                  fontSize: 14, 
                  borderRadius: 6, 
                  border: '1px solid #444', 
                  background: '#181818', 
                  color: '#fff', 
                  padding: '4px 8px',
                  textAlign: 'center',
                  fontWeight: 600
                }} 
                aria-label="Gradient Steps" 
              />
              <div style={{ display: 'inline-flex', gap: 4 }}>
                <button onClick={() => setGradientSteps(4)} style={{ background: gradientSteps === 4 ? '#444' : '#2b2b2b', color: gradientSteps === 4 ? '#fff' : '#ddd', border: '1px solid #444', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s' }}>4</button>
                <button onClick={() => setGradientSteps(8)} style={{ background: gradientSteps === 8 ? '#444' : '#2b2b2b', color: gradientSteps === 8 ? '#fff' : '#ddd', border: '1px solid #444', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s' }}>8</button>
              </div>
            </div>
            {/* Start/End color controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              {/* Start */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ color: '#eee', fontSize: 13, fontWeight: 600 }}>Start</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div 
                    style={{ 
                      width: 40, 
                      height: 40, 
                      border: '2px solid #444', 
                      borderRadius: 6,
                      background: gradientStart,
                      boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)',
                      flexShrink: 0,
                      cursor: 'pointer'
                    }}
                    onClick={openGradientEditor}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openGradientEditor();
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    title="Click to edit gradient colors"
                  />
                  <div 
                    contentEditable
                    suppressContentEditableWarning
                    onInput={e => {
                      let val = e.currentTarget.textContent.toUpperCase();
                      if (!val.startsWith('#')) val = '#' + val;
                      if (/^#[0-9A-F]{0,6}$/.test(val)) {
                        setGradientStart(val);
                      }
                    }}
                    onBlur={e => {
                      e.currentTarget.textContent = gradientStart;
                    }}
                    style={{ 
                      flex: 1,
                      fontSize: 13, 
                      borderRadius: 6, 
                      border: '1px solid #444', 
                      background: '#1a1a1a', 
                      color: '#888', 
                      padding: '8px',
                      textAlign: 'center',
                      fontWeight: 600,
                      fontFamily: 'monospace',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'text'
                    }}
                  >
                    {gradientStart}
                  </div>
                </div>
              </div>
              
              {/* End */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ color: '#aaa', fontSize: 13, fontWeight: 600 }}>
                    End <span style={{ fontSize: 11, color: gradientManualEnd ? '#4a9eff' : '#777' }}>({gradientManualEnd ? 'manual' : 'auto'})</span>
                  </label>
                  {/* Toggle Switch */}
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 6 }}>
                    <span style={{ fontSize: 10, color: '#888', fontWeight: 600 }}>Auto</span>
                    <div
                      onClick={() => {
                        const newManual = !gradientManualEnd;
                        setGradientManualEnd(newManual);
                        if (!newManual) {
                          // Switching back to auto - recalculate end color
                          const autoEnd = lighten(gradientStart, (gradientEndPct / 100) * MAX_LIGHTEN);
                          setGradientEndColor(autoEnd);
                        }
                      }}
                      style={{
                        width: 32,
                        height: 16,
                        borderRadius: 8,
                        background: gradientManualEnd ? '#4a9eff' : '#444',
                        position: 'relative',
                        transition: 'background 0.2s',
                        border: '1px solid #333'
                      }}
                    >
                      <div
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          background: '#fff',
                          position: 'absolute',
                          top: 1,
                          left: gradientManualEnd ? 17 : 1,
                          transition: 'left 0.2s',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 10, color: '#888', fontWeight: 600 }}>Manual</span>
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div 
                    style={{ 
                      width: 40, 
                      height: 40, 
                      border: '2px solid #444', 
                      borderRadius: 6,
                      background: computedGradientEnd,
                      boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)',
                      flexShrink: 0,
                      cursor: 'pointer'
                    }} 
                    title={computedGradientEnd}
                    onClick={openGradientEditor}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openGradientEditor();
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  />
                  <div
                    onClick={openGradientEditor}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openGradientEditor();
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    style={{ 
                    flex: 1,
                    fontSize: 13, 
                    borderRadius: 6, 
                    border: '1px solid #444', 
                    background: '#1a1a1a', 
                    color: '#888', 
                    padding: '8px',
                    textAlign: 'center',
                    fontWeight: 600,
                    fontFamily: 'monospace',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                  >
                    {computedGradientEnd}
                  </div>
                </div>
              </div>
            </div>
            {/* Saturation and Lightness controls */}
            <div style={{ width: '100%', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Saturation */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: '#eee', fontWeight: 600 }}>Saturation</span>
                  {editingSat ? (
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={Math.round(gradientSaturation * 100)}
                      autoFocus
                      onBlur={() => { setEditingSat(false); }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === 'Escape') setEditingSat(false);
                      }}
                      onChange={e => {
                        let v = Math.max(0, Math.min(100, Number(e.target.value)));
                        setGradientSaturation(v / 100);
                      }}
                      disabled={gradientControlsLocked}
                      style={{ width: 48, fontSize: 13, color: gradientControlsLocked ? '#555' : '#fff', background: '#181818', border: '1px solid #444', borderRadius: 4, textAlign: 'center', padding: '2px 4px', fontWeight: 600, opacity: gradientControlsLocked ? 0.4 : 1 }}
                      aria-label="Edit Saturation %"
                    />
                  ) : (
                    <span
                      style={{ fontSize: 13, color: gradientControlsLocked ? '#555' : '#bbb', minWidth: 42, textAlign: 'center', cursor: gradientControlsLocked ? 'not-allowed' : 'pointer', padding: '2px 6px', background: gradientControlsLocked ? '#1f1f1f' : '#2a2a2a', borderRadius: 4, fontWeight: 600, opacity: gradientControlsLocked ? 0.5 : 1 }}
                      tabIndex={gradientControlsLocked ? -1 : 0}
                      onClick={() => { if (!gradientControlsLocked) setEditingSat(true); }}
                      onKeyDown={e => { if (!gradientControlsLocked && (e.key === 'Enter' || e.key === ' ')) setEditingSat(true); }}
                      title={gradientControlsLocked ? 'Locked while end color is manual' : 'Click to edit saturation %'}
                    >
                      {Math.round(gradientSaturation * 100)}%
                    </span>
                  )}
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={gradientSaturation}
                  onChange={e => setGradientSaturation(Number(e.target.value))}
                  disabled={gradientControlsLocked}
                  style={{ width: '100%', opacity: gradientControlsLocked ? 0.4 : 1 }}
                  aria-label="Gradient Saturation"
                />
              </div>
              
              {/* Lightness (End %) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: '#eee', fontWeight: 600 }}>Lightness</span>
                  {editingEnd ? (
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={gradientEndPct}
                      autoFocus
                      onBlur={() => { setEditingEnd(false); }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === 'Escape') setEditingEnd(false);
                      }}
                      onChange={e => {
                        let v = Math.max(0, Math.min(100, Number(e.target.value)));
                        setGradientEndPct(v);
                      }}
                      disabled={gradientControlsLocked}
                      style={{ width: 48, fontSize: 13, color: gradientControlsLocked ? '#555' : '#fff', background: '#181818', border: '1px solid #444', borderRadius: 4, textAlign: 'center', padding: '2px 4px', fontWeight: 600, opacity: gradientControlsLocked ? 0.4 : 1 }}
                      aria-label="Edit Lightness %"
                    />
                  ) : (
                    <span
                      style={{ fontSize: 13, color: gradientControlsLocked ? '#555' : '#bbb', minWidth: 42, textAlign: 'center', cursor: gradientControlsLocked ? 'not-allowed' : 'pointer', padding: '2px 6px', background: gradientControlsLocked ? '#1f1f1f' : '#2a2a2a', borderRadius: 4, fontWeight: 600, opacity: gradientControlsLocked ? 0.5 : 1 }}
                      tabIndex={gradientControlsLocked ? -1 : 0}
                      onClick={() => { if (!gradientControlsLocked) setEditingEnd(true); }}
                      onKeyDown={e => { if (!gradientControlsLocked && (e.key === 'Enter' || e.key === ' ')) setEditingEnd(true); }}
                      title={gradientControlsLocked ? 'Locked while end color is manual' : 'Click to edit lightness %'}
                    >
                      {gradientEndPct}%
                    </span>
                  )}
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={gradientEndPct}
                  onChange={e => setGradientEndPct(Number(e.target.value))}
                  disabled={gradientControlsLocked}
                  style={{ width: '100%', opacity: gradientControlsLocked ? 0.4 : 1 }}
                  aria-label="Gradient Lightness %"
                />
              </div>
            </div>
            <button
              className="btn"
              style={{
                width: '100%',
                marginTop: 6,
                background: paletteAtCapacity ? '#232323' : '#444',
                color: '#fff',
                fontWeight: 700,
                borderRadius: 7,
                fontSize: 15,
                boxShadow: '0 1px 4px #0002',
                border: paletteAtCapacity ? '1px solid #333' : 'none',
                padding: '7px 0',
                transition: 'background 0.15s',
                outline: 'none',
                cursor: paletteAtCapacity ? 'not-allowed' : 'pointer',
                opacity: paletteAtCapacity ? 0.5 : 1,
              }}
              disabled={paletteAtCapacity}
              title={paletteAtCapacity ? `Palette limit reached (${MAX_PALETTE_COLORS})` : 'Add a generated gradient'}
              onClick={handleApplyGradient}
              aria-label="Add Gradient"
              onFocus={e => { if (!paletteAtCapacity) e.currentTarget.style.boxShadow = '0 0 0 2px #ff4d4d'; }}
              onBlur={e => e.currentTarget.style.boxShadow = '0 1px 4px #0002'}
              onMouseEnter={e => { if (!paletteAtCapacity) e.currentTarget.style.background = '#555'; }}
              onMouseLeave={e => { if (!paletteAtCapacity) e.currentTarget.style.background = '#444'; }}
            >
              Add Gradient
            </button>
          </div>
          {/* Drag Mode Toggle (moved below Add Gradient) */}
          <button 
            onClick={() => setDragMode(dragMode === 'SWATCH' ? 'ROW' : 'SWATCH')}
            disabled={!xmlDoc || colors.length === 0}
            title={dragMode === 'SWATCH' ? 'Switch to Row Drag Mode' : 'Switch to Swatch Drag Mode'}
            style={{
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: 8, 
              width: '100%', 
              background: (!xmlDoc || colors.length === 0) ? '#232323' : (dragMode === 'ROW' ? '#4a9eff' : '#444'), 
              color: '#fff', 
              border: (!xmlDoc || colors.length === 0) ? '1px solid #333' : 'none', 
              borderRadius: 7, 
              padding: '10px 14px', 
              fontWeight: 700, 
              fontSize: 13, 
              cursor: (!xmlDoc || colors.length === 0) ? 'not-allowed' : 'pointer',
              opacity: (!xmlDoc || colors.length === 0) ? 0.5 : 1,
              margin: '8px 0',
              boxShadow: '0 1px 4px #0002',
              transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => { 
              if (xmlDoc && colors.length > 0) {
                e.currentTarget.style.transform = 'scale(1.02)';
              }
            }}
            onMouseLeave={(e) => { 
              if (xmlDoc && colors.length > 0) {
                e.currentTarget.style.transform = 'scale(1)';
              }
            }}
          >
            {dragMode === 'SWATCH' ? (
              <>
                <RowModeIcon />
                <span>Row Mode</span>
              </>
            ) : (
              <>
                <SwatchModeIcon />
                <span>Swatch Mode</span>
              </>
            )}
          </button>

          {/* Harmony control */}
          <div style={{ width: '100%', margin: '4px 0 8px 0', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#fff', letterSpacing: '-0.3px' }}>Balance Mode</div>
              <BalanceModeToggle
                isGentle={isGentleBalance}
                onToggle={() => setBalanceMode((prev) => (prev === 'gentle' ? 'vibrant' : 'gentle'))}
                disabled={isBalancing}
                isBalancing={isBalancing}
              />
            </div>
            <button
              type="button"
              className="btn"
              onClick={handleBalancePalette}
              disabled={colors.length < 2 || isBalancing}
              style={{
                width: '100%',
                background: isBalancing ? balanceBackgroundActive : balanceBackgroundIdle,
                borderRadius: 12,
                border: `1px solid ${balanceBorder}`,
                boxShadow: balanceOuterShadow,
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                color: balanceButtonText,
                fontWeight: 600,
                fontSize: 15,
                cursor: colors.length < 2 || isBalancing ? 'not-allowed' : 'pointer',
                opacity: colors.length < 2 && !isBalancing ? 0.5 : 1,
                transition: 'background 0.2s ease, transform 0.2s ease',
                transform: isBalancing ? 'scale(0.99)' : 'scale(1)'
              }}
              aria-label="Balance Palette"
              title={isGentleBalance
                ? 'Gentle balance: harmonise while preserving pastel saturation'
                : 'Balance palette: harmonise hue, lightness, and saturation for consistency'}
            >
              <div style={{ position: 'relative', width: 120, height: 120 }}>
                <svg width="120" height="120" viewBox="0 0 120 120" style={{ position: 'absolute', inset: 0 }}>
                  <defs>
                    <linearGradient id="balanceProgressGradient" x1="0" x2="1" y1="0" y2="0">
                      <stop offset="0%" stopColor={balanceAccentPrimary} />
                      <stop offset="100%" stopColor={balanceAccentSecondary} />
                    </linearGradient>
                  </defs>
                  <circle cx="60" cy="60" r={arcRadius} stroke={balanceMeterBackground} strokeWidth="10" fill="none" />
                  <circle
                    cx="60"
                    cy="60"
                    r={arcRadius}
                    stroke="url(#balanceProgressGradient)"
                    strokeWidth="10"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${arcCircumference} ${arcCircumference}`}
                    strokeDashoffset={arcDashOffset}
                    transform="rotate(-90 60 60)"
                    style={{ transition: 'stroke-dashoffset 0.25s ease-out' }}
                  />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 78, height: 78, borderRadius: '50%', background: balanceInnerBackground, border: `2px solid ${balanceBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: balanceInnerShadow }}>
                    <svg width="52" height="52" viewBox="0 0 48 48" aria-hidden="true">
                      <path d="M24 10v20" stroke={balanceAccentPrimary} strokeWidth="2.2" strokeLinecap="round" />
                      <path d="M14 18h20" stroke={balanceAccentPrimary} strokeWidth="2.2" strokeLinecap="round" />
                      <path d="M18 18l-6 10h12l-6-10z" fill={balanceTriangleFill} stroke={balanceAccentPrimary} strokeWidth="1.8" strokeLinejoin="round" />
                      <path d="M30 18l-6 10h12l-6-10z" fill={balanceTriangleFill} stroke={balanceAccentPrimary} strokeWidth="1.8" strokeLinejoin="round" />
                      <path d="M18 34h12" stroke={balanceAccentPrimary} strokeWidth="2.2" strokeLinecap="round" />
                      <path d="M16 38h16" stroke={balanceAccentPrimary} strokeWidth="2.2" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{isBalancing ? 'Balancing...' : isGentleBalance ? 'Pastelise' : 'Harmonise'}</div>
            </button>
            <span style={{ fontSize: 12, fontWeight: 600, color: balanceStatusColor, textAlign: 'center' }}>
              {isBalancing
                ? (isGentleBalance ? 'Gentle harmonising, preserving pastels' : 'Harmonising - aiming for 100%')
                : balanceScore !== null
                  ? `Harmony score ≈ ${Math.min(100, Math.max(0, balanceScore))}%`
                  : isGentleBalance ? 'Gentle mode ready' : 'Ready to harmonise'}
            </span>
          </div>
        </aside>

        <main className="main" ref={mainScrollRef}>
          <div
            ref={gridRef}
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              background: '#1a1a1a',
              borderRadius: 8,
              padding: 16,
              border: '1px solid #2f2f2f',
              flex: '1 1 auto',
              minHeight: 0,
            }}
          >
            {error && (
              <div
                role="alert"
                style={{
                  background: '#3b1f1f',
                  border: '1px solid #6b2a2a',
                  color: '#ffb0b0',
                  borderRadius: 8,
                  padding: '10px 12px',
                  fontSize: 13,
                  fontWeight: 600,
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
                }}
              >
                {error}
              </div>
            )}
            {colors.length === 0 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '50vh',
                color: '#666',
                gap: 16,
              }}>
                <div style={{ fontSize: 64 }}>🎨</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>No Colors Yet</div>
                <div style={{ fontSize: 14, textAlign: 'center', maxWidth: 400, lineHeight: 1.6 }}>
                  Import a Defaults.xml file or click "+ Add Color" to get started
                </div>
              </div>
            ) : dragMode === 'ROW' ? (
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="palette-rows" type="ROW">
                  {(rowProvided) => (
                    <div ref={rowProvided.innerRef} {...rowProvided.droppableProps} style={{ width: '100%' }}>
                      {(() => {
                        const rows = [];
                        for (let start = 0; start < colors.length; start += columns) {
                          const end = Math.min(start + columns, colors.length);
                          const rowIndex = Math.floor(start / columns);
                          rows.push({ rowIndex, colors: colors.slice(start, end) });
                        }
                        return rows.map((row) => (
                          <DraggableRow
                            key={`row-${row.rowIndex}`}
                            rowId={`row-${row.rowIndex}`}
                            rowIndex={row.rowIndex}
                            colors={row.colors}
                            onSwatchClick={handleSwatchClick}
                            handleRemoveColor={handleRemoveColor}
                            onCopyColor={handleCopyColor}
                            copiedIndex={copiedIndex}
                            columns={columns}
                            canDrag={row.colors.length >= columns}
                            showColorNames={showColorNames}
                          />
                        ));
                      })()}
                      {rowProvided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            ) : (
              <DndProvider backend={HTML5Backend}>
                <CustomDragLayer colors={colors} />
                <div
                  ref={swatchGridRef}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
                    gap: 8,
                    width: '100%',
                  }}
                >
                  {colors.map((c, swatchIndex) => (
                    <DraggableSwatchGrid
                      key={c.id}
                      id={c.id}
                      index={swatchIndex}
                      color={c.color}
                      onRemove={handleRemoveColor}
                      onCopy={handleCopyColor}
                      copied={copiedIndex === c.id}
                      onSwatchClick={handleSwatchClick}
                      selected={false}
                      moveColor={moveColor}
                      draggingItemId={draggingItemId}
                      setDraggingItemId={setDraggingItemId}
                      onDragEnd={handleDragEnd}
                      canDrag={swatchDragReady}
                      showColorNames={showColorNames}
                    />
                  ))}
                </div>
              </DndProvider>
            )}
          </div>
        </main>
        {/* Right Sidebar: Presets Panel */}
        <aside className="sidebar right" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, position: 'relative' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px', marginBottom: 6 }}>Palette Presets</div>
          
          {/* Disabled Overlay */}
          {!xmlDoc && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(35, 35, 35, 0.8)', borderRadius: 8, zIndex: 10 }}>
              <div style={{ color: '#ff4d4d', fontSize: 14, fontWeight: 600, textAlign: 'center', padding: 20 }}>
                Import XML first
              </div>
            </div>
          )}

          

          {/* Save Preset Section */}
          <div style={{ marginBottom: 8, opacity: !xmlDoc ? 0.5 : 1, pointerEvents: !xmlDoc ? 'none' : 'auto' }}>
            <input
              type="text"
              placeholder="Preset name..."
              value={presetName}
              onChange={e => setPresetName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSavePreset();
              }}
              disabled={!xmlDoc || colors.length === 0}
              style={{
                width: '100%',
                background: '#181818',
                border: '1px solid #333',
                borderRadius: 7,
                padding: '8px 12px',
                color: '#fff',
                fontSize: 14,
                marginBottom: 10,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={() => {
                  if (colors.length === 0) {
                    alert('No colors to save yet.');
                    return;
                  }
                  const paletteHexes = colors.map(c => c.color);
                  const json = JSON.stringify(paletteHexes, null, 2);
                  const blob = new Blob([json], { type: 'application/json' });
                  const trimmed = presetName.trim();
                  const suffix = trimmed ? trimmed.replace(/\s+/g, '_') : 'Untitled';
                  saveAs(blob, `CPE_Preset_${suffix}.json`);
                }}
                disabled={colors.length === 0}
                title={colors.length === 0 ? 'Add or import colors before saving' : 'Save the current palette (hex values only)'}
                style={{
                  width: '100%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  background: colors.length === 0 ? '#232323' : '#2a2a2a',
                  color: '#fff',
                  border: '1px solid #333',
                  borderRadius: 7,
                  padding: '8px 12px',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: colors.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: colors.length === 0 ? 0.5 : 1,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (colors.length > 0) e.currentTarget.style.background = '#333'; }}
                onMouseLeave={e => { if (colors.length > 0) e.currentTarget.style.background = '#2a2a2a'; }}
              >
                <SaveIcon />
                Save JSON
              </button>
              <button
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.json';
                  input.onchange = async (event) => {
                    try {
                      const file = event.target.files && event.target.files[0];
                      if (!file) return;
                      const text = await file.text();
                      const parsed = JSON.parse(text);
                      const candidate = Array.isArray(parsed)
                        ? parsed
                        : (parsed && Array.isArray(parsed.colors) ? parsed.colors : null);

                      if (!candidate || candidate.length === 0) {
                        alert('No colors found in this JSON file.');
                        return;
                      }

                      const sanitized = candidate.map((hex) =>
                        typeof hex === 'string' ? hex.trim().toUpperCase() : ''
                      );

                      const invalid = sanitized.filter(hex => !/^#[0-9A-F]{6}$/.test(hex));
                      if (invalid.length > 0) {
                        alert('Some entries are not valid 6-digit hex colors. Please fix the file and try again.');
                        return;
                      }

                      const truncated = sanitized.slice(0, MAX_PALETTE_COLORS);
                      const newPalette = truncated.map(color => ({ id: uuidv4(), color }));
                      setOriginalOrder(newPalette.map(c => c.id));
                      pushHistory(newPalette);

                      if (sanitized.length > MAX_PALETTE_COLORS) {
                        setError(`Palette file contains ${sanitized.length} colors. Only the first ${MAX_PALETTE_COLORS} were loaded.`);
                      }
                    } catch (err) {
                      alert('Failed to load palette: ' + err.message);
                    }
                  };
                  input.click();
                }}
                title="Load a palette JSON (hex array)"
                style={{
                  width: '100%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  background: '#2a2a2a',
                  color: '#fff',
                  border: '1px solid #333',
                  borderRadius: 7,
                  padding: '8px 12px',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#333'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#2a2a2a'; }}
              >
                <LoadIcon />
                Load JSON
              </button>

              {/* Palette Library Button moved below Load JSON */}
              <button
                type="button"
                onClick={() => setShowPresetLibrary(true)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: '#222',
                  border: '1px solid #3a3a3a',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  transition: 'background 0.15s, transform 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#2f2f2f';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#222';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
                title="Browse palettes"
              >
                <PresetsIcon />
                <span>Palettes</span>
              </button>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #333', margin: '8px 0' }} />

          {/* Presets List */}
          <div style={{ opacity: !xmlDoc ? 0.5 : 1, pointerEvents: !xmlDoc ? 'none' : 'auto' }}>
            {/* Controls Grid */}
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px', margin: '12px 0 6px' }}>Controls</div>
            <div className="btn-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
              {/* Balance Palette moved to left sidebar */}
              <button className="btn" onClick={handleRestoreOriginal} disabled={!canRestoreOriginal} title={!xmlDoc ? 'Import XML first' : canRestoreOriginal ? 'Restore original import order' : 'Original order unavailable (palette changed)'} aria-label="Restore original order">Original</button>
              <button className="btn" onClick={handleFlipPalette} disabled={!xmlDoc || colors.length < 2} title={!xmlDoc ? 'Import XML first' : 'Mirror left/right within each row'} aria-label="Flip rows">Flip</button>
              <button className="btn" onClick={handleInvertPalette} disabled={!xmlDoc || colors.length < 2} title={!xmlDoc ? 'Import XML first' : 'Invert row order while keeping left-to-right colour order'} aria-label="Invert rows">Invert</button>
              <button className="btn" onClick={handleReversePalette} disabled={!xmlDoc || colors.length < 2} title={!xmlDoc ? 'Import XML first' : 'Reverse order'} aria-label="Reverse">Reverse</button>
              <button className="btn" onClick={handleShufflePalette} disabled={!xmlDoc || colors.length < 2} title={!xmlDoc ? 'Import XML first' : 'Shuffle colors'} aria-label="Shuffle">Shuffle</button>
              <button className="btn" onClick={handleSortByHue} disabled={!xmlDoc || colors.length < 2} title={!xmlDoc ? 'Import XML first' : 'Sort by Hue'} aria-label="Sort by Hue">Sort: Hue</button>
              <button className="btn" onClick={handleSortBySaturation} disabled={!xmlDoc || colors.length < 2} title={!xmlDoc ? 'Import XML first' : 'Sort by Saturation'} aria-label="Sort by Saturation">Sort: Sat</button>
              <button className="btn" onClick={handleSortByLightness} disabled={!xmlDoc || colors.length < 2} title={!xmlDoc ? 'Import XML first' : 'Sort by Lightness'} aria-label="Sort by Lightness">Sort: Light</button>
              {/* Round-Trip Test removed */}
            </div>
          </div>

          {/* Danger Zone removed here (Delete All placed near Save Preset) */}

          {/* Bottom Load button removed; now located under Save */}
        </aside>
      </div>
      {/* Eyedropper mode overlay */}
      {eyedropper && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#222',
              color: '#fff',
              padding: '8px 18px',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 16,
              boxShadow: '0 2px 16px #0008',
              border: '2px solid #ff4d4d',
              opacity: 0.97,
              pointerEvents: 'auto',
              cursor: 'pointer',
            }}
            title="Click to cancel eyedropper"
            onClick={e => { e.stopPropagation(); setEyedropper(null); }}
          >
            Eyedropper active; click a swatch to copy its color. Click this banner to cancel.
          </div>
        </div>
      )}
      
      {/* Help Modal */}
      {showHelp && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: '#000c',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setShowHelp(false)}
        >
          <div
            style={{
              background: '#1a1a1a',
              borderRadius: 12,
              padding: 24,
              maxWidth: 700,
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 4px 24px #0008',
              border: '1px solid #333',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ color: '#ff4d4d', marginTop: 0, marginBottom: 16 }}>Cubase Color Palette Editor 🎨</h2>

            <div style={{ color: '#ddd', fontSize: 14, lineHeight: 1.6 }}>
              <p style={{ marginBottom: 12 }}>
                <b>Important:</b> Please ensure <span style={{ color: '#ff4d4d' }}>Cubase or Nuendo is not running</span> before replacing or editing your <b>Defaults.xml</b>. This ensures the best workflow.
              </p>


              <h3 style={{ color: '#fff', marginTop: 12, marginBottom: 10 }}>Using the Cubendo Palette Editor</h3>
              <ol style={{ marginLeft: 16, marginBottom: 12 }}>
                <li style={{ marginBottom: 8 }}>
                  <strong>Import XML:</strong> Follow the prompts to load, and import, your <b>Defaults.xml</b>.
                </li>
                <li style={{ marginBottom: 8 }}>
                  <strong>Grid basics:</strong> Up to 128 colours. Click and drag swatches to re-order, double-click to open the swatch editor. Click the HEX label to copy it to your clipboard.
                </li>
                <li style={{ marginBottom: 8 }}>
                  <strong>Row Mode:</strong> Use Row Mode (keystroke <b>R</b>) to reorder swatch rows of 8.
                </li>
                <li style={{ marginBottom: 8 }}>
                  <strong>Swatch Editor:</strong> While the editor is open, use <b>←</b> and <b>→</b> to move between adjacent swatches.
                </li>
                <li style={{ marginBottom: 8 }}>
                  <strong>Eyedropper:</strong> Press <b>E</b> to add a colour from anywhere on screen (supported browsers). <b>Alt+Click</b> a swatch, then click another swatch to copy its colour into the first.
                </li>
                <li style={{ marginBottom: 8 }}>
                  <strong>Gradient Editor:</strong> Build a start/end, set steps, and click <b>Add</b>. New colours are appended; the grid scrolls to them and the editor stays open for more.
                </li>
                <li style={{ marginBottom: 8 }}>
                  <strong>Balance:</strong> Use <b>Harmonise</b> for even hue/lightness or <b>Pastelise</b> to preserve saturation. Watch the score ring for feedback.
                </li>
                <li style={{ marginBottom: 8 }}>
                  <strong>Labels Toggle:</strong> Switch swatch labels between <b>HEX</b> and <b>Names</b> from the toolbar (saved in your browser).
                </li>
                <li style={{ marginBottom: 8 }}>
                  <strong>Palettes & JSON:</strong> <b>Save JSON</b> and <b>Load JSON</b> for sharing. Browse community and saved sets in <b>Palettes</b>.
                </li>
                <li style={{ marginBottom: 8 }}>
                  <strong>Undo/Redo:</strong> Use the toolbar buttons to revert or reapply changes.
                </li>
                <li style={{ marginBottom: 8 }}>
                  <strong>Export:</strong> When finished, click <b>Export</b> to download a new <b>Defaults.xml</b> with your colours.
                </li>
              </ol>

              <p style={{ marginTop: 8, fontSize: 13, color: '#aaa' }}>
                <strong>Tips:</strong> <b>Ctrl+Click</b> duplicates a swatch. <b>Shift+Click</b> the X on a swatch to remove its entire row. Keep a backup until you’re happy with the new palette.
              </p>
            </div>
            
            <button
              onClick={() => setShowHelp(false)}
              style={{
                marginTop: 20,
                width: '100%',
                background: '#444',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontWeight: 600,
                fontSize: 14,
                padding: '10px',
                cursor: 'pointer',
              }}
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="app-footer">
        <img
          src={LogoCubendo}
          alt="Cubendo Colour Picker"
          style={{ height: 36, width: 'auto', display: 'block', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.45))' }}
        />
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 16,
          flex: 1,
          justifyContent: 'center',
          fontSize: 12,
          color: '#aaa'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>💡</span>
            <span><strong>Tip:</strong> Use the eyedropper to add colors from anywhere on your screen.</span>
          </div>
          <span style={{ color: '#444' }}>•</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>✨</span>
            <span><strong>Row Reorder:</strong> Drag the row handle (⋮⋮) to move rows up or down!</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#bbb', fontSize: 13 }}>Colors: <b style={{ color: '#fff' }}>{colors.length}</b> / {MAX_PALETTE_COLORS}</span>
          <span style={{ color: '#444' }}>|</span>
          <span style={{ color: '#666', fontSize: 12 }}>v1.0</span>
          <span style={{ color: '#444' }}>|</span>
          <button
            onClick={() => setShowHelp(!showHelp)}
            style={{
              background: '#2a2a2a',
              border: '1px solid #333',
              borderRadius: 6,
              color: '#fff',
              fontWeight: 600,
              fontSize: 12,
              padding: '5px 10px',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#333'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#2a2a2a'}
          >
            {showHelp ? '❌ Close Help' : '❓ Help'}
          </button>
        </div>
      </footer>
    </div>
  );
}
