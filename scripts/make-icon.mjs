import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '../assets/company-logo.png');
const ASSETS = path.join(__dirname, '../assets');

// Get original dimensions first
const meta = await sharp(SRC).metadata();
const W = meta.width;
const H = meta.height;

// The roof glyph occupies roughly the top 47% of the logo image
// We crop from the full width, top 47% of height, with a little padding
const cropH = Math.round(H * 0.48);

// Crop the roof portion out of the original
const roofBuf = await sharp(SRC)
  .extract({ left: 0, top: 0, width: W, height: cropH })
  .toBuffer();

// We'll composite onto a 1024x1024 white canvas
// Roof image scaled to fit 840px wide, centred horizontally
// "A&A" text sits below it

const CANVAS = 1024;
const roofTargetW = 840;
const roofTargetH = Math.round(cropH * (roofTargetW / W));
const roofLeft = Math.round((CANVAS - roofTargetW) / 2);
// Centre the whole composition (roof + gap + text ~160px tall) vertically
const TEXT_H = 160;
const GAP = 50;
const totalH = roofTargetH + GAP + TEXT_H;
const roofTop = Math.round((CANVAS - totalH) / 2);

const roofResized = await sharp(roofBuf)
  .resize(roofTargetW, roofTargetH, { fit: 'fill' })
  .toBuffer();

// SVG text overlay for "A&A"
const textY = roofTop + roofTargetH + 70;
const textSvg = Buffer.from(`
<svg width="${CANVAS}" height="${CANVAS}" xmlns="http://www.w3.org/2000/svg">
  <text
    x="${CANVAS / 2}"
    y="${textY}"
    font-family="Arial, Helvetica, sans-serif"
    font-size="160"
    font-weight="900"
    fill="#1a3c5e"
    text-anchor="middle"
    dominant-baseline="auto"
    letter-spacing="8"
  >A&amp;A</text>
</svg>`);

const icon = await sharp({
  create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
})
  .composite([
    { input: roofResized, top: roofTop, left: roofLeft },
    { input: textSvg,     top: 0,       left: 0 },
  ])
  .png()
  .toBuffer();

// Write all needed icon files
await sharp(icon).resize(1024, 1024).toFile(path.join(ASSETS, 'icon.png'));
await sharp(icon).resize(1024, 1024).toFile(path.join(ASSETS, 'adaptive-icon.png'));
await sharp(icon).resize(1024, 1024).toFile(path.join(ASSETS, 'splash-icon.png'));
await sharp(icon).resize(196,  196 ).toFile(path.join(ASSETS, 'favicon.png'));

console.log(`Done. Roof: ${roofTargetW}x${roofTargetH} at (${roofLeft}, ${roofTop}). Text Y: ${textY}`);
