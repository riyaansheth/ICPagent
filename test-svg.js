const { JSDOM } = require("jsdom");
const dom = new JSDOM(`<svg><circle id="ring-fill" class="ring-fill"></circle></svg>`);
const el = dom.window.document.getElementById("ring-fill");
try {
  el.className = "ring-fill";
  console.log("Success");
} catch (e) {
  console.log("Error:", e.message);
}
