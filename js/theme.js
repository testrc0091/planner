// ─── Theme Manager ───────────────────────────────────────────────────────────
import { save } from './db.js';

export async function applyTheme(hexColor) {
  const root = document.documentElement;
  const [r, g, b] = hexToRgb(hexColor);
  const [h, s, l] = rgbToHsl(r, g, b);

  root.style.setProperty('--mauve',     hexColor);
  root.style.setProperty('--deep-rose', hslToHex(h, Math.min(s + 0.08, 1), Math.max(l - 0.12, 0)));
  root.style.setProperty('--rose',      hslToHex(h, Math.max(s - 0.15, 0), Math.min(l + 0.10, 1)));
  root.style.setProperty('--blush',     hslToHex(h, Math.max(s - 0.30, 0), Math.min(l + 0.20, 1)));
  root.style.setProperty('--off-white', hslToHex(h, Math.max(s - 0.50, 0), Math.min(l + 0.30, 1)));
  root.style.setProperty('--card',      hslToHex(h, Math.max(s - 0.55, 0), Math.min(l + 0.33, 1)));
  root.style.setProperty('--blush-lt',  hslToHex(h, Math.max(s - 0.58, 0), Math.min(l + 0.36, 1)));

  await save('settings', { id: 'theme', baseColor: hexColor });
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0,2), 16) / 255,
    parseInt(clean.slice(2,4), 16) / 255,
    parseInt(clean.slice(4,6), 16) / 255
  ];
}

function rgbToHsl(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hslToHex(h, s, l) {
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return '#' + [r, g, b].map(x =>
    Math.round(x * 255).toString(16).padStart(2, '0')
  ).join('');
}
