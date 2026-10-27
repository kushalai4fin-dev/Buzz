// Shows every illustration in one place so the art can be reviewed. Not linked from the app.
(function () {
  'use strict';
  var A = window.BuzzArt;
  var holder = document.createElement('div');
  holder.className = 'defs-holder';
  holder.setAttribute('aria-hidden', 'true');
  holder.innerHTML = '<svg width="0" height="0"><defs><filter id="rough" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.6"/></filter><filter id="hard" x="-5%" y="-5%" width="115%" height="120%"><feOffset in="SourceAlpha" dx="4" dy="4" result="o"/><feFlood flood-color="#2b2a33"/><feComposite in2="o" operator="in" result="s"/><feMerge><feMergeNode in="s"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs></svg>';
  document.body.appendChild(holder);

  var moods = document.getElementById('moods');
  ['happy', 'think', 'sleep'].forEach(function (m) {
    var box = document.createElement('div');
    box.className = 'mascot-hero';
    var span = document.createElement('span');
    span.innerHTML = A.mascot(m);
    var p = document.createElement('p');
    p.className = 'meta';
    p.textContent = m;
    box.appendChild(span);
    box.appendChild(p);
    moods.appendChild(box);
  });

  var mg = document.getElementById('motifs');
  (A.motifNames || []).forEach(function (n) {
    var card = document.createElement('article');
    card.className = 'card t-' + (/^(war|peace|sanctions|protest|tariff|oil|election)$/.test(n) ? 'geopolitics' : /^(centralbank|inflation|gold|currency|jobs|stocks_up|stocks_down)$/.test(n) ? 'finance' : /^(cricket|football|tennis|olympics|f1)$/.test(n) ? 'sports' : /^(ai|chip|phone|cyber)$/.test(n) ? 'technology' : /^(space|climate|health|fossil|storm)$/.test(n) ? 'science' : /^(bigcat|whale|bird)$/.test(n) ? 'animals' : 'entertainment');
    card.insertAdjacentHTML('afterbegin', A.motif(n));
    var body = document.createElement('div');
    body.className = 'card-body';
    var h = document.createElement('h2');
    h.className = 'headline';
    h.textContent = n;
    body.appendChild(h);
    card.appendChild(body);
    mg.appendChild(card);
  });

  var grid = document.getElementById('scenes');
  A.sceneNames.forEach(function (n) {
    var card = document.createElement('article');
    card.className = 'card t-' + n;
    card.insertAdjacentHTML('afterbegin', A.scene(n));
    var body = document.createElement('div');
    body.className = 'card-body';
    var h = document.createElement('h2');
    h.className = 'headline';
    h.textContent = n;
    body.appendChild(h);
    card.appendChild(body);
    grid.appendChild(card);
  });
})();
