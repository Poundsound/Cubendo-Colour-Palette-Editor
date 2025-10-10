import { useState, useEffect, useCallback, useRef, useLayoutEffect, useMemo } from 'react';
import './App.css';
import { saveAs } from 'file-saver';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { DndProvider, useDrag, useDrop, useDragLayer } from 'react-dnd';
import { HTML5Backend, getEmptyImage } from 'react-dnd-html5-backend';
import { v4 as uuidv4 } from 'uuid';
import { parseDefaultsXml, extractEventColors, updateEventColors } from './utils/cubaseXml';

const MAX_PALETTE_COLORS = 128;

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
  setDraggingItemId,
  onDragEnd,
  canDrag = true,
}) {
  const ref = useRef(null);
  const lastMoveTime = useRef(0);

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
      if (!ref.current || !moveColor) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;

      const now = Date.now();
      if (now - lastMoveTime.current < 16) return;
      lastMoveTime.current = now;

      moveColor(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });

  drag(drop(ref));

  return (
    <div
      ref={ref}
      data-swatch-id={id}
      style={{
        opacity: isDragging ? 0.4 : 1,
        cursor: canDrag ? (isDragging ? 'grabbing' : 'grab') : 'default',
        position: 'relative',
        transform: isDragging ? 'scale(0.95)' : 'none',
        transition: isDragging ? 'none' : 'transform 120ms ease',
      }}
    >
      <SwatchDisplay
        id={id}
        color={color}
        onRemove={onRemove}
        onCopy={onCopy}
        copied={copied}
        onSwatchClick={onSwatchClick}
        selected={selected}
        isDragging={isDragging}
        isHoverTarget={!isDragging && isOver && canDrop}
      />
    </div>
  );
}

function CustomDragLayer({ colors }) {
  const { item, isDragging, clientOffset } = useDragLayer((monitor) => ({
    item: monitor.getItem(),
    isDragging: monitor.isDragging(),
    clientOffset: monitor.getClientOffset(),
  }));

  if (!isDragging || !clientOffset) return null;

  const found = item?.id ? colors.find((c) => c.id === item.id) : undefined;
  const color = found?.color ?? '#888888';

  const size = 96;
  const x = clientOffset.x - size / 2;
  const y = clientOffset.y - size / 2;

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        pointerEvents: 'none',
        zIndex: 4000,
        transform: `translate(${x}px, ${y}px) scale(1.05)`,
        boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
        animation: 'dragGlow 600ms ease-in-out infinite',
      }}
    >
      <div style={{ width: size, height: size }}>
        <SwatchDisplay
          id={item?.id}
          color={color}
          onRemove={() => {}}
          onCopy={() => {}}
          copied={false}
          onSwatchClick={() => {}}
          selected={false}
          isDragging
          isHoverTarget={false}
        />
      </div>
    </div>
  );
}
// Hello-Pangea DND Swatch (kept for compatibility if needed)
function DraggableSwatch({ id, color, index, onRemove, onCopy, copied, onSwatchClick, selected }) {
  return (
    <Draggable draggableId={id} index={index} type="SWATCH">
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={{
            ...provided.draggableProps.style,
          }}
        >
          <SwatchDisplay
            id={id}
            color={color}
            onRemove={onRemove}
            onCopy={onCopy}
            copied={copied}
            onSwatchClick={onSwatchClick}
            selected={selected}
            isDragging={snapshot.isDragging}
          />
        </div>
      )}
    </Draggable>
  );
}

function SwatchDisplay({ id, color, onRemove, onCopy, copied, onSwatchClick, selected, isDragging, isHoverTarget, isRowDragging = false }) {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <div
      className="sortable-item"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 4,
        position: 'relative',
        outline: selected ? '2px solid #ff4d4d' : 'none',
        outlineOffset: selected ? 0 : 0,
        pointerEvents: isDragging ? 'none' : 'auto',
      }}
      tabIndex={0}
      aria-label={`Color swatch ${color}`}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          onSwatchClick(id, e);
        }
      }}
      onDoubleClick={e => onSwatchClick(id, e)}
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
          cursor: isDragging ? 'grabbing' : 'grab',
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
        {/* Delete button floating top-right */}
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
          onClick={e => { e.stopPropagation(); onRemove(id, e.shiftKey); }}
          title="Remove color"
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = '0.8'}
        >×</button>
        {/* No individual drag handle needed anymore - rows are dragged as a whole */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 8,
          boxShadow: 'inset 0 2px 8px #0004',
          pointerEvents: 'none',
        }} />
      </div>
      {/* Hex code below the swatch, full width, square corners */}
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
          fontFamily: 'Fira Mono, monospace',
          boxSizing: 'border-box',
        }}
        title="Click to copy color code"
        tabIndex={0}
        onMouseDown={e => {
          e.stopPropagation();
          onCopy(id);
        }}
        onClick={e => {
          e.stopPropagation();
        }}
        onTouchStart={e => {
          e.stopPropagation();
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            onCopy(id);
          }
        }}
      >
        {copied ? 'Copied!' : color}
      </span>
    </div>
  );
}

