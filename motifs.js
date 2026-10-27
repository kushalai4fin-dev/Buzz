// Buzz news pictures (Stage 2b). About 35 cartoon pictures that match what a headline is ABOUT
// (a ceasefire, tariffs, an oil price move, a rate cut, a cricket final, an AI launch ...).
// The picture is chosen by simple keyword rules on the headline, so it costs nothing and never calls an AI.
// If no rule fits, the topic's general scene from scenes.js is used.
// Drawn in code, original, neo-brutalist cartoon: thick outlines, flat colour, hard shadows (added by a filter).
// This file only ever contains our own fixed drawings. Feed text is only used to PICK a drawing, never drawn.

(function () {
  'use strict';
  var A = window.BuzzArt;
  if (!A) return;

  /* ---------- tiny drawing helpers (every shape = coloured fill + ink outline) ---------- */
  function pth(d, fill, extra) { return '<path class="' + fill + '" d="' + d + '"' + (extra || '') + '/><path class="ink" d="' + d + '"' + (extra || '') + '/>'; }
  function box(x, y, w, h, fill, r) { var a = ' x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (r || 0) + '"'; return '<rect class="' + fill + '"' + a + '/><rect class="ink"' + a + '/>'; }
  function circ(cx, cy, r, fill) { var a = ' cx="' + cx + '" cy="' + cy + '" r="' + r + '"'; return '<circle class="' + fill + '"' + a + '/><circle class="ink"' + a + '/>'; }
  function ell(cx, cy, rx, ry, fill, rot) { var a = ' cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '"' + (rot ? ' transform="rotate(' + rot + ' ' + cx + ' ' + cy + ')"' : ''); return '<ellipse class="' + fill + '"' + a + '/><ellipse class="ink"' + a + '/>'; }
  function line(d) { return '<path class="ink" d="' + d + '"/>'; }
  function thick(d) { return '<path class="ink thick" d="' + d + '"/>'; }
  function dot(cx, cy, r) { return '<circle class="fill-ink" cx="' + cx + '" cy="' + cy + '" r="' + (r || 2.6) + '"/>'; }
  function star(x, y, s, fill) {
    return '<path class="' + (fill || 'y') + '" transform="translate(' + x + ' ' + y + ') scale(' + (s || 1) + ')" d="M0-9l2.8 6.2 6.2 2.8-6.2 2.8L0 9l-2.8-6.2L-9 0l6.2-2.8z"/>' +
      '<path class="ink sw16" transform="translate(' + x + ' ' + y + ') scale(' + (s || 1) + ')" d="M0-9l2.8 6.2 6.2 2.8-6.2 2.8L0 9l-2.8-6.2L-9 0l6.2-2.8z"/>';
  }
  function eyes(x, y, g) { g = g || 8; return dot(x - g, y, 2.8) + dot(x + g, y, 2.8) + line('M' + (x - 4) + ' ' + (y + 7) + 'q4 4 8 0'); }
  function burst(cx, cy, ro, ri, n) {
    var d = '';
    for (var i = 0; i < n * 2; i++) {
      var a = (Math.PI * i) / n, r = i % 2 ? ri : ro;
      d += (i ? 'L' : 'M') + (cx + r * Math.cos(a)).toFixed(1) + ' ' + (cy + r * Math.sin(a)).toFixed(1);
    }
    return d + 'Z';
  }
  function bubble(x, y, ch) {
    var w = 40, h = 32;
    var d = 'M' + (x + 6) + ' ' + y + 'h' + (w - 12) + 'a6 6 0 0 1 6 6v' + (h - 12) + 'a6 6 0 0 1-6 6H' + (x + 24) + 'l-8 9v-9H' + (x + 6) + 'a6 6 0 0 1-6-6V' + (y + 6) + 'a6 6 0 0 1 6-6z';
    return pth(d, 'w') + '<text class="t" x="' + (x + w / 2) + '" y="' + (y + 25) + '" text-anchor="middle">' + ch + '</text>';
  }
  function sparkle(x, y) { return line('M' + x + ' ' + (y - 6) + 'v12M' + (x - 6) + ' ' + y + 'h12'); }
  function wave(y, fill) { return pth('M20 ' + y + 'q20-14 40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0V124H20z', fill); }

  /* ---------- the pictures ---------- */
  var M = {};

  M.peace = star(284, 100, 1) + sparkle(36, 30) +
    circ(238, 36, 20, 'y') +
    pth('M98 76L62 92l10-26z', 'w') +
    ell(126, 72, 36, 22, 'w') +
    pth('M102 68C112 34 152 26 172 40C158 46 148 58 144 78z', 'b') + line('M120 62c12-14 24-18 38-18') +
    circ(162, 54, 15, 'w') + pth('M176 52l15 6-15 6z', 'o') + dot(166, 51, 2.6) +
    thick('M190 62Q216 58 240 76') + ell(206, 58, 10, 5, 'g', -25) + ell(220, 66, 10, 5, 'g', 25) + ell(232, 73, 9, 4.5, 'g', -10) +
    bubble(256, 10, '!');

  M.war = sparkle(40, 24) +
    pth(burst(240, 62, 48, 30, 12), 'r') + pth(burst(240, 62, 28, 16, 10), 'y') +
    '<g transform="rotate(-24 104 66)">' + box(52, 56, 98, 22, 'w', 11) + pth('M150 56q28 11 0 22z', 'r') + pth('M66 56l-16-20h24z', 'r') + pth('M66 78l-16 20h24z', 'r') +
    line('M96 56v22M112 56v22') + circ(82, 67, 5, 'b') + pth('M52 67l-26-11 7 11-7 11z', 'o') + '</g>' +
    circ(34, 100, 11, 'cl') + circ(52, 106, 9, 'cl') + bubble(28, 4, '!');

  M.tariff = star(290, 100, 0.9) +
    box(46, 78, 72, 32, 'r', 3) + line('M62 78v32M78 78v32M94 78v32M110 78v32') +
    box(124, 78, 72, 32, 'b', 3) + line('M140 78v32M156 78v32M172 78v32M188 78v32') +
    box(86, 46, 72, 32, 'y', 3) + line('M102 46v32M118 46v32M134 46v32M150 46v32') +
    line('M222 20v16') + pth('M206 36h32l10 14-26 26-26-26z', 'w') + circ(222, 46, 4, 'p') +
    '<text class="t" x="222" y="72" text-anchor="middle">%</text>' +
    thick('M196 96h40') + line('M226 88l10 8-10 8');

  M.oil = star(40, 24, 1) + sparkle(290, 30) +
    pth('M112 30h64l10 12v52l-10 12h-64l-10-12V42z', 'dk') +
    '<path class="y" d="M102 50h84v10h-84zM102 78h84v10h-84z"/>' + line('M102 50h84M102 60h84M102 78h84M102 88h84') +
    circ(144, 69, 14, 'w') + pth('M144 60c6 6 8 10 8 13a8 8 0 0 1-16 0c0-3 2-7 8-13z', 'dk') +
    pth('M236 40c10 14 16 22 16 30a16 16 0 0 1-32 0c0-8 6-16 16-30z', 'dk') + '<path d="M230 66q-4 8 2 12" class="pl sw3"/>' +
    pth('M268 100V60h-12l18-22 18 22h-12v40z', 'r');

  M.election = star(40, 28, 1.1) + star(284, 96, 1) +
    box(86, 62, 120, 50, 'b', 4) + box(100, 56, 92, 12, 'dk', 3) +
    '<g transform="rotate(-10 150 40)">' + box(120, 14, 52, 56, 'w', 2) + line('M130 28h32M130 40h32') + thick('M132 54l8 8 14-16') + '</g>' +
    circ(146, 90, 12, 'y') + '<text class="t fs18" x="146" y="97" text-anchor="middle">★</text>' +
    bubble(232, 14, '?');

  M.sanctions = sparkle(36, 24) +
    box(120, 58, 70, 52, 'y', 8) + thick('M134 58V44a21 21 0 0 1 42 0v14') + circ(155, 82, 7, 'dk') + line('M155 86v12') +
    '<g transform="rotate(-18 60 90)">' + ell(50, 90, 16, 9, 'cl') + ell(72, 90, 16, 9, 'cl') + '</g>' +
    '<g transform="rotate(14 240 88)">' + box(210, 66, 72, 40, 'r', 3) + '<text class="t fillw fs22" x="246" y="94" text-anchor="middle">NO</text></g>';

  M.protest = star(290, 100, 0.9) + sparkle(40, 100) +
    pth('M70 54h26l60-28v76L96 74H70z', 'r') + box(96, 74, 14, 26, 'dk', 3) + circ(160, 64, 0, 'w') +
    thick('M172 48q10 14 0 28') + thick('M184 40q16 22 0 44') +
    line('M236 28v84') + '<g transform="rotate(-8 252 52)">' + box(208, 20, 76, 46, 'w', 3) + line('M220 34h52M220 46h36') + '</g>';

  M.storm = star(40, 30, 0.9) +
    circ(120, 54, 26, 'cl') + circ(158, 46, 32, 'cl') + circ(196, 58, 24, 'cl') + box(120, 56, 100, 24, 'cl', 0) +
    '<path class="cl" d="M96 80h124v-2H96z"/>' +
    line('M96 80h124') +
    pth('M162 70l-16 28h14l-8 22 26-32h-14l10-18z', 'y') +
    line('M112 94l-6 12M198 92l-6 12M226 90l-6 12') + wave(112, 'b');

  M.inflation = star(286, 28, 1) + sparkle(34, 100) +
    pth('M64 54h132l-14 52H78z', 'o') + line('M84 54l8 52M110 54l4 52M136 54v52M162 54l-4 52') + line('M70 78h120M74 92h112') +
    thick('M92 54c4-24 26-24 30 0') + thick('M138 54c4-24 26-24 30 0') +
    '<g transform="rotate(8 230 58)">' + pth('M208 34h36l8 12-22 22-22-22z', 'w') + circ(220, 42, 3.5, 'p') + '</g>' +
    pth('M262 106V64h-12l18-22 18 22h-12v42z', 'r');

  M.centralbank = star(284, 24, 1) +
    pth('M60 58L140 22l80 36z', 'w') + circ(140, 46, 8, 'y') +
    box(72, 62, 20, 36, 'w', 2) + box(106, 62, 20, 36, 'w', 2) + box(154, 62, 20, 36, 'w', 2) + box(188, 62, 20, 36, 'w', 2) +
    box(60, 98, 160, 12, 'cl', 2) + box(52, 110, 176, 8, 'dk', 2) +
    circ(262, 70, 24, 'y') + circ(262, 70, 17, 'y') + '<text class="t" x="262" y="79" text-anchor="middle">%</text>';

  function candles(down) {
    var up = [[60, 80, 92, 'g'], [96, 72, 96, 'g'], [132, 60, 84, 'g'], [168, 44, 70, 'g'], [204, 34, 58, 'g']];
    var dn = [[60, 34, 58, 'r'], [96, 44, 72, 'r'], [132, 56, 84, 'r'], [168, 70, 94, 'r'], [204, 84, 104, 'r']];
    var set = down ? dn : up, out = '';
    set.forEach(function (c) { out += line('M' + (c[0] + 9) + ' ' + (c[1] - 10) + 'V' + (c[2] + 12)) + box(c[0], c[1], 18, c[2] - c[1], c[3], 2); });
    out += down ? pth('M246 40v46h-12l18 22 18-22h-12V40z', 'r') : pth('M262 106V60h-12l18-22 18 22h-12v46z', 'g');
    return out + star(40, down ? 100 : 26, 0.9);
  }
  M.stocks_up = candles(false);
  M.stocks_down = candles(true);

  M.gold = star(40, 26, 1) + star(284, 30, 1.2) + sparkle(250, 100) +
    pth('M70 108h74l-10-24H80z', 'y') + pth('M148 108h74l-10-24h-54z', 'y') + pth('M108 84h74l-10-24h-54z', 'y') +
    line('M96 98h22M174 98h22M134 74h22') + circ(256, 80, 22, 'y') + circ(256, 80, 15, 'y') + '<text class="t fs22" x="256" y="89" text-anchor="middle">Au</text>';

  M.currency = star(40, 100, 0.9) + star(290, 28, 1) +
    circ(120, 62, 34, 'y') + circ(120, 62, 25, 'y') + '<text class="t fs34" x="120" y="73" text-anchor="middle">$</text>' +
    circ(200, 66, 34, 'cl') + circ(200, 66, 25, 'cl') + '<text class="t fs34" x="200" y="77" text-anchor="middle">₹</text>' +
    thick('M88 22q32-18 64 0') + line('M146 14l8 8-10 4') + thick('M232 108q-32 14-64 0') + line('M174 116l-8-8 10-4');

  M.jobs = star(284, 100, 1) + sparkle(40, 28) +
    thick('M132 54V42a8 8 0 0 1 8-8h40a8 8 0 0 1 8 8v12') + box(100, 54, 120, 56, 'o', 8) + line('M100 78h120') + box(150, 72, 20, 14, 'y', 3) +
    '<g transform="rotate(12 252 60)">' + box(232, 24, 50, 62, 'w', 2) + line('M242 40h30M242 52h30M242 64h20') + '</g>' +
    bubble(28, 62, '?');

  M.cricket = star(284, 26, 1) +
    '<g transform="rotate(32 120 66)">' + box(72, 38, 24, 56, 'dk', 6) + box(80, 8, 8, 32, 'dk', 3) + pth('M70 38h28l-4 -4h-20z', 'dk') + box(66, 36, 40, 74, 'tn', 8) + line('M72 52h28M72 64h28') + '</g>' +
    circ(206, 92, 16, 'r') + line('M192 86q14 6 28 0M192 98q14-6 28 0') +
    box(240, 40, 8, 66, 'tn', 2) + box(256, 40, 8, 66, 'tn', 2) + box(272, 40, 8, 66, 'tn', 2) + box(240, 34, 18, 6, 'y', 2) + box(262, 34, 18, 6, 'y', 2);

  M.football = star(284, 100, 1) + sparkle(36, 24) +
    '<path class="w op55" d="M40 100V34l40-14h160l40 14v66z"/>' +
    line('M40 100V34l40-14h160l40 14v66') + '<path class="ink sw1 op45" d="M56 40v60M72 30v70M88 26v74M104 24v76M120 24v76M136 24v76M152 24v76M168 24v76M184 24v76M200 24v76M216 26v74M232 30v70M248 38v62M44 56h232M44 74h232M44 92h232"/>' +
    circ(176, 86, 24, 'w') + '<path class="fill-ink" d="M176 74l11 8-4 12h-14l-4-12z"/>' + line('M176 74V64M187 82l10-4M183 94l6 10M169 94l-6 10M165 82l-10-4');

  M.tennis = star(40, 100, 0.9) + sparkle(290, 28) +
    '<g transform="rotate(-35 110 62)">' + ell(110, 40, 30, 38, 'w') + '<path class="ink sw12" d="M90 18v44M100 8v64M110 4v72M120 8v64M130 18v44M82 30h56M80 42h60M82 54h56"/>' + '<ellipse class="ink thick" cx="110" cy="40" rx="30" ry="38"/>' + box(105, 78, 10, 34, 'dk', 3) + '</g>' +
    circ(218, 74, 20, 'g') + line('M200 64q18 10 36 0M202 86q16-8 32 0');

  M.olympics = star(40, 28, 1) + star(284, 26, 1) +
    box(52, 78, 66, 34, 'cl', 2) + box(118, 54, 84, 58, 'y', 2) + box(202, 90, 66, 22, 'o', 2) +
    '<text class="t" x="85" y="102" text-anchor="middle">2</text><text class="t fs36" x="160" y="96" text-anchor="middle">1</text><text class="t fs20" x="235" y="108" text-anchor="middle">3</text>' +
    line('M148 8l12 24 12-24') + circ(160, 40, 14, 'y') + star(160, 40, 0.9, 'r');

  M.f1 = sparkle(40, 100) + star(284, 28, 1) +
    line('M70 14v100') + pth('M70 18q28-12 56 0t56 0v54q-28 12-56 0t-56 0z', 'w') +
    '<path class="fill-ink" d="M70 18q14-6 28-3v18q-14-3-28 3zM126 18q14 6 28 0v18q-14 6-28 0zM98 36q14 3 28 0v18q-14 3-28 0zM154 36q14 6 28 0v18q-14 6-28 0zM70 54q14-6 28-3v18q-14-3-28 3zM126 54q14 6 28 0v18q-14 6-28 0z"/>' +
    circ(236, 82, 28, 'dk') + circ(236, 82, 14, 'cl') + circ(236, 82, 4, 'dk');

  M.ai = star(40, 28, 1) + star(286, 100, 1) +
    line('M160 30V14') + circ(160, 12, 6, 'r') +
    box(104, 30, 112, 70, 'b', 14) + box(92, 52, 12, 26, 'cl', 4) + box(216, 52, 12, 26, 'cl', 4) +
    box(116, 44, 88, 34, 'dk', 8) + circ(140, 61, 8, 'g') + circ(180, 61, 8, 'g') + dot(140, 61, 3) + dot(180, 61, 3) +
    box(130, 86, 60, 8, 'w', 3) + line('M144 86v8M158 86v8M172 86v8') +
    bubble(240, 14, '…') + '<text class="t fs20" x="52" y="62">01</text><text class="t fs20" x="44" y="86">10</text>';

  M.cyber = sparkle(290, 26) +
    box(104, 58, 70, 52, 'y', 8) + thick('M118 58V46a21 21 0 0 1 36 -12') + circ(139, 82, 7, 'dk') + line('M139 86v12') +
    ell(236, 76, 24, 20, 'r') + ell(236, 54, 12, 11, 'dk') + dot(231, 52, 2.4) + dot(241, 52, 2.4) +
    line('M214 70l-18-8M214 80l-20 4M216 90l-14 12M258 70l18-8M258 80l20 4M256 90l14 12M228 44l-8-14M244 44l8-14') +
    line('M222 70h28M222 82h28') + bubble(28, 14, '!');

  M.chip = star(40, 100, 0.9) + star(290, 26, 1.1) +
    box(110, 34, 80, 80, 'b', 10) + box(124, 48, 52, 52, 'w', 6) +
    line('M100 48h10M100 62h10M100 76h10M100 90h10M190 48h10M190 62h10M190 76h10M190 90h10M124 24v10M138 24v10M152 24v10M166 24v10M124 114v10M138 114v10M152 114v10M166 114v10') +
    eyes(150, 70, 9) + thick('M200 62h30l12-14h30M200 88h40l12 14h18') + circ(284, 48, 6, 'y') + circ(270, 102, 6, 'r');

  M.phone = star(40, 28, 1) + star(288, 98, 1) +
    box(124, 8, 72, 108, 'dk', 12) + box(132, 20, 56, 84, 'w', 4) +
    box(138, 26, 44, 14, 'r', 3) + box(138, 46, 20, 18, 'b', 3) + box(162, 46, 20, 18, 'g', 3) + box(138, 70, 20, 18, 'y', 3) + box(162, 70, 20, 18, 'p', 3) +
    circ(228, 40, 14, 'r') + '<text class="t fillw fs20" x="228" y="48" text-anchor="middle">1</text>' +
    line('M96 52q-16 10 0 20M82 44q-30 18 0 36');

  M.space = sparkle(40, 100) + star(40, 30, 1) + star(150, 16, 0.8) +
    circ(236, 56, 28, 'p') + '<ellipse class="ink thick" cx="236" cy="56" rx="48" ry="12" transform="rotate(-18 236 56)"/>' + line('M222 44q10 4 26 0') +
    '<g transform="rotate(38 120 70)">' + pth('M120 12c22 18 24 50 22 74h-44c-2-24 0-56 22-74z', 'w') + circ(120, 50, 10, 'b') + eyes(120, 50, 4).replace(/fill-ink/g, 'fill-ink') +
    pth('M98 70l-18 22 18-6z', 'r') + pth('M142 70l18 22-18-6z', 'r') + pth('M108 86h24l-12 30z', 'o') + pth('M114 86h12l-6 16z', 'y') + '</g>';

  M.climate = star(290, 100, 0.9) +
    circ(70, 34, 22, 'y') + line('M70 2v8M70 58v8M38 34h8M94 34h8M47 11l6 6M93 57l6 6M93 11l-6 6M47 57l6-6') +
    box(142, 18, 22, 78, 'w', 11) + circ(153, 100, 16, 'r') + box(148, 44, 10, 56, 'r', 5) + line('M164 34h10M164 50h10M164 66h10') +
    pth('M206 62h56v42a8 8 0 0 1-8 8h-40a8 8 0 0 1-8-8z', 'b') + line('M216 74h16') + pth('M226 112c-4 6-4 10 0 10s4-4 0-10z', 'b') + pth('M250 112c-4 6-4 10 0 10s4-4 0-10z', 'b');

  M.health = star(40, 100, 0.9) + sparkle(286, 28) +
    '<g transform="rotate(-30 100 66)">' + box(54, 52, 92, 30, 'w', 15) + '<path class="r" d="M100 52h31a15 15 0 0 1 0 30h-31z"/><path class="ink" d="M54 67a15 15 0 0 1 15-15h62a15 15 0 0 1 0 30H69a15 15 0 0 1-15-15zM100 52v30"/>' + '</g>' +
    '<g transform="rotate(30 220 66)">' + box(176, 56, 70, 20, 'w', 4) + box(246, 62, 22, 8, 'cl', 2) + line('M268 66h26') + box(166, 52, 10, 28, 'dk', 3) + box(154, 62, 12, 8, 'dk', 2) + box(190, 56, 28, 20, 'g', 0) + '</g>' +
    box(124, 14, 14, 36, 'r', 2) + box(113, 25, 36, 14, 'r', 2);

  M.fossil = star(290, 28, 1) + sparkle(40, 100) +
    '<g transform="rotate(-20 110 70)">' + pth('M50 62a12 12 0 1 1 10-14l60 6a12 12 0 1 1 14 14l-4 16a12 12 0 1 1-14-6L58 72a12 12 0 1 1-8-10z', 'w') + '</g>' +
    pth('M230 96c-30 0-48-20-40-42 8-20 36-24 50-10 12 12 8 30-8 32-12 2-20-8-14-16', 'tn') + line('M230 96c-20 4-32-6-32-6') +
    circ(266, 100, 4, 'tn');

  M.bigcat = star(40, 28, 1) + star(288, 100, 0.9) +
    circ(110, 36, 16, 'o') + circ(210, 36, 16, 'o') + circ(110, 36, 7, 'pk') + circ(210, 36, 7, 'pk') +
    ell(160, 70, 60, 48, 'o') + line('M150 24l4 14M160 22v16M170 24l-4 14M104 62l16 4M104 76l16-2M216 62l-16 4M216 76l-16-2') +
    ell(138, 62, 9, 8, 'w') + ell(182, 62, 9, 8, 'w') + dot(140, 63, 4) + dot(180, 63, 4) +
    ell(160, 88, 22, 16, 'w') + pth('M152 78h16l-8 9z', 'pk') + line('M160 87v6q-8 6-14 0M160 93q8 6 14 0') +
    line('M96 84l-30-6M96 92l-30 6M224 84l30-6M224 92l30 6');

  M.bird = star(40, 100, 0.9) + sparkle(290, 28) +
    thick('M30 100Q150 84 290 104') + ell(60, 92, 14, 6, 'g', -15) + ell(268, 100, 14, 6, 'g', 12) +
    pth('M98 70l-34-8 8 22z', 'b') + ell(134, 72, 40, 28, 'b') + pth('M104 66c10-16 30-18 44-8-10 4-18 12-20 26z', 'p') +
    circ(170, 48, 20, 'b') + pth('M188 46l22 8-22 8z', 'o') + circ(176, 44, 5, 'w') + dot(177, 44, 2.6) +
    line('M130 98v10M142 98v10M124 108h12M136 108h12');

  M.whale = star(40, 26, 1) + star(284, 100, 0.9) +
    pth('M40 74c0-30 30-42 70-42 40 0 74 14 90 36 8-18 28-26 46-22-4 16-12 24-26 28 14 6 22 16 24 28-18 0-32-6-44-18-16 14-44 22-92 22-44 0-68-14-68-32z', 'b') +
    pth('M70 84c30 12 90 12 124-4-20 14-56 22-96 16z', 'w') + circ(92, 62, 5, 'w') + dot(93, 62, 2.6) + line('M104 76q12 6 24 0') +
    thick('M118 30q-4-14 8-22M118 30q6-14-4-20') + circ(112, 12, 3, 'b') + circ(128, 10, 3, 'b') + wave(112, 'g').replace(/class="g"/, 'class="b"');

  M.awards = sparkle(40, 100) + star(40, 30, 1) + star(284, 28, 1.2) + star(280, 100, 0.9) +
    '<path class="y op35" d="M160 10L110 118h100z"/>' +
    box(130, 100, 60, 14, 'dk', 2) + box(144, 88, 32, 12, 'y', 2) +
    pth('M160 36c-12 0-18 8-18 16 0 12 6 16 6 24l-8 12h40l-8-12c0-8 6-12 6-24 0-8-6-16-18-16z', 'y') + circ(160, 28, 10, 'y') + star(160, 54, 0.9, 'w');

  M.concert = star(40, 28, 1) + star(290, 100, 0.9) +
    '<path class="y op35" d="M30 6l40 112H10z"/><path class="b op35" d="M290 6l-40 112h60z"/>' +
    circ(150, 38, 22, 'cl') + '<path class="ink sw13" d="M132 30h36M130 40h40M134 50h32M144 18v40M156 18v40"/>' + pth('M140 58h20l-4 14h-12z', 'dk') + box(148, 72, 4, 40, 'dk', 1) + line('M136 112h28') +
    ell(214, 92, 11, 8, 'dk') + line('M224 92V44') + line('M224 44q18 4 14 24') + ell(256, 100, 11, 8, 'dk') + line('M266 100V60') + line('M266 60q18 4 14 24');

  M.popcorn = star(40, 100, 0.9) + sparkle(286, 28) +
    circ(120, 44, 14, 'w') + circ(144, 36, 16, 'w') + circ(170, 44, 14, 'w') + circ(132, 56, 12, 'y') + circ(158, 56, 12, 'w') +
    pth('M104 56h82l-12 56h-58z', 'w') + '<path class="r" d="M114 56h12l-3 56h-12zM138 56h12v56h-12zM162 56h12l3 56h-12z"/><path class="ink" d="M104 56h82l-12 56h-58zM126 56l-3 56M150 56v56M174 56l3 56"/>' +
    '<g transform="rotate(-10 240 70)">' + box(212, 44, 56, 54, 'y', 4) + circ(212, 71, 7, 'w') + circ(268, 71, 7, 'w') + line('M226 56h28M226 68h28M226 80h18') + '</g>';

  var ALIASES_NAMES = Object.keys(M);

  /* ---------- picking a picture from the words of a headline ---------- */
  var DOWN = /\b(fall(s|ing)?|fell|slide(s)?|slid|slump(s|ed)?|plunge(s|d)?|drop(s|ped)?|crash(es|ed)?|tumble(s|d)?|sink(s)?|sank|slip(s|ped)?|losses?|lower|retreat(s)?|selloff)\b/;
  var RULES = [
    ['storm', null, /\b(storm|cyclone|hurricane|typhoon|flood(s|ing|ed)?|wildfires?|heatwave|earthquake|tsunami|landslide|monsoon)\b/],
    ['war', ['geopolitics'], /\b(war|missiles?|airstrikes?|air strikes?|troops|military|bomb(s|ing|ed)?|invasion|shelling|offensive|drones?|hostages?|attack(s|ed)?|air defen[cs]e|defen[cs]e minister|frontline|zelenskyy|putin)\b/],
    ['peace', ['geopolitics'], /\b(ceasefire|truce|peace|talks|summit|treaty|diplomat(s|ic)?|negotiat\w+|accord|security council|resolution)\b/],
    ['sanctions', ['geopolitics'], /\b(sanctions?|embargo|blacklist(ed|s)?)\b/],
    ['protest', ['geopolitics', 'economics'], /\b(protest(s|ers)?|rall(y|ies)|demonstrat\w+|unrest|riots?|strikes?|walkout)\b/],
    ['tariff', ['geopolitics', 'economics', 'finance'], /\b(tariffs?|duties|customs|trade (deal|war|talks|ties|row)|wto|containers?|shipping)\b/],
    ['oil', ['geopolitics', 'economics', 'finance'], /\b(oil|crude|opec|petrol|diesel|gas|lng|fuel|brent|pipeline)\b/],
    ['election', ['geopolitics'], /\b(elections?|votes?|voters?|polls?|ballot|parliament|campaign|candidates?|president|prime minister|lawmakers?|senate|congress|government)\b/],
    ['centralbank', ['economics', 'finance'], /\b(interest rates?|rate (cut|cuts|hike|hikes|decision)|central bank|rbi|fed|federal reserve|ecb|bank of england|monetary|repo)\b/],
    ['inflation', ['economics', 'finance'], /\b(inflation|prices?|cpi|cost of living|groceries|food prices)\b/],
    ['gold', ['economics', 'finance'], /\b(gold|silver|copper|bullion|metals?)\b/],
    ['currency', ['economics', 'finance'], /\b(rupee|dollar|euro|pound|yen|currency|forex|exchange rate)\b/],
    ['jobs', ['economics', 'finance'], /\b(jobs?|layoffs?|unemployment|hiring|workers?|employment|payrolls?|redundanc\w+)\b/],
    ['stocks', ['economics', 'finance'], /\b(stocks?|shares|sensex|nifty|wall street|dow|nasdaq|markets?|equities|index|profits?|earnings|quarterly results)\b/, function (t) { return DOWN.test(t) ? 'stocks_down' : 'stocks_up'; }],
    ['cricket', ['sports'], /\b(cricket|test match|ipl|wickets?|innings|batter|bowler|odi|t20)\b/],
    ['tennis', ['sports'], /\b(tennis|wimbledon|grand slam|us open|french open|atp|wta)\b/],
    ['olympics', ['sports'], /\b(olympic\w*|medals?|medallist|athletics|commonwealth games|paralympic\w*)\b/],
    ['f1', ['sports'], /\b(f1|formula (one|1)|grand prix|motogp|racing)\b/],
    ['football', ['sports'], /\b(football|soccer|premier league|fifa|champions league|goals?|striker|la liga)\b/],
    ['cyber', ['technology'], /\b(hack(ed|ers?|ing)?|breach|ransomware|cyber\w*|malware|phishing|data leak)\b/],
    ['chip', ['technology'], /\b(chips?|chipmaker|semiconductors?|foundry|processor|nvidia|intel|tsmc)\b/],
    ['ai', ['technology', 'science'], /\b(ai|artificial intelligence|chatbots?|openai|llm|machine learning|robots?|robotics|gemini|chatgpt)\b/],
    ['phone', ['technology'], /\b(iphone|smartphones?|android|apps?|gadgets?|devices?|samsung|apple|pixel)\b/],
    ['space', ['science', 'technology'], /\b(nasa|isro|spacex|rockets?|moon|lunar|mars|telescopes?|planets?|astronom\w+|galax(y|ies)|orbit|satellites?|asteroids?|comets?)\b/],
    ['climate', ['science', 'geopolitics', 'economics'], /\b(climate|emissions?|global warming|carbon|glaciers?|heat|temperatures?|net zero|greenhouse|sea level)\b/],
    ['health', ['science'], /\b(vaccines?|drugs?|cancer|medical|trials?|disease|virus|health|hospitals?|treatment|gene|dna|medicine|outbreak)\b/],
    ['fossil', ['science'], /\b(fossils?|dinosaurs?|archaeolog\w+|ancient|skeletons?|new species)\b/],
    ['bigcat', ['animals'], /\b(tigers?|leopards?|lions?|cubs?|cats?|jaguars?|cheetahs?)\b/],
    ['whale', ['animals'], /\b(whales?|dolphins?|sharks?|ocean|marine|fish|turtles?|coral)\b/],
    ['bird', ['animals'], /\b(birds?|eagles?|owls?|penguins?|parrots?|vultures?)\b/],
    ['awards', ['movies', 'entertainment', 'music'], /\b(oscars?|awards?|winners?|prize|grammys?|bafta|cannes|nominat\w+|emmys?)\b/],
    ['concert', ['music', 'entertainment'], /\b(concerts?|tour|albums?|singer|songs?|band|gig|rapper|charts?|festival)\b/],
    ['popcorn', ['movies', 'entertainment'], /\b(box office|premiere|trailer|released?|sequel|blockbuster|films?|movies?)\b/]
  ];

  function pick(topic, text) {
    var t = String(text || '').toLowerCase();
    for (var i = 0; i < RULES.length; i++) {
      var r = RULES[i];
      if (r[1] && r[1].indexOf(topic) === -1) continue;
      if (r[2].test(t)) return r[3] ? r[3](t) : r[0];
    }
    return null;
  }

  function svg(inner) {
    return '<svg class="scene" viewBox="0 0 320 124" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      '<g filter="url(#hard)"><g filter="url(#rough)">' + inner + '</g></g></svg>';
  }

  // Picture for a story: a headline-specific one if a rule fits, otherwise the topic's general scene.
  A.sceneFor = function (topic, text) {
    var name = pick(topic, text);
    return name && M[name] ? svg(M[name]) : A.scene(topic);
  };
  A.motif = function (name) { return M[name] ? svg(M[name]) : ''; };
  A.motifNames = ALIASES_NAMES;
  A.pick = pick;
})();
