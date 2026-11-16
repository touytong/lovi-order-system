// LOVI — สั่งของ page logic
(function () {
  var DRAFT_KEY = 'lovi_order_draft_v1';
  var content = document.getElementById('content');
  var dateChip = document.getElementById('dateChip');
  dateChip.textContent = '🔒 ' + window.LOVI.todayLabel();

  var state = {
    groups: [],         // [{ lineGroup, items: [...] }]
    qty: {},             // name -> qty
    search: '',
    activeCategory: 'ทั้งหมด',
    categories: ['ทั้งหมด'],
    view: 'browse',      // browse | review | result
    note: '',
    result: null
  };

  function allItems() {
    var out = [];
    state.groups.forEach(function (g) { out = out.concat(g.items); });
    return out;
  }

  function restoreDraft() {
    var d = window.LOVI.loadDraft(DRAFT_KEY);
    if (d && d.qty) { state.qty = d.qty; state.note = d.note || ''; }
  }

  function persistDraft() {
    window.LOVI.saveDraft(DRAFT_KEY, { qty: state.qty, note: state.note });
  }

  function setQty(name, qty) {
    if (qty <= 0) { delete state.qty[name]; } else { state.qty[name] = qty; }
    persistDraft();
    render();
  }

  function cartCount() {
    return Object.keys(state.qty).reduce(function (sum, k) { return sum + (state.qty[k] > 0 ? 1 : 0); }, 0);
  }

  function matchesFilter(item) {
    if (state.activeCategory !== 'ทั้งหมด' && item.category !== state.activeCategory) return false;
    if (state.search && item.name.toLowerCase().indexOf(state.search.toLowerCase()) === -1) return false;
    return true;
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function renderBrowse() {
    var cats = ['<div class="chip-row">' + state.categories.map(function (c) {
      return '<button class="chip' + (c === state.activeCategory ? ' active' : '') + '" data-cat="' + escapeHtml(c) + '">' + escapeHtml(c) + '</button>';
    }).join('') + '</div>'];

    var sections = state.groups.map(function (g) {
      var visibleItems = g.items.filter(matchesFilter);
      if (!visibleItems.length) return '';
      var rows = visibleItems.map(function (it) {
        var qty = state.qty[it.name] || 0;
        return '<div class="item-card">' +
          '<div class="item-info"><div class="item-name">' + escapeHtml(it.name) + '</div>' +
          '<div class="item-meta">' + escapeHtml(it.detail || '') + '</div></div>' +
          '<div class="stepper">' +
          '<button data-action="dec" data-name="' + escapeHtml(it.name) + '">−</button>' +
          '<span class="qty">' + qty + ' ' + escapeHtml(it.unit || '') + '</span>' +
          '<button data-action="inc" data-name="' + escapeHtml(it.name) + '">+</button>' +
          '</div></div>';
      }).join('');
      return '<div class="section"><div class="section-title">' + escapeHtml(window.LOVI.stripGroupPrefix(g.lineGroup)) + '</div>' + rows + '</div>';
    }).join('');

    content.innerHTML = cats.join('') +
      '<div class="search-box"><input id="searchInput" placeholder="ค้นหาวัตถุดิบ..." value="' + escapeHtml(state.search) + '"></div>' +
      (sections || '<div class="empty-state">ไม่พบรายการที่ค้นหา</div>') +
      '<div style="height:90px"></div>' +
      '<div class="bottom-bar"><button class="btn-primary" id="reviewBtn" ' +
      (cartCount() ? '' : 'disabled') + '>ดูรายการที่เลือก (' + cartCount() + ')</button></div>';

    document.getElementById('searchInput').addEventListener('input', function (e) {
      state.search = e.target.value; render();
    });
    document.getElementById('reviewBtn').addEventListener('click', function () {
      if (cartCount()) { state.view = 'review'; render(); }
    });
    content.querySelectorAll('.chip').forEach(function (el) {
      el.addEventListener('click', function () { state.activeCategory = el.dataset.cat; render(); });
    });
    content.querySelectorAll('[data-action]').forEach(function (el) {
      el.addEventListener('click', function () {
        var name = el.dataset.name;
        var cur = state.qty[name] || 0;
        setQty(name, el.dataset.action === 'inc' ? cur + 1 : cur - 1);
      });
    });
  }

  function renderReview() {
    var byGroup = {};
    state.groups.forEach(function (g) {
      g.items.forEach(function (it) {
        var qty = state.qty[it.name];
        if (!qty) return;
        if (!byGroup[g.lineGroup]) byGroup[g.lineGroup] = [];
        byGroup[g.lineGroup].push({ item: it, qty: qty });
      });
    });

    var groupsHtml = Object.keys(byGroup).map(function (groupName) {
      var rows = byGroup[groupName].map(function (x) {
        return '<div class="review-row"><span>' + escapeHtml(x.item.name) + '</span><span>' + x.qty + ' ' + escapeHtml(x.item.unit || '') + '</span></div>';
      }).join('');
      return '<div class="review-group"><h3>' + escapeHtml(window.LOVI.stripGroupPrefix(groupName)) + '</h3>' + rows + '</div>';
    }).join('');

    content.innerHTML = '<div style="padding:12px 16px 0"><button class="btn-secondary" id="backBtn" style="margin-bottom:12px">‹ กลับไปแก้รายการ</button></div>' +
      groupsHtml +
      '<div class="review-group"><h3>หมายเหตุ (ถ้ามี)</h3>' +
      '<textarea class="note-input" id="noteInput" rows="2" placeholder="เช่น ของเร่งด่วน, แจ้งเวลาส่ง">' + escapeHtml(state.note) + '</textarea></div>' +
      '<div style="height:90px"></div>' +
      '<div class="bottom-bar"><button class="btn-primary" id="submitBtn">ยืนยันสั่งของ</button></div>';

    document.getElementById('backBtn').addEventListener('click', function () { state.view = 'browse'; render(); });
    document.getElementById('noteInput').addEventListener('input', function (e) { state.note = e.target.value; persistDraft(); });
    document.getElementById('submitBtn').addEventListener('click', submitOrder);
  }

  function renderResult() {
    var r = state.result;
    var ok = r && r.orders && r.orders.every(function (o) { return o.pushed && o.pushed.sent; });
    var lines = (r && r.orders || []).map(function (o) {
      var status = o.pushed && o.pushed.sent ? '✅' : '⚠ ส่ง LINE ไม่สำเร็จ';
      return '<div class="review-row"><span>' + escapeHtml(window.LOVI.stripGroupPrefix(o.group)) + ' — ' + o.orderNo + '</span><span>' + status + '</span></div>';
    }).join('');

    content.innerHTML = '<div class="result-icon">' + (ok ? '✅' : '⚠️') + '</div>' +
      '<div class="result-text">' + (ok ? 'ส่งใบสั่งของสำเร็จ' : 'ส่งใบสั่งของแล้ว แต่มีบางรายการแจ้งเตือนไม่สำเร็จ') + '</div>' +
      '<div class="review-group">' + lines + '</div>' +
      '<div style="padding:0 16px"><button class="btn-primary" id="newOrderBtn">สั่งของรายการใหม่</button></div>';

    document.getElementById('newOrderBtn').addEventListener('click', function () {
      state.qty = {}; state.note = ''; state.view = 'browse'; state.result = null;
      window.LOVI.clearDraft(DRAFT_KEY);
      render();
    });
  }

  function render() {
    if (state.view === 'browse') renderBrowse();
    else if (state.view === 'review') renderReview();
    else if (state.view === 'result') renderResult();
  }

  function submitOrder() {
    var itemsByGroup = {};
    state.groups.forEach(function (g) {
      g.items.forEach(function (it) {
        var qty = state.qty[it.name];
        if (!qty) return;
        if (!itemsByGroup[g.lineGroup]) itemsByGroup[g.lineGroup] = [];
        itemsByGroup[g.lineGroup].push({ name: it.name, unit: it.unit, qty: qty, detail: it.detail, link: it.link });
      });
    });

    document.getElementById('submitBtn').disabled = true;
    document.getElementById('submitBtn').textContent = 'กำลังส่ง...';

    window.LOVI.callApi('submitOrder', { itemsByGroup: itemsByGroup, note: state.note }).then(function (res) {
      if (res.ok) {
        state.result = res.data;
        state.qty = {}; state.note = '';
        window.LOVI.clearDraft(DRAFT_KEY);
        state.view = 'result';
      } else {
        alert('ส่งไม่สำเร็จ: ' + (res.error || 'unknown'));
      }
      render();
    }).catch(function (err) {
      alert('เกิดข้อผิดพลาด: ' + err);
      render();
    });
  }

  window.LOVI.initLiff(window.LOVI_CONFIG.LIFF_ID_ORDER).then(function () {
    return window.LOVI.callApi('getCatalog', {});
  }).then(function (res) {
    if (!res.ok) { content.innerHTML = '<div class="empty-state">โหลดรายการไม่สำเร็จ</div>'; return; }
    state.groups = res.data.groups;
    var catSet = {};
    allItems().forEach(function (it) { if (it.category) catSet[it.category] = true; });
    state.categories = ['ทั้งหมด'].concat(Object.keys(catSet));
    restoreDraft();
    render();
  }).catch(function (err) {
    if (err !== 'redirecting_to_login') {
      content.innerHTML = '<div class="empty-state">เกิดข้อผิดพลาด: ' + escapeHtml(String(err)) + '</div>';
    }
  });
})();
