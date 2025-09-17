// scripts/generate-brand-assets.js
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

(async () => {
    const brandDir = path.join(process.cwd(), "public", "brand");
    const src = path.join(brandDir, "logo-4lf-circle-light.png");

    if (!fs.existsSync(src)) {
        console.error("Source logo not found:", src);
        process.exit(1);
    }

    const lightBg = "#E6F4FF";
    const white = "#FFFFFF";

    const save = (processor, out) =>
        processor
            .toFile(path.join(brandDir, out))
            .then(() => console.log("✓", out));

    // Favicons & app icons
    await Promise.all([
        save(sharp(src).resize(16, 16, { fit: "cover" }), "favicon-16x16.png"),
        save(sharp(src).resize(32, 32, { fit: "cover" }), "favicon-32x32.png"),
        save(sharp(src).resize(180, 180, { fit: "cover" }), "apple-touch-icon.png"),
        save(sharp(src).resize(192, 192, { fit: "cover" }), "favicon-192.png"),
        save(sharp(src).resize(512, 512, { fit: "cover" }), "favicon-512.png"),

        // Optional: white-background version of the logo for emails/places that need a solid bg
        save(sharp(src).flatten({ background: white }).png(), "logo-4lf-circle-white.png"),
    ]);

    // Open Graph image (1200×630) with centered logo
    const ogW = 1200, ogH = 630;
    const logoMax = Math.round(Math.min(ogH * 0.7, ogW * 0.7)); // ~70% of canvas
    const logoBuf = await sharp(src).resize(logoMax).toBuffer();

    await save(
        sharp({ create: { width: ogW, height: ogH, channels: 3, background: lightBg } })
            .composite([{ input: logoBuf, gravity: "center" }])
            .png(),
        "og-image.png"
    );
})();
