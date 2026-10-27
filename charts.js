// Buzz charts: tiny line chart and expected-vs-actual bars, drawn as SVG from REAL data saved by the build
// (see scripts/lib/series.mjs). Nothing here makes up numbers. All text goes in with textContent.
// Styling lives in styles.css (classes), because the page's security rules do not allow inline styles.
(function (root) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function svg(tag, attrs) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, String(attrs[k])); });
    return n;
  }
  function html(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function httpsUrl(v) { try { var u = new URL(v); return u.protocol === 'https:' ? u.toString() : null; } catch (e) { return null; } }

  function dateLabel(d) {
    var m = /^(\d{4})-(\d{2})$/.exec(d);
    return m ? MONTHS[Number(m[2]) - 1] + ' ' + m[1] : String(d);
  }

  function num(v) {
    var a = Math.abs(v);
    var s = a >= 1000 ? Math.round(v).toLocaleString('en-US') : a >= 100 ? String(Math.round(v * 10) / 10) : String(Math.round(v * 100) / 100);
    return s;
  }

  function withUnit(v, unit) {
    if (unit === '%') return num(v) + '%';
    if (!unit || unit === 'index points') return num(v);
    return num(v) + ' ' + unit;
  }

  // A friendly axis range: three tidy ticks that cover the data.
  function niceRange(min, max) {
    if (min === max) { min -= 1; max += 1; }
    var span = max - min;
    var step = Math.pow(10, Math.floor(Math.log(span / 3) / Math.LN10));
    [1, 2, 2.5, 5, 10].some(function (m) { if (span / (step * m) <= 4) { step *= m; return true; } return false; });
    var lo = Math.floor(min / step) * step;
    var hi = Math.ceil(max / step) * step;
    var ticks = [];
    for (var t = lo; t <= hi + step / 2; t += step) ticks.push(Math.round(t * 1e6) / 1e6);
    return { lo: lo, hi: hi, ticks: ticks };
  }

  function validPoints(series) {
    var pts = (series && Array.isArray(series.points) ? series.points : []).filter(function (p) {
      return Array.isArray(p) && typeof p[0] === 'string' && typeof p[1] === 'number' && isFinite(p[1]);
    });
    return pts.length >= 3 ? pts : null;
  }

  function line(series, note) {
    var pts = validPoints(series);
    if (!pts) return null;
    var W = 340, H = 200, L = 46, R = 16, T = 14, B = 30;
    var vals = pts.map(function (p) { return p[1]; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    var range = niceRange(min, max);
    var x = function (i) { return L + (i / (pts.length - 1)) * (W - L - R); };
    var y = function (v) { return T + (1 - (v - range.lo) / (range.hi - range.lo)) * (H - T - B); };

    var fig = html('figure', 'chart');
    fig.appendChild(html('h4', 'chart-title', String(series.title || 'Chart')));

    var hi = pts[0], lo = pts[0];
    pts.forEach(function (p) { if (p[1] > hi[1]) hi = p; if (p[1] < lo[1]) lo = p; });
    var last = pts[pts.length - 1];
    var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'class': 'chart-svg', focusable: 'false' });
    s.setAttribute('aria-label', String(series.title) + '. Latest ' + withUnit(last[1], series.unit) + ' in ' + dateLabel(last[0]) +
      '. Highest ' + withUnit(hi[1], series.unit) + ' in ' + dateLabel(hi[0]) + '. Lowest ' + withUnit(lo[1], series.unit) + ' in ' + dateLabel(lo[0]) + '.');

    range.ticks.forEach(function (t) {
      s.appendChild(svg('line', { x1: L, x2: W - R, y1: y(t), y2: y(t), 'class': t === 0 ? 'chart-zero' : 'chart-grid' }));
      var lab = svg('text', { x: L - 6, y: y(t) + 4, 'text-anchor': 'end', 'class': 'chart-label' });
      lab.textContent = num(t);
      s.appendChild(lab);
    });

    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p[1]).toFixed(1); }).join('');
    var base = y(Math.max(range.lo, Math.min(0, range.hi)));
    s.appendChild(svg('path', { d: d + 'L' + x(pts.length - 1).toFixed(1) + ' ' + base.toFixed(1) + 'L' + x(0).toFixed(1) + ' ' + base.toFixed(1) + 'Z', 'class': 'chart-area' }));
    s.appendChild(svg('path', { d: d, 'class': 'chart-line' }));

    [0, Math.floor((pts.length - 1) / 2), pts.length - 1].forEach(function (i, k) {
      var t = svg('text', { x: x(i), y: H - 8, 'text-anchor': k === 0 ? 'start' : k === 2 ? 'end' : 'middle', 'class': 'chart-label' });
      t.textContent = dateLabel(pts[i][0]);
      s.appendChild(t);
    });

    var ex = x(pts.length - 1), ey = y(last[1]);
    s.appendChild(svg('circle', { cx: ex, cy: ey, r: 5.5, 'class': 'chart-dot' }));
    var tag = svg('text', { x: Math.min(ex, W - R - 2), y: ey < T + 16 ? ey + 20 : ey - 10, 'text-anchor': 'end', 'class': 'chart-now' });
    tag.textContent = withUnit(last[1], series.unit);
    s.appendChild(tag);
    fig.appendChild(s);

    if (note) fig.appendChild(html('p', 'chart-note', note));

    var cap = html('figcaption', 'chart-source');
    cap.appendChild(document.createTextNode('Source: '));
    var href = httpsUrl(series.sourceUrl);
    if (href) {
      var a = html('a', null, String(series.source || 'source'));
      a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer';
      cap.appendChild(a);
    } else {
      cap.appendChild(document.createTextNode(String(series.source || 'unknown')));
    }
    cap.appendChild(document.createTextNode(' · data up to ' + dateLabel(series.asOf || last[0]) + (series.frequency === 'yearly' ? ' · one value per year' : '')));
    fig.appendChild(cap);

    var det = html('details', 'chart-table');
    det.appendChild(html('summary', null, 'Show the numbers'));
    var table = html('table');
    var step = Math.max(1, Math.ceil(pts.length / 24));
    var thead = html('tr');
    thead.appendChild(html('th', null, 'Date')); thead.appendChild(html('th', null, series.unit || 'Value'));
    table.appendChild(thead);
    pts.forEach(function (p, i) {
      if (i % step && i !== pts.length - 1) return;
      var tr = html('tr');
      tr.appendChild(html('td', null, dateLabel(p[0]))); tr.appendChild(html('td', null, num(p[1])));
      table.appendChild(tr);
    });
    det.appendChild(table);
    fig.appendChild(det);
    return fig;
  }

  // Two bars: what was expected, what actually happened. Both numbers were checked against the news reports by the build.
  function expectedVsActual(ev, publishers) {
    if (!ev || typeof ev.expected !== 'number' || typeof ev.actual !== 'number') return null;
    if (!isFinite(ev.expected) || !isFinite(ev.actual) || ev.expected < 0 || ev.actual < 0) return null;
    var max = Math.max(ev.expected, ev.actual) || 1;
    var W = 340, H = 110, L = 86, R = 70;
    var fig = html('figure', 'chart evsa');
    fig.appendChild(html('h4', 'chart-title', 'Expected vs what happened'));
    var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'class': 'chart-svg', focusable: 'false' });
    var unit = ev.unit ? (ev.unit === '%' ? '%' : ' ' + ev.unit) : '';
    s.setAttribute('aria-label', String(ev.label) + '. Expected ' + num(ev.expected) + unit + '. Actual ' + num(ev.actual) + unit + '.');
    [['Expected', ev.expected, 'bar-exp', 20], ['Actual', ev.actual, 'bar-act', 62]].forEach(function (b) {
      var w = Math.max(3, (b[1] / max) * (W - L - R));
      var lab = svg('text', { x: L - 8, y: b[3] + 20, 'text-anchor': 'end', 'class': 'chart-label' });
      lab.textContent = b[0];
      s.appendChild(lab);
      s.appendChild(svg('rect', { x: L, y: b[3], width: w, height: 30, 'class': 'chart-bar ' + b[2] }));
      var v = svg('text', { x: L + w + 6, y: b[3] + 20, 'class': 'chart-now chart-now-left' });
      v.textContent = num(b[1]) + unit;
      s.appendChild(v);
    });
    fig.appendChild(s);
    fig.appendChild(html('p', 'chart-note', String(ev.label)));
    fig.appendChild(html('figcaption', 'chart-source', 'Both numbers come from the news reports' + (publishers && publishers.length ? ' (' + publishers.join(', ') + ')' : '') + '.'));
    return fig;
  }

  root.BuzzCharts = { line: line, expectedVsActual: expectedVsActual, niceRange: niceRange, dateLabel: dateLabel };
})(window);
