  function makeEl(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function fmt(b) {
    var sym = b.currency === 'CNY' ? '¥' : b.currency === 'USD' ? '$' : b.currency + ' ';
    var n = Number(b.total);
    return { sym: sym, text: isFinite(n) ? n.toFixed(2) : String(b.total) };
  }

  function countdownText(ms) {
    var total = Math.max(0, Math.floor((ms - Date.now()) / 60000));
    var h = Math.floor(total / 60), m = total % 60;
    if (h <= 0 && m <= 0) return '即将调整';
    return h > 0 ? h + '小时' + m + '分' : m + '分';
  }

  function fmtNextAt(ts, now) {
    var d = new Date(ts);
    var n = now === undefined ? new Date() : new Date(now);
    var dayStart = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
    var nextStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    var diff = Math.round((nextStart - dayStart) / 86400000);
    var label = diff === 0 ? '今日' : diff === 1 ? '明日' : (d.getMonth() + 1) + '月' + d.getDate() + '日';
    var h = d.getHours();
    var ampm = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12 || 12;
    var mm = String(d.getMinutes()).padStart(2, '0');
    return '(' + label + h12 + ':' + mm + ampm + ')';
  }

  function localWindows(windowsUtc) {
    // 把 UTC 波峰窗口换算成本地时间显示(如 "10:00-13:00, 15:00-19:00")
    var offsetMin = new Date().getTimezoneOffset(); // 本地→UTC 需加的分(UTC+9 为 -540)
    var parts = [];
    (windowsUtc || []).forEach(function (w) {
      var a = ((w[0] - offsetMin / 60) % 24 + 24) % 24;
      var b = ((w[1] - offsetMin / 60) % 24 + 24) % 24;
      var z = function (h) { return String(Math.floor(h)).padStart(2, '0') + ':' + String(Math.round((h % 1) * 60)).padStart(2, '0'); };
      parts.push(z(a) + '-' + z(b));
    });
    return parts.join(', ');
  }

  function pickCurrencies(infos) {
    // 只显示有余额的币种;两个都有余额时 USD 优先;都无余额时保留全部(显示 0)
    var withBalance = (infos || []).filter(function (b) { return Number(b.total) > 0; });
    if (withBalance.length === 0) return infos || [];
    withBalance.sort(function (a, b) {
      if (a.currency === 'USD') return -1;
      if (b.currency === 'USD') return 1;
      return 0;
    });
    return withBalance;
  }

  function usageText(usd, currency) {
    // 近24h 只显示一种货币:跟随主余额币种(USD 原样,其余按汇率换算人民币)
    if (currency === 'USD') return '$' + usd.toFixed(2);
    return '¥' + (usd * 7.1).toFixed(2);
  }

  function sourceLabel(provider) {
    // 模型来源:官方 API 显示中文,其它(网关/OpenRouter/本机路由)显示路由名
    if (provider === 'deepseek-official') return '官方 API';
    return provider;
  }

  function pulseDuration(tps) {
    // 呼吸灯脉动频率按 tok/s 分级:越快越短
    if (tps >= 300) return 0.6;
    if (tps >= 100) return 1.0;
    if (tps >= 20) return 1.6;
    return 2.4;
  }

  function currentSessionId() {
    try {
      var raw = localStorage.getItem('dsh.sessions.current');
      if (!raw) return null;
      var o = JSON.parse(raw);
      return (o && o.sessionId) || null;
    } catch (e) { return null; }
  }

  function tpsValue(activity) {
    // 有消耗显示实时 tps;空闲(或过期)清 0,不保留过期值
    if (!activity || !activity.active) return 0;
    return activity.tps;
  }

  function agoText(ts, now) {
    var s = Math.max(0, Math.round((now - ts) / 1000));
    if (s < 10) return '刚刚';
    if (s < 60) return s + 's前';
    var m = Math.round(s / 60);
    if (m < 60) return m + 'm前';
    var h = Math.round(m / 60);
    if (h < 24) return h + 'h前';
    return Math.round(h / 24) + 'd前';
  }

  function fmtTokens(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return String(n);
  }

  function fmtCost(cny) {
    if (!isFinite(cny) || cny <= 0) return '¥0';
    if (cny >= 1) return '¥' + cny.toFixed(2);
    if (cny >= 0.01) return '¥' + cny.toFixed(3);
    return '¥' + cny.toFixed(4);
  }

  function fmtM(n) {
    var m = Math.max(n, 100000) / 1000000;
    return m >= 1 ? Math.round(m) + 'M' : m.toFixed(1) + 'M';
  }

  function modelKeyFromLabel(label) {
    if (!label) return null;
    var t = String(label).toLowerCase().replace(/[^a-z0-9]/g, '');
    var keys = ['deepseek-v4-flash', 'deepseek-v4-pro', 'deepseek-reasoner', 'deepseek-chat'];
    for (var i = 0; i < keys.length; i++) if (t.indexOf(keys[i].replace(/-/g, '')) !== -1) return keys[i];
    return null;
  }
  function currentModelFromDom() {
    try { var el = document.querySelector('.gTaGEG_trigger'); return el ? modelKeyFromLabel(el.textContent) : null; }
    catch (e) { return null; }
  }

  function fmtTps(n) { return String(Math.round(Number(n) || 0)); }