// Row component using @hello-pangea/dnd's Draggable
// Row component with drag handle for row-level reordering
function DraggableRow({ rowIndex, rowId, colors, onSwatchClick, handleRemoveColor, setCopiedIndex, copiedIndex, columns }) {
  return (
    <Draggable draggableId={rowId} index={rowIndex} type="ROW">
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
              cursor: 'grab',
              padding: '8px',
              background: '#2a2a2a',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              color: '#888',
              fontWeight: 900,
              userSelect: 'none',
              flexShrink: 0,
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#333';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#2a2a2a';
              e.currentTarget.style.color = '#888';
            }}
            title="Drag to reorder entire row"
          >
            ⋮⋮
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
                onRemove={handleRemoveColor}
                onCopy={setCopiedIndex}
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
function balancePaletteIteration(colors) {
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
  const SATURATION_BOOST = 1.15; // Boost factor for chromatic colors
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
          // For chromatic: keep original hue and saturation, interpolate only lightness, then boost sat
          const l = first.l + (last.l - first.l) * t;
          let s = Math.min(1, orig.s * SATURATION_BOOST);
          balanced.push({ ...orig, color: hslToHex(orig.h, s, l) });
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
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const gridRef = useRef(null);
  const mainScrollRef = useRef(null);
  const swatchGridRef = useRef(null); // SWATCH mode grid container
  const [swatchDragReady, setSwatchDragReady] = useState(false);
  const [isBalancing, setIsBalancing] = useState(false);
  const [balanceProgress, setBalanceProgress] = useState(0);
  const [balanceScore, setBalanceScore] = useState(null);
  const [originalOrder, setOriginalOrder] = useState(null);
  const paletteAtCapacity = colors.length >= MAX_PALETTE_COLORS;

  const displayedPercentRaw = isBalancing ? balanceProgress : (balanceScore ?? 0);
  const displayedPercent = Math.round(Math.min(100, Math.max(0, displayedPercentRaw)));
  const arcRadius = 52;
  const arcCircumference = 2 * Math.PI * arcRadius;
  const arcDashOffset = arcCircumference * (1 - displayedPercent / 100);

  const resetBalanceUi = useCallback(() => {
    setIsBalancing(false);
    setBalanceProgress(0);
    setBalanceScore(null);
  }, []);
  
  // Track currently dragging item to apply visual state
  const [draggingItemId, setDraggingItemId] = useState(null);

  // FLIP animation: store previous rects of swatches between renders
  const prevRectsRef = useRef(new Map());
  const skipFlipOnceRef = useRef(false);

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

  // Animate swatch reordering transitions in SWATCH mode (post-drop)
  useLayoutEffect(() => {
    if (isBalancing || dragMode !== 'SWATCH') {
      prevRectsRef.current = new Map();
      skipFlipOnceRef.current = false;
      return;
    }
    if (!swatchGridRef.current) return;
    // Skip while dragging to avoid mid-drag jitter; animate on commit
    if (draggingItemId) return;

    const shouldSkipAnimation = skipFlipOnceRef.current;
    if (shouldSkipAnimation) {
      skipFlipOnceRef.current = false;
    }

    const nodes = swatchGridRef.current.querySelectorAll('[data-swatch-id]');
    const currentRects = new Map();
    nodes.forEach((node) => {
      const id = node.getAttribute('data-swatch-id');
      if (!id) return;
      currentRects.set(id, node.getBoundingClientRect());
    });

    // If we have previous rects, animate from previous to current
    if (!shouldSkipAnimation && prevRectsRef.current.size) {
      nodes.forEach((node) => {
        const id = node.getAttribute('data-swatch-id');
        const prev = id ? prevRectsRef.current.get(id) : null;
        const last = id ? currentRects.get(id) : null;
        if (!id || !prev || !last) return;
        const dx = prev.left - last.left;
        const dy = prev.top - last.top;
        if (dx !== 0 || dy !== 0) {
          node.style.transition = 'none';
          node.style.transform = `translate(${dx}px, ${dy}px)`;
          // Force reflow
          void node.getBoundingClientRect();
          node.style.transition = 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)';
          node.style.transform = 'translate(0, 0)';
          const cleanup = () => {
            node.style.transition = '';
            node.removeEventListener('transitionend', cleanup);
          };
          node.addEventListener('transitionend', cleanup);
        }
      });
    }

    prevRectsRef.current = currentRects;
  }, [colors, dragMode, draggingItemId, isBalancing]);

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
      let raf1 = 0, raf2 = 0;
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setSwatchDragReady(true));
      });
      return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
    } else {
      setSwatchDragReady(false);
    }
  }, [dragMode]);

  // When colors are first populated (e.g., after XML import) in SWATCH mode, ensure drag is ready
  const prevColorCountRef = useRef(0);
  useEffect(() => {
    const prev = prevColorCountRef.current;
    const curr = colors.length;
    prevColorCountRef.current = curr;
    if (dragMode === 'SWATCH' && prev === 0 && curr > 0) {
      setSwatchDragReady(false);
      let raf1 = 0, raf2 = 0;
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setSwatchDragReady(true));
      });
      return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
    }
    return undefined;
  }, [colors.length, dragMode]);
  
  // Use ref to track the current order without triggering re-renders
  const dragOrderRef = useRef(colors);
  
  // Update ref when colors change from other sources
  useEffect(() => {
    dragOrderRef.current = colors;
  }, [colors]);
  
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
    const { preserveScroll = false, skipFlip = false } = options;
    const restoreScroll = preserveScroll ? createScrollRestorer() : null;
    if (preserveScroll || skipFlip) skipFlipOnceRef.current = true;
    setHistory(h => [...h, colors.map(c => ({ ...c }))]);
    setFuture([]);
    setColors(newColors);
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
  const handleScreenPickAddNew = useCallback(async () => {
    if (colors.length >= MAX_PALETTE_COLORS) {
      setError(`Palette limit reached (${MAX_PALETTE_COLORS}). Remove a color before adding another.`);
      return;
    }
    try {
      if ('EyeDropper' in window) {
        const eye = new window.EyeDropper();
        const result = await eye.open();
        const newHex = result.sRGBHex.toUpperCase();
        pushHistory([...colors, { id: uuidv4(), color: newHex }]);
      } else {
        alert('Screen Eyedropper not supported in this browser.');
      }
    } catch (err) {
      console.debug('Screen pick cancelled or failed:', err);
    }
  }, [colors, pushHistory]);

  // Global shortcut: press 'E' to pick any on-screen color and add as a new swatch
  useEffect(() => {
    const onKey = (e) => {
      if (e.key.toLowerCase() === 'e') {
        handleScreenPickAddNew();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleScreenPickAddNew]);

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
    setFuture(f => [colors.map(c => ({ ...c })), ...f]);
    setColors(history[history.length - 1]);
    setHistory(h => h.slice(0, -1));
    resetBalanceUi();
  };

  // Redo
  const handleRedo = () => {
    if (future.length === 0) return;
    setHistory(h => [...h, colors.map(c => ({ ...c }))]);
    setColors(future[0]);
    setFuture(f => f.slice(1));
    resetBalanceUi();
  };

  // Handle file upload and parse XML
  const handleFileUpload = async (e) => {
    setError('');
    let file;
    if (e.target && e.target.files && e.target.files[0]) {
      file = e.target.files[0];
    } else if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
      file = e.dataTransfer.files[0];
    } else {
      setError('No file selected.');
      return;
    }
    const text = await file.text();
    try {
      const doc = parseDefaultsXml(text);
      const hexes = extractEventColors(doc);
      if (!hexes) {
        setError('Could not find Event Colors in this Defaults.xml');
        return;
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
        setError(`Imported ${hexes.length} colors but only the first ${MAX_PALETTE_COLORS} were loaded.`);
      }
    } catch (err) {
      console.error(err);
      setError(String(err.message || 'Failed to parse XML.'));
    }
  };

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
    pushHistory([...colors, { id: uuidv4(), color: '#000000' }]);
  };

  // Compute end color based on start color and percentage, clamped so 100% is not pure white
  const MAX_LIGHTEN = 0.7; // 0.7 = 70% toward white at 100%
  const computedGradientEnd = gradientManualEnd 
    ? gradientEndColor 
    : lighten(gradientStart, (gradientEndPct / 100) * MAX_LIGHTEN);

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
      
      const sourceRowStart = source.index * columns;
      const sourceRowEnd = Math.min(sourceRowStart + columns, colors.length);
      const rowColors = colors.slice(sourceRowStart, sourceRowEnd);
      
      // Remove from source
      const newColors = [...colors];
      newColors.splice(sourceRowStart, rowColors.length);
      
      // Insert at destination
      const destRowStart = destination.index * columns;
      newColors.splice(destRowStart, 0, ...rowColors);
      
      pushHistory(newColors);
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

  const handleBalancePalette = useCallback(async () => {
    if (colors.length < 2 || isBalancing) return;

    const originalColors = colors.map((c) => ({ ...c }));

    const restoreScroll = dragMode === 'SWATCH' ? createScrollRestorer() : null;

    const queueScrollRestore = () => {
      if (!restoreScroll) return;
      restoreScroll();
    };

    setIsBalancing(true);
    setBalanceProgress(0);
    setBalanceScore(null);

    try {
      let workingColors = originalColors.map((c) => ({ ...c }));
      let bestColors = workingColors.map((c) => ({ ...c }));
      let bestScore = calculateHarmonyScore(workingColors);

      const iterations = Math.max(10, Math.min(60, colors.length * 2));

      for (let step = 0; step < iterations; step += 1) {
        await sleep(80);

        const nextColors = balancePaletteIteration(workingColors);
        workingColors = nextColors.map((c) => ({ ...c }));
    setColors(workingColors);
    queueScrollRestore();

        const nextScore = calculateHarmonyScore(workingColors);

        if (nextScore >= bestScore - 0.001) {
          bestScore = nextScore;
          bestColors = workingColors.map((c) => ({ ...c }));
        }

        const animatedProgress = Math.min(99, Math.round(((step + 1) / iterations) * 100));
        setBalanceProgress(animatedProgress);
        setBalanceScore(Math.round(Math.min(100, nextScore)));

        if (nextScore >= 99.5) {
          setBalanceProgress(100);
          break;
        }
      }

      await sleep(120);

      const finalColors = bestColors.map((c) => ({ ...c }));
      const changed = !palettesEqual(originalColors, finalColors);

      if (changed) {
        setHistory((prev) => [...prev, originalColors]);
        setFuture([]);
        setColors(finalColors);
        queueScrollRestore();
      } else {
        setColors(originalColors);
        queueScrollRestore();
      }

      setBalanceProgress(100);
      setBalanceScore(Math.round(Math.min(100, bestScore)));
    } finally {
      setIsBalancing(false);
    }
  }, [colors, createScrollRestorer, dragMode, isBalancing, setColors, setFuture, setHistory]);

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
    const date = new Date().toISOString().split('T')[0];
    saveAs(blob, `Defaults_backup_${date}.xml`);
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
            📥 Import XML
          </button>

          {/* Export XML */}
          <button onClick={handleDownload} disabled={colors.length===0} style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#2a2a2a', color: '#fff', border: '1px solid #333', borderRadius: 7, padding: '7px 14px', fontWeight: 600, fontSize: 13, opacity: colors.length===0?0.5:1, cursor: colors.length===0?'not-allowed':'pointer', transition: 'background 0.15s'
          }}
          onMouseEnter={(e) => { if (colors.length > 0) e.currentTarget.style.background = '#333'; }}
          onMouseLeave={(e) => { if (colors.length > 0) e.currentTarget.style.background = '#2a2a2a'; }}
          >
            📤 Export XML
          </button>

          {/* Divider */}
          <div style={{ width: 1, height: 24, background: '#333', margin: '0 4px' }} />

          {/* Create Backup */}
          <button onClick={handleCreateBackup} disabled={!xmlDoc} style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#2a2a2a', color: '#fff', border: '1px solid #333', borderRadius: 7, padding: '7px 14px', fontWeight: 600, fontSize: 13, opacity: !xmlDoc?0.5:1, cursor: !xmlDoc?'not-allowed':'pointer', transition: 'background 0.15s'
          }}
          onMouseEnter={(e) => { if (xmlDoc) e.currentTarget.style.background = '#333'; }}
          onMouseLeave={(e) => { if (xmlDoc) e.currentTarget.style.background = '#2a2a2a'; }}
          >
            🔒 Backup
          </button>
        </div>
        <div className="header-controls" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Undo */}
          <button
            onClick={handleUndo}
            disabled={history.length === 0}
            aria-label="Undo"
            title="Undo"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#2a2a2a', color: '#fff', border: '1px solid #333', borderRadius: 7, padding: '7px 14px', fontWeight: 600, fontSize: 13, opacity: history.length===0?0.5:1, cursor: history.length===0?'not-allowed':'pointer', transition: 'background 0.15s'
            }}
            onMouseEnter={(e) => { if (history.length > 0) e.currentTarget.style.background = '#333'; }}
            onMouseLeave={(e) => { if (history.length > 0) e.currentTarget.style.background = '#2a2a2a'; }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 20 20"><path d="M4 10h8a4 4 0 110 8" stroke="#fff" strokeWidth="1.7" strokeLinecap="round"/><path d="M7 13l-3-3 3-3" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Undo
          </button>

          {/* Redo */}
          <button
            onClick={handleRedo}
            disabled={future.length === 0}
            aria-label="Redo"
            title="Redo"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#2a2a2a', color: '#fff', border: '1px solid #333', borderRadius: 7, padding: '7px 14px', fontWeight: 600, fontSize: 13, opacity: future.length===0?0.5:1, cursor: future.length===0?'not-allowed':'pointer', transition: 'background 0.15s'
            }}
            onMouseEnter={(e) => { if (future.length > 0) e.currentTarget.style.background = '#333'; }}
            onMouseLeave={(e) => { if (future.length > 0) e.currentTarget.style.background = '#2a2a2a'; }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 20 20"><path d="M16 10H8a4 4 0 100 8" stroke="#fff" strokeWidth="1.7" strokeLinecap="round"/><path d="M13 13l3-3-3-3" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
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
            🗑️ Delete All
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
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Color editor</div>
            
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
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#888',
                    textAlign: 'center',
                    padding: '8px 14px',
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

            {/* Done Button */}
            <button
              onClick={() => setGradientEditor(null)}
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
                transition: 'background 0.2s',
                marginTop: 24
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#333'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#2a2a2a'}
            >
              Done
            </button>
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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            backdropFilter: 'blur(4px)'
          }}
          onClick={() => setShowImportModal(false)}
        >
          <div
            className="custom-color-picker"
            style={{
              background: '#1a1a1a',
              borderRadius: 12,
              padding: 32,
              minWidth: 500,
              maxWidth: '90vw',
              border: '1px solid #333',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 20, textAlign: 'center' }}>
              📥 Import Defaults.xml
            </div>

            {/* Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.style.borderColor = '#4a9eff';
                e.currentTarget.style.background = '#1e2530';
              }}
              onDragLeave={(e) => {
                e.currentTarget.style.borderColor = '#444';
                e.currentTarget.style.background = '#232323';
              }}
              onDrop={async (e) => {
                e.preventDefault();
                e.currentTarget.style.borderColor = '#444';
                e.currentTarget.style.background = '#232323';
                const file = e.dataTransfer.files[0];
                if (file && file.name.endsWith('.xml')) {
                  const syntheticEvent = { target: { files: [file] } };
                  await handleFileUpload(syntheticEvent);
                  setShowImportModal(false);
                }
              }}
              style={{
                border: '2px dashed #444',
                borderRadius: 10,
                padding: 40,
                textAlign: 'center',
                background: '#232323',
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginBottom: 20
              }}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.xml';
                input.onchange = async (e) => {
                  await handleFileUpload(e);
                  setShowImportModal(false);
                };
                input.click();
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 16 }}>📁</div>
              <div style={{ color: '#ddd', fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                Drop your Defaults.xml file here
              </div>
              <div style={{ color: '#888', fontSize: 13 }}>
                or click to browse
              </div>
            </div>

            {/* Path Info */}
            <div style={{ 
              background: '#2a2a2a',
              borderRadius: 8,
              border: '1px solid #3a3a3a',
              padding: 16,
              color: '#aaa',
              fontSize: 12,
              lineHeight: 1.6
            }}>
              <div style={{ color: '#fff', fontWeight: 600, marginBottom: 8 }}>📂 Default Location:</div>
              <div style={{ fontFamily: 'monospace', color: '#4a9eff', marginBottom: 4 }}>
                C:\Users\[YourName]\AppData\Roaming\Steinberg\Cubase [Version]\Presets\
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: '#666' }}>
                💡 Make sure to create a backup before making changes!
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setShowImportModal(false)}
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
      
      <div className="layout">
        {/* Left Sidebar */}
        <aside className="sidebar left" style={{ padding: 10, gap: 0 }}>
          {/* Add Color Button */}
          <button 
            onClick={handleAddColor}
            disabled={!xmlDoc || paletteAtCapacity}
            title={!xmlDoc ? 'Import XML first' : paletteAtCapacity ? `Palette limit reached (${MAX_PALETTE_COLORS})` : 'Add a new color'}
            style={{
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: 8, 
              width: '100%', 
              background: (!xmlDoc || paletteAtCapacity) ? '#232323' : '#444', 
              color: '#fff', 
              border: (!xmlDoc || paletteAtCapacity) ? '1px solid #333' : 'none', 
              borderRadius: 7, 
              padding: '10px 14px', 
              fontWeight: 700, 
              fontSize: 15, 
              cursor: (!xmlDoc || paletteAtCapacity) ? 'not-allowed' : 'pointer',
              opacity: (!xmlDoc || paletteAtCapacity) ? 0.5 : 1,
              marginBottom: 8,
              boxShadow: '0 1px 4px #0002',
              transition: 'background 0.15s'
            }}
            onMouseEnter={(e) => { if (xmlDoc && !paletteAtCapacity) e.currentTarget.style.background = '#555'; }}
            onMouseLeave={(e) => { if (xmlDoc && !paletteAtCapacity) e.currentTarget.style.background = '#444'; }}
          >
            ➕ Add Color
          </button>

          {/* Drag Mode Toggle */}
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
              marginBottom: 8,
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
            {dragMode === 'SWATCH' ? '⋮⋮ Row Mode' : '🔄 Swatch Mode'}
          </button>

          {/* Round-Trip Test removed */}
          {/* Create Backup moved to right sidebar */}
          {/* Gradient Generator Section */}
          <div style={{ background: '#232323', borderRadius: 10, padding: 12, marginBottom: 6, boxShadow: '0 1px 4px #0002', display: 'flex', flexDirection: 'column', gap: 8, opacity: !xmlDoc ? 0.5 : 1, pointerEvents: !xmlDoc ? 'none' : 'auto', position: 'relative' }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#fff', marginBottom: 4, letterSpacing: '-0.3px' }}>Gradient Generator</div>
            {!xmlDoc && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(35, 35, 35, 0.8)', borderRadius: 10, zIndex: 1 }}>
                <div style={{ color: '#ff4d4d', fontSize: 14, fontWeight: 600, textAlign: 'center', padding: 20 }}>📥 Import XML first</div>
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
                max={32} 
                value={gradientSteps} 
                onChange={e => setGradientSteps(Number(e.target.value))} 
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
                    onClick={() => {
                      // Open gradient editor with both start and end colors
                      const hexToHSV = (hex) => {
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
                      };
                      const startHSV = hexToHSV(gradientStart);
                      const endHSV = hexToHSV(computedGradientEnd);
                      setGradientEditor({
                        startH: startHSV.h,
                        startS: startHSV.s,
                        startV: startHSV.v,
                        endH: endHSV.h,
                        endS: endHSV.s,
                        endV: endHSV.v,
                        manualMode: gradientManualEnd
                      });
                    }}
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
                      flexShrink: 0
                    }} 
                    title={computedGradientEnd}
                  />
                  <div style={{ 
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
                    justifyContent: 'center'
                  }}>
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
                      style={{ width: 48, fontSize: 13, color: '#fff', background: '#181818', border: '1px solid #444', borderRadius: 4, textAlign: 'center', padding: '2px 4px', fontWeight: 600 }}
                      aria-label="Edit Saturation %"
                    />
                  ) : (
                    <span
                      style={{ fontSize: 13, color: '#bbb', minWidth: 42, textAlign: 'center', cursor: 'pointer', padding: '2px 6px', background: '#2a2a2a', borderRadius: 4, fontWeight: 600 }}
                      tabIndex={0}
                      onClick={() => setEditingSat(true)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setEditingSat(true); }}
                      title="Click to edit saturation %"
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
                  style={{ width: '100%' }}
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
                      style={{ width: 48, fontSize: 13, color: '#fff', background: '#181818', border: '1px solid #444', borderRadius: 4, textAlign: 'center', padding: '2px 4px', fontWeight: 600 }}
                      aria-label="Edit Lightness %"
                    />
                  ) : (
                    <span
                      style={{ fontSize: 13, color: '#bbb', minWidth: 42, textAlign: 'center', cursor: 'pointer', padding: '2px 6px', background: '#2a2a2a', borderRadius: 4, fontWeight: 600 }}
                      tabIndex={0}
                      onClick={() => setEditingEnd(true)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setEditingEnd(true); }}
                      title="Click to edit lightness %"
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
                  style={{ width: '100%' }}
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
          {/* Balance Palette control */}
          <div style={{ width: '100%', margin: '4px 0 8px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#fff', marginBottom: 0, letterSpacing: '-0.3px' }}>Balance Palette</div>
            <button
              type="button"
              className="btn"
              onClick={handleBalancePalette}
              disabled={colors.length < 2 || isBalancing}
              style={{
                width: '100%',
                background: isBalancing ? '#0f2419' : '#15221b',
                borderRadius: 12,
                border: '1px solid #285a3d',
                boxShadow: '0 8px 20px rgba(12, 40, 26, 0.35)',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                color: '#f2fff1',
                fontWeight: 600,
                fontSize: 15,
                cursor: colors.length < 2 || isBalancing ? 'not-allowed' : 'pointer',
                opacity: colors.length < 2 && !isBalancing ? 0.5 : 1,
                transition: 'background 0.2s ease, transform 0.2s ease',
                transform: isBalancing ? 'scale(0.99)' : 'scale(1)'
              }}
              aria-label="Balance Palette"
              title="Balance palette: harmonise hue, lightness, and saturation for consistency"
            >
              <div style={{ position: 'relative', width: 120, height: 120 }}>
                <svg width="120" height="120" viewBox="0 0 120 120" style={{ position: 'absolute', inset: 0 }}>
                  <defs>
                    <linearGradient id="balanceProgressGradient" x1="0" x2="1" y1="0" y2="0">
                      <stop offset="0%" stopColor="#2ecc71" />
                      <stop offset="100%" stopColor="#27ae60" />
                    </linearGradient>
                  </defs>
                  <circle cx="60" cy="60" r={arcRadius} stroke="#1a3526" strokeWidth="10" fill="none" />
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
                  <div style={{ width: 78, height: 78, borderRadius: '50%', background: '#0f1f17', border: '2px solid #285a3d', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 20px rgba(10, 32, 22, 0.45)' }}>
                    <svg width="52" height="52" viewBox="0 0 48 48" aria-hidden="true">
                      <path d="M24 10v20" stroke="#2ecc71" strokeWidth="2.2" strokeLinecap="round" />
                      <path d="M14 18h20" stroke="#2ecc71" strokeWidth="2.2" strokeLinecap="round" />
                      <path d="M18 18l-6 10h12l-6-10z" fill="rgba(46,204,113,0.2)" stroke="#2ecc71" strokeWidth="1.8" strokeLinejoin="round" />
                      <path d="M30 18l-6 10h12l-6-10z" fill="rgba(46,204,113,0.2)" stroke="#2ecc71" strokeWidth="1.8" strokeLinejoin="round" />
                      <path d="M18 34h12" stroke="#2ecc71" strokeWidth="2.2" strokeLinecap="round" />
                      <path d="M16 38h16" stroke="#2ecc71" strokeWidth="2.2" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>
              </div>
            </button>
            <span style={{ fontSize: 12, fontWeight: 600, color: isBalancing ? '#7fffb3' : '#2ecc71', textAlign: 'center' }}>
              {isBalancing ? 'Harmonising - aiming for 100%' : balanceScore !== null ? `Harmony score ≈ ${Math.min(100, Math.max(0, balanceScore))}%` : 'Ready to harmonise'}
            </span>
          </div>
          <div style={{ height: 12 }} />
          {error && <div style={{ color: '#ff4d4d', fontWeight: 600, fontSize: 15, marginTop: 8 }}>{error}</div>}
            {/* Tips (left bottom) */}
        </aside>
  {/* Main content */}
  <main className="main" ref={mainScrollRef}>
              {/* Swatch Grid Container - Always visible */}
              <div ref={gridRef} style={{ 
                width: '100%', 
                minHeight: '60vh',
                display: 'flex', 
                flexDirection: 'column', 
                gap: 8,
                background: '#1a1a1a',
                borderRadius: 8,
                padding: 16,
                border: '1px solid #2f2f2f'
              }}>
              {colors.length === 0 ? (
                // Empty state
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '50vh',
                  color: '#666',
                  gap: 16
                }}>
                  <div style={{ fontSize: 64 }}>🎨</div>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>No Colors Yet</div>
                  <div style={{ fontSize: 14, textAlign: 'center', maxWidth: 400, lineHeight: 1.6 }}>
                    Import a Defaults.xml file or click "+ Add Color" to get started
                  </div>
                </div>
              ) : dragMode === 'ROW' ? (
                // ROW MODE: Drag entire rows via handles using @hello-pangea/dnd
                <DragDropContext onDragEnd={onDragEnd}>
                  <div>
                    <Droppable droppableId="palette-rows" type="ROW">
                      {(rowProvided) => (
                        <div
                          ref={rowProvided.innerRef}
                          {...rowProvided.droppableProps}
                          style={{ width: '100%' }}
                        >
                          {(() => {
                            const rows = [];
                            for (let start = 0; start < colors.length; start += columns) {
                              const end = Math.min(start + columns, colors.length);
                              const rowIndex = Math.floor(start / columns);
                              const rowColors = colors.slice(start, end);
                              rows.push({ start, end, rowIndex, colors: rowColors });
                            }
                            
                            return rows.map((row) => (
                              <DraggableRow
                                key={`row-${row.rowIndex}`}
                                rowId={`row-${row.rowIndex}`}
                                rowIndex={row.rowIndex}
                                colors={row.colors}
                                onSwatchClick={handleSwatchClick}
                                handleRemoveColor={handleRemoveColor}
                                setCopiedIndex={setCopiedIndex}
                                copiedIndex={copiedIndex}
                                columns={columns}
                              />
                            ));
                          })()}
                          {rowProvided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                </DragDropContext>
              ) : (
                // SWATCH MODE: Use react-dnd for proper grid-based dragging
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
                    {colors.map((c, index) => (
                      <DraggableSwatchGrid
                        key={c.id}
                        id={c.id}
                        index={index}
                        color={c.color}
                        onRemove={handleRemoveColor}
                        onCopy={setCopiedIndex}
                        copied={copiedIndex === c.id}
                        onSwatchClick={handleSwatchClick}
                        selected={false}
                        moveColor={moveColor}
                        draggingItemId={draggingItemId}
                        setDraggingItemId={setDraggingItemId}
                        onDragEnd={handleDragEnd}
                        canDrag={swatchDragReady}
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
                📥 Import XML first
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
                💾 Save JSON
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
                📂 Load JSON
              </button>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #333', margin: '8px 0' }} />

          {/* Presets List */}
          <div style={{ opacity: !xmlDoc ? 0.5 : 1, pointerEvents: !xmlDoc ? 'none' : 'auto' }}>
            {presets.length === 0 ? (
              <div style={{ color: '#888', fontSize: 13, textAlign: 'center', padding: '20px 10px', lineHeight: 1.5 }}>
                No presets saved yet. Save your current palette to create your first preset!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {presets.map(preset => (
                <div
                  key={preset.id}
                  style={{
                    background: '#181818',
                    borderRadius: 8,
                    padding: 10,
                    border: '1px solid #333',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#fff', marginBottom: 2 }}>{preset.name}</div>
                      <div style={{ fontSize: 12, color: '#888' }}>{preset.colorCount} colors</div>
                    </div>
                    <button
                      onClick={() => handleDeletePreset(preset.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ff4d4d',
                        cursor: 'pointer',
                        fontSize: 18,
                        padding: 2,
                        lineHeight: 1,
                      }}
                      title="Delete preset"
                    >
                      ×
                    </button>
                  </div>
                  {/* Preview colors */}
                  <div style={{ display: 'flex', gap: 2, marginBottom: 8, flexWrap: 'wrap' }}>
                    {preset.colors.slice(0, 8).map((color, i) => (
                      <div
                        key={i}
                        style={{
                          width: 20,
                          height: 20,
                          background: color,
                          borderRadius: 4,
                          border: '1px solid #222',
                        }}
                      />
                    ))}
                    {preset.colors.length > 8 && (
                      <div style={{ fontSize: 12, color: '#888', alignSelf: 'center', marginLeft: 4 }}>
                        +{preset.colors.length - 8} more
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleLoadPreset(preset)}
                    style={{
                      width: '100%',
                      background: '#444',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '6px 12px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                  >
                    Apply
                  </button>
                </div>
              ))}
              </div>
            )}

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
            Eyedropper active — click a swatch to copy its color. Click this banner to cancel.
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
                <b>Important:</b> Please ensure <span style={{ color: '#ff4d4d' }}>Cubase is not running</span> before editing your color palette.<br/>
                You must import your <b>Defaults.xml</b> from:<br/>
                <span style={{ color: '#fff', background: '#222', padding: '2px 6px', borderRadius: 5, fontFamily: 'Fira Mono, monospace', fontSize: 13, display: 'inline-block', marginTop: 4 }}>
                  C:\Users\(your username)\AppData\Roaming\Steinberg\Cubase 14
                </span>
              </p>
              
              <h3 style={{ color: '#fff', marginTop: 20, marginBottom: 12 }}>Getting Started:</h3>
              <ol style={{ marginLeft: 16, marginBottom: 12 }}>
                <li style={{ marginBottom: 8 }}>
                  <strong>Import Defaults.xml:</strong> Click the "Import" button and select your Defaults.xml file from the Cubase directory above.
                </li>
                <li style={{ marginBottom: 8 }}>
                  <strong>Edit Colours:</strong> Click any colour swatch to open the colour picker. <br/>
                  <b>Drag</b> a swatch's handle (≡) to reorder it. <br/>
                  <b>Hold Shift + Drag</b> a swatch handle to select and reorder the entire row. <br/>
                  <b>Shift+X</b> (delete button) removes the entire row. <br/>
                  <b>Ctrl+Click</b> a swatch to duplicate it. <br/>
                </li>
                <li style={{ marginBottom: 8 }}>
                  <strong>Apply a Gradient:</strong> Use the Gradient Generator to create smooth colour transitions.
                </li>
                <li style={{ marginBottom: 8 }}>
                  <strong>Balance Palette:</strong> Click "Balance Palette" to harmonise hue, lightness, and saturation.
                </li>
                <li style={{ marginBottom: 8 }}>
                  <strong>Undo/Redo:</strong> Use the Undo and Redo buttons to revert or reapply changes.
                </li>
                <li style={{ marginBottom: 8 }}>
                  <strong>Export:</strong> Once satisfied, click "Export" to download the updated Defaults.xml.
                </li>
              </ol>
              
              <p style={{ marginTop: 16, fontSize: 13, color: '#aaa' }}>
                <strong>Tip:</strong> Make a backup copy of your Defaults.xml before editing!
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
        <span>Cubendo Colour Picker</span>
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
