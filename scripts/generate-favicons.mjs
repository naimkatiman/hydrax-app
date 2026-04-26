#!/usr/bin/env node
// One-shot generator: takes brand masters and emits the favicon set into
// web/portal-deploy/. Run: NODE_PATH=/home/naim/.openclaw/workspace/sukukscope/node_modules node scripts/generate-favicons.mjs
import sharp from "/home/naim/.openclaw/workspace/sukukscope/node_modules/sharp/lib/index.js";
import { mkdir, writeFile, copyFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..");

const APP_ICON_MASTER = join(repo, "nanobanana-output/app-icon/nb-2026-04-26T10-01-10-817-01.jpg");
const FAVICON_MASTER = join(repo, "nanobanana-output/favicon/nb-2026-04-26T10-02-05-642-04.jpg");

const OUT_ROOT = join(repo, "web/portal-deploy");
const BRAND_DIR = join(OUT_ROOT, "assets/brand");

async function pngBuffer(srcPath, size) {
  return sharp(srcPath).resize(size, size, { fit: "cover" }).png({ compressionLevel: 9 }).toBuffer();
}

// Build a multi-image .ico whose entries are PNG payloads (supported by all
// modern browsers and IE11+). Format reference:
// https://en.wikipedia.org/wiki/ICO_(file_format)
function buildIco(pngs) {
  // pngs: [{ size: 16|32|48, buffer: Buffer }]
  const headerSize = 6;
  const entrySize = 16;
  const dirSize = headerSize + entrySize * pngs.length;
  const totalSize = dirSize + pngs.reduce((acc, p) => acc + p.buffer.length, 0);
  const out = Buffer.alloc(totalSize);
  // ICONDIR
  out.writeUInt16LE(0, 0);                // reserved
  out.writeUInt16LE(1, 2);                // type: 1 = ICO
  out.writeUInt16LE(pngs.length, 4);      // image count
  let offset = dirSize;
  pngs.forEach((p, i) => {
    const e = headerSize + entrySize * i;
    out.writeUInt8(p.size === 256 ? 0 : p.size, e + 0); // width (0 means 256)
    out.writeUInt8(p.size === 256 ? 0 : p.size, e + 1); // height
    out.writeUInt8(0, e + 2);             // color palette (0 = no palette)
    out.writeUInt8(0, e + 3);             // reserved
    out.writeUInt16LE(1, e + 4);          // color planes
    out.writeUInt16LE(32, e + 6);         // bits per pixel
    out.writeUInt32LE(p.buffer.length, e + 8);  // image size
    out.writeUInt32LE(offset, e + 12);    // image offset
    p.buffer.copy(out, offset);
    offset += p.buffer.length;
  });
  return out;
}

async function main() {
  await mkdir(BRAND_DIR, { recursive: true });

  // Copy masters into brand/ for provenance
  await copyFile(APP_ICON_MASTER, join(BRAND_DIR, "hydrax-app-icon-master.jpg"));
  await copyFile(FAVICON_MASTER, join(BRAND_DIR, "hydrax-favicon-master.jpg"));
  console.log("masters copied to assets/brand/");

  // Favicon set from FAVICON master (simpler mark, optimized for small sizes)
  const fav16 = await pngBuffer(FAVICON_MASTER, 16);
  const fav32 = await pngBuffer(FAVICON_MASTER, 32);
  const fav48 = await pngBuffer(FAVICON_MASTER, 48);
  await writeFile(join(OUT_ROOT, "favicon-16x16.png"), fav16);
  await writeFile(join(OUT_ROOT, "favicon-32x32.png"), fav32);
  console.log("favicon-16x16.png + favicon-32x32.png written");

  // Multi-image ICO (16+32+48)
  const ico = buildIco([
    { size: 16, buffer: fav16 },
    { size: 32, buffer: fav32 },
    { size: 48, buffer: fav48 },
  ]);
  await writeFile(join(OUT_ROOT, "favicon.ico"), ico);
  console.log(`favicon.ico written (${ico.length} bytes, 3 images)`);

  // App icon set from APP_ICON master (richer pillars+capsule for big surfaces)
  const apple180 = await pngBuffer(APP_ICON_MASTER, 180);
  const android192 = await pngBuffer(APP_ICON_MASTER, 192);
  const android512 = await pngBuffer(APP_ICON_MASTER, 512);
  await writeFile(join(OUT_ROOT, "apple-touch-icon.png"), apple180);
  await writeFile(join(OUT_ROOT, "android-chrome-192x192.png"), android192);
  await writeFile(join(OUT_ROOT, "android-chrome-512x512.png"), android512);
  console.log("apple-touch-icon.png + android-chrome-{192,512}.png written");

  // Web manifest
  const manifest = {
    name: "HydraX Workflow",
    short_name: "HydraX",
    icons: [
      { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    theme_color: "#0A1F3D",
    background_color: "#0A1F3D",
    display: "standalone",
  };
  await writeFile(join(OUT_ROOT, "site.webmanifest"), JSON.stringify(manifest, null, 2));
  console.log("site.webmanifest written");

  console.log("\nDone.");
}

main().catch((err) => { console.error(err); process.exit(1); });
