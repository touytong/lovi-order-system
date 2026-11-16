// LOVI — รับของ page logic
(function () {
  var content = document.getElementById('content');
  var state = {
    view: 'list',      // list | checklist | result
    orders: [],
    current: null,     // selected order
    checked: {},        // name -> received(bool)
    result: null
  };

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function renderList() {
    if (!state.orders.length) {
      content.innerHTML = '<div class="empty-state">ยังไม่มีใบสั่งของที่รอรับ</div>';
      return;
    }
    content.innerHTML = state.orders.map(function (o) {
      return '<div class="order-card" data-order="' + escapeHtml(o.orderNo) + '">' +
        '<div class="order-no">' + escapeHtml(o.orderNo) + ' · ' + escapeHtml(o.date) + '</div>' +
        '<div class="order-title">' + escapeHtml(window.LOVI.stripGroupPrefix(o.group)) + '</div>' +
        '<div class="item-meta">' + o.items.length + ' รายการ · สั่งโดย ' + escapeHtml(o.orderedBy) + '</div>' +
        '</div>';
    }).join('');
    content.querySelectorAll('.order-card').forEach(function (el) {
      el.addEventListener('click', function () {
        var order = state.orders.filter(function (o) { return o.orderNo === el.dataset.order; })[0];
        openChecklist(order);
      });
    });
  }

  function openChecklist(order) {
    state.current = order;
    state.checked = {};
    order.items.forEach(function (it) { state.checked[it.name] = true; }); // default: รับ
    state.view = 'checklist';
    render();
  }

  function renderChecklist() {
    var o = state.current;
    var rows = o.items.map(function (it) {
      var received = state.checked[it.name];
      return '<div class="checklist-row">' +
        '<div><div class="item-name">' + escapeHtml(it.name) + '</div>' +
        '<div class="item-meta">' + it.qty + ' ' + escapeHtml(it.unit || '') + '</div></div>' +
        '<button class="toggle-btn' + (received ? '' : ' rejected') + '" data-name="' + escapeHtml(it.name) + '">' +
        (received ? 'รับ ✓' : 'ไม่รับ ✕') + '</button></div>';
    }).join('');

    content.innerHTML = '<div style="padding:12px 16px 0"><button class="btn-secondary" id="backBtn">‹ กลับไปรายการ</button></div>' +
      '<div class="order-card"><div class="order-no">' + escapeHtml(o.orderNo) + '</div>' +
      '<div class="order-title">' + escapeHtml(window.LOVI.stripGroupPrefix(o.group)) + '</div>' + rows + '</div>' +
      '<div style="height:90px"></div>' +
      '<div class="bottom-bar"><button class="btn-primary" id="confirmBtn">ยืนยันการรับของ</button></div>';

    document.getElementById('backBtn').addEventListener('click', function () { state.view = 'list'; render(); });
    content.querySelectorAll('.toggle-btn').forEach(function (el) {
      el.addEventListener('click', function () {
        var name = el.dataset.name;
        state.checked[name] = !state.checked[name];
        render();
      });
    });
    document.getElementById('confirmBtn').addEventListener('click', submitReceive);
  }

  function renderResult() {
    var r = state.result;
    var hasIssue = r && r.rejected && r.rejected.length;
    content.innerHTML = '<div class="result-icon">' + (hasIssue ? '⚠️' : '✅') + '</div>' +
      '<div class="result-text">' + (hasIssue ? 'บันทึกแล้ว — มี ' + r.rejected.length + ' รายการไม่รับ (แจ้งกลุ่มแจ้งปัญหาแล้ว)' : 'รับของครบแล้ว') + '</div>' +
      '<div style="padding:0 16px"><button class="btn-primary" id="doneBtn">กลับไปหน้ารายการ</button></div>';
    document.getElementById('doneBtn').addEventListener('click', function () {
      state.view = 'list'; state.result = null;
      loadOrders();
    });
  }

  function render() {
    if (state.view === 'list') renderList();
    else if (state.view === 'checklist') renderChecklist();
    else if (state.view === 'result') renderResult();
  }

  function submitReceive() {
    var o = state.current;
    var items = o.items.map(function (it) { return { name: it.name, received: !!state.checked[it.name] }; });
    document.getElementById('confirmBtn').disabled = true;
    document.getElementById('confirmBtn').textContent = 'กำลังบันทึก...';
    window.LOVI.callApi('submitReceive', { orderNo: o.orderNo, items: items }).then(function (res) {
      if (res.ok) {
        state.result = res.data;
        state.view = 'result';
      } else {
        alert('บันทึกไม่สำเร็จ: ' + (res.error || 'unknown'));
      }
      render();
    }).catch(function (err) {
      alert('เกิดข้อผิดพลาด: ' + err);
      render();
    });
  }

  function loadOrders() {
    content.innerHTML = '<div class="empty-state">กำลังโหลด...</div>';
    window.LOVI.callApi('getPendingOrders', {}).then(function (res) {
      if (!res.ok) { content.innerHTML = '<div class="empty-state">โหลดรายการไม่สำเร็จ</div>'; return; }
      state.orders = res.data.orders;
      render();
    });
  }

  window.LOVI.initLiff(window.LOVI_CONFIG.LIFF_ID_RECEIVE).then(function () {
    loadOrders();
  }).catch(function (err) {
    if (err !== 'redirecting_to_login') {
      content.innerHTML = '<div class="empty-state">เกิดข้อผิดพลาด: ' + String(err) + '</div>';
    }
  });
})();
