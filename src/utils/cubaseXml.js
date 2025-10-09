// Utility helpers for safely reading/writing Cubase Event Colors in Defaults.xml
// We only touch: <obj class="UColorSet" name="Event Colors"> → <list name="Set"> → <item>
// and only modify the <int name="Color" value="..."/> entries inside those items.

export const MAX_COLORS = 128; // Cubase supports up to 32 base x 4 tints typically

function argbIntToHexLocal(argb) {
  const n = Number(argb) >>> 0;
  const hex = (n & 0xFFFFFF).toString(16).toUpperCase();
  return '#' + hex.padStart(6, '0');
}

function hexToArgbIntLocal(hex) {
  const rgb = parseInt(String(hex).replace('#', ''), 16);
  return (0xFF000000 | rgb) >>> 0;
}

export function parseDefaultsXml(text) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'application/xml');
  // Basic parse error check
  const parserError = doc.getElementsByTagName('parsererror')[0];
  if (parserError) {
    const err = parserError.textContent || 'Unknown XML parse error';
    throw new Error('XML parse error: ' + err);
  }
  return doc;
}

function findEventColorsSetList(doc) {
  // Find <obj class="UColorSet" name="Event Colors">
  const objs = Array.from(doc.getElementsByTagName('obj'));
  const eventColorsObj = objs.find(
    (node) => node.getAttribute('class') === 'UColorSet' && node.getAttribute('name') === 'Event Colors'
  );
  if (!eventColorsObj) return null;
  // Then find <list name="Set">
  const setList = Array.from(eventColorsObj.getElementsByTagName('list')).find(
    (l) => l.getAttribute('name') === 'Set'
  );
  return setList || null;
}

// Read hex colors from the Event Colors set
export function extractEventColors(doc) {
  const setList = findEventColorsSetList(doc);
  if (!setList) return null;
  const items = Array.from(setList.getElementsByTagName('item'));
  const colorHexes = items
    .map((item) => {
      const colorInt = Array.from(item.getElementsByTagName('int')).find((intNode) => intNode.getAttribute('name') === 'Color');
      if (!colorInt) return null;
      const val = colorInt.getAttribute('value');
      return val ? argbIntToHexLocal(val) : null;
    })
    .filter(Boolean);
  return colorHexes.slice(0, MAX_COLORS);
}

// Safely update only the <int name="Color"/> values for the Event Colors set
// - Preserve existing <string name="Name"/> where possible
// - Do not touch any other sections
export function updateEventColors(doc, hexColors) {
  const setList = findEventColorsSetList(doc);
  if (!setList) throw new Error('Could not find <obj class="UColorSet" name="Event Colors"> / <list name="Set">');

  const desired = hexColors.slice(0, MAX_COLORS);
  const items = Array.from(setList.getElementsByTagName('item'));

  // Update existing items first
  const minLen = Math.min(items.length, desired.length);
  for (let i = 0; i < minLen; i++) {
    const item = items[i];
    let intNode = Array.from(item.getElementsByTagName('int')).find((n) => n.getAttribute('name') === 'Color');
    if (!intNode) {
      intNode = doc.createElement('int');
      intNode.setAttribute('name', 'Color');
      item.appendChild(intNode);
    }
    intNode.setAttribute('value', String(hexToArgbIntLocal(desired[i])));
  }

  // If more desired than existing, append new items
  for (let i = items.length; i < desired.length; i++) {
    const itemNode = doc.createElement('item');
    // Name string (preserve convention)
    const stringNode = doc.createElement('string');
    stringNode.setAttribute('name', 'Name');
    stringNode.setAttribute('value', `Color${i}`);
    stringNode.setAttribute('wide', 'true');
    const intNode = doc.createElement('int');
    intNode.setAttribute('name', 'Color');
    intNode.setAttribute('value', String(hexToArgbIntLocal(desired[i])));
    itemNode.appendChild(stringNode);
    itemNode.appendChild(intNode);
    setList.appendChild(itemNode);
  }

  // If existing has more items than desired, remove the tail to avoid touching unrelated structure
  for (let i = items.length - 1; i >= desired.length; i--) {
    setList.removeChild(items[i]);
  }

  return doc;
}
