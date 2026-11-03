const log = document.getElementById("log")!;
const preview = document.getElementById("preview")!;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const sizes = [
  [390, 844],
  [375, 667],
  [844, 390],
  [768, 1024],
  [1280, 720],
  [1920, 1080],
];
for (const [width, height] of sizes) {
  const frame = document.createElement("iframe");
  frame.style.cssText = `width:${width}px;height:${height}px;border:1px solid #bbb;display:block`;
  frame.src = "/tests/ui-fixture.html";
  preview.replaceChildren(frame);
  const deadline = Date.now() + 12000;
  let ready = false;
  while (Date.now() < deadline) {
    if (frame.contentDocument?.querySelector(".board-frame")) {
      ready = true;
      break;
    }
    await pause(100);
  }
  if (!ready) {
    log.textContent += `FAIL ${width}×${height}: app not ready\n`;
    continue;
  }
  await pause(800);
  const doc = frame.contentDocument!,
    win = frame.contentWindow!;
  const board = doc.querySelector(".board-frame")!.getBoundingClientRect(),
    grid = doc.querySelector(".board")!.getBoundingClientRect(),
    rack = doc.querySelector(".rack-panel")!.getBoundingClientRect();
  const fits = (r: DOMRect) =>
    r.left >= -0.5 &&
    r.top >= -0.5 &&
    r.right <= width + 0.5 &&
    r.bottom <= height + 0.5 &&
    r.width > 0 &&
    r.height > 0;
  const okay =
    doc.documentElement.scrollWidth === width &&
    doc.documentElement.scrollHeight === height &&
    fits(board) &&
    fits(rack) &&
    Math.abs(grid.width - grid.height) < 1;
  log.textContent += `${okay ? "PASS" : "FAIL"} ${width}×${height}: board ${Math.round(board.width)}×${Math.round(board.height)}, rack bottom ${Math.round(rack.bottom)}, page ${doc.documentElement.scrollWidth}×${doc.documentElement.scrollHeight}, square cells ${Math.abs(grid.width - grid.height) < 1}\n`;
  if (!okay)
    log.textContent +=
      JSON.stringify({ board: board.toJSON(), rack: rack.toJSON() }) + "\n";
}
log.textContent += "VIEWPORT CHECKS COMPLETE";
