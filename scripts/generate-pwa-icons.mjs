// Génère les icônes PWA (public/pwa-*.png, maskable-icon-*.png, apple-touch-icon-*.png,
// favicon.ico) à partir du dégradé mint→teal déjà utilisé comme logo dans TopBar.tsx
// (w-7 h-7 rounded-lg bg-gradient-to-br from-mint to-teal).
//
// Volontairement SANS dépendance externe (seulement zlib/fs de Node) : sharp (utilisé par
// @vite-pwa/assets-generator) n'a pas de binaire natif pour win32-arm64, et son build WASM de
// repli plante sous Node 24 sur cette machine (TypeError dans libvipsVersion). Le motif est un
// simple carré arrondi + dégradé linéaire, assez simple pour être rastérisé à la main — plus
// robuste ici qu'une dépendance native/WASM fragile.
//
// Usage : node scripts/generate-pwa-icons.mjs (ou npm run generate-pwa-icons)
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const MINT = [0x3f, 0xd6, 0x9b]; // #3FD69B
const TEAL = [0x57, 0xa9, 0xf0]; // #57A9F0
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Filtre "None" (0) devant chaque ligne.
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = deflateSync(raw);

  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

/**
 * Rastérise le motif à la taille demandée.
 * - fullBleed=true (maskable, apple-touch) : dégradé plein cadre, opaque, sans coins arrondis
 *   (l'OS applique son propre masque/arrondi — un maskable pré-arrondi serait doublement rogné).
 * - fullBleed=false (pwa-*, favicon) : carré arrondi (coins transparents), même proportion que
 *   TopBar.tsx (rounded-lg sur w-7 h-7 ≈ 28,6 % du côté).
 */
function rasterize(size, { fullBleed = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const radius = fullBleed ? 0 : size * (146 / 512);
  const SS = 3; // supersampling 3x3 pour adoucir les coins arrondis

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let coverage = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          if (radius === 0) {
            coverage++;
            continue;
          }
          const inCornerBox = (px < radius || px > size - radius) && (py < radius || py > size - radius);
          if (!inCornerBox) {
            coverage++;
            continue;
          }
          const cx = px < radius ? radius : size - radius;
          const cy = py < radius ? radius : size - radius;
          const dx = px - cx;
          const dy = py - cy;
          if (dx * dx + dy * dy <= radius * radius) coverage++;
        }
      }
      const alpha = coverage / (SS * SS);
      const t = Math.min(1, Math.max(0, (x + y + 1) / (2 * size)));
      const i = (y * size + x) * 4;
      rgba[i] = lerp(MINT[0], TEAL[0], t);
      rgba[i + 1] = lerp(MINT[1], TEAL[1], t);
      rgba[i + 2] = lerp(MINT[2], TEAL[2], t);
      rgba[i + 3] = Math.round(alpha * 255);
    }
  }
  return rgba;
}

function writeIco(path, size) {
  const rgba = rasterize(size, { fullBleed: false });
  const png = encodePng(size, size, rgba);

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // 1 image

  const entry = Buffer.alloc(16);
  entry[0] = size >= 256 ? 0 : size; // width (0 = 256)
  entry[1] = size >= 256 ? 0 : size; // height
  entry[2] = 0; // palette
  entry[3] = 0; // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8); // taille des données
  entry.writeUInt32LE(6 + 16, 12); // offset des données

  writeFileSync(path, Buffer.concat([header, entry, png]));
}

mkdirSync(OUT_DIR, { recursive: true });

const targets = [
  { name: "pwa-64x64.png", size: 64, fullBleed: false },
  { name: "pwa-192x192.png", size: 192, fullBleed: false },
  { name: "pwa-512x512.png", size: 512, fullBleed: false },
  { name: "maskable-icon-512x512.png", size: 512, fullBleed: true },
  { name: "apple-touch-icon-180x180.png", size: 180, fullBleed: true },
];

for (const t of targets) {
  const rgba = rasterize(t.size, { fullBleed: t.fullBleed });
  const png = encodePng(t.size, t.size, rgba);
  writeFileSync(join(OUT_DIR, t.name), png);
  console.log(`écrit ${t.name} (${png.length} octets)`);
}

writeIco(join(OUT_DIR, "favicon.ico"), 48);
console.log("écrit favicon.ico");
