import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const label = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([label, data])));
  return Buffer.concat([length, label, data, crc]);
}

export function cairviaPng(size) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const radius = size * 0.38;
  for (let y = 0; y < size; y += 1) {
    raw[y * stride] = 0;
    for (let x = 0; x < size; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const i = y * stride + 1 + x * 4;
      if (dist <= radius) {
        const glow = Math.max(0, 1 - dist / radius);
        raw[i] = Math.round(196 + 40 * glow);
        raw[i + 1] = Math.round(165 + 30 * glow);
        raw[i + 2] = Math.round(116);
        raw[i + 3] = 255;
      } else {
        raw[i] = 22;
        raw[i + 1] = 20;
        raw[i + 2] = 16;
        raw[i + 3] = dist < radius + 1.2 ? 220 : 0;
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

export function writeCairviaIcons() {
  const extensionIcons = path.join(root, "apps/extension/icons");
  const desktopIcons = path.join(root, "apps/desktop/resources");
  mkdirSync(extensionIcons, { recursive: true });
  mkdirSync(desktopIcons, { recursive: true });
  for (const size of [16, 32, 48, 128]) {
    writeFileSync(path.join(extensionIcons, `icon${size}.png`), cairviaPng(size));
  }
  writeFileSync(path.join(desktopIcons, "orb.png"), cairviaPng(128));
  return { extensionIcons, desktopIcons };
}

if (process.argv[1] && path.normalize(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeCairviaIcons();
}
