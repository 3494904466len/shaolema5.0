const STORE_KEY = "shaolema.v1";

function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export function loadStore() {
  const raw = localStorage.getItem(STORE_KEY);
  const base = {
    usersById: {},
    currentUserId: null,
    catalog: [
      { id: "paper_house", name: "靜夜・安居套裝", desc: "屋宅、紙紮、心意歸處。", tag: "NEW" },
      { id: "paper_trip", name: "遠行・順行套裝", desc: "行裝、手信、一路平安。", tag: "HOT" },
      { id: "paper_bless", name: "祈願・祝福套裝", desc: "祈福、符語、心願上行。", tag: "NEW" },
      { id: "paper_home", name: "家家・思念套裝", desc: "相守、紀念、念念不忘。", tag: "HOT" },
      { id: "paper_gold", name: "金銀・通達套裝", desc: "紙錢、元寶、路路皆通。", tag: "HOT" },
      { id: "paper_guard", name: "護身・符咒套裝", desc: "符紙、護印、安穩不驚。", tag: "NEW" },
      { id: "paper_feast", name: "供奉・饗宴套裝", desc: "供品、香火、滿滿心意。", tag: "NEW" },
      { id: "paper_message", name: "寄語・長信套裝", desc: "信箋、墨印、話語不滅。", tag: "HOT" },
      { id: "paper_craft", name: "紙紮・匠作套裝", desc: "手作紙紮、細節入魂。", tag: "NEW" },
      { id: "paper_lantern", name: "引路・燈火套裝", desc: "引路燈、燭火、照見歸途。", tag: "HOT" }
    ]
  };
  if (!raw) return base;
  const parsed = safeJsonParse(raw, base);
  return { ...base, ...parsed };
}

export function saveStore(store) {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

export function getOrCreateUser(displayName) {
  const store = loadStore();
  if (store.currentUserId && store.usersById[store.currentUserId]) {
    return { store, user: store.usersById[store.currentUserId] };
  }
  const newUserId = uid("user");
  const user = {
    id: newUserId,
    displayName: displayName || "旅者",
    createdAt: Date.now(),
    cart: [],
    orders: []
  };
  store.usersById[newUserId] = user;
  store.currentUserId = newUserId;
  saveStore(store);
  return { store, user };
}

export function requireUser() {
  const store = loadStore();
  const user = store.currentUserId ? store.usersById[store.currentUserId] : null;
  if (!user) return getOrCreateUser("旅者");
  return { store, user };
}

export function updateUser(mutator) {
  const store = loadStore();
  const id = store.currentUserId;
  if (!id || !store.usersById[id]) {
    const created = getOrCreateUser("旅者");
    return updateUser(mutator) || created;
  }
  const nextUser = mutator({ ...store.usersById[id] });
  store.usersById[id] = nextUser;
  saveStore(store);
  return { store, user: nextUser };
}

export function addToCart(product) {
  return updateUser((u) => {
    const existing = u.cart.find((x) => x.id === product.id);
    if (existing) {
      existing.qty += 1;
    } else {
      u.cart.push({ ...product, qty: 1 });
    }
    return u;
  });
}

export function removeFromCart(productId) {
  return updateUser((u) => {
    u.cart = u.cart.filter((x) => x.id !== productId);
    return u;
  });
}

export function setCartQty(productId, qty) {
  return updateUser((u) => {
    u.cart = u.cart
      .map((x) => (x.id === productId ? { ...x, qty: Math.max(1, qty) } : x))
      .filter(Boolean);
    return u;
  });
}

export function clearCart() {
  return updateUser((u) => {
    u.cart = [];
    return u;
  });
}

export function placeOrder({ note, uploadedImages = [] }) {
  return updateUser((u) => {
    const order = {
      id: uid("order"),
      createdAt: Date.now(),
      items: u.cart.map((x) => ({ id: x.id, name: x.name, qty: x.qty })),
      note: note || "",
      images: uploadedImages,
      status: "已遞交冥府處理"
    };
    u.orders = [order, ...u.orders];
    u.cart = [];
    return u;
  });
}

export function formatTime(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function setActiveNav() {
  const path = (location.pathname || "").toLowerCase();
  const map = [
    { href: "index.html", key: "index.html" },
    { href: "space.html", key: "space.html" },
    { href: "order.html", key: "order.html" },
    { href: "checkout.html", key: "checkout.html" },
    { href: "station.html", key: "station.html" }
  ];
  for (const a of document.querySelectorAll(".nav a")) {
    a.removeAttribute("aria-current");
  }
  const hit = map.find((x) => path.endsWith(x.key));
  if (!hit && path.endsWith("/")) {
    const a = document.querySelector(`.nav a[href="index.html"]`);
    if (a) a.setAttribute("aria-current", "page");
    return;
  }
  if (hit) {
    const a = document.querySelector(`.nav a[href="${hit.href}"]`);
    if (a) a.setAttribute("aria-current", "page");
  }
}

export function bindBrandUser() {
  const { user } = requireUser();
  const el = document.querySelector("[data-user]");
  if (el) el.textContent = user.displayName;
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("讀取失敗"));
    reader.readAsDataURL(file);
  });
}

export function ensureTraditionalChinese() {
  document.documentElement.lang = "zh-Hant";
}

