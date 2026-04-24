import { ensureTraditionalChinese, formatTime, requireUser, setActiveNav } from "./app.js";

function qs(sel) { return document.querySelector(sel); }

function render(mode) {
  const { user } = requireUser();
  const root = qs("#gallery");
  const title = qs("#stationTitle");
  const empty = qs("#empty");
  if (!root || !title || !empty) return;

  const orders = user.orders;
  const items = [];
  for (const o of orders) {
    for (const img of (o.images || [])) {
      items.push({
        orderId: o.id,
        createdAt: o.createdAt,
        note: o.note,
        dataUrl: img.dataUrl,
        caption: img.caption || "供品"
      });
    }
  }

  const isPublic = mode === "public";
  title.textContent = isPublic ? "冥界空間站（公開區）" : "冥界空間站（個人區）";

  // 純靜態原型：公開區先展示同一套資料，但 UI 入口保留（後續接後端可跨使用者）
  const list = items;
  root.innerHTML = "";

  if (!list.length) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  for (const it of list) {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.innerHTML = `
      <img src="${it.dataUrl}" alt="供品圖片" loading="lazy" />
      <div class="cap">
        <div style="font-weight:800; letter-spacing:.02em">${it.caption}</div>
        <div class="muted" style="margin-top:4px">
          ${formatTime(it.createdAt)}${it.note ? ` · ${it.note}` : ""}
        </div>
      </div>
    `;
    root.appendChild(tile);
  }
}

function boot() {
  ensureTraditionalChinese();
  setActiveNav();

  const mode = location.hash === "#public" ? "public" : "personal";
  render(mode);

  const personalBtn = qs("#tabPersonal");
  const publicBtn = qs("#tabPublic");
  if (personalBtn) personalBtn.addEventListener("click", () => {
    history.replaceState(null, "", "station.html");
    render("personal");
  });
  if (publicBtn) publicBtn.addEventListener("click", () => {
    history.replaceState(null, "", "station.html#public");
    render("public");
  });
}

boot();

