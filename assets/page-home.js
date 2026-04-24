import { ensureTraditionalChinese, getOrCreateUser, loadStore, placeOrder, readFileAsDataUrl, setActiveNav } from "./app.js";

function qs(sel) { return document.querySelector(sel); }

function renderRecommended() {
  const store = loadStore();
  const root = qs("#recommended");
  if (!root) return;
  root.innerHTML = "";
  for (const p of store.catalog) {
    const card = document.createElement("a");
    card.className = "card";
    card.href = "order.html";
    card.innerHTML = `
      <div class="card-inner">
        <span class="tag ${p.tag === "HOT" ? "hot" : "new"}">${p.tag === "HOT" ? "HOT" : "NEW"}</span>
        <div style="font-weight:800; letter-spacing:.02em">${p.name}</div>
        <div class="muted" style="font-size:12px">${p.desc}</div>
      </div>
    `;
    root.appendChild(card);
  }
}

async function handleUpload(ev) {
  const input = ev.currentTarget;
  const file = input.files && input.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    alert("請上傳圖片檔。");
    input.value = "";
    return;
  }
  const dataUrl = await readFileAsDataUrl(file);
  const img = qs("#uploadPreviewImg");
  const wrap = qs("#uploadPreview");
  if (img && wrap) {
    img.src = dataUrl;
    wrap.style.display = "flex";
  }
  sessionStorage.setItem("shaolema.pendingUpload", dataUrl);
}

function boot() {
  ensureTraditionalChinese();
  setActiveNav();
  // 建立使用者（第一次進站）
  getOrCreateUser("旅者");
  renderRecommended();

  const upload = qs("#uploadInput");
  if (upload) upload.addEventListener("change", handleUpload);

  const next = qs("#nextStep");
  if (next) {
    next.addEventListener("click", () => {
      // 把上傳圖當成「下一步」的附圖提示，真正下單在結算時提交
      location.href = "order.html";
    });
  }

  const goOrder = qs("#goOrder");
  if (goOrder) goOrder.addEventListener("click", () => (location.href = "order.html"));

  const goBurn = qs("#goBurn");
  if (goBurn) goBurn.addEventListener("click", () => (location.href = "checkout.html"));

  const goStation = qs("#goStation");
  if (goStation) goStation.addEventListener("click", () => (location.href = "station.html"));

  // 快速投遞：若使用者只上傳圖片，允許直接投遞成一筆空購物籃訂單（僅作體驗）
  const quickSend = qs("#quickSend");
  if (quickSend) {
    quickSend.addEventListener("click", () => {
      const img = sessionStorage.getItem("shaolema.pendingUpload");
      const uploadedImages = img ? [{ id: "img0", dataUrl: img, caption: "上傳供品" }] : [];
      placeOrder({ note: "快速投遞（體驗）", uploadedImages });
      sessionStorage.removeItem("shaolema.pendingUpload");
      alert("已投遞至冥界空間站。");
      location.href = "station.html";
    });
  }
}

boot();

