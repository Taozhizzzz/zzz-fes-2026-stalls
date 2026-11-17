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
  const CAMPS = Array.isArray(FES.CAMPS) ? FES.CAMPS : [];
  const AGENT_MAP = (FES.AGENT_MAP && typeof FES.AGENT_MAP === 'object') ? FES.AGENT_MAP : {};

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

  function agentLabel(key) {
    const found = AGENT_MAP[key];
    return found ? found.label : (key || '其他');
  }

  function campOfAgent(key) {
    const found = AGENT_MAP[key];
    return found ? found.campKey : null;
  }

  function campLabel(key) {
    const found = CAMPS.filter(function (c) { return c.key === key; })[0];
    return found ? found.label : (key || '其他');
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

  /**
   * 摊位涉及的角色（去重）。
   * 一件制品可标注多个角色，摊位层面汇总。
   */
  function charactersOf(id) {
    const out = [];
    productsOf(id).forEach(function (p) {
      if (!Array.isArray(p.characters)) return;
      p.characters.forEach(function (c) {
        if (c && out.indexOf(c) === -1) out.push(c);
      });
    });
    return out;
  }

  /** 摊位涉及的角色中有哪些属于「已收录信息」的阵营 */
  function campsOf(id) {
    return uniq(charactersOf(id).map(campOfAgent).filter(Boolean));
  }

  /**
   * 是否属于「其他」：
   *   1) 收录了制品但没有任何角色标注；
   *   2) 标注的角色全部属于「其他」阵营（佩洛伊斯 / 铃 / 哲）。
   * 没有任何数据的摊位是「待补充」，不能算进「其他」，
   * 否则刚上线时点「其他」会把全部空摊位都筛出来。
   */
  function isOtherCategory(id) {
    const known = charactersOf(id).filter(function (c) { return !!AGENT_MAP[c]; });
    if (!known.length) return productsOf(id).length > 0;
    return known.every(function (c) {
      return AGENT_MAP[c].campKey === 'other';
    });
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
    camp: 'ALL',
    agent: 'ALL',
    onlyWish: false
  };

  function matches(stall) {
    if (filter.onlyWish && !isWished(stall.id)) return false;
    if (filter.zone !== 'ALL' && zoneOf(stall.id) !== filter.zone) return false;

    if (filter.camp !== 'ALL') {
      if (filter.camp === 'other') {
        if (!isOtherCategory(stall.id)) return false;
      } else if (campsOf(stall.id).indexOf(filter.camp) === -1) {
        return false;
      }
    }

    if (filter.agent !== 'ALL' && charactersOf(stall.id).indexOf(filter.agent) === -1) {
      return false;
    }

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
      if (Array.isArray(p.characters)) {
        p.characters.forEach(function (c) { bag.push(agentLabel(c)); });
      }
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
    renderCampFilters();
    renderAgentFilters();
    renderList();
  }

  function renderZoneFilters() {
    const box = document.getElementById('zone-filters');
    if (!box) return;

    let html = chipHtml('zone', 'ALL', '全部', '', filter.zone === 'ALL');
    ZONES.forEach(function (z) {
      html += chipHtml('zone', z.key, z.label, '', filter.zone === z.key);
    });
    box.innerHTML = html;
  }

  /* 一级筛选：阵营 */
  function renderCampFilters() {
    const box = document.getElementById('camp-filters');
    if (!box) return;

    let html = chipHtml('camp', 'ALL', '全部阵营', '', filter.camp === 'ALL');
    CAMPS.forEach(function (c) {
      const n = (c.key === 'other')
        ? STALLS.filter(function (s) { return isOtherCategory(s.id); }).length
        : STALLS.filter(function (s) { return campsOf(s.id).indexOf(c.key) !== -1; }).length;

      html += chipHtml('camp', c.key, c.label, n ? String(n) : '', filter.camp === c.key, n === 0);
    });
    box.innerHTML = html;
  }

  /* 二级筛选：角色。只在选中具体阵营后展开 */
  function renderAgentFilters() {
    const box = document.getElementById('agent-filters');
    if (!box) return;

    const camp = CAMPS.filter(function (c) { return c.key === filter.camp; })[0];

    if (!camp || !camp.agents.length) {
      box.innerHTML = '';
      box.hidden = true;
      return;
    }

    box.hidden = false;

    let html = chipHtml('agent', 'ALL', '全部角色', '', filter.agent === 'ALL');
    camp.agents.forEach(function (a) {
      const n = STALLS.filter(function (s) {
        return charactersOf(s.id).indexOf(a.key) !== -1;
      }).length;
      html += chipHtml('agent', a.key, a.label, n ? String(n) : '', filter.agent === a.key, n === 0);
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
    if (filter.agent !== 'ALL') tips.push(esc(agentLabel(filter.agent)));
    else if (filter.camp !== 'ALL') tips.push(esc(campLabel(filter.camp)));
    if (filter.onlyWish) tips.push('我的清单');

    return '<div class="empty">' +
      '<div class="empty-t">没有符合条件的摊位</div>' +
      '<p>' + (tips.length ? '当前筛选：' + tips.join(' · ') : '换个条件再看看') + '</p>' +
      '<button type="button" class="btn" data-reset="1">清除全部筛选</button>' +
      '</div>';
  }

  function cardHtml(s) {
    const st = stateOf(s.id);
    const chars = charactersOf(s.id).slice(0, 3);
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
      (chars.length ? '<span class="mini-types">' +
        chars.map(function (c) { return '<i>' + esc(agentLabel(c)) + '</i>'; }).join('') +
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
        html += '<div class="kv kv-owner"><span class="k">摊主</span><span class="v">' + esc(d.owner) + '</span></div>';
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
      if (!ps.length) {
        html += '<div class="notice notice--card">' +
          '<div class="notice-t">在售制品待补充</div>' +
          '<p>摊主信息已收录，制品清单还在整理中。</p>' +
          '</div>';
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
    const chars = Array.isArray(p.characters) ? p.characters.filter(Boolean) : [];

    const charsHtml = chars.length
      ? chars.map(function (c) {
          return '<span class="ptype">' + esc(agentLabel(c)) + '</span>';
        }).join('')
      : '<span class="ptype">其他</span>';

    return '<article class="product">' +
      '<div class="product-img">' +
      (img
        ? '<img src="' + esc(img) + '" alt="' + esc(p.title) + '" loading="lazy">'
        : '<span class="ph">暂无图片</span>') +
      '</div>' +
      '<div class="product-body">' +
      '<h3>' + esc(p.title) + '</h3>' +
      '<div class="product-meta">' +
      charsHtml +
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

      const camp = e.target.closest('[data-camp]');
      if (camp) {
        filter.camp = camp.getAttribute('data-camp');
        filter.agent = 'ALL';
        renderCampFilters();
        renderAgentFilters();
        renderList();
        return;
      }

      const agent = e.target.closest('[data-agent]');
      if (agent) {
        filter.agent = agent.getAttribute('data-agent');
        renderAgentFilters();
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
    filter.camp = 'ALL';
    filter.agent = 'ALL';
    filter.onlyWish = false;

    const search = document.getElementById('search-input');
    if (search) search.value = '';
    const onlyWish = document.getElementById('only-wish');
    if (onlyWish) onlyWish.checked = false;

    renderZoneFilters();
    renderCampFilters();
    renderAgentFilters();
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
    bindRowWheel();
    route();
  }

  /* 桌面端：鼠标停在筛选行上时，把竖向滚轮转成该行的横向滚动。
     滚到两端后放行，页面恢复正常的竖向滚动。 */
  function bindRowWheel() {
    [].slice.call(document.querySelectorAll('.filter-row')).forEach(function (row) {
      row.addEventListener('wheel', function (e) {
        if (e.deltaY === 0) return;

        // 行模式（部分鼠标/设置）下 deltaY 的单位是行，换算成像素
        const step = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;

        const max = row.scrollWidth - row.clientWidth;
        if (max <= 1) return;
        if (step > 0 && row.scrollLeft >= max - 1) return;
        if (step < 0 && row.scrollLeft <= 0) return;

        e.preventDefault();
        row.scrollLeft += step;
      }, { passive: false });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
