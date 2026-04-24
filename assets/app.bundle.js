(function () {
  "use strict";

  const STORE_KEY = "shaolema.v1";
  const BGM_KEY = "shaolema.bgm.enabled";
  const BGM_SRC = "assets/bgm.mp3.mp3"; // 你放入的合法音檔（循環播放）

  function setupBgm() {
    // 建立 audio（跨頁會重啟，純靜態站限制）
    const audio = document.createElement("audio");
    audio.src = BGM_SRC;
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0.6;
    audio.setAttribute("playsinline", "true");
    audio.style.display = "none";
    document.body.appendChild(audio);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "bgm-btn";
    document.body.appendChild(btn);

    const getEnabled = () => localStorage.getItem(BGM_KEY) === "1";
    const setEnabled = (v) => localStorage.setItem(BGM_KEY, v ? "1" : "0");
    // 預設開啟（第一次進站）
    if (localStorage.getItem(BGM_KEY) === null) setEnabled(true);

    let isPlaying = false;
    let hasError = false;
    const TIME_KEY = "shaolema.bgm.t";
    const render = () => {
      if (hasError) {
        btn.textContent = "音樂：找不到 bgm.mp3";
        return;
      }
      if (!getEnabled()) {
        btn.textContent = "音樂：關";
        return;
      }
      btn.textContent = isPlaying ? "音樂：開" : "音樂：開（點一下啟動）";
    };

    const getSavedTime = () => {
      try {
        const t = Number(sessionStorage.getItem(TIME_KEY) || "0");
        return Number.isFinite(t) && t > 0 ? t : 0;
      } catch {
        return 0;
      }
    };

    const seekToSavedTime = async () => {
      const t = getSavedTime();
      if (!t) return;
      // 等到可以 seek（避免剛換頁時卡頓/跳回 0）
      if (audio.readyState < 1) {
        await new Promise((resolve) => audio.addEventListener("loadedmetadata", resolve, { once: true }));
      }
      try { audio.currentTime = t; } catch {}
    };

    const persistTime = () => {
      try {
        // 只在可用時存，避免 NaN / Infinity
        const t = Number(audio.currentTime || 0);
        if (Number.isFinite(t) && t >= 0) sessionStorage.setItem(TIME_KEY, String(t));
      } catch {}
    };

    const fadeIn = () => {
      const target = 0.6;
      const start = 0.10;
      audio.volume = start;
      const t0 = performance.now();
      const dur = 220;
      const tick = (now) => {
        const p = Math.min(1, (now - t0) / dur);
        audio.volume = start + (target - start) * p;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const tryPlay = async () => {
      try {
        // 主動觸發載入，讓 canplay 更快到位
        try { audio.load(); } catch {}
        await seekToSavedTime();
        await audio.play();
        isPlaying = true;
        fadeIn();
        render();
        return true;
      } catch {
        isPlaying = false;
        render();
        return false;
      }
    };

    const stop = () => {
      try { audio.pause(); } catch {}
      // 關閉時才歸零；跨頁時靠 TIME_KEY 接續播放
      try { audio.currentTime = 0; } catch {}
      try { sessionStorage.setItem(TIME_KEY, "0"); } catch {}
      isPlaying = false;
      render();
    };

    const enable = async () => {
      setEnabled(true);
      const ok = await tryPlay();
      // 若被瀏覽器擋自動播放，等下一次使用者點擊再播放
      if (!ok) {
        const once = async () => {
          document.removeEventListener("pointerdown", once);
          await tryPlay();
        };
        document.addEventListener("pointerdown", once, { once: true });
      }
    };

    const disable = () => {
      setEnabled(false);
      render();
      stop();
    };

    btn.addEventListener("click", async () => {
      if (getEnabled()) disable();
      else await enable();
    });

    // 檔案不存在/載入失敗
    audio.addEventListener("error", () => {
      hasError = true;
      isPlaying = false;
      render();
    });

    // 跨頁接續：持續記錄播放時間（節流）
    let lastSave = 0;
    audio.addEventListener("timeupdate", () => {
      const now = Date.now();
      if (now - lastSave < 900) return;
      lastSave = now;
      persistTime();
    });
    window.addEventListener("pagehide", persistTime);

    // 若使用者已開啟，嘗試自動播放（多數瀏覽器仍需手勢）
    if (getEnabled()) {
      enable();
    }

    // 初始渲染
    render();
  }

  // -------- SPA 站內切頁（避免整頁 reload，BGM 不會卡頓） --------
  let __spaNavigating = false;

  function isInternalHtmlLink(a) {
    if (!a || !a.getAttribute) return false;
    const href = a.getAttribute("href") || "";
    if (!href) return false;
    if (href.startsWith("#")) return false;
    if (href.startsWith("http://") || href.startsWith("https://")) return false;
    if (href.startsWith("mailto:") || href.startsWith("tel:")) return false;
    if (href.startsWith("javascript:")) return false;
    if (!href.endsWith(".html")) return false;
    return true;
  }

  function bootPage() {
    const page = document.body.getAttribute("data-page");
    if (page === "home") bootHome();
    else if (page === "order") bootOrder();
    else if (page === "checkout") bootCheckout();
    else if (page === "space") bootSpace();
    else if (page === "station") bootStation();
  }

  async function spaNavigate(href, { replace = false } = {}) {
    if (__spaNavigating) return;
    __spaNavigating = true;
    try {
      const res = await fetch(href, { cache: "no-cache" });
      if (!res.ok) throw new Error("fetch failed");
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const nextRoot = doc.querySelector("#pageRoot");
      const curRoot = document.querySelector("#pageRoot");
      if (!nextRoot || !curRoot) throw new Error("missing pageRoot");

      // 更新 title / data-page
      document.title = doc.title || document.title;
      const nextPage = doc.body && doc.body.getAttribute ? doc.body.getAttribute("data-page") : "";
      if (nextPage) document.body.setAttribute("data-page", nextPage);

      // 取代內容（保留 bgm / 既有 script）
      curRoot.replaceWith(nextRoot);

      // nav highlight（如果有 aria-current）
      for (const a of document.querySelectorAll(".nav a")) a.removeAttribute("aria-current");
      for (const a of document.querySelectorAll(`.nav a[href="${href}"]`)) a.setAttribute("aria-current", "page");

      if (replace) history.replaceState({ href }, "", href);
      else history.pushState({ href }, "", href);

      // 重新啟動該頁面邏輯（不重建 BGM）
      bootPage();
    } catch {
      // 若 fetch 失敗（例如 file:// 或跨網域限制），回退成正常跳頁
      location.href = href;
    } finally {
      __spaNavigating = false;
    }
  }

  function setupSpaNav() {
    document.addEventListener("click", (e) => {
      const a = e.target && e.target.closest ? e.target.closest("a") : null;
      if (!a) return;
      if (!isInternalHtmlLink(a)) return;
      if (a.target && a.target !== "_self") return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      const href = a.getAttribute("href");
      if (!href) return;
      spaNavigate(href);
    });

    window.addEventListener("popstate", (ev) => {
      const href = (ev && ev.state && ev.state.href) ? ev.state.href : (location.pathname.split("/").pop() || "index.html");
      spaNavigate(href, { replace: true });
    });
  }

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

  function getDeviceId() {
    const k = "shaolema.deviceId";
    let v = localStorage.getItem(k);
    if (!v) {
      v = uid("dev");
      localStorage.setItem(k, v);
    }
    return v;
  }

  function loadLikes() {
    return safeJsonParse(localStorage.getItem("shaolema.likes.v1") || "{}", {});
  }
  function saveLikes(obj) {
    localStorage.setItem("shaolema.likes.v1", JSON.stringify(obj));
  }

  function imageKey(orderId, imgId) {
    return `${orderId}::img::${imgId}`;
  }

  function getSupabaseClient() {
    try {
      const url = window.SHAOLEMA_SUPABASE_URL;
      const key = window.SHAOLEMA_SUPABASE_ANON_KEY;
      if (!url || !key) return null;
      if (String(url).includes("___YOUR_SUPABASE_URL___")) return null;
      if (String(key).includes("___YOUR_SUPABASE_ANON_KEY___")) return null;
      if (!window.supabase || !window.supabase.createClient) return null;
      return window.supabase.createClient(String(url), String(key));
    } catch {
      return null;
    }
  }

  async function dataUrlToBlob(dataUrl) {
    // 簡單可靠：交給瀏覽器 parse data:
    const res = await fetch(dataUrl);
    return await res.blob();
  }

  async function publishImageToSupabase({ deviceId, orderId, img }) {
    const sb = getSupabaseClient();
    if (!sb) return { ok: false, reason: "no_supabase" };

    const bucket = window.SHAOLEMA_PUBLIC_BUCKET || "public-offerings";
    const table = window.SHAOLEMA_PUBLIC_TABLE || "public_offerings";

    const imgId = img.id || "img";
    const ext = "jpg";
    const path = `${deviceId}/${orderId}/${imgId}.${ext}`;

    const blob = await dataUrlToBlob(img.dataUrl);
    const uploadRes = await sb.storage.from(bucket).upload(path, blob, {
      upsert: true,
      contentType: blob.type || "image/jpeg",
      cacheControl: "3600"
    });
    if (uploadRes.error) return { ok: false, reason: uploadRes.error.message || "upload_failed" };

    const up = await sb
      .from(table)
      .upsert(
        {
          device_id: deviceId,
          order_id: orderId,
          img_id: imgId,
          caption: img.caption || null,
          storage_path: path
        },
        { onConflict: "device_id,order_id,img_id" }
      )
      .select("id,like_count,storage_path")
      .maybeSingle();

    if (up.error) return { ok: false, reason: up.error.message || "db_failed" };
    return { ok: true, offering: up.data };
  }

  async function unpublishImageFromSupabase({ deviceId, orderId, img }) {
    const sb = getSupabaseClient();
    if (!sb) return { ok: false, reason: "no_supabase" };
    const bucket = window.SHAOLEMA_PUBLIC_BUCKET || "public-offerings";
    const table = window.SHAOLEMA_PUBLIC_TABLE || "public_offerings";
    const imgId = img.id || "img";

    // 先刪 DB（原型：不驗證身分）
    const del = await sb.from(table).delete().eq("device_id", deviceId).eq("order_id", orderId).eq("img_id", imgId);
    if (del.error) return { ok: false, reason: del.error.message || "delete_failed" };

    // 再刪 storage（失敗也不致命）
    const path = img.publicRef && img.publicRef.storage_path ? img.publicRef.storage_path : `${deviceId}/${orderId}/${imgId}.jpg`;
    await sb.storage.from(bucket).remove([path]);

    return { ok: true };
  }

  async function fetchPublicFeedFromSupabase(limit = 24) {
    const sb = getSupabaseClient();
    if (!sb) return { ok: false, reason: "no_supabase", items: [] };
    const bucket = window.SHAOLEMA_PUBLIC_BUCKET || "public-offerings";
    const table = window.SHAOLEMA_PUBLIC_TABLE || "public_offerings";

    const q = await sb
      .from(table)
      .select("id,created_at,caption,storage_path,like_count")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (q.error) return { ok: false, reason: q.error.message || "query_failed", items: [] };

    const items = (q.data || []).map((r) => {
      const pub = sb.storage.from(bucket).getPublicUrl(r.storage_path);
      const url = pub && pub.data ? pub.data.publicUrl : "";
      return {
        id: r.id,
        src: url,
        likes: Number(r.like_count || 0),
        caption: r.caption || ""
      };
    });
    return { ok: true, items };
  }

  async function likeOfferingInSupabase(offeringId) {
    const sb = getSupabaseClient();
    if (!sb) return { ok: false, reason: "no_supabase", like_count: null };
    const rpc = await sb.rpc("increment_like", { offering_id: offeringId });
    if (rpc.error) return { ok: false, reason: rpc.error.message || "like_failed", like_count: null };
    return { ok: true, like_count: Number(rpc.data || 0) };
  }

  function loadStore() {
    const raw = localStorage.getItem(STORE_KEY);
    const base = {
      usersById: {},
      currentUserId: null,
      products: [
        // 衣
        { id: "yi_spirit_robe", cat: "衣", name: "靈衣・霓縫袍", desc: "紙紮靈衣，霓光走線。", tag: "NEW" },
        { id: "yi_brocade", cat: "衣", name: "錦衣・護符披", desc: "披掛護印，安穩隨行。", tag: "HOT" },
        { id: "yi_shoes", cat: "衣", name: "步履・雲紋履", desc: "雲紋紙履，步步不沉。", tag: "NEW" },
        { id: "yi_bundle", cat: "衣", name: "衣・思念套裝", desc: "靈衣＋履具＋護符。", tag: "HOT", bundle: true },

        // 食
        { id: "shi_feast", cat: "食", name: "供奉・饗宴盤", desc: "供品紙紮，滿滿心意。", tag: "NEW" },
        { id: "shi_tea", cat: "食", name: "清茶・安魂盞", desc: "一盞清茶，息怒安魂。", tag: "HOT" },
        { id: "shi_incense", cat: "食", name: "香火・長明香", desc: "長明不滅，煙路通達。", tag: "NEW" },
        { id: "shi_bundle", cat: "食", name: "食・禮敬套裝", desc: "饗宴＋清茶＋香火。", tag: "HOT", bundle: true },

        // 住
        { id: "zhu_house", cat: "住", name: "靜夜・安居宅", desc: "紙屋宅第，歸處安穩。", tag: "NEW" },
        { id: "zhu_furniture", cat: "住", name: "寢居・羅帳榻", desc: "帳榻成套，夢裡安睡。", tag: "NEW" },
        { id: "zhu_bagua", cat: "住", name: "八卦・鎮宅印", desc: "鎮宅辟邪，四方皆安。", tag: "HOT" },
        { id: "zhu_bundle", cat: "住", name: "住・安宅套裝", desc: "安居宅＋羅帳榻＋鎮宅印。", tag: "HOT", bundle: true },

        // 行
        { id: "xing_lantern", cat: "行", name: "引路・燈火符", desc: "照見歸途，路不迷。", tag: "HOT" },
        { id: "xing_carriage", cat: "行", name: "遠行・順行輿", desc: "行裝紙紮，平安到達。", tag: "NEW" },
        { id: "xing_gold", cat: "行", name: "金銀・通達元寶", desc: "路路皆通，事事可行。", tag: "HOT" },
        { id: "xing_bundle", cat: "行", name: "行・順途套裝", desc: "燈火符＋順行輿＋通達元寶。", tag: "HOT", bundle: true }
      ]
    };
    if (!raw) return base;
    const parsed = safeJsonParse(raw, base);
    return { ...base, ...parsed, products: base.products };
  }

  function saveStore(store) {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  }

  function getOrCreateUser(displayName) {
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

  function requireUser() {
    const store = loadStore();
    const user = store.currentUserId ? store.usersById[store.currentUserId] : null;
    if (!user) return getOrCreateUser("旅者");
    return { store, user };
  }

  function updateUser(mutator) {
    const store = loadStore();
    const id = store.currentUserId;
    if (!id || !store.usersById[id]) {
      getOrCreateUser("旅者");
      return updateUser(mutator);
    }
    const nextUser = mutator({ ...store.usersById[id] });
    store.usersById[id] = nextUser;
    saveStore(store);
    return { store, user: nextUser };
  }

  function addToCart(product) {
    return updateUser((u) => {
      const existing = u.cart.find((x) => x.id === product.id);
      if (existing) existing.qty += 1;
      else u.cart.push({ ...product, qty: 1 });
      return u;
    });
  }

  function removeFromCart(productId) {
    return updateUser((u) => {
      u.cart = u.cart.filter((x) => x.id !== productId);
      return u;
    });
  }

  function setCartQty(productId, qty) {
    return updateUser((u) => {
      u.cart = u.cart.map((x) => (x.id === productId ? { ...x, qty: Math.max(1, qty) } : x));
      return u;
    });
  }

  function placeOrder({ note, uploadedImages = [] }) {
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

  function formatTime(ts) {
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function ensureTraditionalChinese() {
    document.documentElement.lang = "zh-Hant";
  }

  function qs(sel) {
    return document.querySelector(sel);
  }

  function productEmoji(p) {
    const id = String(p?.id || "");
    const cat = String(p?.cat || "");
    // 優先用具體商品類型，其次用分類
    if (id.includes("robe") || id.includes("brocade")) return "🧥";
    if (id.includes("shoes")) return "👞";
    if (id.includes("feast")) return "🍱";
    if (id.includes("tea")) return "🍵";
    if (id.includes("incense")) return "🕯️";
    if (id.includes("house")) return "🏠";
    if (id.includes("furniture")) return "🛏️";
    if (id.includes("bagua")) return "☯️";
    if (id.includes("lantern")) return "🏮";
    if (id.includes("carriage")) return "🧳";
    if (id.includes("gold")) return "🪙";
    if (cat === "衣") return "🧥";
    if (cat === "食") return "🍱";
    if (cat === "住") return "🏠";
    if (cat === "行") return "🏮";
    return "🧧";
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("讀取失敗"));
      reader.readAsDataURL(file);
    });
  }

  async function readImageAsDataUrlCompressed(file, { maxSide = 1400, quality = 0.86 } = {}) {
    // 非圖片就照原樣讀取
    if (!file || !file.type || !file.type.startsWith("image/")) return readFileAsDataUrl(file);

    const original = await readFileAsDataUrl(file);
    // 用 <img> 解碼 dataURL（兼容性最好）
    const img = new Image();
    img.decoding = "async";
    img.src = original;
    await new Promise((r, j) => {
      img.onload = () => r();
      img.onerror = () => j(new Error("圖片解碼失敗"));
    });

    const w = img.naturalWidth || img.width || 1;
    const h = img.naturalHeight || img.height || 1;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    // 不需要縮就直接回傳原檔（避免重編碼造成畫質損失）
    if (scale >= 1) return original;

    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) return original;
    ctx.drawImage(img, 0, 0, cw, ch);

    // 優先輸出 JPEG 以節省空間（透明度不重要：供品照片通常不需要 alpha）
    const out = canvas.toDataURL("image/jpeg", quality);
    return out;
  }

  // 扣除背景：支援棋盤格假透明、或純黑底（本次火焰素材）
  // 策略：
  // - 先從邊緣做 flood fill，清掉連通背景
  // - 再做全圖清理：針對低飽和/接近背景色的殘留像素
  // - 若背景主色偏黑，額外把「近黑」像素做羽化透明（沿火焰邊緣更乾淨）
  async function cutoutByEdgeFlood(imgEl, tolerance = 54) {
    const img = imgEl;
    if (!img.complete) {
      await new Promise((r) => img.addEventListener("load", r, { once: true }));
    }
    const w = Math.max(1, img.naturalWidth || img.width || 1);
    const h = Math.max(1, img.naturalHeight || img.height || 1);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h);

    const dist = (a, b) => {
      const dr = a[0] - b[0];
      const dg = a[1] - b[1];
      const db = a[2] - b[2];
      return Math.sqrt(dr * dr + dg * dg + db * db);
    };

    const lum = (rgb) => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];

    // 收集邊緣顏色，對棋盤格通常會有兩個主色
    const edgeSamples = [];
    const pushRgb = (x, y) => {
      const i = (y * w + x) * 4;
      edgeSamples.push([data.data[i], data.data[i + 1], data.data[i + 2]]);
    };
    const step = Math.max(6, Math.floor(Math.min(w, h) / 80));
    for (let x = 0; x < w; x += step) {
      pushRgb(x, 0);
      pushRgb(x, h - 1);
    }
    for (let y = 0; y < h; y += step) {
      pushRgb(0, y);
      pushRgb(w - 1, y);
    }

    // 將顏色做粗量化後統計頻率，取前 3 名當背景色集合
    const keyOf = (rgb) => rgb.map((v) => Math.round(v / 16) * 16).join(",");
    const freq = new Map();
    for (const c of edgeSamples) {
      const k = keyOf(c);
      freq.set(k, (freq.get(k) || 0) + 1);
    }
    const bgKeys = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map((x) => x[0]);
    const bgColors = bgKeys.map((k) => k.split(",").map((n) => Number(n)));

    const isBg = (rgb) => {
      for (const bc of bgColors) {
        if (dist(rgb, bc) <= tolerance) return true;
      }
      return false;
    };

    // 背景是否偏黑（本次火焰素材通常是純黑）
    const bgIsDark = bgColors.length ? bgColors.every((c) => lum(c) < 54) : false;

    // flood fill：從四周邊緣開始，把連通的背景像素透明化
    const visited = new Uint8Array(w * h);
    const qx = new Int32Array(w * 2 + h * 2 + 16);
    const qy = new Int32Array(w * 2 + h * 2 + 16);
    let qs = 0;
    let qe = 0;
    const enqueue = (x, y) => {
      const idx = y * w + x;
      if (visited[idx]) return;
      visited[idx] = 1;
      qx[qe] = x;
      qy[qe] = y;
      qe++;
    };

    // 種子：邊界所有點
    for (let x = 0; x < w; x += 1) {
      enqueue(x, 0);
      enqueue(x, h - 1);
    }
    for (let y = 1; y < h - 1; y += 1) {
      enqueue(0, y);
      enqueue(w - 1, y);
    }

    const getRgb = (x, y) => {
      const i = (y * w + x) * 4;
      return [data.data[i], data.data[i + 1], data.data[i + 2]];
    };

    while (qs < qe) {
      const x = qx[qs];
      const y = qy[qs];
      qs++;

      const i = (y * w + x) * 4;
      const rgb = [data.data[i], data.data[i + 1], data.data[i + 2]];
      if (isBg(rgb)) {
        data.data[i + 3] = 0;
        // 4-neighborhood
        if (x > 0) enqueue(x - 1, y);
        if (x + 1 < w) enqueue(x + 1, y);
        if (y > 0) enqueue(x, y - 1);
        if (y + 1 < h) enqueue(x, y + 1);
      }
    }

    // 第二階段：把殘留的棋盤格（通常為低飽和灰白）也清掉
    // 這能處理「未連通到邊緣」或被抗鋸齒切斷的背景塊
    const tolerance2 = Math.max(tolerance, 84);
    const lowChroma = (rgb) => {
      const mx = Math.max(rgb[0], rgb[1], rgb[2]);
      const mn = Math.min(rgb[0], rgb[1], rgb[2]);
      return (mx - mn) <= 26; // 越小越灰
    };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (data.data[i + 3] === 0) continue;
        const rgb = [data.data[i], data.data[i + 1], data.data[i + 2]];
        // 只清掉接近背景主色的灰白像素，避免誤傷符紙暖色
        if (lowChroma(rgb)) {
          let hit = false;
          for (const bc of bgColors) {
            if (dist(rgb, bc) <= tolerance2) { hit = true; break; }
          }
          if (hit) data.data[i + 3] = 0;
        }

        // 黑底羽化去背（沿火焰邊緣扣得更乾淨）
        if (bgIsDark) {
          const l = lum(rgb);
          // 近黑區域：做漸層透明，保留火焰高亮
          // 0..255 → alpha
          if (l < 70) {
            const keep = Math.min(1, Math.max(0, (l - 18) / (70 - 18))); // 0~1
            const a = data.data[i + 3] / 255;
            data.data[i + 3] = Math.round(255 * a * keep);
          }
        }
      }
    }

    ctx.putImageData(data, 0, 0);
    return canvas.toDataURL("image/png");
  }

  // -------- Pages --------

  function renderRecommended() {
    const store = loadStore();
    const root = qs("#recommended");
    if (!root) return;
    root.innerHTML = "";
    const rec = store.products.filter((p) => p.bundle).slice(0, 8);
    for (const p of rec) {
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
    const dataUrl = await readImageAsDataUrlCompressed(file, { maxSide: 1400, quality: 0.86 });
    const img = qs("#uploadPreviewImg");
    const wrap = qs("#uploadPreview");
    if (img && wrap) {
      img.src = dataUrl;
      wrap.style.display = "flex";
    }
    sessionStorage.setItem("shaolema.pendingUpload", dataUrl);
  }

  function bootHome() {
    getOrCreateUser("旅者");
    renderRecommended();

    // 生成「打開本網站」二維碼（使用公開 QR 服務）
    const qr = qs("#shareQr");
    if (qr) {
      const url = String(location.href || "");
      const data = encodeURIComponent(url);
      qr.src = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=10&data=${data}`;
    }

    const upload = qs("#uploadInput");
    if (upload) upload.addEventListener("change", handleUpload);

    const next = qs("#nextStep");
    if (next) next.addEventListener("click", () => spaNavigate("order.html"));

    const goOrder = qs("#goOrder");
    if (goOrder) goOrder.addEventListener("click", () => spaNavigate("order.html"));

    const goBurn = qs("#goBurn");
    if (goBurn) goBurn.addEventListener("click", () => spaNavigate("checkout.html"));

    const goStation = qs("#goStation");
    if (goStation) {
      goStation.addEventListener("click", () => {
        const portal = qs("#portal");
        if (!portal) {
          spaNavigate("station.html");
          return;
        }
        // 記錄：從首頁傳送門進入（供空間站做淡入）
        sessionStorage.setItem("shaolema.portal", "1");
        document.body.classList.add("portal-lock");
        portal.classList.add("opening");
        // 提前切頁，避免門開完露底
        setTimeout(() => {
          spaNavigate("station.html");
        }, 720);
      });
    }

    const quickSend = qs("#quickSend");
    if (quickSend) {
      quickSend.addEventListener("click", () => {
        const img = sessionStorage.getItem("shaolema.pendingUpload");
        const uploadedImages = img ? [{ id: uid("img"), dataUrl: img, caption: "上傳供品", isPublic: false }] : [];
        placeOrder({ note: "快速投遞（體驗）", uploadedImages });
        sessionStorage.removeItem("shaolema.pendingUpload");
        alert("已投遞至冥界空間站。");
        spaNavigate("station.html");
      });
    }

    // 公開分享牆（Supabase 優先；沒設定就退回本機模式）
    const hint = qs("#publicHint");
    const feed = qs("#publicFeed");
    if (feed) {
      const sb = getSupabaseClient();
      if (sb) {
        if (hint) hint.textContent = "提示：已啟用雲端公開牆（不同使用者會互相看見圖片與按讚數）。";
        fetchPublicFeedFromSupabase(28).then((res) => {
          const pics = res.ok ? res.items.filter((x) => x.src) : [];
          if (!pics.length) {
            feed.innerHTML = `<div class="public-empty">尚未有可公開的供品。到空間站把圖片設為「可公開」即可顯示。</div>`;
            return;
          }
          const all = pics.concat(pics);
          const track = document.createElement("div");
          track.className = "public-track";
          for (const p of all) {
            const card = document.createElement("div");
            card.className = "public-card";
            card.innerHTML = `
              <img src="${p.src}" alt="公開供品" loading="lazy" />
              <button class="like-btn" type="button" data-like-id="${p.id}">
                <span>讚</span><span class="n">${p.likes}</span>
              </button>
            `;
            track.appendChild(card);
          }
          feed.innerHTML = "";
          feed.appendChild(track);

          feed.addEventListener("click", async (e) => {
            const btn = e.target && e.target.closest ? e.target.closest("[data-like-id]") : null;
            if (!btn) return;
            const id = btn.getAttribute("data-like-id");
            if (!id) return;
            btn.setAttribute("disabled", "disabled");
            const r = await likeOfferingInSupabase(id);
            if (r.ok) {
              const n = btn.querySelector(".n");
              if (n) n.textContent = String(r.like_count);
            }
            btn.removeAttribute("disabled");
          });
        });
      } else {
        if (hint) hint.textContent = "提示：尚未啟用雲端，公開牆只會顯示你本機的內容。";
        const { user } = requireUser();
        const likes = loadLikes();
        const pics = [];
        for (const o of user.orders || []) {
          for (const img of o.images || []) {
            if (!img || !img.dataUrl) continue;
            if (!img.isPublic) continue;
            const id = img.id || "img";
            const key = imageKey(o.id, id);
            pics.push({
              key,
              src: img.dataUrl,
              likes: Number(likes[key] || 0)
            });
          }
        }

        if (!pics.length) {
          feed.innerHTML = `<div class="public-empty">尚未有可公開的供品。到空間站勾選圖片為「可公開」即可顯示。</div>`;
        } else {
          const all = pics.concat(pics);
          const track = document.createElement("div");
          track.className = "public-track";
          for (const p of all) {
            const card = document.createElement("div");
            card.className = "public-card";
            card.innerHTML = `
              <img src="${p.src}" alt="公開供品" loading="lazy" />
              <button class="like-btn" type="button" data-like="${p.key}">
                <span>讚</span><span class="n">${p.likes}</span>
              </button>
            `;
            track.appendChild(card);
          }
          feed.innerHTML = "";
          feed.appendChild(track);

          feed.addEventListener("click", (e) => {
            const btn = e.target && e.target.closest ? e.target.closest("[data-like]") : null;
            if (!btn) return;
            const k = btn.getAttribute("data-like");
            if (!k) return;
            const likes2 = loadLikes();
            likes2[k] = Number(likes2[k] || 0) + 1;
            saveLikes(likes2);
            const n = btn.querySelector(".n");
            if (n) n.textContent = String(likes2[k]);
          });
        }
      }
    }
  }

  function renderCatalog() {
    const store = loadStore();
    const root = qs("#products");
    if (!root) return;

    const catLabel = qs("#catLabel");
    const catDesc = qs("#catDesc");
    let activeCat = "衣";
    const descMap = {
      "衣": "溫暖與庇護",
      "食": "飽足與心安",
      "住": "安歇與歸屬",
      "行": "路途與放下"
    };

    const renderList = () => {
      root.innerHTML = "";
      const list = store.products.filter((p) => p.cat === activeCat);
      for (const p of list) {
        const el = document.createElement("div");
        el.className = "item";
        const emo = productEmoji(p);
        el.innerHTML = `
          <div class="thumb" aria-hidden="true"><span class="emoji">${emo}</span></div>
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
    };

    const setActive = (cat) => {
      activeCat = cat;
      if (catLabel) catLabel.textContent = cat;
      if (catDesc) catDesc.textContent = descMap[cat] || "";
      for (const b of document.querySelectorAll("[data-cat]")) {
        const isHit = b.getAttribute("data-cat") === cat;
        b.classList.toggle("btn-primary", isHit);
      }
      renderList();
    };

    // 分類切換
    document.addEventListener("click", (e) => {
      const t = e.target && e.target.closest ? e.target.closest("[data-cat]") : null;
      if (!t) return;
      setActive(t.getAttribute("data-cat") || "衣");
    });

    // 加入購物籃
    root.addEventListener("click", (e) => {
      const btn = e.target && e.target.closest ? e.target.closest("[data-add]") : null;
      if (!btn) return;
      const id = btn.getAttribute("data-add");
      const prod = store.products.find((x) => x.id === id);
      if (!prod) return;
      addToCart({ id: prod.id, name: prod.name });
      renderCart();
    });

    setActive("衣");
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
      // 不強制加入購物籃：仍可前往結算上傳圖片焚化
      if (checkout) checkout.removeAttribute("disabled");
      return;
    }
    if (empty) empty.style.display = "none";
    if (checkout) checkout.removeAttribute("disabled");

    for (const it of user.cart) {
      const row = document.createElement("div");
      row.className = "item";
      const emo = productEmoji(it);
      row.innerHTML = `
        <div class="thumb" aria-hidden="true"><span class="emoji">${emo}</span></div>
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

    root.onclick = (e) => {
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
    };
  }

  function bootOrder() {
    renderCatalog();
    renderCart();
    const go = qs("#goCheckout");
    if (go) go.addEventListener("click", () => spaNavigate("checkout.html"));
  }

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
      const emo = productEmoji(it);
      el.innerHTML = `
        <div class="thumb" aria-hidden="true"><span class="emoji">${emo}</span></div>
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
    if (pending) uploads.push({ id: uid("img"), dataUrl: pending, caption: "上傳供品", isPublic: false });

    const input = qs("#extraUpload");
    const files = input && input.files ? Array.from(input.files) : [];
    for (const f of files.slice(0, 6)) {
      if (!f.type.startsWith("image/")) continue;
      const dataUrl = await readImageAsDataUrlCompressed(f, { maxSide: 1400, quality: 0.86 });
      uploads.push({ id: uid("img"), dataUrl, caption: "追加供品", isPublic: false });
    }
    return uploads;
  }

  function bootCheckout() {
    renderSummary();
    const goBack = qs("#backToOrder");
    if (goBack) goBack.addEventListener("click", () => spaNavigate("order.html"));

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

      // 隨機祝福文案（由 assets/blessings.js 提供）
      const list = Array.isArray(window.SHAOLEMA_BLESSINGS) ? window.SHAOLEMA_BLESSINGS : [];
      const pick = list.length ? list[Math.floor(Math.random() * list.length)] : "願你所念，皆有回音。";
      const el = qs("#burnBlessing");
      if (el) el.textContent = pick;

      const canvas = qs("#burnCanvas");

      const playBurn = () => new Promise((resolve) => {
        if (!canvas || !canvas.getContext) return resolve();
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve();

        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const cssW = canvas.clientWidth || 420;
        const cssH = canvas.clientHeight || 665;
        canvas.width = Math.floor(cssW * dpr);
        canvas.height = Math.floor(cssH * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const W = cssW;
        const H = cssH;
        const paperW = Math.min(310, W * 0.82);
        const paperH = Math.min(430, H * 0.78);
        const paperX = (W - paperW) / 2;
        const paperY = (H - paperH) / 2 + 10;

        const rand = (a, b) => a + Math.random() * (b - a);
        const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

        // 粒子
        const particles = [];
        const spawnParticles = (count, yLine) => {
          for (let i = 0; i < count; i++) {
            particles.push({
              x: rand(paperX + 18, paperX + paperW - 18),
              y: clamp(yLine + rand(-12, 12), paperY, paperY + paperH),
              vx: rand(-18, 18),
              vy: rand(-58, -22),
              life: rand(0.7, 1.35),
              t: 0,
              r: rand(1.2, 2.4),
              c: Math.random() < 0.5 ? "rgba(255,224,122,0.9)" : (Math.random() < 0.5 ? "rgba(255,122,217,0.8)" : "rgba(95,246,214,0.75)")
            });
          }
        };

        const draw = (tBurn, tDissolve) => {
          ctx.clearRect(0, 0, W, H);

          // 紙紮（清晰）
          const g = ctx.createLinearGradient(0, paperY, 0, paperY + paperH);
          g.addColorStop(0, "rgba(255, 236, 170, 0.96)");
          g.addColorStop(1, "rgba(242, 196, 86, 0.92)");

          ctx.save();
          ctx.shadowColor = "rgba(0,0,0,0.55)";
          ctx.shadowBlur = 26;
          ctx.shadowOffsetY = 16;
          ctx.fillStyle = g;
          ctx.strokeStyle = "rgba(255,224,122,0.45)";
          ctx.lineWidth = 1.5;
          const r = 18;
          ctx.beginPath();
          ctx.moveTo(paperX + r, paperY);
          ctx.arcTo(paperX + paperW, paperY, paperX + paperW, paperY + paperH, r);
          ctx.arcTo(paperX + paperW, paperY + paperH, paperX, paperY + paperH, r);
          ctx.arcTo(paperX, paperY + paperH, paperX, paperY, r);
          ctx.arcTo(paperX, paperY, paperX + paperW, paperY, r);
          ctx.closePath();
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.stroke();
          ctx.restore();

          // 內部淡符紋
          ctx.save();
          ctx.globalAlpha = 0.10;
          ctx.strokeStyle = "rgba(40,20,10,0.85)";
          ctx.lineWidth = 5;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(paperX + paperW * 0.5, paperY + 26);
          ctx.lineTo(paperX + paperW * 0.5, paperY + paperH - 26);
          ctx.moveTo(paperX + paperW * 0.28, paperY + paperH * 0.22);
          ctx.quadraticCurveTo(paperX + paperW * 0.5, paperY + paperH * 0.16, paperX + paperW * 0.72, paperY + paperH * 0.22);
          ctx.stroke();
          ctx.restore();

          // 焚燒線：從底往上
          const burnY = paperY + paperH * (1 - tBurn);

          // 把已焚燒部分「挖掉」
          ctx.save();
          ctx.globalCompositeOperation = "destination-out";
          ctx.beginPath();
          // jitter edge
          const steps = 24;
          ctx.moveTo(paperX - 10, paperY + paperH + 40);
          ctx.lineTo(paperX - 10, burnY);
          for (let i = 0; i <= steps; i++) {
            const x = paperX + (paperW * i) / steps;
            const y = burnY + Math.sin((i / steps) * Math.PI * 3 + tBurn * 10) * 6 + rand(-4, 4);
            ctx.lineTo(x, y);
          }
          ctx.lineTo(paperX + paperW + 10, burnY);
          ctx.lineTo(paperX + paperW + 10, paperY + paperH + 40);
          ctx.closePath();
          ctx.fill();
          ctx.restore();

          // 火焰（清晰：火舌輪廓 + 亮核 + 霓光外焰）
          ctx.save();
          ctx.globalCompositeOperation = "screen";

          const baseX = W / 2;
          const baseY = burnY + 42;
          const flameW = paperW * 0.92;
          const flameH = 220;

          // 底部亮核（柔光，不是長方形）
          const core = ctx.createRadialGradient(baseX, baseY, 8, baseX, baseY, flameW * 0.55);
          core.addColorStop(0, "rgba(255,255,210,0.95)");
          core.addColorStop(0.28, "rgba(255,224,122,0.92)");
          core.addColorStop(0.55, "rgba(255,120,60,0.75)");
          core.addColorStop(0.85, "rgba(255,55,55,0.18)");
          core.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = core;
          ctx.beginPath();
          ctx.ellipse(baseX, baseY - 18, flameW * 0.42, 70, 0, 0, Math.PI * 2);
          ctx.fill();

          // 火舌：多筆清晰輪廓，輕微擺動
          const drawTongue = (i, x, w, h, sway, phase) => {
            const y0 = baseY;
            const yTop = y0 - h;
            const tipX = x + Math.sin(phase) * sway;

            const grad = ctx.createLinearGradient(x, yTop, x, y0);
            grad.addColorStop(0, "rgba(255,245,170,0.92)");
            grad.addColorStop(0.35, "rgba(255,224,122,0.88)");
            grad.addColorStop(0.68, "rgba(255,120,60,0.78)");
            grad.addColorStop(1, "rgba(255,55,55,0.10)");

            ctx.fillStyle = grad;
            ctx.strokeStyle = "rgba(255,224,122,0.35)";
            ctx.lineWidth = 1.2;

            ctx.beginPath();
            ctx.moveTo(x - w * 0.55, y0);
            ctx.bezierCurveTo(
              x - w * 0.75, y0 - h * 0.28,
              tipX - w * 0.30, y0 - h * 0.72,
              tipX, yTop
            );
            ctx.bezierCurveTo(
              tipX + w * 0.30, y0 - h * 0.72,
              x + w * 0.75, y0 - h * 0.28,
              x + w * 0.55, y0
            );
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // 內焰小舌（更亮）
            const inner = ctx.createLinearGradient(x, yTop, x, y0);
            inner.addColorStop(0, "rgba(255,255,235,0.85)");
            inner.addColorStop(0.5, "rgba(255,224,122,0.78)");
            inner.addColorStop(1, "rgba(255,120,60,0.05)");
            ctx.fillStyle = inner;
            ctx.beginPath();
            ctx.moveTo(x - w * 0.26, y0);
            ctx.quadraticCurveTo(tipX - w * 0.10, y0 - h * 0.55, tipX, yTop + h * 0.12);
            ctx.quadraticCurveTo(tipX + w * 0.10, y0 - h * 0.55, x + w * 0.26, y0);
            ctx.closePath();
            ctx.fill();
          };

          const t = tBurn;
          const wobble = 8 + Math.sin(t * 8) * 2;
          const tongues = 4;
          for (let i = 0; i < tongues; i++) {
            const u = tongues === 1 ? 0 : i / (tongues - 1);
            const x = baseX + (u - 0.5) * flameW * 0.55;
            const w = 58 + (1 - Math.abs(u - 0.5) * 1.7) * 34;
            const h = 120 + (1 - Math.abs(u - 0.5) * 1.4) * 86;
            const phase = t * 12 + i * 1.7;
            drawTongue(i, x, w, h, wobble + i * 1.5, phase);
          }

          // 外焰霓光（偏粉/青，貼合參考色調）
          const neon = ctx.createRadialGradient(baseX, baseY - 40, 18, baseX, baseY - 40, flameW * 0.78);
          neon.addColorStop(0, "rgba(255,122,217,0.16)");
          neon.addColorStop(0.55, "rgba(95,246,214,0.10)");
          neon.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = neon;
          ctx.beginPath();
          ctx.ellipse(baseX, baseY - 58, flameW * 0.55, 130, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();

          // 粒子（燒盡後飄走）
          ctx.save();
          for (const p of particles) {
            const a = 1 - (p.t / p.life);
            if (a <= 0) continue;
            ctx.globalAlpha = a;
            ctx.fillStyle = p.c;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();

          // 消散（紙紮最後一點淡出）
          if (tDissolve > 0) {
            ctx.save();
            ctx.globalAlpha = tDissolve * 0.55;
            ctx.fillStyle = "rgba(0,0,0,1)";
            ctx.globalCompositeOperation = "destination-out";
            ctx.fillRect(paperX - 8, paperY - 8, paperW + 16, paperH + 16);
            ctx.restore();
          }
        };

        const BURN_MS = 2000;
        // 燒完就馬上漸隱：縮短且更順
        const DISSOLVE_MS = 520;
        let last = performance.now();
        let start = last;
        let phase = "burn";

        const tick = (now) => {
          const dt = (now - last) / 1000;
          last = now;

          if (phase === "burn") {
            const t = clamp((now - start) / BURN_MS, 0, 1);
            const burnY = (canvas.clientHeight || 665) * 0; // unused, kept
            // 沿焚燒線補一些火星（更多）
            if (Math.random() < 0.92) {
              const cssH2 = canvas.clientHeight || 665;
              const cssW2 = canvas.clientWidth || 420;
              const W2 = cssW2;
              const H2 = cssH2;
              const paperW2 = Math.min(310, W2 * 0.82);
              const paperH2 = Math.min(430, H2 * 0.78);
              const paperX2 = (W2 - paperW2) / 2;
              const paperY2 = (H2 - paperH2) / 2 + 10;
              const yLine = paperY2 + paperH2 * (1 - t);
              spawnParticles(5, yLine);
            }
            // 更新粒子
            for (const p of particles) {
              p.t += dt;
              p.x += p.vx * dt;
              p.y += p.vy * dt;
            }
            draw(t, 0);
            if (t >= 1) {
              phase = "dissolve";
              start = now;
              // 燒盡瞬間多一點粒子
              const cssH2 = canvas.clientHeight || 665;
              const cssW2 = canvas.clientWidth || 420;
              const paperW2 = Math.min(310, cssW2 * 0.82);
              const paperH2 = Math.min(430, cssH2 * 0.78);
              const paperX2 = (cssW2 - paperW2) / 2;
              const paperY2 = (cssH2 - paperH2) / 2 + 10;
              spawnParticles(48, paperY2 + paperH2 * 0.18);
            }
          } else {
            // ease-out 讓最後不僵硬
            const t0 = clamp((now - start) / DISSOLVE_MS, 0, 1);
            const t = 1 - Math.pow(1 - t0, 3);
            for (const p of particles) {
              p.t += dt;
              p.x += p.vx * dt;
              p.y += p.vy * dt;
            }
            draw(1, t);
            if (t >= 1) return resolve();
          }
          requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
      });

      // 先播焚燒動畫（清晰畫面），再顯示祝福
      document.body.classList.add("burning", "phase-burn");
      await playBurn();
      document.body.classList.remove("phase-burn");

      // 祝福顯示/消散後再提交並跳轉
      setTimeout(() => {
        placeOrder({ note, uploadedImages: uploads });
        sessionStorage.removeItem("shaolema.pendingUpload");
        document.body.classList.remove("burning");
        spaNavigate("station.html");
      }, 3250);
    });
  }

  function renderSpace() {
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

  function bootSpace() {
    renderSpace();
    const saveBtn = qs("#saveProfile");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        const { store, user } = requireUser();
        const v = String(qs("#displayName")?.value || "").trim();
        user.displayName = v || "旅者";
        store.usersById[user.id] = user;
        saveStore(store);
        alert("已保存。");
        renderSpace();
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

  function renderStation() {
    const { user } = requireUser();
    const root = qs("#gallery");
    const empty = qs("#empty");
    if (!root || !empty) return;

    const entries = [];
    for (const o of user.orders) {
      // 1) 圖片供品
      for (const img of o.images || []) {
        entries.push({
          kind: "image",
          orderId: o.id,
          imgId: img.id || "img",
          isPublic: Boolean(img.isPublic),
          createdAt: o.createdAt,
          note: o.note,
          dataUrl: img.dataUrl,
          caption: img.caption || "供品"
        });
      }
      // 2) 下單商品（不顯示金額，只顯示品項與數量）
      for (const it of o.items || []) {
        entries.push({
          kind: "item",
          createdAt: o.createdAt,
          note: o.note,
          id: it.id,
          name: it.name,
          qty: it.qty || 1
        });
      }
    }

    root.innerHTML = "";

    if (!entries.length) {
      empty.style.display = "block";
      return;
    }
    empty.style.display = "none";

    for (const it of entries) {
      const tile = document.createElement("div");
      tile.className = "tile";
      if (it.kind === "image") {
        tile.innerHTML = `
          <img src="${it.dataUrl}" alt="供品圖片" loading="lazy" />
          <button class="like-btn" type="button" data-public-toggle="${it.orderId}::${it.imgId}" style="left:8px; right:auto">
            <span>${it.isPublic ? "可公開" : "不公開"}</span>
          </button>
          <div class="cap">
            <div style="font-weight:800; letter-spacing:.02em">${it.caption}</div>
            <div class="muted" style="margin-top:4px">
              ${formatTime(it.createdAt)}${it.note ? ` · ${it.note}` : ""}
            </div>
          </div>
        `;
      } else {
        const emo = productEmoji(it);
        const qtyText = it.qty > 1 ? ` × ${it.qty}` : "";
        tile.innerHTML = `
          <div class="tile-emoji" aria-hidden="true"><span>${emo}</span></div>
          <div class="cap">
            <div style="font-weight:800; letter-spacing:.02em">${it.name}${qtyText}</div>
            <div class="muted" style="margin-top:4px">${formatTime(it.createdAt)}${it.note ? ` · ${it.note}` : ""}</div>
          </div>
        `;
      }
      root.appendChild(tile);
    }
  }

  function bootStation() {
    // 從首頁「蓮花開門」進來：做一個淡入銜接
    if (sessionStorage.getItem("shaolema.portal") === "1") {
      sessionStorage.removeItem("shaolema.portal");
      document.body.classList.add("portal-arrive");
      setTimeout(() => document.body.classList.remove("portal-arrive"), 420);
    }
    renderStation();

    // 圖片：公開/不公開切換（本機）
    const gallery = qs("#gallery");
    if (gallery) {
      gallery.addEventListener("click", (e) => {
        const btn = e.target && e.target.closest ? e.target.closest("[data-public-toggle]") : null;
        if (!btn) return;
        const key = btn.getAttribute("data-public-toggle");
        if (!key) return;
        const [orderId, imgId] = key.split("::");
        const { store, user } = requireUser();
        const targetOrder = user.orders.find((o) => o.id === orderId);
        if (!targetOrder) return;
        const targetImg = (targetOrder.images || []).find((im) => (im.id || "img") === imgId);
        if (!targetImg) return;
        (async () => {
          const nextPublic = !targetImg.isPublic;
          targetImg.isPublic = nextPublic;
          store.usersById[user.id] = user;
          saveStore(store);
          renderStation();

          // 若已設定 Supabase：同步到雲端公開牆
          const sb = getSupabaseClient();
          if (!sb) return;
          const deviceId = getDeviceId();
          btn.setAttribute("disabled", "disabled");
          try {
            if (nextPublic) {
              const r = await publishImageToSupabase({ deviceId, orderId, img: targetImg });
              if (r.ok) {
                targetImg.publicRef = r.offering;
                store.usersById[user.id] = user;
                saveStore(store);
              } else {
                // 上傳失敗：回滾成不公開
                targetImg.isPublic = false;
                store.usersById[user.id] = user;
                saveStore(store);
                renderStation();
                alert("公開失敗，請確認 Supabase 設定與 SQL/Storage 是否已完成。");
              }
            } else {
              await unpublishImageFromSupabase({ deviceId, orderId, img: targetImg });
              targetImg.publicRef = null;
              store.usersById[user.id] = user;
              saveStore(store);
            }
          } finally {
            btn.removeAttribute("disabled");
          }
        })();
      });
    }

    const del = qs("#deleteOfferings");
    const modal = qs("#deleteModal");
    const closeBtn = qs("#deleteClose");
    const listRoot = qs("#deleteList");
    const btnAll = qs("#deleteSelectAll");
    const btnNone = qs("#deleteSelectNone");
    const btnConfirm = qs("#deleteConfirm");

    const openModal = () => {
      if (!modal || !listRoot) return;
      const { user } = requireUser();
      const rows = [];
      for (const o of user.orders) {
        const ts = formatTime(o.createdAt);
        for (const img of o.images || []) {
          const key = `${o.id}::img::${img.id || "img"}`;
          rows.push({
            key,
            kind: "image",
            title: img.caption || "供品圖片",
            subtitle: ts + (o.note ? ` · ${o.note}` : ""),
            dataUrl: img.dataUrl
          });
        }
        for (const it of o.items || []) {
          const key = `${o.id}::item::${it.id || "item"}`;
          const qtyText = (it.qty || 1) > 1 ? ` × ${it.qty}` : "";
          rows.push({
            key,
            kind: "item",
            title: `${it.name}${qtyText}`,
            subtitle: ts + (o.note ? ` · ${o.note}` : ""),
            emoji: productEmoji(it)
          });
        }
      }

      listRoot.innerHTML = "";
      if (!rows.length) {
        listRoot.innerHTML = `<div class="empty">目前沒有可刪除的供品。</div>`;
      } else {
        for (const r of rows) {
          const div = document.createElement("label");
          div.className = "delete-item";
          div.innerHTML = `
            <input type="checkbox" data-key="${r.key}" />
            <div class="delete-thumb" aria-hidden="true">
              ${r.kind === "image" ? `<img src="${r.dataUrl}" alt="" />` : `<span class="emoji">${r.emoji || "🧧"}</span>`}
            </div>
            <div class="delete-meta">
              <div class="t">${r.title}</div>
              <div class="s">${r.subtitle}</div>
            </div>
          `;
          listRoot.appendChild(div);
        }
      }

      document.body.classList.add("modal-open");
      modal.setAttribute("aria-hidden", "false");
    };

    const closeModal = () => {
      if (!modal) return;
      document.body.classList.remove("modal-open");
      modal.setAttribute("aria-hidden", "true");
    };

    if (del) del.addEventListener("click", openModal);
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (modal) modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });

    if (btnAll) btnAll.addEventListener("click", () => {
      for (const cb of document.querySelectorAll('#deleteList input[type="checkbox"]')) cb.checked = true;
    });
    if (btnNone) btnNone.addEventListener("click", () => {
      for (const cb of document.querySelectorAll('#deleteList input[type="checkbox"]')) cb.checked = false;
    });

    if (btnConfirm) {
      btnConfirm.addEventListener("click", () => {
        const checked = Array.from(document.querySelectorAll('#deleteList input[type="checkbox"]:checked'))
          .map((x) => x.getAttribute("data-key"))
          .filter(Boolean);
        if (!checked.length) {
          alert("請先勾選要刪除的供品。");
          return;
        }
        const ok = confirm(`確定要刪除已勾選的 ${checked.length} 項供品嗎？\n（此操作無法復原）`);
        if (!ok) return;

        const toDelete = new Set(checked);
        updateUser((u) => {
          u.orders = (u.orders || []).map((o) => {
            const images = (o.images || []).filter((img) => !toDelete.has(`${o.id}::img::${img.id || "img"}`));
            const items = (o.items || []).filter((it) => !toDelete.has(`${o.id}::item::${it.id || "item"}`));
            return { ...o, images, items };
          }).filter((o) => (o.images && o.images.length) || (o.items && o.items.length));
          return u;
        });

        renderStation();
        closeModal();
      });
    }
  }

  // -------- Boot --------

  function boot() {
    ensureTraditionalChinese();
    setupBgm();
    setupSpaNav();
    // 記錄當前頁面到 history（讓返回鍵能正常）
    try { history.replaceState({ href: location.pathname.split("/").pop() || "index.html" }, "", location.href); } catch {}
    bootPage();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

