import { ensureTraditionalChinese, formatTime, placeOrder, readFileAsDataUrl, requireUser, setActiveNav } from "./app.js";

function qs(sel) { return document.querySelector(sel); }

function renderSummary() {
  const { user } = requireUser();
  const root = qs("#summary");
  const empty = qs("#summaryEmpty");
  if (!root) return;
  root.innerHTML = "";

  if (!user.cart.length) {
    if (empty) empty.style.display = "block";
    return;
  }
  if (empty) empty.style.display = "none";

  for (const it of user.cart) {
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div class="thumb" aria-hidden="true"></div>
      <div style="flex:1">
        <h3>${it.name}</h3>
        <p>數量：${it.qty}</p>
      </div>
    `;
    root.appendChild(el);
  }
}

async function collectUploads() {
  const pending = sessionStorage.getItem("shaolema.pendingUpload");
  const uploads = [];
  if (pending) uploads.push({ id: "pending", dataUrl: pending, caption: "上傳供品" });

  const input = qs("#extraUpload");
  const files = input && input.files ? Array.from(input.files) : [];
  for (const f of files.slice(0, 6)) {
    if (!f.type.startsWith("image/")) continue;
    const dataUrl = await readFileAsDataUrl(f);
    uploads.push({ id: f.name + "_" + Date.now(), dataUrl, caption: "追加供品" });
  }
  return uploads;
}

function boot() {
  ensureTraditionalChinese();
  setActiveNav();
  renderSummary();

  const goBack = qs("#backToOrder");
  if (goBack) goBack.addEventListener("click", () => (location.href = "order.html"));

  const form = qs("#checkoutForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const { user } = requireUser();
    if (!user.cart.length && !sessionStorage.getItem("shaolema.pendingUpload")) {
      alert("請先加入商品，或至少上傳一張圖片。");
      return;
    }
    const note = String(qs("#note")?.value || "").trim();
    const uploads = await collectUploads();

    placeOrder({ note, uploadedImages: uploads });
    sessionStorage.removeItem("shaolema.pendingUpload");

    const last = requireUser().user.orders[0];
    const msg = `已完成投遞。\n訂單時間：${formatTime(last.createdAt)}\n狀態：${last.status}`;
    alert(msg);
    location.href = "station.html";
  });
}

boot();

