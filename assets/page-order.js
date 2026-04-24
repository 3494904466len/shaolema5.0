import { addToCart, ensureTraditionalChinese, loadStore, requireUser, removeFromCart, setActiveNav, setCartQty } from "./app.js";

function qs(sel) { return document.querySelector(sel); }

function renderCatalog() {
  const store = loadStore();
  const root = qs("#catalog");
  if (!root) return;
  root.innerHTML = "";

  for (const p of store.catalog) {
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div class="thumb" aria-hidden="true"></div>
      <div style="flex:1">
        <h3>${p.name}</h3>
        <p>${p.desc}</p>
        <div class="row" style="margin-top:8px">
          <button class="btn btn-small btn-primary" data-add="${p.id}">加入購物籃</button>
        </div>
      </div>
    `;
    root.appendChild(el);
  }

  root.addEventListener("click", (e) => {
    const btn = e.target && e.target.closest ? e.target.closest("[data-add]") : null;
    if (!btn) return;
    const id = btn.getAttribute("data-add");
    const prod = store.catalog.find((x) => x.id === id);
    if (!prod) return;
    addToCart({ id: prod.id, name: prod.name });
    renderCart();
  });
}

function renderCart() {
  const { user } = requireUser();
  const root = qs("#cart");
  const badge = qs("#cartCount");
  const empty = qs("#cartEmpty");
  const checkout = qs("#goCheckout");

  if (badge) badge.textContent = String(user.cart.reduce((a, x) => a + (x.qty || 1), 0));

  if (!root) return;
  root.innerHTML = "";

  if (!user.cart.length) {
    if (empty) empty.style.display = "block";
    if (checkout) checkout.setAttribute("disabled", "disabled");
    return;
  }
  if (empty) empty.style.display = "none";
  if (checkout) checkout.removeAttribute("disabled");

  for (const it of user.cart) {
    const row = document.createElement("div");
    row.className = "item";
    row.innerHTML = `
      <div class="thumb" aria-hidden="true"></div>
      <div style="flex:1">
        <h3>${it.name}</h3>
        <p>數量：${it.qty}</p>
        <div class="row" style="margin-top:8px">
          <button class="btn btn-small" data-dec="${it.id}" type="button">－</button>
          <button class="btn btn-small" data-inc="${it.id}" type="button">＋</button>
          <button class="btn btn-small btn-ghost" data-rm="${it.id}" type="button">移除</button>
        </div>
      </div>
    `;
    root.appendChild(row);
  }

  root.addEventListener("click", (e) => {
    const t = e.target && e.target.closest ? e.target.closest("[data-dec],[data-inc],[data-rm]") : null;
    if (!t) return;
    const dec = t.getAttribute("data-dec");
    const inc = t.getAttribute("data-inc");
    const rm = t.getAttribute("data-rm");
    const { user: u } = requireUser();
    if (rm) {
      removeFromCart(rm);
      renderCart();
      return;
    }
    if (dec) {
      const it = u.cart.find((x) => x.id === dec);
      if (it) setCartQty(dec, Math.max(1, (it.qty || 1) - 1));
      renderCart();
      return;
    }
    if (inc) {
      const it = u.cart.find((x) => x.id === inc);
      if (it) setCartQty(inc, (it.qty || 1) + 1);
      renderCart();
      return;
    }
  }, { once: true });
}

function boot() {
  ensureTraditionalChinese();
  setActiveNav();
  renderCatalog();
  renderCart();

  const go = qs("#goCheckout");
  if (go) go.addEventListener("click", () => (location.href = "checkout.html"));
}

boot();

