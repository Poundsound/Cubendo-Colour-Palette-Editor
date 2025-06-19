import { useState, useEffect } from 'react';
import './App.css';
import { saveAs } from 'file-saver';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { v4 as uuidv4 } from 'uuid';

function argbIntToHex(argb) {
  let n = Number(argb) >>> 0;
  let hex = (n & 0xFFFFFF).toString(16).toUpperCase();
  return '#' + hex.padStart(6, '0');
}
function hexToArgbInt(hex) {
  let rgb = parseInt(hex.replace('#', ''), 16);
  return (0xFF000000 | rgb) >>> 0;
}

// Helper: convert hex to HSL
function hexToHsl(hex) {
  let r = 0, g = 0, b = 0;
  if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16) / 255;
    g = parseInt(hex.slice(3, 5), 16) / 255;
    b = parseInt(hex.slice(5, 7), 16) / 255;
  }
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
      default: h = 0;
    }
    h /= 6;
  }
  return [h * 360, s, l];
}

// Helper: convert HSL to hex
function hslToHex(h, s, l) {
  h /= 360;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return (
    '#' +
    [r, g, b]
      .map(x => Math.round(x * 255).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

// Helper: check if a hex color is achromatic (R=G=B)
function isAchromatic(hex) {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return r === g && g === b;
}

function generateGradientSaturation(start, end, steps, sat) {
  // start/end: #RRGGBB, steps: int, sat: 0-1
  if (isAchromatic(start)) {
    // For greyscale, interpolate only lightness, keep hue=0, sat=0
    const [, , l1] = hexToHsl(start);
    const [, , l2] = hexToHsl(end);
    return Array.from({ length: steps }, (_, i) => {
      const t = steps === 1 ? 0 : i / (steps - 1);
      const l = l1 + (l2 - l1) * t;
      return hslToHex(0, 0, l);
    });
  } else {
    const [h1, , l1] = hexToHsl(start);
    const [h2, , l2] = hexToHsl(end);
    return Array.from({ length: steps }, (_, i) => {
      const t = steps === 1 ? 0 : i / (steps - 1);
      let h = h1 + (h2 - h1) * t;
      let l = l1 + (l2 - l1) * t;
      return hslToHex(h, sat, l);
    });
  }
}

// Helper: apply saturation to a hex color (returns hex)
function setSaturation(hex, sat) {
  let [h, , l] = hexToHsl(hex);
  return hslToHex(h, sat, l);
}

// Swatch component for sortable grid
function SortableSwatch({ id, color, onColorChange, onRemove, onCopy, copied, onFocus, onBlur, onSwatchClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: swatchDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: swatchDragging ? 100 : 'auto',
        filter: swatchDragging ? 'brightness(1.08) drop-shadow(0 2px 12px #0008)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 6,
        position: 'relative',
      }}
      tabIndex={0}
      aria-label={`Color swatch ${color}`}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          document.getElementById(`color-input-${id}`)?.click();
        }
      }}
      onClick={e => onSwatchClick(id, e)}
    >
      <div
        style={{
          width: '100%',
          aspectRatio: '1',
          background: color,
          borderRadius: 16,
          border: '2px solid #222',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          boxShadow: '0 2px 8px #0007',
          cursor: 'pointer',
          transition: 'box-shadow 0.2s, border 0.2s, transform 0.15s',
          overflow: 'visible',
        }}
        title="Click to edit color"
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.06)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        <input
          id={`color-input-${id}`}
          type="color"
          value={color}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            opacity: 0,
            cursor: 'pointer',
            zIndex: 20,
          }}
          onChange={e => onColorChange(id, e.target.value)}
          tabIndex={-1}
        />
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
          onClick={e => { e.stopPropagation(); onRemove(id); }}
          title="Remove color"
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = '0.8'}
        >×</button>
        {/* Drag handle button floating top-left - only here apply listeners/attributes */}
        <button
          data-dragbtn="1"
          {...listeners}
          {...attributes}
          style={{
            position: 'absolute',
            top: 6,
            left: 6,
            fontSize: 15,
            background: '#fff',
            border: 'none',
            cursor: 'grab',
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
            color: '#888',
            fontWeight: 900,
            zIndex: 30,
            opacity: 0.8,
            transition: 'opacity 0.15s',
            pointerEvents: 'auto',
          }}
          title="Drag to reorder"
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = '0.8'}
        >≡</button>
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 16,
          boxShadow: 'inset 0 2px 8px #0004',
          pointerEvents: 'none',
        }} />
      </div>
      {/* Hex code below, full width of swatch, no delete button here */}
      <span
        data-hex="1"
        style={{
          color: '#222',
          background: '#fffdeee0',
          fontSize: 14,
          borderRadius: 7,
          padding: '3px 10px',
          fontWeight: 800,
          letterSpacing: '1px',
          boxShadow: '0 2px 8px #0002',
          userSelect: 'all',
          display: 'inline-block',
          textAlign: 'center',
          cursor: 'pointer',
          minWidth: 60,
          maxWidth: 80,
          width: '100%',
          marginTop: 0,
          zIndex: 2,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          fontFamily: 'Fira Mono, monospace',
        }}
        title="Click to copy color code"
        tabIndex={0}
        onMouseDown={e => {
          e.stopPropagation();
          onCopy(id);
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
function balancePalette(colors) {
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

export default function App() {
  const [colors, setColors] = useState([]); // [{id, color}]
  const [xmlDoc, setXmlDoc] = useState(null);
  const [error, setError] = useState('');
  const [gradientStart, setGradientStart] = useState('#000000');
  const [gradientEndPct, setGradientEndPct] = useState(60); // 0-100, default 60%
  const [gradientSteps, setGradientSteps] = useState(8);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [gradientSaturation, setGradientSaturation] = useState(1.0); // New state for saturation
  const [editingSat, setEditingSat] = useState(false);
  const [editingEnd, setEditingEnd] = useState(false);
  const [eyedropper, setEyedropper] = useState(null); // { targetId } or null

  // Track if a drag is in progress to prevent color picker popup
  // const [isDragging, setIsDragging] = useState(false);

  // DnD-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

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
  const pushHistory = (newColors) => {
    setHistory(h => [...h, colors.map(c => ({ ...c }))]);
    setFuture([]);
    setColors(newColors);
  };

  // Undo
  const handleUndo = () => {
    if (history.length === 0) return;
    setFuture(f => [colors.map(c => ({ ...c })), ...f]);
    setColors(history[history.length - 1]);
    setHistory(h => h.slice(0, -1));
  };

  // Redo
  const handleRedo = () => {
    if (future.length === 0) return;
    setHistory(h => [...h, colors.map(c => ({ ...c }))]);
    setColors(future[0]);
    setFuture(f => f.slice(1));
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
      const parser = new window.DOMParser();
      const doc = parser.parseFromString(text, 'application/xml');
      setXmlDoc(doc);
      // Find <obj class="UColorSet" name="Event Colors">
      const colorObjs = Array.from(doc.getElementsByTagName('obj'));
      const eventColorsObj = colorObjs.find(
        node => node.getAttribute('class') === 'UColorSet' && node.getAttribute('name') === 'Event Colors'
      );
      if (eventColorsObj) {
        // Find <list name="Set">
        const setList = Array.from(eventColorsObj.getElementsByTagName('list')).find(
          l => l.getAttribute('name') === 'Set'
        );
        if (setList) {
          // Find all <item> in the set
          const items = Array.from(setList.getElementsByTagName('item'));
          // For each item, get <int name="Color" value="..."/>
          const colorInts = items.map(item => {
            const colorInt = Array.from(item.getElementsByTagName('int')).find(
              intNode => intNode.getAttribute('name') === 'Color'
            );
            return colorInt ? colorInt.getAttribute('value') : null;
          }).filter(Boolean);
          setColors(colorInts.map(argb => ({ id: uuidv4(), color: argbIntToHex(argb) })));
          setHistory([]);
          setFuture([]);
        } else {
          setError('Could not find <list name="Set"> in Event Colors.');
        }
      } else {
        setError('Could not find <obj class="UColorSet" name="Event Colors">.');
      }
    } catch {
      setError('Failed to parse XML.');
    }
  };

  // Download updated XML
  const handleDownload = () => {
    if (!xmlDoc) return;
    // Find <obj class="UColorSet" name="Event Colors">
    const colorObjs = Array.from(xmlDoc.getElementsByTagName('obj'));
    const eventColorsObj = colorObjs.find(
      node => node.getAttribute('class') === 'UColorSet' && node.getAttribute('name') === 'Event Colors'
    );
    if (eventColorsObj) {
      const setList = Array.from(eventColorsObj.getElementsByTagName('list')).find(
        l => l.getAttribute('name') === 'Set'
      );
      if (setList) {
        // Remove all existing children (should be <item> nodes)
        while (setList.firstChild) setList.removeChild(setList.firstChild);
        // For each color, add an <item><string name="Name" value="ColorN" wide="true"/><int name="Color" value="..."/></item>
        colors.forEach(({ color }, idx) => {
          const itemNode = xmlDoc.createElement('item');
          const stringNode = xmlDoc.createElement('string');
          stringNode.setAttribute('name', 'Name');
          stringNode.setAttribute('value', `Color${idx}`);
          stringNode.setAttribute('wide', 'true');
          const intNode = xmlDoc.createElement('int');
          intNode.setAttribute('name', 'Color');
          intNode.setAttribute('value', hexToArgbInt(color).toString());
          itemNode.appendChild(stringNode);
          itemNode.appendChild(intNode);
          setList.appendChild(itemNode);
        });
      }
    }
    const serializer = new window.XMLSerializer();
    const xml = serializer.serializeToString(xmlDoc);
    const blob = new Blob([xml], { type: 'application/xml' });
    saveAs(blob, 'Defaults.xml');
  };

  // Edit a color
  const handleColorChange = (id, newHex) => {
    pushHistory(colors.map(c => c.id === id ? { ...c, color: newHex.toUpperCase() } : c));
  };

  // Remove a color
  const handleRemoveColor = (id) => {
    pushHistory(colors.filter(c => c.id !== id));
  };

  // Delete all colors
  const handleDeleteAll = () => {
    if (colors.length > 0) pushHistory([]);
  };

  // Add a new color (default black)
  const handleAddColor = () => {
    pushHistory([...colors, { id: uuidv4(), color: '#000000' }]);
  };

  // Compute start color with saturation for preview
  const previewGradientStart = setSaturation(gradientStart, gradientSaturation);
  // Compute end color based on previewed start color and percentage, clamped so 100% is not pure white
  const MAX_LIGHTEN = 0.7; // 0.7 = 70% toward white at 100%
  const computedGradientEnd = lighten(previewGradientStart, (gradientEndPct / 100) * MAX_LIGHTEN);

  // Handle drag end for reordering
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = colors.findIndex(c => c.id === active.id);
    const newIndex = colors.findIndex(c => c.id === over.id);
    pushHistory(arrayMove(colors, oldIndex, newIndex));
  };

  // Helper: lighten a hex color by percent (0-1)
  function lighten(hex, percent) {
    let rgb = hex.replace('#','').match(/.{2}/g).map(x => parseInt(x,16));
    rgb = rgb.map(v => Math.round(v + (255-v)*percent));
    return '#' + rgb.map(x => x.toString(16).padStart(2,'0')).join('').toUpperCase();
  }

  // Apply gradient to colors
  const handleApplyGradient = () => {
    const grad = generateGradientSaturation(
      previewGradientStart,
      computedGradientEnd,
      gradientSteps,
      gradientSaturation
    );
    pushHistory([...colors, ...grad.map(hex => ({ id: uuidv4(), color: hex }))]);
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
    // Ctrl+click: duplicate swatch next to itself
    if (e.ctrlKey) {
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
    // Default: open color picker
    document.getElementById(`color-input-${id}`)?.click();
  };

  // --- Debugging / dev tools ---
  // Log colors state on change
  useEffect(() => {
    console.log('Colors:', colors);
  }, [colors]);

  const handleBalancePalette = () => {
    if (colors.length < 2) return;
    const balanced = balancePalette(colors, 0.7); // 0.7 = strong but not extreme
    pushHistory(balanced);
  };

  return (
    <div className="app-bg" style={{ minHeight: '100vh', background: '#232323', color: '#fff', fontFamily: 'Inter, Arial, sans-serif' }}>
      <div className="flex-root" style={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
        {/* Sidebar */}
        <aside style={{
          width: 230,
          flexShrink: 0,
          background: '#202124',
          borderRadius: 14,
          padding: 10,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 320,
          position: 'sticky',
          top: 0,
          alignSelf: 'flex-start',
          boxShadow: '0 2px 16px #0004',
          border: '1px solid #232323',
          margin: 24,
          marginRight: 0,
          height: 'calc(100vh - 48px)', // 24px margin top/bottom
          maxHeight: 'calc(100vh - 48px)',
          overflowY: 'auto',
          gap: 0,
        }}>
          {/* Palette Actions Section */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px', marginBottom: 6 }}>Palette Actions</div>
            <div style={{ color: '#bbb', fontSize: 13, marginBottom: 8 }}>Colors: <b>{colors.length}</b></div>
            {/* Import Button Container - improved styling */}
            <div style={{ marginBottom: 6, width: '100%' }}>
              <button className="btn" onClick={handleFileUpload} style={{ display: 'none' }} />
              <label htmlFor="import-xml" style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                background: '#232323',
                borderRadius: 7,
                padding: '7px 10px',
                fontWeight: 600,
                color: '#fff',
                fontSize: 15,
                boxShadow: '0 1px 4px #0002',
                border: '1px solid #333',
                marginBottom: 0,
                outline: 'none',
                width: '100%',
                minHeight: 40,
                justifyContent: 'flex-start',
                boxSizing: 'border-box',
              }} tabIndex={0} aria-label="Import XML">
                <svg width="18" height="18" fill="none" viewBox="0 0 20 20"><rect width="20" height="20" rx="4" fill="#444"/><path d="M10 4v8m0 0l-3-3m3 3l3-3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><rect x="4" y="14" width="12" height="2" rx="1" fill="#fff"/></svg>
                <span>Import</span>
                <input id="import-xml" type="file" accept=".xml" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
            </div>
            <button className="btn" onClick={handleDownload} disabled={colors.length === 0} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: '#232323', borderRadius: 7, fontWeight: 600, color: '#fff', fontSize: 15, boxShadow: '0 1px 4px #0002', border: '1px solid #333', padding: '7px 10px', transition: 'background 0.15s', outline: 'none', opacity: colors.length === 0 ? 0.5 : 1, cursor: colors.length === 0 ? 'not-allowed' : 'pointer', marginBottom: 5, minHeight: 36, justifyContent: 'flex-start' }} aria-label="Export XML">
              <svg width="18" height="18" fill="none" viewBox="0 0 20 20"><rect width="20" height="20" rx="4" fill="#444"/><path d="M10 16V8m0 0l-3 3m3-3l3 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><rect x="4" y="4" width="12" height="2" rx="1" fill="#fff"/></svg>
              <span>Export</span>
            </button>
            <div style={{ display: 'flex', flexDirection: 'row', gap: 6, marginBottom: 6 }}>
              <button
                onClick={handleUndo}
                disabled={history.length === 0}
                aria-label="Undo"
                style={{
                  flex: 1,
                  background: '#232323',
                  border: '1px solid #333',
                  borderRadius: 7,
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 15,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  justifyContent: 'center',
                  height: 38,
                  boxShadow: '0 1px 4px #0002',
                  outline: 'none',
                  opacity: history.length === 0 ? 0.5 : 1,
                  cursor: history.length === 0 ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s',
                  padding: '0 10px',
                }}
                title="Undo"
                tabIndex={0}
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 20 20"><path d="M4 10h8a4 4 0 110 8" stroke="#fff" strokeWidth="1.7" strokeLinecap="round"/><path d="M7 13l-3-3 3-3" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span style={{ fontSize: 15 }}>Undo</span>
              </button>
              <button
                onClick={handleRedo}
                disabled={future.length === 0}
                aria-label="Redo"
                style={{
                  flex: 1,
                  background: '#232323',
                  border: '1px solid #333',
                  borderRadius: 7,
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 15,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  justifyContent: 'center',
                  height: 38,
                  boxShadow: '0 1px 4px #0002',
                  outline: 'none',
                  opacity: future.length === 0 ? 0.5 : 1,
                  cursor: future.length === 0 ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s',
                  padding: '0 10px',
                }}
                title="Redo"
                tabIndex={0}
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 20 20"><path d="M16 10H8a4 4 0 100 8" stroke="#fff" strokeWidth="1.7" strokeLinecap="round"/><path d="M13 13l3-3-3-3" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span style={{ fontSize: 15 }}>Redo</span>
              </button>
            </div>
          </div>
          <hr style={{ border: 'none', borderTop: '1px solid #333', margin: '6px 0 6px 0' }} />
          {/* Gradient Generator Section */}
          <div style={{ background: '#232323', borderRadius: 10, padding: 8, marginBottom: 6, boxShadow: '0 1px 4px #0002', display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#fff', marginBottom: 2, letterSpacing: '-0.5px' }}>Gradient Generator</div>
            {/* Steps above Start/End controls */}
            <label style={{ display: 'block', color: '#eee', fontSize: 13, marginBottom: 4 }}>
              Steps
              <input type="number" min={2} max={32} value={gradientSteps} onChange={e => setGradientSteps(Number(e.target.value))} style={{ width: 48, marginLeft: 6, fontSize: 14, borderRadius: 5, border: '1px solid #444', background: '#181818', color: '#fff', padding: '2px 6px' }} aria-label="Gradient Steps" />
            </label>
            {/* Start/End controls */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'center' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 2, color: '#eee', fontSize: 13 }}>
                Start
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="color" value={previewGradientStart} onChange={e => {
                    setGradientStart(e.target.value);
                  }} style={{ width: 32, height: 32, border: 'none', background: 'none', padding: 0 }} aria-label="Gradient Start Color" />
                  <input
                    type="text"
                    value={gradientStart}
                    maxLength={7}
                    onChange={e => {
                      let val = e.target.value.toUpperCase();
                      if (!val.startsWith('#')) val = '#' + val;
                      if (/^#[0-9A-F]{0,6}$/.test(val)) {
                        setGradientStart(val);
                      }
                    }}
                    style={{ width: 70, fontSize: 14, borderRadius: 5, border: '1px solid #444', background: '#181818', color: '#fff', padding: '2px 6px' }}
                    spellCheck={false}
                    autoComplete="off"
                    aria-label="Gradient Start Hex"
                  />
                </div>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 2, color: '#eee', fontSize: 13 }}>
                End
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="color" value={computedGradientEnd} disabled style={{ opacity: 0.7, cursor: 'not-allowed', width: 32, height: 32, border: 'none', background: 'none', padding: 0 }} aria-label="Gradient End Color (auto)" />
                </div>
              </label>
            </div>
            {/* Saturation and End% sliders with values to the right of the labels */}
            <div style={{ width: '100%', marginTop: 2 }}>
              <div style={{ display: 'flex', flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 2 }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', fontSize: 13, color: '#eee' }}>
                  <span>Saturation</span>
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
                      style={{ marginLeft: 6, width: 40, fontSize: 13, color: '#bbb', background: '#181818', border: '1px solid #444', borderRadius: 4, textAlign: 'right', padding: '1px 4px' }}
                      aria-label="Edit Saturation %"
                    />
                  ) : (
                    <span
                      style={{ marginLeft: 6, fontSize: 13, color: '#bbb', minWidth: 36, textAlign: 'right', display: 'inline-block', cursor: 'pointer', borderBottom: '1px dashed #888' }}
                      tabIndex={0}
                      onClick={() => setEditingSat(true)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setEditingSat(true); }}
                      title="Click to edit saturation %"
                    >
                      {Math.round(gradientSaturation * 100)}%
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', fontSize: 13, color: '#eee' }}>
                  <span>End</span>
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
                      style={{ marginLeft: 6, width: 40, fontSize: 13, color: '#bbb', background: '#181818', border: '1px solid #444', borderRadius: 4, textAlign: 'right', padding: '1px 4px' }}
                      aria-label="Edit End %"
                    />
                  ) : (
                    <span
                      style={{ marginLeft: 6, fontSize: 13, color: '#bbb', minWidth: 36, textAlign: 'right', display: 'inline-block', cursor: 'pointer', borderBottom: '1px dashed #888' }}
                      tabIndex={0}
                      onClick={() => setEditingEnd(true)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setEditingEnd(true); }}
                      title="Click to edit end %"
                    >
                      {gradientEndPct}%
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'row', gap: 8, alignItems: 'center', width: '100%' }}>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={gradientSaturation}
                  onChange={e => setGradientSaturation(Number(e.target.value))}
                  style={{ flex: 1, width: '100%', minWidth: 60, maxWidth: 100, marginLeft: 0 }}
                  aria-label="Gradient Saturation"
                />
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={gradientEndPct}
                  onChange={e => setGradientEndPct(Number(e.target.value))}
                  style={{ flex: 1, width: '100%', minWidth: 60, maxWidth: 100, marginLeft: 0 }}
                  aria-label="Gradient End % toward white"
                />
              </div>
            </div>
            <button className="btn" style={{ width: '100%', marginTop: 6, background: '#444', color: '#fff', fontWeight: 700, borderRadius: 7, fontSize: 15, boxShadow: '0 1px 4px #0002', border: 'none', padding: '7px 0', transition: 'background 0.15s', outline: 'none' }} onClick={handleApplyGradient} aria-label="Add Gradient" onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px #ff4d4d'} onBlur={e => e.currentTarget.style.boxShadow = '0 1px 4px #0002'}>Add Gradient</button>
          </div>
          {/* Balance Palette button - moved below Gradient Generator */}
          <button
            className="btn"
            onClick={handleBalancePalette}
            disabled={colors.length < 2}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: '#232323', borderRadius: 7, fontWeight: 600, color: '#fff', fontSize: 15, boxShadow: '0 1px 4px #0002', border: '1px solid #333', padding: '7px 10px', transition: 'background 0.15s', outline: 'none', opacity: colors.length < 2 ? 0.5 : 1, cursor: colors.length < 2 ? 'not-allowed' : 'pointer', marginBottom: 12, minHeight: 36, justifyContent: 'flex-start'
            }}
            aria-label="Balance Palette"
            title="Balance palette: harmonise hue, lightness, and saturation for consistency"
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 20 20"><rect width="20" height="20" rx="4" fill="#444"/><path d="M4 10h12M6 7l-2 3 2 3M14 13l2-3-2-3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span>Balance Palette</span>
          </button>
          <hr style={{ border: 'none', borderTop: '1px solid #333', margin: '5px 0 12px 0' }} />
          {/* Danger Zone Section */}
          <div style={{ fontSize: 13, color: '#ff4d4d', fontWeight: 700, marginBottom: 3, letterSpacing: '0.5px' }}>Danger Zone</div>
          <button className="btn" onClick={handleDeleteAll} disabled={colors.length === 0} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', color: '#ff4d4d', fontWeight: 700, borderRadius: 7, fontSize: 15, boxShadow: '0 1px 4px #0002', border: '1.5px solid #ff4d4d', padding: '7px 10px', transition: 'background 0.15s,color 0.15s', outline: 'none', opacity: colors.length === 0 ? 0.5 : 1, cursor: colors.length === 0 ? 'not-allowed' : 'pointer', marginBottom: 0 }} aria-label="Delete All Colors" onMouseOver={e => { e.currentTarget.style.background = '#ff4d4d'; e.currentTarget.style.color = '#fff'; }} onMouseOut={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#ff4d4d'; }}>
            <svg width="18" height="18" fill="none" viewBox="0 0 20 20"><rect width="20" height="20" rx="4" fill="#fff"/><path d="M6 6l8 8M14 6l-8 8" stroke="#ff4d4d" strokeWidth="2" strokeLinecap="round"/></svg>
            <span>Delete All</span>
          </button>
          {error && <div style={{ color: '#ff4d4d', fontWeight: 600, fontSize: 15, marginTop: 8 }}>{error}</div>}
          {/* Donation Button Section */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '18px 0 0 0' }}>
            <a
              href="https://www.paypal.com/donate/?hosted_button_id=M5R7YKVH2SPQC"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                background: '#ffc439',
                color: '#222',
                fontWeight: 700,
                fontSize: 15,
                borderRadius: 7,
                padding: '8px 18px',
                textDecoration: 'none',
                boxShadow: '0 1px 4px #0002',
                border: '1.5px solid #e6b800',
                marginTop: 2,
                marginBottom: 2,
                transition: 'background 0.15s',
                outline: 'none',
                cursor: 'pointer',
              }}
              aria-label="Donate via PayPal"
            >
              PayPal
            </a>
            <span style={{ color: '#bbb', fontSize: 12, marginTop: 2, textAlign: 'center' }}>Support development</span>
          </div>
        </aside>
        {/* Main content: color palette */}
        <main style={{ flex: 1, width: '100%', maxWidth: 1400, margin: '24px 24px 24px 20px', padding: 0, minWidth: 0 }}>
          {/* DnD context provider for sortable colors */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={colors.map(c => c.id)} strategy={rectSortingStrategy}>
              <div
                className="palette-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
                  gap: 16,
                  width: '100%',
                  // No marginLeft or paddingLeft
                  transition: 'padding-left 0.2s',
                }}
              >
                {colors.map((c) => (
                  <SortableSwatch
                    key={c.id}
                    id={c.id}
                    color={c.color}
                    onColorChange={handleColorChange}
                    onRemove={handleRemoveColor}
                    onCopy={setCopiedIndex}
                    copied={copiedIndex === c.id}
                    onSwatchClick={handleSwatchClick}
                  />
                ))}
                {/* Add color button: only show if colors are loaded (i.e. after import) */}
                {colors.length > 0 && (
                  <button
                    onClick={handleAddColor}
                    aria-label="Add color"
                    style={{
                      width: '100%',
                      aspectRatio: '1',
                      borderRadius: 16,
                      border: '2px dashed #444',
                      background: 'none',
                      color: '#888',
                      fontSize: 36,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'border 0.2s, color 0.2s',
                      outline: 'none',
                    }}
                    tabIndex={0}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') handleAddColor();
                    }}
                    title="Add new color"
                  >+
                  </button>
                )}
              </div>
            </SortableContext>
          </DndContext>
          {/* Instructions and info */}
          <div style={{ color: '#ddd', fontSize: 14, lineHeight: 1.6, maxWidth: 800, margin: '0 auto', padding: '0 16px' }}>
            <p style={{ marginBottom: 12 }}>
              Welcome to the <strong style={{ color: '#ff4d4d' }}>Cubase Color Palette Editor</strong>! 🎨
            </p>
            <p style={{ marginBottom: 12 }}>
              <b>Important:</b> Please ensure <span style={{ color: '#ff4d4d' }}>Cubase is not running</span> before editing your color palette.<br/>
              You must import your <b>Defaults.xml</b> from:<br/>
              <span style={{ color: '#fff', background: '#222', padding: '2px 6px', borderRadius: 5, fontFamily: 'Fira Mono, monospace', fontSize: 13 }}>
                C:\Users\(your username)\AppData\Roaming\Steinberg\Cubase 14
              </span>
            </p>
            <p style={{ marginBottom: 12 }}>
              <b>Tip:</b> Make a backup copy of your Defaults.xml before editing, so you can restore it if needed.
            </p>
            <p style={{ marginBottom: 12 }}>
              <strong>Getting Started & Controls:</strong>
            </p>
            <ol style={{ marginLeft: 16, marginBottom: 12 }}>
              <li style={{ marginBottom: 8 }}>
                <strong>Import Defaults.xml:</strong> Click the "Import" button and select your Defaults.xml file from the Cubase directory above.
              </li>
              <li style={{ marginBottom: 8 }}>
                <strong>Edit Colours:</strong> Click any colour swatch to open the colour picker. <br/>
                <b>Drag</b> a swatch to reorder. <br/>
                <b>Ctrl+Click</b> a swatch to duplicate it. <br/>
              </li>
              <li style={{ marginBottom: 8 }}>
                <strong>Apply a Gradient:</strong> Use the Gradient Generator to create smooth colour transitions. Adjust the start colour, number of steps, saturation, and end percentage. Click "Add Gradient" to append the generated colours to your palette.
              </li>
              <li style={{ marginBottom: 8 }}>
                <strong>Balance Palette:</strong> Click "Balance Palette" to harmonise hue, lightness, and saturation for a more consistent look.
              </li>
              <li style={{ marginBottom: 8 }}>
                <strong>Undo/Redo:</strong> Use the Undo and Redo buttons to revert or reapply changes to your palette.
              </li>
              <li style={{ marginBottom: 8 }}>
                <strong>Danger Zone:</strong> Use "Delete All" to clear your palette. <span style={{ color: '#ff4d4d' }}><b>This cannot be undone!</b></span>
              </li>
              <li style={{ marginBottom: 8 }}>
                <strong>Export Your Palette:</strong> Once you're satisfied, click "Export" to download the updated Defaults.xml for Cubase.
              </li>
            </ol>
            <p style={{ marginBottom: 0 }}>
              <strong>Note:</strong> This tool is continuously being improved. If you encounter any issues or have suggestions, please let me know!
            </p>
          </div>
        </main>
      </div>
      {/* Eyedropper mode overlay */}
      {eyedropper && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          pointerEvents: 'none',
        }}>
          <div style={{
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
          }}>
            Eyedropper: Click another swatch to copy its color here, or press Esc to cancel
          </div>
        </div>
      )}
      {/* Responsive sidebar: collapse on small screens */}
      <style>{`
        @media (max-width: 900px) {
          .flex-root { flex-direction: column !important; }
          aside { width: 100% !important; margin: 12px 0 0 0 !important; border-radius: 0 0 14px 14px !important; }
          main { margin: 12px 0 0 0 !important; }
        }
      `}</style>
    </div>
  );
}
