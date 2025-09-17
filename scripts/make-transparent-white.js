// scripts/make-transparent-white.js
// Build transparent + white versions by *keeping* brand blue + white,
// making everything else transparent. Crisp, no grain left.
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h *= 60;
    }
    const s = max === 0 ? 0 : d / max;
    const v = max;
    return { h, s, v };
}

(async () => {
    const brandDir = path.join(process.cwd(), "public", "brand");
    const src = path.join(brandDir, "logo-4lf-circle-light.png");
    if (!fs.existsSync(src)) {
        console.error("Source not found:", src);
        process.exit(1);
    }

    // Brand blue we’ll lock to (adjust if you prefer a different hex)
    const BRAND = { r: 0x23, g: 0x42, b: 0xB8 }; // #2342B8

    // Selection thresholds (tweak if needed)
    const BLUE_H_MIN = 200, BLUE_H_MAX = 255; // blue hues
    const BLUE_S_MIN = 0.35;                  // saturation at least this
    const BLUE_V_MIN = 0.20, BLUE_V_MAX = 0.98;
    const WHITE_V_MIN = 0.96, WHITE_S_MAX = 0.10;

    // Read raw pixels
    const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width, height } = info;
    const out = Buffer.alloc(width * height * 4);

    for (let i = 0; i < data.length; i += 4) {
        let r = data[i], g = data[i + 1], b = data[i + 2];
        const { h, s, v } = rgbToHsv(r, g, b);

        let keep = false;
        let asWhite = false;

        // Keep brand blue-ish pixels
        if (h >= BLUE_H_MIN && h <= BLUE_H_MAX && s >= BLUE_S_MIN && v >= BLUE_V_MIN && v <= BLUE_V_MAX) {
            keep = true;
        }

        // Keep the white tape stripes
        if (!keep && v >= WHITE_V_MIN && s <= WHITE_S_MAX) {
            keep = true;
            asWhite = true;
        }

        if (keep) {
            if (asWhite) { r = 255; g = 255; b = 255; } else { r = BRAND.r; g = BRAND.g; b = BRAND.b; }
            out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = 255;
        } else {
            // Transparent
            out[i] = 0; out[i + 1] = 0; out[i + 2] = 0; out[i + 3] = 0;
        }
    }

    // Transparent logo
    const transparentPath = path.join(brandDir, "logo-4lf-circle-transparent.png");
    await sharp(out, { raw: { width, height, channels: 4 } }).png().toFile(transparentPath);

    // White-background logo (flatten transparent over white)
    const whitePath = path.join(brandDir, "logo-4lf-circle-white.png");
    await sharp(transparentPath).flatten({ background: "#FFFFFF" }).png().toFile(whitePath);

    console.log("✓ Created:", path.basename(transparentPath));
    console.log("✓ Created:", path.basename(whitePath));
})();
