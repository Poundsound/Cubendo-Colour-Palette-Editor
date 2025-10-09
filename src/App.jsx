import { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import { saveAs } from 'file-saver';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { v4 as uuidv4 } from 'uuid';
import { parseDefaultsXml, extractEventColors, updateEventColors } from './utils/cubaseXml';

// Helper: get color name from hex
function getColorName(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  
  // Convert to HSL for better color naming
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  const d = max - min;
  
  if (d === 0) {
    if (l > 0.95) return 'White';
    if (l < 0.05) return 'Black';
    return 'Gray';
  }
  
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  
  let h = 0;
  if (max === r / 255) h = ((g - b) / 255 / d + (g < b ? 6 : 0)) / 6;
  else if (max === g / 255) h = ((b - r) / 255 / d + 2) / 6;
  else h = ((r - g) / 255 / d + 4) / 6;
  h *= 360;
  
  // Lightness descriptors
  let lightness = '';
  if (l < 0.2) lightness = 'Very Dark ';
  else if (l < 0.4) lightness = 'Dark ';
  else if (l > 0.8) lightness = 'Light ';
  else if (l > 0.9) lightness = 'Very Light ';
  
  // Saturation descriptors
  let saturation = '';
  if (s < 0.1) return lightness + 'Gray';
  else if (s < 0.3) saturation = 'Grayish ';
  else if (s > 0.9) saturation = 'Vivid ';
  else if (s > 0.6) saturation = 'Bright ';
  
  // Hue names
  let hue = '';
  if (h < 15) hue = 'Red';
  else if (h < 45) hue = 'Orange';
  else if (h < 70) hue = 'Yellow';
  else if (h < 150) hue = 'Green';
  else if (h < 200) hue = 'Cyan';
  else if (h < 250) hue = 'Blue';
  else if (h < 310) hue = 'Purple';
  else if (h < 340) hue = 'Magenta';
  else hue = 'Red';
  
  return `${lightness}${saturation}${hue}`.trim();
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
// Simplified swatch component - no longer needs drag logic for individual swatches
function SwatchDisplay({ id, color, onRemove, onCopy, copied, onSwatchClick, selected }) {
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
      }}
      tabIndex={0}
      aria-label={`Color swatch ${color}`}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          onSwatchClick(id, e);
        }
      }}
      onClick={e => onSwatchClick(id, e)}
    >
      <div
        style={{
          width: '100%',
          aspectRatio: '1',
          background: color,
          borderRadius: 8,
          border: '2px solid #222',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          boxShadow: '0 1px 6px #0006',
          cursor: 'pointer',
          transition: 'box-shadow 0.2s, border 0.2s',
          overflow: 'visible',
        }}
        title="Click to edit color"
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
function DraggableRow({ rowIndex, rowId, children }) {
  return (
    <Draggable draggableId={rowId} index={rowIndex}>
      {(provided, snapshot) => {
        // Build the style object, ensuring we don't add transitions to transform
        const style = {
          ...provided.draggableProps.style,
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        };
        
        // Only add visual effects during drag - NO transparency
        if (snapshot.isDragging) {
          style.background = '#252525';
          style.borderRadius = '8px';
          style.padding = '4px';
          style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.5)';
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
            title="Drag to reorder row"
          >
            ⋮⋮
          </div>
          {/* Row content */}
          <div style={{ flex: 1 }}>
            {children}
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
  // focused swatch tracking removed (no longer needed)
  const [presets, setPresets] = useState([]); // [{name, description, colors, colorCount}]
  const [presetName, setPresetName] = useState('');
  // Row-selection and grid columns tracking
  const [columns, setColumns] = useState(8);
  const [showHelp, setShowHelp] = useState(false);
  const gridRef = useRef(null);
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
  const pushHistory = useCallback((newColors) => {
    setHistory(h => [...h, colors.map(c => ({ ...c }))]);
    setFuture([]);
    setColors(newColors);
  }, [colors]);

  // Screen pick helper (adds a new swatch)
  const handleScreenPickAddNew = useCallback(async () => {
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
      const doc = parseDefaultsXml(text);
      const hexes = extractEventColors(doc);
      if (!hexes) {
        setError('Could not find Event Colors in this Defaults.xml');
        return;
      }
      setXmlDoc(doc);
      setColors(hexes.map(hex => ({ id: uuidv4(), color: hex })));
      setHistory([]);
      setFuture([]);
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
  const handleColorChange = (id, newHex) => {
    pushHistory(colors.map(c => c.id === id ? { ...c, color: newHex.toUpperCase() } : c));
  };

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
  const computedGradientEnd = gradientManualEnd 
    ? gradientEndColor 
    : lighten(previewGradientStart, (gradientEndPct / 100) * MAX_LIGHTEN);

  // Handle drag end for reordering rows with @hello-pangea/dnd
  const onDragEnd = (result) => {
    const { source, destination } = result;
    
    // Dropped outside the list
    if (!destination) return;
    
    // No movement
    if (source.index === destination.index) return;
    
    console.log('Row drag end - from:', source.index, 'to:', destination.index);
    
    // Reorganize the colors array by moving entire rows
    const sourceRowStart = source.index * columns;
    const sourceRowEnd = Math.min(sourceRowStart + columns, colors.length);
    const rowColors = colors.slice(sourceRowStart, sourceRowEnd);
    
    // Remove from source
    const newColors = [...colors];
    newColors.splice(sourceRowStart, rowColors.length);
    
    // Insert at destination
    const destRowStart = destination.index * columns;
    newColors.splice(destRowStart, 0, ...rowColors);
    
    console.log('Moved row of', rowColors.length, 'colors from index', sourceRowStart, 'to', destRowStart);
    
    // Update immediately - pushHistory will handle the state update
    pushHistory(newColors);
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
    // Note: Shift selection moved to drag handle, not the swatch body
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
    pushHistory([...colors].reverse());
  };

  const handleShufflePalette = () => {
    if (colors.length < 2) return;
    const shuffled = [...colors]
      .map(v => ({ v, r: Math.random() }))
      .sort((a, b) => a.r - b.r)
      .map(({ v }) => v);
    pushHistory(shuffled);
  };

  const handleSortByHue = () => {
    const sorted = [...colors].sort((a, b) => {
      const [ha,, la] = hexToHsl(a.color);
      const [hb,, lb] = hexToHsl(b.color);
      if (ha === hb) return la - lb;
      return ha - hb;
    });
    pushHistory(sorted);
  };

  const handleSortBySaturation = () => {
    const sorted = [...colors].sort((a, b) => {
      const [,sa, la] = hexToHsl(a.color);
      const [,sb, lb] = hexToHsl(b.color);
      if (sa === sb) return la - lb;
      return sa - sb;
    });
    pushHistory(sorted);
  };

  const handleSortByLightness = () => {
    const sorted = [...colors].sort((a, b) => {
      const [, , la] = hexToHsl(a.color);
      const [, , lb] = hexToHsl(b.color);
      return la - lb;
    });
    pushHistory(sorted);
  };

  // Eyedropper button removed with top toolbar; keep Alt-click on swatches and global screen pick (E)

  // Removed focused-swatches screen-pick variant to match new global add-new behavior

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

  // Save current palette as a preset
  const handleSavePreset = () => {
    if (!presetName.trim() || colors.length === 0) return;
    const newPreset = {
      id: uuidv4(),
      name: presetName.trim(),
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
    const newColors = preset.colors.map(color => ({ id: uuidv4(), color }));
    pushHistory(newColors);
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
                    const previewStart = setSaturation(newColor, gradientSaturation);
                    const autoEndColor = lighten(previewStart, (gradientEndPct / 100) * MAX_LIGHTEN);
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
      
      <div className="layout">
        {/* Left Sidebar */}
        <aside className="sidebar left" style={{ padding: 10, gap: 0 }}>
          {/* Palette Actions Section */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px', marginBottom: 6 }}>Palette Actions</div>
            <div style={{ color: '#bbb', fontSize: 13, marginBottom: 8 }}>Colors: <b>{colors.length}</b></div>
            {/* Import/Export/Donate removed: handled on right sidebar */}
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
          {/* Round-Trip Test removed */}
          {/* Create Backup moved to right sidebar */}
          <hr style={{ border: 'none', borderTop: '1px solid #333', margin: '6px 0 6px 0' }} />
          {/* Gradient Generator Section */}
          <div style={{ background: '#232323', borderRadius: 10, padding: 12, marginBottom: 6, boxShadow: '0 1px 4px #0002', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#fff', marginBottom: 4, letterSpacing: '-0.3px' }}>Gradient Generator</div>
            
            {/* Live Gradient Preview */}
            <div style={{
              height: 32,
              borderRadius: 6,
              background: `linear-gradient(to right, ${generateGradientSaturation(previewGradientStart, computedGradientEnd, gradientSteps, gradientSaturation).join(', ')})`,
              border: '1px solid #444',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
            }} title="Gradient preview" />
            
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
                          const previewStart = setSaturation(gradientStart, gradientSaturation);
                          const autoEnd = lighten(previewStart, (gradientEndPct / 100) * MAX_LIGHTEN);
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
            <button className="btn" style={{ width: '100%', marginTop: 6, background: '#444', color: '#fff', fontWeight: 700, borderRadius: 7, fontSize: 15, boxShadow: '0 1px 4px #0002', border: 'none', padding: '7px 0', transition: 'background 0.15s', outline: 'none' }} onClick={handleApplyGradient} aria-label="Add Gradient" onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px #ff4d4d'} onBlur={e => e.currentTarget.style.boxShadow = '0 1px 4px #0002'}>Add Gradient</button>
          </div>
          {/* Balance Palette button */}
          <button
            className="btn"
            onClick={handleBalancePalette}
            disabled={colors.length < 2}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: '#232323', borderRadius: 7, fontWeight: 600, color: '#fff', fontSize: 15, boxShadow: '0 1px 4px #0002', border: '1px solid #333', padding: '7px 10px', transition: 'background 0.15s', outline: 'none', opacity: colors.length < 2 ? 0.5 : 1, cursor: colors.length < 2 ? 'not-allowed' : 'pointer', margin: '8px 0 12px 0', minHeight: 36, justifyContent: 'flex-start'
            }}
            aria-label="Balance Palette"
            title="Balance palette: harmonise hue, lightness, and saturation for consistency"
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 20 20"><rect width="20" height="20" rx="4" fill="#444"/><path d="M4 10h12M6 7l-2 3 2 3M14 13l2-3-2-3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span>Balance Palette</span>
          </button>
          {error && <div style={{ color: '#ff4d4d', fontWeight: 600, fontSize: 15, marginTop: 8 }}>{error}</div>}
            {/* Tips (left bottom) */}
            <div style={{
              marginTop: 12,
              background: '#2a2a2a',
              borderRadius: 8,
              border: '1px solid #3a3a3a',
              padding: '10px 12px',
              color: '#ddd',
              fontSize: 12,
              lineHeight: 1.5,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}>
              <div>
                <span style={{ marginRight: 6 }}>💡</span>
                <strong>Tip:</strong> Use the eyedropper to add colors from anywhere on your screen.
              </div>
              <div>
                <span style={{ marginRight: 6 }}>✨</span>
                <strong>Row Reorder:</strong> Drag the row handle (⋮⋮) to move rows up or down!
              </div>
            </div>
            
            {/* Help Button */}
            <button
              onClick={() => setShowHelp(!showHelp)}
              style={{
                width: '100%',
                background: '#232323',
                border: '1px solid #333',
                borderRadius: 7,
                color: '#fff',
                fontWeight: 600,
                fontSize: 14,
                padding: '8px 12px',
                cursor: 'pointer',
                marginTop: 12,
              }}
            >
              {showHelp ? '❌ Close Help' : '❓ Show Help'}
            </button>
  </aside>
  {/* Main content */}
  <main className="main">
          {/* DnD context provider for sortable rows */}
          <DragDropContext 
            onDragEnd={onDragEnd}
          >
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
              ) : (
                // Droppable list of rows
                <Droppable droppableId="palette-rows" type="ROW">
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      style={{ width: '100%' }}
                    >
                      {(() => {
                        const rows = [];
                        for (let start = 0; start < colors.length; start += columns) {
                          const end = Math.min(start + columns, colors.length);
                          const rowIndex = Math.floor(start / columns);
                          const rowColors = colors.slice(start, end);
                          
                          // Build content for ghost display
                          const content = (
                            <div 
                              className="row-grid" 
                              style={{ 
                                display: 'grid', 
                                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, 
                                gap: 8,
                              }}
                            >
                              {rowColors.map((c) => (
                                <div
                                  key={c.id}
                                  style={{
                                    aspectRatio: '1',
                                    background: c.color,
                                    borderRadius: 8,
                                    border: '2px solid #444',
                                  }}
                                />
                              ))}
                            </div>
                          );
                          
                          rows.push({ start, end, rowId: `row-${rowIndex}`, rowIndex, content, colors: rowColors });
                        }
                        
                        return rows.map((r) => (
                          <DraggableRow 
                            key={r.rowId} 
                            rowId={r.rowId} 
                            rowIndex={r.rowIndex}
                          >
                            <div 
                              className="row-grid" 
                              style={{ 
                                display: 'grid', 
                                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, 
                                gap: 8,
                              }}
                            >
                              {r.colors.map((c) => {
                                return (
                                  <SwatchDisplay
                                    key={c.id}
                                    id={c.id}
                                    color={c.color}
                                    onColorChange={handleColorChange}
                                    onRemove={handleRemoveColor}
                                    onCopy={setCopiedIndex}
                                    copied={copiedIndex === c.id}
                                    onSwatchClick={handleSwatchClick}
                                    selected={false}
                                  />
                                );
                              })}
                            </div>
                          </DraggableRow>
                        ));
                      })()}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              )}
              </div>
          </DragDropContext>
        </main>
        {/* Right Sidebar: Presets Panel */}
        <aside className="sidebar right" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Import & Export */}
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px', marginBottom: 6 }}>Import & Export</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, marginBottom: 12 }}>
            <label htmlFor="right-import" style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#232323', color: '#fff', border: '1px solid #333', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', fontWeight: 700, fontSize: 13, width: '100%'
            }}>
              <span>Import</span>
              <input id="right-import" type="file" accept=".xml" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>
            <button onClick={handleDownload} disabled={colors.length===0} style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#232323', color: '#fff', border: '1px solid #333', borderRadius: 8, padding: '8px 10px', fontWeight: 700, fontSize: 13, opacity: colors.length===0?0.5:1, cursor: colors.length===0?'not-allowed':'pointer', width: '100%'
            }}>Export</button>
            <button onClick={handleCreateBackup} disabled={!xmlDoc} style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#232323', color: '#fff', border: '1px solid #333', borderRadius: 8, padding: '8px 10px', fontWeight: 700, fontSize: 13, opacity: !xmlDoc?0.5:1, cursor: !xmlDoc?'not-allowed':'pointer', width: '100%'
            }}>Create Backup</button>
            <button onClick={handleAddColor} style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#444', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 10px', fontWeight: 700, fontSize: 13, cursor: 'pointer', width: '100%'
            }}>+ Add Color</button>
          </div>

          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px', margin: '6px 0 4px' }}>Palette Presets</div>
          
          {/* Save Preset Section */}
          <div style={{ marginBottom: 8 }}>
            <input
              type="text"
              placeholder="Preset name..."
              value={presetName}
              onChange={e => setPresetName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSavePreset();
              }}
              disabled={colors.length === 0}
              style={{
                width: '100%',
                background: '#181818',
                border: '1px solid #333',
                borderRadius: 7,
                padding: '8px 12px',
                color: '#fff',
                fontSize: 14,
                marginBottom: 8,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <button
              onClick={handleSavePreset}
              disabled={!presetName.trim() || colors.length === 0}
              style={{
                width: '100%',
                background: '#444',
                color: '#fff',
                border: 'none',
                borderRadius: 7,
                padding: '8px 12px',
                fontSize: 14,
                fontWeight: 600,
                cursor: colors.length === 0 || !presetName.trim() ? 'not-allowed' : 'pointer',
                opacity: colors.length === 0 || !presetName.trim() ? 0.5 : 1,
                transition: 'background 0.15s',
              }}
            >
              Save
            </button>
            {/* Load JSON placed directly below Save */}
            <button
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.onchange = async (e) => {
                  try {
                    const file = e.target.files[0];
                    const text = await file.text();
                    const loaded = JSON.parse(text);
                    setPresets(loaded);
                    localStorage.setItem('cubase-color-presets', JSON.stringify(loaded));
                  } catch (err) {
                    alert('Failed to load presets: ' + err.message);
                  }
                };
                input.click();
              }}
              style={{
                width: '100%',
                background: '#232323',
                color: '#fff',
                border: '1px solid #333',
                borderRadius: 7,
                padding: '8px 12px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                marginTop: 8,
              }}
            >
              Load JSON
            </button>
          </div>

          <button
            className="btn btn-danger"
            onClick={handleDeleteAll}
            disabled={colors.length === 0}
            aria-label="Delete All Colors"
            style={{ width: '100%', marginTop: 8 }}
          >
            Delete All
          </button>

          <hr style={{ border: 'none', borderTop: '1px solid #333', margin: '8px 0' }} />

          {/* Presets List */}
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
            <button className="btn" onClick={handleReversePalette} disabled={colors.length < 2} title="Reverse order" aria-label="Reverse">Reverse</button>
            <button className="btn" onClick={handleShufflePalette} disabled={colors.length < 2} title="Shuffle colors" aria-label="Shuffle">Shuffle</button>
            <button className="btn" onClick={handleSortByHue} disabled={colors.length < 2} title="Sort by Hue" aria-label="Sort by Hue">Sort: Hue</button>
            <button className="btn" onClick={handleSortBySaturation} disabled={colors.length < 2} title="Sort by Saturation" aria-label="Sort by Saturation">Sort: Sat</button>
            <button className="btn" onClick={handleSortByLightness} disabled={colors.length < 2} title="Sort by Lightness" aria-label="Sort by Lightness">Sort: Light</button>
            {/* Round-Trip Test removed */}
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
    </div>
  );
}
