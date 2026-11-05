const sharp = require("sharp");

async function main() {
  const fs = require("fs");
  const files = fs.readdirSync("public");
  const source = files.find(f => f.startsWith("attendance-source."));
  if (!source) throw new Error("Source logo not found in public.");

  for (const size of [192, 512]) {
    await sharp(`public/${source}`)
      .resize(size, size, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toFile(`public/attendance-${size}.png`);
  }

  await sharp(`public/${source}`)
    .resize(512, 512, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    })
    .png()
    .toFile("public/attendance-maskable.png");

  console.log("PWA icons created successfully.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
