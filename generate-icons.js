import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPNG(width, height, isMaskable = false) {
  // Generate RGBA buffer
  const buffer = Buffer.alloc(width * height * 4);
  const cx = width / 2;
  const cy = height / 2;
  const radius = width * (isMaskable ? 0.38 : 0.45);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Background gradient: Emerald to Teal
      const t = (x + y) / (width + height);
      let r = Math.round(15 + (13 - 15) * t); // dark slate/emerald
      let g = Math.round(148 + (185 - 148) * t); // emerald-600 to teal-500
      let b = Math.round(136 + (129 - 136) * t);
      let a = 255;

      // Draw rounded receipt card in center
      const cardW = width * 0.52;
      const cardH = height * 0.62;
      const cardX = cx - cardW / 2;
      const cardY = cy - cardH / 2;

      const inCard = x >= cardX && x <= cardX + cardW && y >= cardY && y <= cardY + cardH;
      if (inCard) {
        // Receipt paper: clean crisp off-white/cream
        r = 250;
        g = 252;
        b = 255;

        // Subtle receipt header band
        if (y < cardY + cardH * 0.18) {
          r = 16;
          g = 185;
          b = 129; // emerald banner
        } else {
          // Lines on receipt
          const relY = (y - (cardY + cardH * 0.25)) / (cardH * 0.7);
          const lineRow = Math.floor(relY * 7);
          const lineYFraction = (relY * 7) - lineRow;
          if (relY >= 0 && relY <= 0.85 && lineYFraction < 0.3) {
            // Receipt line
            if (x >= cardX + cardW * 0.15 && x <= cardX + cardW * 0.85) {
              r = 203;
              g = 213;
              b = 225; // slate-300
            }
          }

          // Center Rupee ₹ mark accent
          const rupeeDist = Math.hypot(x - cx, y - (cy + cardH * 0.1));
          if (rupeeDist < width * 0.1) {
            r = 15;
            g = 118;
            b = 110; // teal-700
          }
        }
      }

      buffer[idx] = r;
      buffer[idx + 1] = g;
      buffer[idx + 2] = b;
      buffer[idx + 3] = a;
    }
  }

  // Construct PNG file
  // 1. Signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // 2. IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth 8
  ihdr.writeUInt8(6, 9); // RGBA
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  function makeChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(4 + 4 + len + 4);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4);
    data.copy(buf, 8);
    // CRC calculation
    const crc = crc32(Buffer.concat([Buffer.from(type), data]));
    buf.writeInt32BE(crc, 8 + len);
    return buf;
  }

  // Raw image scanlines with filter byte 0
  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    scanlines[y * (1 + width * 4)] = 0; // Filter: none
    buffer.copy(scanlines, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(scanlines);
  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// CRC32 table & function
const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return c ^ -1;
}

const publicDir = path.resolve(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPNG(192, 192, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPNG(512, 512, false));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPNG(512, 512, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPNG(180, 180, false));
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), createPNG(32, 32, false));

console.log('Successfully generated compliant PWA icons in /public');
