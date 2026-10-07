/* REPLICA LAB — buildless storefront. All shopping data stays in this browser. */
(() => {
  'use strict';

  // This catalog is fictional. Replace these records and images to practice editing.
  const products = [
    { id: 'atlas', name: 'ATLAS C1', category: 'classic', series: '经典长款', price: 699,
      finish: '石墨黑', color: '#343936', tag: '轮廓收藏', subtitle: '经典轮廓，安静而有力量。',
      description: '从延伸的线条到细密的切面，ATLAS C1 把经典长款轮廓转译成一件桌面收藏。石墨黑的整体配色，搭配醒目的橙色模型端帽。',
      keywords: '长款 经典 黑色 石墨 长枪 步枪', specs: ['C1 展示系列', '经典长款轮廓', '石墨黑 / 橙色细节', '静态展示玩具模型'] },
    { id: 'nova', name: 'NOVA P2', category: 'compact', series: '紧凑短款', price: 299,
      finish: '石墨灰', color: '#5b5c57', tag: '小而有型', subtitle: '一个小巧的轮廓，一处新的焦点。',
      description: '紧凑的比例让 NOVA P2 适合成为桌面的一个小焦点。握柄纹理与利落的顶部线条形成对比，橙色模型端帽让整体多一处色彩节奏。',
      keywords: '短款 紧凑 黑色 灰色 手枪', specs: ['P2 展示系列', '紧凑短款轮廓', '石墨灰 / 橙色细节', '静态展示玩具模型'] },
    { id: 'arc', name: 'ARC S1', category: 'future', series: '原创科幻', price: 599,
      finish: '象牙白', color: '#d9d8cb', tag: '未来想象', subtitle: '给未来，留一个想象的位置。',
      description: 'ARC S1 用象牙白的曲面、深色内嵌结构与蓝色细节，探索一种原创科幻轮廓。它是一件关于未来想象的玩具模型，也是一种更轻盈的陈列选择。',
      keywords: '科幻 未来 白色 象牙 原创 太空', specs: ['S1 原创系列', '科幻造型轮廓', '象牙白 / 蓝色细节', '静态展示玩具模型'] }
  ];
  const catalog = new Map(products.map(product => [product.id, product]));
  const storageKeys = { cart: 'replica-lab-cart-v1', favorites: 'replica-lab-favorites-v1', order: 'replica-lab-order-v1' };
  const $ = id => document.getElementById(id);
  const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const money = value => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }).format(value);
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const clampQuantity = value => Math.max(1, Math.min(10, Math.trunc(Number(value) || 1)));
  let toastTimer;

  function readStorage(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  }
  function saveStorage(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { showToast('浏览器未允许保存；本次操作仍可继续。'); return false; }
  }
  function sanitizeCart(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([id, qty]) => catalog.has(id) && Number.isInteger(qty) && qty > 0).map(([id, qty]) => [id, clampQuantity(qty)]));
  }
  const savedFavorites = readStorage(storageKeys.favorites, []);
  const state = {
    cart: sanitizeCart(readStorage(storageKeys.cart, {})),
    favorites: new Set(Array.isArray(savedFavorites) ? savedFavorites.filter(id => catalog.has(id)) : []),
    category: 'all', query: '', sort: 'featured', favoritesOnly: false,
    selected: null, quantity: 1, orderPreview: null, lastOrder: null
  };
  function validOrder(value) {
    if (!value || typeof value !== 'object' || !/^RL-\d{8}-[A-Z0-9]{4}$/.test(value.number) || !Number.isFinite(Date.parse(value.createdAt)) || !Array.isArray(value.items)) return null;
    const items = value.items.filter(item => item && catalog.has(item.id) && Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 10);
    if (!items.length || items.length !== value.items.length || items.length > products.length || new Set(items.map(item => item.id)).size !== items.length) return null;
    return { number: value.number, createdAt: value.createdAt, items: items.map(({ id, quantity }) => ({ id, quantity })) };
  }
  state.lastOrder = validOrder(readStorage(storageKeys.order, null));

  function showToast(message, withCart = false) {
    clearTimeout(toastTimer);
    $('toast-text').textContent = message;
    $('toast-cart').hidden = !withCart;
    $('toast').hidden = false;
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4800);
  }
  function cartItems() {
    return products.filter(product => state.cart[product.id]).map(product => ({ ...product, quantity: state.cart[product.id] }));
  }
  function updateCounts() {
    const count = Object.values(state.cart).reduce((sum, qty) => sum + qty, 0);
    $('cart-count').textContent = count;
    $('drawer-count').textContent = count;
    $('cart-button').setAttribute('aria-label', `打开购物车，共 ${count} 件模型`);
    $('favorite-count').textContent = state.favorites.size;
    $('favorite-count').hidden = state.favorites.size === 0;
    $('favorites-button').setAttribute('aria-label', `查看收藏清单，共 ${state.favorites.size} 件模型`);
  }
  function renderProducts() {
    const query = state.query.trim().toLowerCase();
    let visible = products.filter(product =>
      (state.category === 'all' || state.category === product.category) &&
      (!state.favoritesOnly || state.favorites.has(product.id)) &&
      (!query || `${product.name} ${product.series} ${product.finish} ${product.keywords}`.toLowerCase().includes(query))
    );
    if (state.sort === 'price-asc') visible = visible.sort((a, b) => a.price - b.price);
    if (state.sort === 'price-desc') visible = visible.sort((a, b) => b.price - a.price);
    $('product-grid').innerHTML = visible.map(product => `<article class="product-card">
      <div class="product-image-container">
        <button class="product-image-button" data-product="${product.id}" data-open-product="${product.id}" aria-label="查看 ${product.name} 详情">
          <span class="product-tag">${product.tag}</span><img src="assets/${product.id}.png" alt="${product.name} ${product.finish} 玩具模型" width="1536" height="1024" loading="lazy"><span class="quick-view-hint">查看细节 ${icon('arrow-up')}</span>
        </button>
        <button class="favorite-product" data-favorite="${product.id}" aria-label="${state.favorites.has(product.id) ? '取消收藏' : '收藏'} ${product.name}" aria-pressed="${state.favorites.has(product.id)}">${icon('heart')}</button>
      </div>
      <div class="product-card-meta"><p class="overline">${product.series}</p><div class="product-title-row"><button class="product-name" data-open-product="${product.id}">${product.name}</button><span class="product-price">${money(product.price)}</span></div><div class="product-bottom"><span class="swatch-meta"><i class="swatch" style="--swatch:${product.color}"></i>${product.finish}</span><button class="card-add" data-add="${product.id}" aria-label="将 ${product.name} 加入购物车">${icon('plus')}</button></div></div>
    </article>`).join('');
    $('product-empty').hidden = visible.length > 0;
    $('empty-description').textContent = state.favoritesOnly ? '先点击模型上的爱心，把喜欢的模型放进收藏清单。' : '换个关键词或分类，再看看。';
    $('result-count').textContent = `${visible.length} 件${state.favoritesOnly ? '已收藏的' : '概念'}模型`;
    document.querySelectorAll('[data-category]').forEach(button => {
      const active = button.dataset.category === state.category;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    $('favorite-filter').setAttribute('aria-pressed', String(state.favoritesOnly));
  }
  function toggleFavorite(id) {
    if (!catalog.has(id)) return;
    const activeElement = document.activeElement;
    const restoreCardFocus = activeElement?.dataset.favorite === id && activeElement.classList.contains('favorite-product');
    if (state.favorites.has(id)) state.favorites.delete(id); else state.favorites.add(id);
    saveStorage(storageKeys.favorites, [...state.favorites]);
    renderProducts(); updateCounts();
    if (restoreCardFocus) document.querySelector(`.favorite-product[data-favorite="${id}"]`)?.focus({ preventScroll: true });
    const detailFavorite = $('product-detail').querySelector('[data-favorite]');
    if (detailFavorite && state.selected === id) {
      detailFavorite.setAttribute('aria-pressed', String(state.favorites.has(id)));
      detailFavorite.innerHTML = `${icon('heart')}${state.favorites.has(id) ? '已加入收藏' : '加入收藏清单'}`;
    }
    showToast(state.favorites.has(id) ? `${catalog.get(id).name} 已加入收藏` : '已从收藏清单移除');
  }
  function resetFilters() {
    state.category = 'all'; state.query = ''; state.favoritesOnly = false;
    $('product-search').value = ''; renderProducts();
  }
  function scrollToCollection() {
    $('collection').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }

  const dialogs = [...document.querySelectorAll('dialog')];
  function openDialog(id) {
    dialogs.filter(dialog => dialog.open && dialog.id !== id).forEach(dialog => dialog.close());
    if (!$(id).open) $(id).showModal();
    document.body.classList.add('modal-open');
    closeMenu();
  }
  dialogs.forEach(dialog => {
    dialog.addEventListener('close', () => {
      document.body.classList.toggle('modal-open', dialogs.some(item => item.open));
      if (dialog.id === 'product-dialog' && location.hash.startsWith('#product/')) history.replaceState(null, '', '#collection');
    });
    dialog.addEventListener('click', event => {
      const rect = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
    });
  });
  function quantityControl(id, qty, context) {
    return `<div class="quantity-control" role="group" aria-label="${catalog.get(id).name} 数量"><button data-quantity="${id}" data-context="${context}" data-step="-1" aria-label="减少 ${catalog.get(id).name} 数量" ${qty <= 1 ? 'disabled' : ''}>${icon('minus')}</button><output aria-live="polite">${qty}</output><button data-quantity="${id}" data-context="${context}" data-step="1" aria-label="增加 ${catalog.get(id).name} 数量" ${qty >= 10 ? 'disabled' : ''}>${icon('plus')}</button></div>`;
  }
  function openProduct(id) {
    const product = catalog.get(id); if (!product) return;
    state.selected = id; state.quantity = 1;
    $('product-detail').innerHTML = `<div class="product-detail-grid"><div class="product-detail-image" data-product="${id}"><img src="assets/${id}.png" alt="${product.name} ${product.finish} 玩具模型完整视图" width="1536" height="1024"><button class="image-zoom text-button" id="image-zoom" aria-pressed="false">放大细节 ${icon('plus')}</button></div><div class="product-detail-copy"><p class="overline">${product.series} / 展示型模型</p><h2 id="product-dialog-title">${product.name}</h2><p class="product-subtitle">${product.subtitle}</p><div class="detail-price">${money(product.price)}<small>演示价格</small></div><p class="product-detail-description">${product.description}</p><dl class="detail-specs">${['系列', '轮廓', '配色', '类型'].map((label, index) => `<div><dt>${label}</dt><dd>${product.specs[index]}</dd></div>`).join('')}</dl><div class="detail-purchase"><div id="detail-quantity">${quantityControl(id, 1, 'detail')}</div><button class="button button-dark" data-add-detail="${id}">加入购物车 ${icon('bag')}</button></div><button class="detail-favorite text-button" data-favorite="${id}" aria-pressed="${state.favorites.has(id)}">${icon('heart')}${state.favorites.has(id) ? '已加入收藏' : '加入收藏清单'}</button><p class="detail-footer-note">原创概念图 · 虚构练习商品 · 无真实交易</p></div></div>`;
    openDialog('product-dialog');
    history.replaceState(null, '', `#product/${id}`);
  }
  function addToCart(id, quantity = 1) {
    if (!catalog.has(id)) return;
    const previous = state.cart[id] || 0;
    state.cart[id] = Math.min(10, previous + quantity);
    saveStorage(storageKeys.cart, state.cart); updateCounts(); renderCart();
    showToast(previous === 10 ? '每种模型最多可添加 10 件' : `${catalog.get(id).name} 已加入购物车`, true);
  }
  function renderCart() {
    const items = cartItems();
    $('cart-bottom').hidden = items.length === 0;
    $('checkout-button').disabled = items.length === 0;
    $('cart-total').textContent = money(items.reduce((sum, item) => sum + item.price * item.quantity, 0));
    $('cart-content').innerHTML = items.length ? items.map(item => `<article class="cart-item"><button class="cart-item-image" data-open-product="${item.id}" aria-label="查看 ${item.name} 详情"><img src="assets/${item.id}.png" alt="${item.name} 玩具模型" width="1536" height="1024"></button><div class="cart-item-copy"><div class="cart-item-head"><h3>${item.name}</h3><strong>${money(item.price * item.quantity)}</strong></div><p>${item.finish} · 单价 ${money(item.price)}</p><div class="cart-item-bottom">${quantityControl(item.id, item.quantity, 'cart')}<button class="remove-item" data-remove="${item.id}" aria-label="移除 ${item.name}">移除</button></div></div></article>`).join('') : `<div class="cart-empty">${icon('bag')}<h3>收藏，从第一件开始。</h3><p>把喜欢的模型加入购物车，<br>在这里慢慢做选择。</p><button class="button button-dark" id="empty-cart-browse">去陈列室看看 ${icon('arrow')}</button></div>`;
  }
  function openCart() { renderCart(); openDialog('cart-dialog'); $('toast').hidden = true; }
  function changeQuantity(id, context, step) {
    if (!catalog.has(id)) return;
    if (context === 'detail' && state.selected === id) {
      state.quantity = clampQuantity(state.quantity + step);
      $('detail-quantity').innerHTML = quantityControl(id, state.quantity, 'detail');
      $('detail-quantity').querySelector(`[data-step="${step}"]`)?.focus({ preventScroll: true });
    } else if (context === 'cart' && state.cart[id]) {
      state.cart[id] = clampQuantity(state.cart[id] + step);
      saveStorage(storageKeys.cart, state.cart); updateCounts(); renderCart();
      $('cart-content').querySelector(`[data-quantity="${id}"][data-step="${step}"]`)?.focus({ preventScroll: true });
    }
  }

  function orderLines(items) {
    return `<ul class="order-lines">${items.map(item => {
      const product = catalog.get(item.id);
      return `<li><span>${product.name}<small>${product.finish} × ${item.quantity}</small></span><strong>${money(product.price * item.quantity)}</strong></li>`;
    }).join('')}</ul><div class="order-total"><span>演示合计</span><strong>${money(items.reduce((sum, item) => sum + catalog.get(item.id).price * item.quantity, 0))}</strong></div>`;
  }
  function previewOrder() {
    const items = cartItems().map(({ id, quantity }) => ({ id, quantity })); if (!items.length) return;
    state.orderPreview = items;
    $('order-content').innerHTML = `<p class="overline">下一件收藏，已经选好了</p><h2 id="order-title">确认你的选择。</h2><p class="order-note">这是一份本地演示订单，不收款、不发货。无需填写个人信息。</p>${orderLines(items)}<button class="button button-dark order-action" id="generate-order">生成演示订单 ${icon('arrow')}</button><button class="text-button" id="back-to-cart">返回购物车</button>`;
    openDialog('order-dialog');
  }
  function showOrder(order, saved = true) {
    const createdAt = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Shanghai' }).format(new Date(order.createdAt));
    $('order-content').innerHTML = `<div class="order-success-icon">${icon('check')}</div><p class="overline">一次完整的独立站购物练习</p><h2 id="order-title">演示订单已生成。</h2><p class="order-note">${saved ? '记录已保存在当前浏览器。' : '当前浏览器未允许保存，可展开并复制下方记录。'}没有支付、发货或真实交易。</p><p class="order-number">${escape(order.number)}<br><small>${escape(createdAt)} · 北京时间</small></p>${orderLines(order.items)}<div class="order-actions"><button class="button button-dark" id="download-order">下载订单记录 ${icon('arrow-up')}</button><button class="text-button" id="finish-order">继续探索模型 ${icon('arrow')}</button></div><details class="order-json"><summary>查看订单数据（JSON）</summary><pre>${escape(JSON.stringify(orderPayload(order), null, 2))}</pre></details>`;
    openDialog('order-dialog');
  }
  function generateOrder() {
    if (!state.orderPreview?.length) return;
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).replace(/-/g, '');
    const random = [...crypto.getRandomValues(new Uint8Array(4))].map(value => '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'[value % 36]).join('');
    const order = { number: `RL-${date}-${random}`, createdAt: new Date().toISOString(), items: state.orderPreview.map(item => ({ ...item })) };
    state.lastOrder = order; state.orderPreview = null;
    const saved = saveStorage(storageKeys.order, order);
    state.cart = {}; saveStorage(storageKeys.cart, state.cart); updateCounts(); renderCart(); showOrder(order, saved);
  }
  function orderPayload(order) {
    return { type: 'local-demo-order', ...order, currency: 'CNY', items: order.items.map(item => ({ ...item, name: catalog.get(item.id).name, unitPrice: catalog.get(item.id).price })), total: order.items.reduce((sum, item) => sum + catalog.get(item.id).price * item.quantity, 0), notice: '独立站练习记录，无真实支付、发货或交易。' };
  }
  function downloadOrder() {
    if (!state.lastOrder) return;
    const order = state.lastOrder;
    const url = URL.createObjectURL(new Blob([JSON.stringify(orderPayload(order), null, 2)], { type: 'application/json;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `${order.number}.json`; link.hidden = true;
    document.body.append(link); link.click(); link.remove();
    const records = $('order-content').querySelector('.order-json');
    if (records) records.open = true;
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  const notes = {
    display: { title: '让第一件模型，成为桌面的主角。', image: 'arc', label: '陈列灵感', paragraphs: [
      ['先减掉背景里的噪声', '挑选一块能看清完整轮廓的地方，把零散的小物收在一起。模型需要的并不是更大的桌面，而是周围的一点空白。'],
      ['用对比，让轮廓出现', '象牙白模型可以搭配深色底板，石墨黑模型可以放在浅色背景前。先看形体是否清楚，再考虑配饰和灯光。'],
      ['从一个视角开始', '坐在你平时的位置观察，调整模型角度，让喜欢的线条进入视线。不要为了摆得满而继续添加；一件模型也能构成一个完整角落。'] ] },
    choose: { title: '从轮廓出发，找到自己的偏好。', image: 'atlas', label: '选品笔记', paragraphs: [
      ['先看整体，再看细节', '暂时忽略名称，只比较长短、曲直与配色。经典长款强调延伸感，紧凑短款更集中，科幻造型则给曲面和色彩留出空间。'],
      ['用收藏清单做比较', '点击商品上的爱心，再打开收藏清单。将感兴趣的造型放在一起，比较它们共有的特征，比逐件判断更容易找到偏好。'],
      ['让陈列空间参与选择', '想一想模型会放在哪里，以及你最常从哪个角度看它。选一个轮廓与空间相处得舒服的造型，再继续寻找下一件。'] ] }
  };
  function openNote(id) {
    const note = notes[id]; if (!note) return;
    $('note-content').innerHTML = `<p class="overline">${note.label} / REPLICA LAB</p><h2 id="note-title">${note.title}</h2><img src="assets/${note.image}.png" alt="${catalog.get(note.image).name} 模型陈列示意" width="1536" height="1024">${note.paragraphs.map(([title, text]) => `<h3>${title}</h3><p>${text}</p>`).join('')}`;
    openDialog('note-dialog');
  }
  function closeMenu() { $('mobile-menu').hidden = true; $('menu-button').setAttribute('aria-expanded', 'false'); $('menu-button').setAttribute('aria-label', '打开导航'); }

  // One delegated click handler covers both the static page and freshly rendered cards.
  document.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.dataset.openProduct) openProduct(button.dataset.openProduct);
    else if (button.dataset.favorite) toggleFavorite(button.dataset.favorite);
    else if (button.dataset.add) addToCart(button.dataset.add);
    else if (button.dataset.addDetail) { addToCart(button.dataset.addDetail, state.quantity); openCart(); }
    else if (button.dataset.close) $(button.dataset.close)?.close();
    else if (button.dataset.quantity) changeQuantity(button.dataset.quantity, button.dataset.context, Number(button.dataset.step));
    else if (button.dataset.remove) {
      delete state.cart[button.dataset.remove]; saveStorage(storageKeys.cart, state.cart); updateCounts(); renderCart();
      $('cart-content').querySelector('button')?.focus({ preventScroll: true });
    } else if (button.dataset.category) { state.category = button.dataset.category; renderProducts(); }
    else if (button.dataset.openNote) openNote(button.dataset.openNote);
    else switch (button.id) {
      case 'cart-button': case 'toast-cart': openCart(); break;
      case 'favorites-button': state.favoritesOnly = true; state.category = 'all'; state.query = ''; $('product-search').value = ''; renderProducts(); scrollToCollection(); break;
      case 'favorite-filter': state.favoritesOnly = !state.favoritesOnly; renderProducts(); break;
      case 'search-button': $('search-row').hidden = false; scrollToCollection(); $('product-search').focus({ preventScroll: true }); break;
      case 'clear-search': $('search-row').hidden = true; state.query = ''; $('product-search').value = ''; renderProducts(); break;
      case 'reset-filters': resetFilters(); break;
      case 'menu-button': { const open = $('mobile-menu').hidden; $('mobile-menu').hidden = !open; button.setAttribute('aria-expanded', String(open)); button.setAttribute('aria-label', open ? '关闭导航' : '打开导航'); break; }
      case 'image-zoom': { const image = $('product-detail').querySelector('.product-detail-image img'); const zoomed = image.classList.toggle('zoomed'); button.setAttribute('aria-pressed', String(zoomed)); button.innerHTML = `${zoomed ? '回到完整视图' : '放大细节'} ${icon(zoomed ? 'minus' : 'plus')}`; break; }
      case 'empty-cart-browse': $('cart-dialog').close(); scrollToCollection(); break;
      case 'checkout-button': previewOrder(); break;
      case 'back-to-cart': openCart(); break;
      case 'generate-order': generateOrder(); break;
      case 'download-order': downloadOrder(); break;
      case 'finish-order': $('order-dialog').close(); scrollToCollection(); break;
      case 'last-order-button': state.lastOrder ? showOrder(state.lastOrder) : showToast('还没有演示订单，先去挑选喜欢的模型。'); break;
      case 'toast-close': $('toast').hidden = true; clearTimeout(toastTimer); break;
    }
  });
  $('sort').addEventListener('change', event => { state.sort = event.target.value; renderProducts(); });
  $('product-search').addEventListener('input', event => { state.query = event.target.value; renderProducts(); });
  $('mobile-menu').addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
  window.addEventListener('hashchange', () => { if (location.hash.startsWith('#product/')) openProduct(location.hash.slice(9)); });

  // Subtle pointer motion, disabled for touch input and reduced-motion preferences.
  if (matchMedia('(pointer: fine) and (prefers-reduced-motion: no-preference)').matches) {
    const stage = $('hero-stage');
    stage.addEventListener('pointermove', event => {
      const rect = stage.getBoundingClientRect();
      stage.style.setProperty('--mx', String(((event.clientX - rect.left) / rect.width - 0.5) * 1.4));
      stage.style.setProperty('--my', String(((event.clientY - rect.top) / rect.height - 0.5) * 1.0));
    });
    stage.addEventListener('pointerleave', () => { stage.style.setProperty('--mx', '0'); stage.style.setProperty('--my', '0'); });
  }
  renderProducts(); renderCart(); updateCounts();
  if (location.hash.startsWith('#product/')) openProduct(location.hash.slice(9));
})();
