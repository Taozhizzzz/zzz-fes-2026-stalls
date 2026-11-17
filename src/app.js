/* ============================================================
   绝区零 FES 2026 · 同人摊位查询
   ------------------------------------------------------------
   纯原生 JS，无框架、无构建。加载顺序：
     data/stalls.js -> data/meta.js -> data/details.js -> src/app.js
   数据全部挂在 window.FES 上，所以本地双击 index.html 也能跑。
   ============================================================ */

(function () {
  'use strict';

  const FES = window.FES || {};
  const STALLS = Array.isArray(FES.STALLS) ? FES.STALLS : [];
  const DETAILS = (FES.DETAILS && typeof FES.DETAILS === 'object') ? FES.DETAILS : {};
  const ZONES = Array.isArray(FES.ZONES) ? FES.ZONES : [];
  const TYPES = Array.isArray(FES.TYPES) ? FES.TYPES : [];

  const STORE_KEY = 'fes2026.stalls.wishlist';

  /* ==================== 小工具 ==================== */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function zoneOf(id) {
    return String(id || '').charAt(0);
  }

  function typeLabel(key) {
    for (let i = 0; i < TYPES.length; i++) {
      if (TYPES[i].key === key) return TYPES[i].label;
    }
    return key || '其他';
  }

  function uniq(arr) {
    const out = [];
    for (let i = 0; i < arr.length; i++) {
      if (out.indexOf(arr[i]) === -1) out.push(arr[i]);
    }
    return out;
  }

  /* ==================== 数据派生 ==================== */

  function detailOf(id) {
    const d = DETAILS[id];
    return (d && typeof d === 'object') ? d : null;
  }

  function productsOf(id) {
    const d = detailOf(id);
    if (!d || !Array.isArray(d.products)) return [];
    return d.products.filter(function (p) {
      return p && typeof p === 'object' && String(p.title || '').trim();
    });
  }

  function typesOf(id) {
    return uniq(productsOf(id).map(function (p) { return p.type; }).filter(Boolean));
  }

  function tagsOf(id) {
    const d = detailOf(id);
    return (d && Array.isArray(d.tags)) ? d.tags.filter(Boolean) : [];
  }

  function linksOf(id) {
    const d = detailOf(id);
    if (!d) return [];
    const raw = Array.isArray(d.xhs) ? d.xhs : (d.xhs ? [d.xhs] : []);
    return raw.filter(function (u) { return typeof u === 'string' && u.trim(); });
  }

  /**
   * 三档状态：
   *   empty   —— 没有任何条目，待补充
   *   partial —— 有摊主信息但还没录到制品
   *   done    —— 至少收录了一件制品
   */
  function stateOf(id) {
    const d = detailOf(id);
    if (!d) return 'empty';
    return productsOf(id).length ? 'done' : 'partial';
  }

  const STATE_TEXT = { empty: '待补充', partial: '部分收录', done: '已收录' };

  function priceText(p) {
    if (p.price != null && p.price !== '' && isFinite(Number(p.price))) {
      return '¥' + Number(p.price);
    }
    if (p.priceText) return String(p.priceText);
    return '';
  }

  /* ==================== 收藏（localStorage） ==================== */

  let wishlist = loadWishlist();

  function loadWishlist() {
    try {
      const raw = window.localStorage.getItem(STORE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return [];
      return arr.filter(function (x) { return typeof x === 'string' && x; });
    } catch (e) {
      return [];
    }
  }

  function saveWishlist() {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(wishlist));
    } catch (e) {
      /* 隐私模式等场景下静默失败，不影响浏览 */
    }
  }

  function isWished(id) {
    return wishlist.indexOf(id) !== -1;
  }

  function toggleWish(id) {
    const i = wishlist.indexOf(id);
    if (i === -1) wishlist.push(id); else wishlist.splice(i, 1);
    saveWishlist();
    syncWishButtons();
    updateStats();
    if (currentView === 'wishlist') renderWishlist();
  }

  /* ==================== 筛选状态 ==================== */

  const filter = {
    query: '',
    zone: 'ALL',
    type: 'ALL',
    onlyWish: false
  };

  function matches(stall) {
    if (filter.onlyWish && !isWished(stall.id)) return false;
    if (filter.zone !== 'ALL' && zoneOf(stall.id) !== filter.zone) return false;
    if (filter.type !== 'ALL' && typesOf(stall.id).indexOf(filter.type) === -1) return false;

    const q = filter.query.trim().toLowerCase();
    if (!q) return true;

    const bag = [stall.id, stall.name];
    const d = detailOf(stall.id);
    if (d) {
      if (d.owner) bag.push(d.owner);
      if (d.note) bag.push(d.note);
      if (Array.isArray(d.tags)) bag.push(d.tags.join(' '));
    }
    productsOf(stall.id).forEach(function (p) {
      bag.push(p.title || '');
      bag.push(p.desc || '');
      bag.push(typeLabel(p.type));
    });
    return bag.join(' ').toLowerCase().indexOf(q) !== -1;
  }

  /* ==================== 统计 ==================== */

  function updateStats() {
    let done = 0;
    STALLS.forEach(function (s) { if (stateOf(s.id) === 'done') done++; });
    const total = STALLS.length;

    setText('stat-total', total);
    setText('stat-done', done);
    setText('stat-todo', total - done);
    setText('stat-wish', wishlist.length);
  }

  function setText(id, v) {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  }

  /* ==================== 渲染：主页 ==================== */

  function renderHome() {
    updateStats();
    renderZoneFilters();
    renderTypeFilters();
    renderList();
  }

  function renderZoneFilters() {
    const box = document.getElementById('zone-filters');
    if (!box) return;

    let html = chipHtml('zone', 'ALL', '全部', '', filter.zone === 'ALL');
    ZONES.forEach(function (z) {
      const total = STALLS.filter(function (s) { return zoneOf(s.id) === z.key; }).length;
      const done = STALLS.filter(function (s) {
        return zoneOf(s.id) === z.key && stateOf(s.id) === 'done';
      }).length;
      html += chipHtml('zone', z.key, z.label, done + '/' + total, filter.zone === z.key);
    });
    box.innerHTML = html;
  }

  function renderTypeFilters() {
    const box = document.getElementById('type-filters');
    if (!box) return;

    let html = chipHtml('type', 'ALL', '全部类型', '', filter.type === 'ALL');
    TYPES.forEach(function (t) {
      const n = STALLS.filter(function (s) {
        return typesOf(s.id).indexOf(t.key) !== -1;
      }).length;
      html += chipHtml('type', t.key, t.label, n ? String(n) : '', filter.type === t.key, n === 0);
    });
    box.innerHTML = html;
  }

  function chipHtml(kind, value, label, count, active, dim) {
    return '<button type="button" class="chip' + (active ? ' active' : '') + (dim ? ' dim' : '') +
      '" data-' + kind + '="' + esc(value) + '">' + esc(label) +
      (count ? '<span class="chip-n">' + esc(count) + '</span>' : '') + '</button>';
  }

  function renderList() {
    const box = document.getElementById('list');
    if (!box) return;

    const visible = STALLS.filter(matches);
    if (!visible.length) {
      box.innerHTML = emptyStateHtml();
      return;
    }

    let html = '';
    ZONES.forEach(function (z) {
      const list = visible.filter(function (s) { return zoneOf(s.id) === z.key; });
      if (!list.length) return;

      const total = STALLS.filter(function (s) { return zoneOf(s.id) === z.key; }).length;
      const done = STALLS.filter(function (s) {
        return zoneOf(s.id) === z.key && stateOf(s.id) === 'done';
      }).length;

      html += '<section class="zone-block">' +
        '<div class="zone-head">' +
        '<span class="zone-badge">' + esc(z.key) + '</span>' +
        '<h2>' + esc(z.label) + '</h2>' +
        '<span class="zone-count">已收录 ' + done + ' / ' + total + '</span>' +
        '</div><div class="stall-grid">' +
        list.map(cardHtml).join('') +
        '</div></section>';
    });
    box.innerHTML = html;
  }

  function emptyStateHtml() {
    const tips = [];
    if (filter.query) tips.push('搜索词「' + esc(filter.query) + '」');
    if (filter.zone !== 'ALL') tips.push(esc(filter.zone) + ' 区');
    if (filter.type !== 'ALL') tips.push(esc(typeLabel(filter.type)));
    if (filter.onlyWish) tips.push('我的清单');

    return '<div class="empty">' +
      '<div class="empty-t">没有符合条件的摊位</div>' +
      '<p>' + (tips.length ? '当前筛选：' + tips.join(' · ') : '换个条件再看看') + '</p>' +
      '<button type="button" class="btn" data-reset="1">清除全部筛选</button>' +
      '</div>';
  }

  function cardHtml(s) {
    const st = stateOf(s.id);
    const types = typesOf(s.id).slice(0, 3);
    const wished = isWished(s.id);
    const owner = detailOf(s.id) && detailOf(s.id).owner ? detailOf(s.id).owner : '';

    return '<a class="stall-card" href="#/stall/' + encodeURIComponent(s.id) + '" data-id="' + esc(s.id) + '">' +
      '<div class="card-top">' +
      '<span class="stall-no">' + esc(s.id) + '</span>' +
      wishBtnHtml(s.id, wished, true) +
      '</div>' +
      '<div class="stall-name">' + esc(s.name) + '</div>' +
      (owner ? '<div class="stall-owner">' + esc(owner) + '</div>' : '') +
      '<div class="card-bottom">' +
      '<span class="state state-' + st + '">' + esc(STATE_TEXT[st]) + '</span>' +
      (types.length ? '<span class="mini-types">' +
        types.map(function (t) { return '<i>' + esc(typeLabel(t)) + '</i>'; }).join('') +
        '</span>' : '') +
      '</div>' +
      '</a>';
  }

  /**
   * 星标按钮。三种形态：
   *   compact —— 卡片右上角，只显示星形图标
   *   wide    —— 详情页，显示「☆ 加入清单 / ★ 已在清单」文字
   *   默认    —— 清单页行内，星形图标
   */
  function wishBtnHtml(id, wished, compact, wide) {
    let cls = 'wish-btn';
    if (wished) cls += ' on';
    if (compact) cls += ' compact';
    if (wide) cls += ' wide';

    const label = wished ? '从清单移除' : '加入清单';
    const inner = wide
      ? (wished ? '★ 已在清单' : '☆ 加入清单')
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.6l2.6 5.3 5.9.9-4.3 4.2 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.8l5.9-.9z"/></svg>';

    return '<span class="' + cls + '" role="button" tabindex="0" data-wish="' + esc(id) + '"' +
      ' aria-pressed="' + (wished ? 'true' : 'false') + '"' +
      ' aria-label="' + label + '" title="' + label + '">' + inner + '</span>';
  }

  function syncWishButtons() {
    const btns = document.querySelectorAll('[data-wish]');
    for (let i = 0; i < btns.length; i++) {
      const id = btns[i].getAttribute('data-wish');
      const on = isWished(id);
      btns[i].classList.toggle('on', on);
      btns[i].setAttribute('aria-pressed', on ? 'true' : 'false');
      btns[i].setAttribute('aria-label', on ? '从清单移除' : '加入清单');
      btns[i].setAttribute('title', on ? '从清单移除' : '加入清单');
      if (btns[i].classList.contains('wide')) {
        btns[i].innerHTML = on ? '★ 已在清单' : '☆ 加入清单';
      }
    }
  }

  /* ==================== 渲染：摊位详情 ==================== */

  function renderDetail(id) {
    const view = document.getElementById('view-detail');
    if (!view) return;

    const idx = STALLS.findIndex(function (s) { return s.id === id; });
    if (idx === -1) {
      view.innerHTML = '<a class="back" href="#/">← 返回列表</a>' +
        '<div class="empty"><div class="empty-t">没有这个摊位</div>' +
        '<p>摊位编号「' + esc(id) + '」不在官方名单中。</p></div>';
      return;
    }

    const s = STALLS[idx];
    const st = stateOf(id);
    const d = detailOf(id);
    const ps = productsOf(id);
    const links = linksOf(id);
    const tags = tagsOf(id);
    const prev = STALLS[idx - 1];
    const next = STALLS[idx + 1];

    let html = '<a class="back" href="#/">← 返回列表</a>';

    html += '<div class="detail-head">' +
      '<div class="detail-no">' + esc(s.id) + ' · ' + esc(zoneOf(s.id)) + ' 区</div>' +
      '<h1>' + esc(s.name) + '</h1>' +
      '<div class="detail-badges">' +
      '<span class="state state-' + st + '">' + esc(STATE_TEXT[st]) + '</span>' +
      tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') +
      '</div>' +
      '</div>';

    html += '<div class="detail-actions">' +
      wishBtnHtml(id, isWished(id), false, true) +
      '</div>';

    if (st === 'empty') {
      html += '<div class="notice">' +
        '<div class="notice-t">这个摊位的信息还在补充中</div>' +
        '<p>官方名单只公布摊位编号与名称。摊主、在售制品与小道消息需要从摊主的公开发布内容整理，收到后会第一时间更新到这里。</p>' +
        '</div>';
    } else {
      if (d.owner) {
        html += '<div class="kv"><span class="k">摊主</span><span class="v">' + esc(d.owner) + '</span></div>';
      }
      if (links.length) {
        html += '<div class="kv"><span class="k">小红书</span><span class="v">' +
          links.map(function (u, i) {
            return '<a class="link" href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' +
              (links.length > 1 ? '主页 ' + (i + 1) : '查看主页') + '</a>';
          }).join('') + '</span></div>';
      }
      if (d.note) {
        html += '<div class="kv"><span class="k">备注</span><span class="v">' + esc(d.note) + '</span></div>';
      }
      if (d.updatedAt) {
        html += '<div class="kv"><span class="k">更新</span><span class="v muted">' + esc(d.updatedAt) + '</span></div>';
      }
    }

    if (ps.length) {
      html += '<h2 class="section-title">在售制品 <span class="count">' + ps.length + '</span></h2>' +
        '<div class="product-grid">' + ps.map(productHtml).join('') + '</div>';
    }

    html += '<nav class="pager">' +
      (prev ? '<a class="pager-link" href="#/stall/' + encodeURIComponent(prev.id) + '">' +
        '<span class="pager-dir">← 上一个</span><span class="pager-name">' + esc(prev.id) + ' ' + esc(prev.name) + '</span></a>'
        : '<span class="pager-link placeholder"></span>') +
      (next ? '<a class="pager-link next" href="#/stall/' + encodeURIComponent(next.id) + '">' +
        '<span class="pager-dir">下一个 →</span><span class="pager-name">' + esc(next.id) + ' ' + esc(next.name) + '</span></a>'
        : '<span class="pager-link placeholder"></span>') +
      '</nav>';

    view.innerHTML = html;
  }

  function productHtml(p) {
    const img = (Array.isArray(p.images) ? p.images : []).filter(Boolean)[0];
    const price = priceText(p);

    return '<article class="product">' +
      '<div class="product-img">' +
      (img
        ? '<img src="' + esc(img) + '" alt="' + esc(p.title) + '" loading="lazy">'
        : '<span class="ph">暂无图片</span>') +
      '</div>' +
      '<div class="product-body">' +
      '<h3>' + esc(p.title) + '</h3>' +
      '<div class="product-meta">' +
      '<span class="ptype">' + esc(typeLabel(p.type)) + '</span>' +
      (price ? '<span class="pprice">' + esc(price) + '</span>' : '') +
      '</div>' +
      (p.desc ? '<p class="product-desc">' + esc(p.desc) + '</p>' : '') +
      '</div>' +
      '</article>';
  }

  /* ==================== 渲染：我的清单 ==================== */

  function renderWishlist() {
    const view = document.getElementById('view-wishlist');
    if (!view) return;

    const ids = wishlist.filter(function (id) {
      return STALLS.some(function (s) { return s.id === id; });
    });

    let html = '<a class="back" href="#/">← 返回列表</a>' +
      '<div class="detail-head"><div class="detail-no">WISHLIST</div>' +
      '<h1>我的逛展清单</h1>' +
      '<p class="sub">' + (ids.length ? '已收藏 ' + ids.length + ' 个摊位，按区域顺序排列，方便现场按路线走。' : '还没有收藏任何摊位。') + '</p>' +
      '</div>';

    if (!ids.length) {
      html += '<div class="empty"><div class="empty-t">清单是空的</div>' +
        '<p>在摊位卡片或详情页点右侧的星标，就能把它加进来。</p>' +
        '<a class="btn" href="#/">去逛摊位</a></div>';
      view.innerHTML = html;
      return;
    }

    const sorted = ids.slice().sort(function (a, b) { return a < b ? -1 : a > b ? 1 : 0; });

    html += '<ol class="wishlist">' + sorted.map(function (id) {
      const s = STALLS.filter(function (x) { return x.id === id; })[0];
      const ps = productsOf(id);
      return '<li><a class="wish-row" href="#/stall/' + encodeURIComponent(id) + '">' +
        '<span class="stall-no">' + esc(id) + '</span>' +
        '<span class="wish-name">' + esc(s.name) + '</span>' +
        '<span class="wish-meta">' + (ps.length ? ps.length + ' 件制品' : STATE_TEXT[stateOf(id)]) + '</span>' +
        wishBtnHtml(id, true, true) +
        '</a></li>';
    }).join('') + '</ol>';

    html += '<p class="hint">清单只保存在这台设备的浏览器里，不会上传，也不需要登录。</p>';

    view.innerHTML = html;
  }

  /* ==================== 路由 ==================== */

  const views = {};
  let currentView = 'home';

  function showView(name) {
    Object.keys(views).forEach(function (k) {
      if (views[k]) views[k].hidden = (k !== name);
    });
    currentView = name;
  }

  function route() {
    const hash = window.location.hash || '';

    if (hash.indexOf('#/stall/') === 0) {
      const id = decodeURIComponent(hash.slice(8)).toUpperCase();
      showView('detail');
      renderDetail(id);
    } else if (hash === '#/wishlist') {
      showView('wishlist');
      renderWishlist();
    } else {
      showView('home');
      renderHome();
    }

    window.scrollTo(0, 0);
  }

  /* ==================== 图片放大 ==================== */

  function openLightbox(src, alt) {
    const lb = document.getElementById('lightbox');
    const img = document.getElementById('lb-img');
    if (!lb || !img) return;
    img.src = src;
    img.alt = alt || '';
    lb.hidden = false;
    document.body.classList.add('locked');
  }

  function closeLightbox() {
    const lb = document.getElementById('lightbox');
    const img = document.getElementById('lb-img');
    if (!lb) return;
    lb.hidden = true;
    if (img) img.src = '';
    document.body.classList.remove('locked');
  }

  /* ==================== 事件 ==================== */

  function bind() {
    document.addEventListener('click', function (e) {
      const wish = e.target.closest('[data-wish]');
      if (wish) {
        e.preventDefault();
        e.stopPropagation();
        toggleWish(wish.getAttribute('data-wish'));
        return;
      }

      const zone = e.target.closest('[data-zone]');
      if (zone) {
        filter.zone = zone.getAttribute('data-zone');
        renderZoneFilters();
        renderList();
        return;
      }

      const type = e.target.closest('[data-type]');
      if (type) {
        filter.type = type.getAttribute('data-type');
        renderTypeFilters();
        renderList();
        return;
      }

      const reset = e.target.closest('[data-reset]');
      if (reset) {
        resetFilters();
        return;
      }

      const shot = e.target.closest('.product-img img');
      if (shot) {
        openLightbox(shot.getAttribute('src'), shot.getAttribute('alt'));
        return;
      }

      if (e.target.closest('#lightbox')) {
        closeLightbox();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeLightbox();
      if ((e.key === 'Enter' || e.key === ' ') && document.activeElement &&
        document.activeElement.hasAttribute('data-wish')) {
        e.preventDefault();
        toggleWish(document.activeElement.getAttribute('data-wish'));
      }
    });

    const search = document.getElementById('search-input');
    if (search) {
      search.addEventListener('input', function () {
        filter.query = search.value;
        renderList();
      });
    }

    const onlyWish = document.getElementById('only-wish');
    if (onlyWish) {
      onlyWish.addEventListener('change', function () {
        filter.onlyWish = onlyWish.checked;
        renderList();
      });
    }

    const clear = document.getElementById('search-clear');
    if (clear) {
      clear.addEventListener('click', function () {
        if (search) search.value = '';
        filter.query = '';
        renderList();
      });
    }

    window.addEventListener('hashchange', route);
  }

  function resetFilters() {
    filter.query = '';
    filter.zone = 'ALL';
    filter.type = 'ALL';
    filter.onlyWish = false;

    const search = document.getElementById('search-input');
    if (search) search.value = '';
    const onlyWish = document.getElementById('only-wish');
    if (onlyWish) onlyWish.checked = false;

    renderZoneFilters();
    renderTypeFilters();
    renderList();
  }

  /* ==================== 启动 ==================== */

  function init() {
    views.home = document.getElementById('view-home');
    views.detail = document.getElementById('view-detail');
    views.wishlist = document.getElementById('view-wishlist');

    if (!STALLS.length) {
      const box = document.getElementById('list');
      if (box) {
        box.innerHTML = '<div class="empty"><div class="empty-t">没有读到摊位名单</div>' +
          '<p>请确认 data/stalls.js 已正确加载。</p></div>';
      }
      return;
    }

    bind();
    route();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
