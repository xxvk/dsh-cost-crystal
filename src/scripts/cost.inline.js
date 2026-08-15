(function () {
  if (window.__dsSessionCostInstalled) return;
  window.__dsSessionCostInstalled = true;
  var DATA_POLL = 30000;
  var DOM_POLL = 2000;
  var cost = null;

  function currentSessionId() {
    try {
      var raw = localStorage.getItem('dsh.sessions.current');
      if (!raw) return null;
      var o = JSON.parse(raw);
      return (o && o.sessionId) || null;
    } catch (e) { return null; }
  }

  function refresh() {
    var sid = currentSessionId();
    if (!sid) return;
    fetch('/ds-session-cost?session=' + encodeURIComponent(sid), { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.ok) { cost = d; saveCostCache(d); } })
      .catch(function () {});
  }

  function findStatsDiv() {
    // 统计条特征: 含「首 token」或「缓存命中」等专属文案,且子 span 较多
    // (分组文本 + 分隔符);按 document 逆序查找(统计条位于页面底部)。
    var divs = document.querySelectorAll('div');
    for (var i = divs.length - 1; i >= 0; i--) {
      var el = divs[i];
      if (el.className && String(el.className).indexOf('ds-') === 0) continue;
      var txt = el.textContent || '';
      if (txt.length < 20 || txt.length > 600) continue;
      var distinctive = txt.indexOf('首 token') !== -1 || txt.indexOf('缓存命中') !== -1;
      if (!distinctive) continue;
      if (el.querySelectorAll('span').length < 4) continue;
      return el;
    }
    return null;
  }

  function applyCost() {
    if (!cost) return;
    var el = findStatsDiv();
    if (!el) return;
    if (el.querySelector('.ds-session-cost')) return;
    var sep = document.createElement('span');
    sep.textContent = ' | ';
    sep.className = 'ds-session-cost-sep';
    var span = document.createElement('span');
    span.className = 'ds-session-cost';
    var parts = [];
    if (cost.flatUsd > 0) parts.push('平峰 $' + cost.flatUsd.toFixed(3));
    if (cost.peakUsd > 0) parts.push('波峰 $' + cost.peakUsd.toFixed(3));
    if (cost.offUsd > 0) parts.push('低峰 $' + cost.offUsd.toFixed(3));
    span.title = '本对话费用:官方政策价' + (parts.length ? '(' + parts.join(' / ') + ')' : '') + ',共 ' + cost.calls + ' 次调用;仅统计本机会话';
    span.textContent = '费用 ≈ ¥' + (typeof cost.cny === 'number' ? cost.cny : cost.usd * 7.1).toFixed(2) + '($' + cost.usd.toFixed(2) + ')';
    el.appendChild(sep);
    el.appendChild(span);
  }

  function saveCostCache(d) {
    try { localStorage.setItem('dsh-session-cost-data', JSON.stringify(d)); } catch (e) {}
  }
  function loadCostCache() {
    try {
      var raw = localStorage.getItem('dsh-session-cost-data');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }
  var cc = loadCostCache();
  if (cc && cc.ok) { cost = cc; applyCost(); }
  refresh();
  setInterval(refresh, DATA_POLL);
  setInterval(applyCost, DOM_POLL);
})();
