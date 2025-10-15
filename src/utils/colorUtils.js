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

const TAU = Math.PI * 2;

function srgbChannelToLinear(channel) {
  const srgb = channel / 255;
  if (srgb <= 0.04045) return srgb / 12.92;
  return ((srgb + 0.055) / 1.055) ** 2.4;
}

function linearChannelToSrgb(linear) {
  if (linear <= 0.0031308) return linear * 12.92;
  return 1.055 * (Math.max(0, linear) ** (1 / 2.4)) - 0.055;
}

function hexToOklch(hex) {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    return { L: 0, C: 0, h: 0 };
  }

  const r = srgbChannelToLinear(parseInt(hex.slice(1, 3), 16));
  const g = srgbChannelToLinear(parseInt(hex.slice(3, 5), 16));
  const b = srgbChannelToLinear(parseInt(hex.slice(5, 7), 16));

  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bLab = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  const C = Math.sqrt(a * a + bLab * bLab);
  let h = Math.atan2(bLab, a);
  if (!Number.isFinite(h)) h = 0;
  const hDeg = ((h % TAU) + TAU) % TAU * (180 / Math.PI);

  return { L, C, h: hDeg };
}

function oklchToHex({ L, C, h }) {
  const chroma = Math.max(0, C);
  const hueRad = Number.isFinite(h) ? (h % 360) * (Math.PI / 180) : 0;
  const a = Math.cos(hueRad) * chroma;
  const b = Math.sin(hueRad) * chroma;

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  const rLin = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  const r = linearChannelToSrgb(rLin);
  const g = linearChannelToSrgb(gLin);
  const bl = linearChannelToSrgb(bLin);

  const toHex = (val) => Math.round(clamp01(val) * 255).toString(16).padStart(2, '0');

  return `#${toHex(r)}${toHex(g)}${toHex(bl)}`.toUpperCase();
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
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
  if (!preserveSaturation) {
    const hslArr = colors.map((c) => {
      if (isAchromatic(c.color)) {
        const [, , l] = hexToHsl(c.color);
        return { ...c, h: null, s: 0, l, family: getHueFamily(null) };
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
    const SATURATION_BOOST = 1.15;
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
            const boostedS = Math.min(1, orig.s * SATURATION_BOOST);
            balanced.push({ ...orig, color: hslToHex(orig.h, boostedS, baseLightness) });
          }
        }
      }
    }

    const idToColor = Object.fromEntries(balanced.map(({ id, color }) => [id, color]));
    return colors.map(({ id }) => ({ id, color: idToColor[id] }));
  }

  const enriched = colors.map((entry) => {
    const hex = entry.color;
    const { L, C, h } = hexToOklch(hex);
    const chroma = C;
    const achromatic = chroma < 0.0008;
    const [hHsl] = hexToHsl(hex);
    const family = achromatic ? 'grey' : getHueFamily(hHsl);
    return { ...entry, family, oklch: { L, C: chroma, h } };
  });

  const familyMap = new Map();
  enriched.forEach((item) => {
    if (!familyMap.has(item.family)) familyMap.set(item.family, []);
    familyMap.get(item.family).push(item);
  });

  const adjustments = new Map();

  const LIGHT_BLEND = 0.35;
  const EDGE_LIGHT_BLEND = 0.2;
  const GREY_BLEND = 0.4;
  const LIGHT_TARGET_PUSH = 0.22;
  const CHROMA_BLEND = 0.45;
  const CHROMA_OFFSET = 0.04;
  const CHROMA_MAX = 0.28;
  const TINTED_THRESHOLD = 0.018;
  const MIN_TINT_CHROMA = 0.014;
  const TINT_CHROMA_RETENTION = 0.72;
  const TINT_LIGHTNESS_CAP = 0.82;
  const TINT_MAX_LIFT = 0.2;
  const TINT_CHROMA_RETAIN_RATIO = 0.9;
  const PASTEL_LIGHT_MIN = 0.6;
  const PASTEL_CHROMA_MAX = 0.065;

  familyMap.forEach((group, family) => {
    if (!group.length) return;
    if (family === 'grey') {
      const Ls = group.map((item) => item.oklch.L);
      const medianL = median(Ls);
      const targetL = clamp01(medianL + (1 - medianL) * 0.18);
      group.forEach((item) => {
        const strength = GREY_BLEND * (group.length <= 2 ? 0.7 : 1);
        const newL = clamp01(item.oklch.L + (targetL - item.oklch.L) * strength);
        adjustments.set(item.id, oklchToHex({ L: newL, C: 0, h: 0 }));
      });
      return;
    }

    const sortedByLightness = [...group].sort((a, b) => a.oklch.L - b.oklch.L);
    const Ls = sortedByLightness.map((item) => item.oklch.L);
    const Cs = group.map((item) => item.oklch.C);

    const medianL = median(Ls);
    const medianC = median(Cs);
    const targetL = clamp01(medianL + (1 - medianL) * LIGHT_TARGET_PUSH);
    const softCeil = Math.min(CHROMA_MAX, medianC + CHROMA_OFFSET);

    sortedByLightness.forEach((item, idx) => {
      const isPastel = item.oklch.L >= PASTEL_LIGHT_MIN && item.oklch.C <= PASTEL_CHROMA_MAX;
      if (isPastel) {
        adjustments.set(item.id, item.color);
        return;
      }

      const lightStrength = (idx === 0 || idx === sortedByLightness.length - 1) ? EDGE_LIGHT_BLEND : LIGHT_BLEND;
      let newL = clamp01(item.oklch.L + (targetL - item.oklch.L) * lightStrength);

      const cappedC = item.oklch.C > softCeil ? softCeil : item.oklch.C;
      let newC = clamp01(item.oklch.C + (cappedC - item.oklch.C) * CHROMA_BLEND);

      const isTinted = item.oklch.C >= TINTED_THRESHOLD;
      if (isTinted) {
        const retentionFloor = Math.max(MIN_TINT_CHROMA, item.oklch.C * TINT_CHROMA_RETENTION);
        const retainOriginalFloor = item.oklch.C * TINT_CHROMA_RETAIN_RATIO;
        newC = Math.max(newC, retentionFloor, retainOriginalFloor);
        const liftLimit = Math.min(TINT_LIGHTNESS_CAP, item.oklch.L + TINT_MAX_LIFT);
        if (newL > liftLimit) {
          newL = liftLimit;
        }
      } else if (item.oklch.C >= MIN_TINT_CHROMA && newC < MIN_TINT_CHROMA) {
        newC = MIN_TINT_CHROMA;
      }

      adjustments.set(item.id, oklchToHex({ L: newL, C: newC, h: item.oklch.h }));
    });
  });

  const originalMap = new Map(colors.map(({ id, color }) => [id, color]));
  return colors.map(({ id }) => ({ id, color: adjustments.get(id) || originalMap.get(id) || '#000000' }));

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
