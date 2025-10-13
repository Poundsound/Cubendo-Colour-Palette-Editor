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

function findEventColorsLists(doc) {
  // Find <obj class="UColorSet" name="Event Colors">
  const objs = Array.from(doc.getElementsByTagName('obj'));
  const eventColorsObj = objs.find(
    (node) => node.getAttribute('class') === 'UColorSet' && node.getAttribute('name') === 'Event Colors'
  );
  if (!eventColorsObj) return { setList: null, defSetList: null };
  // Then find <list name="Set"> and optional <list name="DefSet">
  const lists = Array.from(eventColorsObj.getElementsByTagName('list'));
  const setList = lists.find((l) => l.getAttribute('name') === 'Set') || null;
  const defSetList = lists.find((l) => l.getAttribute('name') === 'DefSet') || null;
  return { setList, defSetList };
}

// Read hex colors from the Event Colors set
export function extractEventColors(doc) {
  const { setList } = findEventColorsLists(doc);
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
  const { setList, defSetList } = findEventColorsLists(doc);
  if (!setList) throw new Error('Could not find <obj class="UColorSet" name="Event Colors"> / <list name="Set">');

  const desired = hexColors.slice(0, MAX_COLORS);
  const items = Array.from(setList.getElementsByTagName('item'));
  const defItems = defSetList ? Array.from(defSetList.getElementsByTagName('item')) : [];

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

    // Mirror into DefSet if present
    if (defSetList && defItems[i]) {
      let defInt = Array.from(defItems[i].getElementsByTagName('int')).find((n) => n.getAttribute('name') === 'Color');
      if (!defInt) {
        defInt = doc.createElement('int');
        defInt.setAttribute('name', 'Color');
        defItems[i].appendChild(defInt);
      }
      defInt.setAttribute('value', String(hexToArgbIntLocal(desired[i])));
    }
  }

  // If more desired than existing, append new items
  for (let i = items.length; i < desired.length; i++) {
    const itemNode = doc.createElement('item');
    // Name string (preserve convention)
    const stringNode = doc.createElement('string');
    stringNode.setAttribute('name', 'Name');
    stringNode.setAttribute('value', `Color ${i + 1}`);
    stringNode.setAttribute('wide', 'true');
    const intNode = doc.createElement('int');
    intNode.setAttribute('name', 'Color');
    intNode.setAttribute('value', String(hexToArgbIntLocal(desired[i])));
    itemNode.appendChild(stringNode);
    itemNode.appendChild(intNode);
    setList.appendChild(itemNode);

    // Mirror into DefSet if present
    if (defSetList) {
      const defItem = doc.createElement('item');
      const defString = doc.createElement('string');
      defString.setAttribute('name', 'Name');
      defString.setAttribute('value', `Color ${i + 1}`);
      defString.setAttribute('wide', 'true');
      const defInt = doc.createElement('int');
      defInt.setAttribute('name', 'Color');
      defInt.setAttribute('value', String(hexToArgbIntLocal(desired[i])));
      defItem.appendChild(defString);
      defItem.appendChild(defInt);
      defSetList.appendChild(defItem);
    }
  }

  // If existing has more items than desired, remove the tail to avoid touching unrelated structure
  for (let i = items.length - 1; i >= desired.length; i--) {
    setList.removeChild(items[i]);
  }
  if (defSetList) {
    for (let i = defItems.length - 1; i >= desired.length; i--) {
      defSetList.removeChild(defItems[i]);
    }
  }

  return doc;
}

// Serialize XML with optional declaration and normalized line endings
export function serializeDefaultsXml(doc, { includeXmlDeclaration = true, encoding = 'utf-8', windowsLineEndings = true } = {}) {
  const serializer = new XMLSerializer();
  let xml = serializer.serializeToString(doc);
  if (includeXmlDeclaration) {
    const decl = `<?xml version="1.0" encoding="${encoding}"?>`;
    // Only prepend if not already present
    if (!xml.trimStart().startsWith('<?xml')) {
      xml = decl + (windowsLineEndings ? '\r\n' : '\n') + xml;
    }
  }
  if (windowsLineEndings) {
    // Normalize all LF to CRLF for Windows-friendly formatting
    xml = xml.replace(/\r?\n/g, '\r\n');
  }
  return xml;
}
