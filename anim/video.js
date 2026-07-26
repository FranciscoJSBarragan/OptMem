// Renders the AmalgaMem animation to PNG frames. Usage:
//   node video.js            all frames at 30fps into frames/
//   node video.js 3 9 26 40  single stills at those seconds into shots/
const { createCanvas } = require("canvas");
const fs = require("fs");
const { draw, setCtx, DUR } = require("./render.js");

const cv = createCanvas(1280, 720);
setCtx(cv.getContext("2d"));

const args = process.argv.slice(2);
if (args.length) {
  fs.mkdirSync("shots", { recursive: true });
  for (const a of args) {
    draw(parseFloat(a));
    fs.writeFileSync(`shots/t${a}.png`, cv.toBuffer("image/png"));
    console.log(`shots/t${a}.png`);
  }
} else {
  const FPS = 30, N = Math.round(DUR * FPS);
  fs.mkdirSync("frames", { recursive: true });
  for (let f = 0; f < N; f++) {
    draw(f / FPS);
    fs.writeFileSync(`frames/${String(f).padStart(5, "0")}.png`, cv.toBuffer("image/png"));
    if (f % 300 === 0) console.log(`${f}/${N}`);
  }
  console.log("done. now: ffmpeg -framerate 30 -i frames/%05d.png -c:v libx264 -pix_fmt yuv420p -crf 18 amalgamem.mp4");
}
