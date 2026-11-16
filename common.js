// LOVI — shared LIFF helpers

window.LOVI = (function () {
  var cfg = window.LOVI_CONFIG;

  function initLiff(liffId) {
    return liff.init({ liffId: liffId }).then(function () {
      if (!liff.isLoggedIn()) {
        liff.login();
        return Promise.reject('redirecting_to_login');
      }
      return liff.getProfile();
    });
  }

  /** POST to the Apps Script web app. No Content-Type header -> avoids CORS preflight. */
  function callApi(action, payload) {
    var body = Object.assign({ action: action, idToken: liff.getIDToken() }, payload || {});
    return fetch(cfg.API_URL, {
      method: 'POST',
      body: JSON.stringify(body)
    }).then(function (res) { return res.json(); });
  }

  function saveDraft(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) { /* ignore */ }
  }

  function loadDraft(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function clearDraft(key) {
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }

  function todayLabel() {
    var d = new Date();
    var days = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
    return d.getDate() + '/' + (d.getMonth() + 1) + '/' + (d.getFullYear() % 100) +
      ' (' + days[d.getDay()] + ')';
  }

  function stripGroupPrefix(name) {
    return String(name || '').replace(/^สั่งของ\s*/, '');
  }

  return {
    initLiff: initLiff,
    callApi: callApi,
    saveDraft: saveDraft,
    loadDraft: loadDraft,
    clearDraft: clearDraft,
    todayLabel: todayLabel,
    stripGroupPrefix: stripGroupPrefix
  };
})();
