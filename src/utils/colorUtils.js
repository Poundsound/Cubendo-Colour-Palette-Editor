export function randomHex() {
  return `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0').toUpperCase()}`;
}

export function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

export function hslToHex(h, s, l) {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp01(s);
  const light = clamp01(l);

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

export function hexToHsl(hex) {
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

export function hexToHsv(hex) {
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
}

export function isAchromatic(hex) {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return r === g && g === b;
}

export function getHueFamily(h) {
  if (h === null || Number.isNaN(h)) return 'grey';
  if (h < 15 || h >= 345) return 'red';
  if (h < 45) return 'orange';
  if (h < 70) return 'yellow';
  if (h < 170) return 'green';
  if (h < 200) return 'cyan';
  if (h < 260) return 'blue';
  if (h < 320) return 'magenta';
  return 'red';
}

export function getColorName(hex) {
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

export function clonePalette(palette) {
  return palette.map((entry) => ({ ...entry }));
}

export function palettesEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].id !== b[i].id) return false;
    if (a[i].color !== b[i].color) return false;
  }
  return true;
}

export function balancePaletteIteration(colors, options = {}) {
  const { preserveSaturation = false } = options;
  if (!colors.length) return colors;

  const hslArr = colors.map((c) => {
    if (isAchromatic(c.color)) {
      const [, , l] = hexToHsl(c.color);
      return { ...c, h: null, s: 0, l, family: 'grey' };
    }
    const [h, s, l] = hexToHsl(c.color);
    return { ...c, h, s, l, family: getHueFamily(h) };
  });

  const families = {};
  hslArr.forEach((c) => {
    if (!families[c.family]) families[c.family] = [];
    families[c.family].push(c);
  });

  let balanced = [];
  const SATURATION_BOOST = preserveSaturation ? 1 : 1.15;
  for (const fam in families) {
    const group = families[fam];
    const sorted = [...group].sort((a, b) => a.l - b.l);
    const n = sorted.length;
    if (n <= 2) {
      balanced = balanced.concat(sorted);
      continue;
    }

    const first = sorted[0];
    const last = sorted[n - 1];
    for (let i = 0; i < n; i += 1) {
      const orig = sorted[i];
      if (i === 0 || i === n - 1) {
        balanced.push(orig);
      } else {
        const t = i / (n - 1);
        if (fam === 'grey') {
          const l = first.l + (last.l - first.l) * t;
          balanced.push({ ...orig, color: hslToHex(0, 0, l) });
        } else {
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

  const idToColor = Object.fromEntries(balanced.map(({ id, color }) => [id, color]));
  return colors.map(({ id }) => ({ id, color: idToColor[id] }));
}

export function calculateHarmonyScore(colors) {
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
