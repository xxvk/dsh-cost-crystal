  function renderSkeleton() {
    root.textContent = '';
    var head = makeEl('div', 'ds-balance-card__head');
    head.appendChild(makeEl('span', 'ds-balance-card__dot'));
    head.appendChild(makeEl('span', null, 'DeepSeek'));
    root.appendChild(head);
    var amtRow = makeEl('div', 'ds-balance-card__amtrow');
    var amtCol = makeEl('div', 'ds-balance-card__amtcol');
    amtCol.appendChild(makeEl('span', 'ds-balance-card__time', ''));
    amtCol.appendChild(makeEl('span', 'ds-balance-card__amtlabel', '余额'));
    amtRow.appendChild(amtCol);
    amtRow.appendChild(makeEl('span', 'ds-balance-card__amt', '…'));
    root.appendChild(amtRow);
  }

  function render(data) {
    root.textContent = '';
    if (!data || data.ok !== true) {
      var reason = data && data.reason === 'no-key' ? '未配置 API key' : '查询失败';
      root.appendChild(makeEl('div', 'ds-balance-card__err', reason));
      return;
    }
    var dot = makeEl('span', 'ds-balance-card__dot');
    var dotTitle = '';
    if (!data.isAvailable) {
      dot.className += ' ds-balance-card__dot--err';
      dotTitle = '账户不可用';
    } else if (data.activity && data.activity.active) {
      dot.className += ' ds-balance-card__dot--active';
      dot.style.animationDuration = pulseDuration(data.activity.tps) + 's';
      dotTitle = '运行中 ' + fmtTps(data.activity.tps) + ' tok/s';
    } else {
      dotTitle = '空闲';
    }
    dot.title = dotTitle;
    var head = makeEl('div', 'ds-balance-card__head');
    head.appendChild(dot);
    var brand = makeEl('span', 'ds-balance-card__brand');
    brand.textContent = 'DeepSeek';
    if (data.activity && data.activity.active) {
      brand.classList.add('ds-balance-card__brand--active');
      brand.style.animationDuration = pulseDuration(data.activity.tps) + 's';
    }
    head.appendChild(brand);
    if (data.source && data.source.provider) {
      var src = makeEl('span', 'ds-balance-card__src', sourceLabel(data.source.provider));
      src.title = '模型: ' + (data.source.model || '?');
      head.appendChild(src);
    }
    if (data.activity) {
      var tpsOn = data.activity.active;
      var tpsNum = makeEl('span', 'ds-balance-card__tpsnum' + (tpsOn ? ' ds-balance-card__tpsnum--on' : ''), fmtTps(tpsValue(data.activity)));
      var rateRow = makeEl('span', 'ds-balance-card__rate' + (tpsOn ? ' ds-balance-card__rate--on' : ''));
      rateRow.appendChild(tpsNum);
      rateRow.appendChild(makeEl('span', null, ' tok/s'));
      rateRow.title = tpsOn ? '运行中 · 实时 ' + fmtTps(data.activity.tps) + ' tok/s' : '空闲 · 速率 0';
      head.appendChild(rateRow);
    }
    var list = pickCurrencies(data.infos);
    var mainCur = list[0] ? list[0].currency : 'CNY';
    var main = fmt(list[0] || { currency: 'CNY', total: '--' });
    var amtRow = makeEl('div', 'ds-balance-card__amtrow');
    var amtCol = makeEl('div', 'ds-balance-card__amtcol');
    var asOf = typeof data.asOf === 'number' ? data.asOf : Date.now();
    var timeEl = makeEl('span', 'ds-balance-card__time', agoText(asOf, Date.now()));
    timeEl.title = '更新于 ' + new Date(asOf).toLocaleTimeString('zh-CN', { hour12: false });
    amtCol.appendChild(timeEl);
    amtCol.appendChild(makeEl('span', 'ds-balance-card__amtlabel', '余额'));
    amtRow.appendChild(amtCol);
    var amtSpan = makeEl('span', 'ds-balance-card__amt', main.sym + main.text);
    var mainInfo = list[0];
    if (mainInfo) {
      var gAmt = fmt({ currency: mainInfo.currency, total: mainInfo.granted });
      var tAmt = fmt({ currency: mainInfo.currency, total: mainInfo.toppedUp });
      amtSpan.title = '充值 ' + tAmt.sym + tAmt.text + ' / 赠送 ' + gAmt.sym + gAmt.text;
    }
    amtRow.appendChild(amtSpan);
    if (data.usage24h) {
      var u = data.usage24h;
      var usage = makeEl('span', 'ds-balance-card__usage', '近24h ' + (mainCur === 'USD' ? usageText(u.usd, 'USD') : (typeof u.cny === 'number' ? '¥' + u.cny.toFixed(2) : usageText(u.usd, 'CNY'))));
          var uparts = [];
    if (u.flatUsd > 0) uparts.push('平峰 $' + u.flatUsd.toFixed(3));
    if (u.peakUsd > 0) uparts.push('波峰 $' + u.peakUsd.toFixed(3));
    if (u.offUsd > 0) uparts.push('低峰 $' + u.offUsd.toFixed(3));
    usage.title = '仅本机 Harness 会话;官方政策价估算' + (uparts.length ? '(' + uparts.join(' / ') + ')' : '') + ' / 调用 ' + u.calls + ' 次\n更新时间 ' + new Date(u.asOf).toLocaleTimeString('zh-CN', { hour12: false });
      amtRow.appendChild(usage);
    }
    root.appendChild(head);
    root.appendChild(amtRow);
    if (data.period) {
      var peak = data.period.mode === 'peak';
      var badge = makeEl('span', 'ds-balance-card__badge ' + (peak ? 'ds-balance-card__badge--peak' : 'ds-balance-card__badge--offpeak'), peak ? '波峰' : '低峰');
      var period = makeEl('div', 'ds-balance-card__period');
      period.title = '波峰时段(本地): ' + localWindows(data.period.windowsUtc);
      period.appendChild(badge);
      period.appendChild(makeEl('span', 'ds-balance-card__next', '下次调整 ' + countdownText(data.period.nextAt) + fmtNextAt(data.period.nextAt)));
      root.appendChild(period);
    }
    root.appendChild(makeEl('div', 'ds-balance-card__divider'));
    if (data.byModel && data.byModel.length > 1) {
      var pm = makeEl('div', 'ds-balance-card__models');
      pm.textContent = data.byModel.map(function (b) {
        return shortModel(b.model) + ' ' + fmtM(b.input + b.cacheRead + b.output) + ' · ' + fmtCost(b.costCny);
      }).join('  ');
      pm.title = data.byModel.map(function (b) {
        return b.model + ': ' + fmtTokens(b.input + b.cacheRead + b.output) + ' tok · ¥' + b.costCny.toFixed(4) + '(' + b.calls + ' 次)';
      }).join('\n');
      root.appendChild(pm);
    }
    var fc = makeEl('div', 'ds-balance-card__forecast');
    var p = data.prediction;
    if (p && p.totalTokens > 0) {
      fc.classList.add('ds-balance-card__forecast--on');
      fc.textContent = '🔮 此次预测 ' + fmtM(p.totalTokens) + ' tok · ';
      fc.appendChild(makeEl('span', 'ds-balance-card__cost', fmtCost(p.costCny)));
      fc.title = '预计输入 ' + fmtTokens(p.predictedInput) + '(含上下文 ' + fmtTokens(p.contextTokens) + ')+ 输出 ' + fmtTokens(p.predictedOutput) + ' · ' + (p.model || '未知模型') + ' 估算\n数据为本地日志估算,仅供参考';
    } else {
      fc.textContent = '🔮';
      fc.title = '预测模块开发中(规划中)';
    }
    root.appendChild(fc);
  }
