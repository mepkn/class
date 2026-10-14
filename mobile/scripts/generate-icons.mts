// Draws the class blackboard mark (web/public/favicon.svg) as the app icons.
import { Resvg } from "@resvg/resvg-js";
import { writeFileSync } from "node:fs";

// Usage: npm run icons  (writes into assets/images)
const OUT = process.argv[2] ?? "assets/images";
const BG = "#1F3A2E"; // dark slate green behind the board
const BG_HI = "#2B5040";

// The favicon's 64×64 board, centred in a 1024 canvas.
const board = `<g transform="translate(512 512) scale(12) translate(-32 -31)">
  <rect x="2" y="6" width="60" height="46" rx="7" fill="#8a5a2f"/>
  <rect x="7" y="11" width="50" height="36" rx="3" fill="#1f4d3a"/>
  <path d="M24 17 L26.6 24.4 L34 27 L26.6 29.6 L24 37 L21.4 29.6 L14 27 L21.4 24.4 Z" fill="#f4f1ea"/>
  <path d="M38 24 H50 M38 31 H47" stroke="#f4f1ea" stroke-width="3.5" stroke-linecap="round" opacity="0.85"/>
  <rect x="10" y="52" width="44" height="5" rx="2.5" fill="#6f4522"/>
  <rect x="40" y="48.5" width="10" height="4" rx="2" fill="#f4f1ea"/>
</g>`;

function scaled(body: string, scale: number): string {
  return `<g transform="translate(512 512) scale(${scale}) translate(-512 -512)">${body}</g>`;
}

const background = `<defs><radialGradient id="g" cx="0.3" cy="0.15" r="1.1">
  <stop offset="0" stop-color="${BG_HI}"/><stop offset="1" stop-color="${BG}"/>
</radialGradient></defs><rect width="1024" height="1024" fill="url(#g)"/>`;

// Monochrome (Android themed icons) only uses alpha: the board's outline and chalk.
const mono = scaled(
  `<g transform="translate(512 512) scale(12) translate(-32 -31)" fill="none" stroke="#fff" stroke-width="4">
    <rect x="4" y="8" width="56" height="42" rx="6"/>
    <path d="M38 24 H50 M38 31 H47 M24 19 L24 35 M16 27 L32 27" stroke-linecap="round"/>
  </g>`,
  0.62,
);

const svgs: Record<string, [size: number, body: string]> = {
  "icon.png": [1024, background + scaled(board, 0.9)],
  "android-icon-background.png": [1024, background],
  // Adaptive icons are cropped to the centre ~66%, so the mark is scaled down.
  "android-icon-foreground.png": [1024, scaled(board, 0.58)],
  "android-icon-monochrome.png": [1024, mono],
  "splash-icon.png": [1024, board],
  "favicon.png": [48, background + scaled(board, 0.9)],
};

for (const [name, [size, body]] of Object.entries(svgs)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${body}</svg>`;
  const png = new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
  writeFileSync(`${OUT}/${name}`, png);
  console.log(name, size);
}
