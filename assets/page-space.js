import { ensureTraditionalChinese, formatTime, requireUser, saveStore, setActiveNav, loadStore } from "./app.js";

function qs(sel) { return document.querySelector(sel); }

function render() {
  const { user } = requireUser();
  const name = qs("#displayName");
  const created = qs("#createdAt");
  const stats = qs("#stats");
  const recent = qs("#recent");

  if (name) name.value = user.displayName;
  if (created) created.textContent = formatTime(user.createdAt);
  if (stats) {
    const orderCount = user.orders.length;
    const imgCount = user.orders.reduce((a, o) => a + (o.images ? o.images.length : 0), 0);
    stats.innerHTML = `
      <span class="pill">訂單：<strong>${orderCount}</strong></span>
      <span class="pill">圖片：<strong>${imgCount}</strong></span>
    `;
  }
  if (recent) {
    recent.innerHTML = "";
    if (!user.orders.length) {
      recent.innerHTML = `<div class="empty">你還沒有投遞紀錄。可以先去「下單」或在首頁上傳圖片後快速投遞。</div>`;
    } else {
      for (const o of user.orders.slice(0, 4)) {
        const el = document.createElement("div");
        el.className = "item";
        const cover = o.images && o.images[0] ? `<img src="${o.images[0].dataUrl}" alt="訂單圖片" />` : "";
        el.innerHTML = `
          <div class="thumb" aria-hidden="true">${cover}</div>
          <div style="flex:1">
            <h3>投遞時間：${formatTime(o.createdAt)}</h3>
            <p>${o.status}${o.note ? ` · ${o.note}` : ""}</p>
          </div>
        `;
        recent.appendChild(el);
      }
    }
  }
}

function boot() {
  ensureTraditionalChinese();
  setActiveNav();
  render();

  const saveBtn = qs("#saveProfile");
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const { store, user } = requireUser();
      const v = String(qs("#displayName")?.value || "").trim();
      user.displayName = v || "旅者";
      store.usersById[user.id] = user;
      saveStore(store);
      alert("已保存。");
      render();
    });
  }

  const resetBtn = qs("#resetUser");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      const ok = confirm("要切換成新的使用者嗎？（本機獨立空間會重新開始）");
      if (!ok) return;
      const store = loadStore();
      store.currentUserId = null;
      saveStore(store);
      location.reload();
    });
  }
}

boot();

