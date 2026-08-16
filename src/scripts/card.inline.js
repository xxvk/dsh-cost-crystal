(function () {
  if (window.__dsBalanceInstalled) return;
  window.__dsBalanceInstalled = true;
  var POLL_MS = 10000;
  var TICK_MS = 30000;
  var last = null;
  var STYLE = '.ds-balance-card{position:fixed;top:60px;right:14px;z-index:9999;width:256px;box-sizing:border-box;max-height:240px;overflow:hidden;padding:9px 14px 10px;border-radius:12px;background:rgba(28,30,36,.88);color:#e8eaf0;font:12px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.28);cursor:pointer;user-select:none;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);}' +
    '.ds-balance-card:hover{background:rgba(38,41,48,.92);}.ds-balance-card__head{display:flex;align-items:center;gap:6px;opacity:.75;margin-bottom:2px;white-space:nowrap;}.ds-balance-card__dot{width:7px;height:7px;border-radius:50%;background:#4D6BFE;flex:none;}.ds-balance-card__dot--err{background:#f87171;}' +
    '@keyframes dsCardPulse{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(77,107,254,.45);}50%{opacity:.5;box-shadow:0 0 8px 4px rgba(77,107,254,.22);}}.ds-balance-card__dot--active{animation:dsCardPulse 1.5s ease-in-out infinite;}.ds-balance-card--dragging{cursor:grabbing!important;opacity:.85;user-select:none;}' +
    '.ds-balance-card__rate{font-size:11px;font-weight:600;opacity:.9;white-space:nowrap;margin-left:auto;display:none;}.ds-balance-card__rate--on{display:inline;}.ds-balance-card__tpsnum{font-weight:650;}.ds-balance-card__tpsnum--on{color:#4ade80;}.ds-balance-card__models{font-size:10px;opacity:.7;margin-top:4px;text-align:left;letter-spacing:.2px;}.ds-balance-card__forecast{font-size:11px;opacity:.5;margin-top:4px;text-align:left;letter-spacing:.3px;}.ds-balance-card__forecast--on{opacity:.75;}.ds-balance-card__cost{font-weight:650;color:#fff;}' +
    '.ds-balance-card__time{font-size:9px;font-weight:400;opacity:.4;letter-spacing:.3px;line-height:1;}.ds-balance-card__amt{font-size:17px;font-weight:650;letter-spacing:.2px;}.ds-balance-card__amtlabel{font-size:10.5px;font-weight:400;opacity:.6;letter-spacing:.3px;}.ds-balance-card__src{font-size:10px;opacity:.75;padding:0 5px;border:1px solid rgba(128,128,128,.35);border-radius:999px;white-space:nowrap;}.ds-balance-card__switch{font-size:9px;opacity:.6;cursor:pointer;padding:0 2px;}.ds-balance-card__modelsel{display:inline-flex;align-items:center;gap:2px;cursor:pointer;}' +
    '.ds-balance-card__divider{border-top:1px solid rgba(128,128,128,.22);margin-top:6px;}' +
    '.ds-balance-card__brand{background:linear-gradient(90deg,#4D6BFE 0%,#4D6BFE 40%,#C9D6FF 50%,#4D6BFE 60%,#4D6BFE 100%);color:#0000;-webkit-text-fill-color:transparent;background-position:100% 0;background-size:250% 100%;-webkit-background-clip:text;background-clip:text;}.ds-balance-card__brand--active{animation:dsBrandShimmer 1.8s linear infinite;}@keyframes dsBrandShimmer{to{background-position:0 0}}@media (prefers-reduced-motion:reduce){.ds-balance-card__brand--active{background-position:0 0;background-size:100% 100%;animation:none}}' +
    '.ds-balance-card__period{margin-top:4px;padding-top:4px;border-top:1px solid rgba(128,128,128,.25);display:flex;align-items:center;justify-content:flex-start;gap:6px;flex-wrap:wrap;white-space:nowrap;}.ds-balance-card__badge{font-size:10.5px;font-weight:650;padding:1px 7px;border-radius:999px;letter-spacing:.3px;}.ds-balance-card__badge--peak{background:rgba(251,146,60,.2);color:#fbbf24;border:1px solid rgba(251,146,60,.45);}.ds-balance-card__badge--offpeak{background:rgba(52,211,153,.16);color:#34d399;border:1px solid rgba(52,211,153,.4);}' +
    '.ds-balance-card__next{opacity:.8;font-size:11px;}.ds-balance-card__amtrow{display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;}.ds-balance-card__amtcol{display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-width:0;}.ds-balance-card__usage{font-size:10.5px;font-weight:400;opacity:.72;letter-spacing:.2px;margin-left:auto;}.ds-balance-card__err{color:#fca5a5;font-size:11px;max-width:230px;}' +
    '.ds-balance-card__menu{position:fixed;z-index:10000;min-width:180px;max-width:260px;box-sizing:border-box;background:rgba(28,30,36,.96);color:#e8eaf0;border:1px solid rgba(128,128,128,.3);border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.35);padding:4px;font:12px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);}' +
    '.ds-balance-card__menuitem{font-size:11px;padding:5px 8px;border-radius:6px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
    '.ds-balance-card__menuitem:hover{background:rgba(77,107,254,.22);}' +
    '.ds-balance-card__menuitem--current{color:#4D6BFE;font-weight:600;}' +
    '.ds-balance-card__menuitem--current::before{content:"✓ ";}' +
    'body:not([data-ds-dark-theme]) .ds-balance-card{background:rgba(255,255,255,.95);color:#23262f;box-shadow:0 4px 16px rgba(0,0,0,.12);border:1px solid rgba(0,0,0,.07);}body:not([data-ds-dark-theme]) .ds-balance-card:hover{background:#fff;}body:not([data-ds-dark-theme]) .ds-balance-card__period{border-top-color:rgba(0,0,0,.12);}body:not([data-ds-dark-theme]) .ds-balance-card__divider{border-top-color:rgba(0,0,0,.12);}body:not([data-ds-dark-theme]) .ds-balance-card__badge--peak{background:rgba(251,146,60,.14);color:#b45309;border-color:rgba(180,83,9,.4);}body:not([data-ds-dark-theme]) .ds-balance-card__badge--offpeak{background:rgba(16,185,129,.12);color:#047857;border-color:rgba(4,120,87,.35);}body:not([data-ds-dark-theme]) .ds-balance-card__err{color:#b91c1c;}body:not([data-ds-dark-theme]) .ds-balance-card__cost{color:#000;}' +
    'body:not([data-ds-dark-theme]) .ds-balance-card__menu{background:rgba(255,255,255,.98);color:#23262f;border-color:rgba(0,0,0,.12);}body:not([data-ds-dark-theme]) .ds-balance-card__menuitem:hover{background:rgba(77,107,254,.12);}';
  var styleEl = document.createElement('style');
  styleEl.textContent = STYLE;
  document.head.appendChild(styleEl);

  var root = document.createElement('div');
  root.className = 'ds-balance-card';
  root.title = '点击立即刷新';
  var drag = { mode: false, timer: null, sx: 0, sy: 0, ox: 0, oy: 0, suppress: false };
  function dragDown(e) {
    var rect = root.getBoundingClientRect();
    drag.sx = e.clientX; drag.sy = e.clientY;
    drag.ox = rect.left; drag.oy = rect.top;
    drag.timer = setTimeout(function () {
      drag.mode = true;
      root.classList.add('ds-balance-card--dragging');
    }, 350);
  }
  function dragMove(e) {
    if (!drag.mode) {
      if (drag.timer && (Math.abs(e.clientX - drag.sx) > 6 || Math.abs(e.clientY - drag.sy) > 6)) {
        clearTimeout(drag.timer); drag.timer = null;
      }
      return;
    }
    root.style.right = 'auto';
    root.style.left = (drag.ox + (e.clientX - drag.sx)) + 'px';
    root.style.top = (drag.oy + (e.clientY - drag.sy)) + 'px';
  }
  function dragUp() {
    clearTimeout(drag.timer); drag.timer = null;
    if (drag.mode) {
      drag.mode = false;
      drag.suppress = true;
      root.classList.remove('ds-balance-card--dragging');
      try {
        localStorage.setItem('dsh-balance-card-pos', JSON.stringify({ left: root.style.left, top: root.style.top }));
      } catch (e) {}
    }
  }
  root.addEventListener('pointerdown', dragDown);
  window.addEventListener('pointermove', dragMove);
  window.addEventListener('pointerup', dragUp);
  root.addEventListener('click', function () {
    if (drag.suppress) { drag.suppress = false; return; }
    poll();
  });
  try {
    var savedPos = localStorage.getItem('dsh-balance-card-pos');
    if (savedPos) {
      var pos = JSON.parse(savedPos);
      if (pos && (pos.left || pos.top)) {
        root.style.left = pos.left; root.style.top = pos.top; root.style.right = 'auto';
      }
    }
  } catch (e) {}
  document.body.appendChild(root);

  // CARD_FMT_SLOT
  // CARD_RENDER_SLOT
  function saveCache(data) {
    try { localStorage.setItem('dsh-balance-card-data', JSON.stringify(data)); } catch (e) {}
  }
  function loadCache() {
    try {
      var raw = localStorage.getItem('dsh-balance-card-data');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  var polling = false;
  function poll() {
    if (polling) return;
    polling = true;
    var sid = currentSessionId();
    var qs = '';
    if (sid) qs += '?session=' + encodeURIComponent(sid);
    var model = currentModelFromDom();
    if (model) qs += (qs ? '&' : '?') + 'model=' + encodeURIComponent(model);
    fetch('/ds-balance' + qs, { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) { last = d; saveCache(d); render(d); })
      .catch(function () { polling = false; render({ ok: false, reason: 'http' }); });
    polling = false;
  }

  var POLL_ACTIVITY_MS = 1500;
  var activityPolling = false;
  function pollActivity() {
    if (activityPolling) return;
    activityPolling = true;
    var sid = currentSessionId();
    fetch('/ds-activity' + (sid ? '?session=' + encodeURIComponent(sid) : ''), { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) { activityPolling = false; if (d && d.activity) applyActivity(d.activity); })
      .catch(function () { activityPolling = false; });
  }
  function applyActivity(a) {
    var dot = root.querySelector('.ds-balance-card__dot');
    if (!dot || !a) return;
    var on = !!a.active;
    dot.classList.remove('ds-balance-card__dot--active', 'ds-balance-card__dot--err');
    if (on) {
      dot.classList.add('ds-balance-card__dot--active');
      dot.style.animationDuration = pulseDuration(a.tps) + 's';
      dot.title = '运行中 ' + fmtTps(a.tps) + ' tok/s';
    } else {
      dot.title = '空闲';
    }
    var brand = root.querySelector('.ds-balance-card__brand');
    if (brand) {
      brand.classList.toggle('ds-balance-card__brand--active', on);
      if (on) brand.style.animationDuration = pulseDuration(a.tps) + 's';
    }
    var rate = root.querySelector('.ds-balance-card__rate');
    if (rate) {
      var num = rate.querySelector('.ds-balance-card__tpsnum');
      if (num) {
        num.textContent = fmtTps(tpsValue(a));
        num.classList.toggle('ds-balance-card__tpsnum--on', on);
      }
      rate.classList.toggle('ds-balance-card__rate--on', on);
      rate.title = on ? '运行中 · 实时 ' + fmtTps(a.tps) + ' tok/s' : '空闲 · 速率 0';
    }
  }

  var cached = loadCache();
  if (cached) { last = cached; render(cached); } else { renderSkeleton(); }
  poll();
  setInterval(poll, POLL_MS);
  setInterval(function () { if (last) render(last); }, TICK_MS);
  pollActivity();
  setInterval(pollActivity, POLL_ACTIVITY_MS);
})();
