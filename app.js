// Buzz front end. No frameworks, no build step.
// Safety rule: everything that came from a news feed or from the AI is inserted with textContent, never innerHTML.
// The only innerHTML below is our own fixed artwork from scenes.js.

(function () {
  'use strict';

  var $ = function (sel) { return document.querySelector(sel); };
  var Art = window.BuzzArt;
  var Search = window.BuzzSearch;

  var state = {
    topics: [], stories: [], storiesById: {}, clusters: [], explainers: {}, sources: [], status: null,
    demo: false, generatedAt: null, view: { name: 'feed', topic: 'all' }, level: 0, firstRender: true,
    searchNote: null, lastFeedHash: 'topic=all'
  };

  var profile = window.BuzzProfile.create(safeStorage());
  var speech = window.BuzzSpeech.create(window.speechSynthesis, window.SpeechSynthesisUtterance);

  /* ---------- helpers ---------- */

  function safeStorage() {
    return {
      getItem: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
      setItem: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* blocked */ } },
      removeItem: function (k) { try { localStorage.removeItem(k); } catch (e) { /* blocked */ } }
    };
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function button(label, className, onClick) {
    var b = el('button', className, label);
    b.type = 'button';
    if (onClick) b.addEventListener('click', onClick);
    return b;
  }

  function loadJSON(path) {
    return fetch(path, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(path + ' ' + r.status);
      return r.json();
    });
  }

  function timeAgo(iso) {
    if (!iso) return '';
    var t = Date.parse(iso);
    if (isNaN(t)) return '';
    var mins = Math.round((Date.now() - t) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + ' min ago';
    var hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs + ' h ago';
    var days = Math.round(hrs / 24);
    return days + (days === 1 ? ' day ago' : ' days ago');
  }

  function safeHttpsUrl(value) {
    try {
      var u = new URL(value);
      return u.protocol === 'https:' ? u.toString() : null;
    } catch (e) {
      return null;
    }
  }

  function str(v) { return typeof v === 'string' ? v : ''; }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function safeId(v) { return String(v == null ? '' : v).replace(/[^a-z0-9-]/gi, ''); }
  function safeDecode(s) { try { return decodeURIComponent(s); } catch (e) { return ''; } }
  function nowIso() { return new Date().toISOString(); }

  function sceneSvg(topic, text) {
    if (!Art) return '';
    return Art.sceneFor ? Art.sceneFor(topic, text || '') : Art.scene(topic);
  }

  // Words used only to PICK a picture. Never drawn.
  function pictureText(cluster) {
    return cluster.storyIds.map(function (id) { var s = state.storiesById[id]; return s ? s.title + ' ' + (s.snippet || '') : ''; }).join(' ');
  }

  function addFilterDefs() {
    var holder = document.createElement('div');
    holder.setAttribute('aria-hidden', 'true');
    holder.className = 'defs-holder';
    holder.innerHTML = '<svg width="0" height="0" focusable="false" xmlns="http://www.w3.org/2000/svg"><defs>' +
      '<filter id="rough" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" result="n"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="n" scale="2.6"/></filter><filter id="hard" x="-5%" y="-5%" width="115%" height="120%"><feOffset in="SourceAlpha" dx="4" dy="4" result="o"/><feFlood flood-color="#2b2a33"/><feComposite in2="o" operator="in" result="s"/><feMerge><feMergeNode in="s"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs></svg>';
    document.body.appendChild(holder);
  }

  function mascotBlock(mood, text, extraClass) {
    var box = el('div', 'empty mascot-hero' + (extraClass ? ' ' + extraClass : ''));
    var holder = el('span');
    holder.setAttribute('aria-hidden', 'true');
    if (Art) holder.innerHTML = Art.mascot(mood);
    box.appendChild(holder);
    box.appendChild(el('p', null, text));
    return box;
  }

  /* ---------- data helpers ---------- */

  function topicLabel(id) {
    for (var i = 0; i < state.topics.length; i++) if (state.topics[i].id === id) return state.topics[i].label;
    return id;
  }

  function enabledTopicIds() {
    return state.topics.filter(function (t) { return t.enabled; }).map(function (t) { return t.id; });
  }

  // Older data has no clusters: treat every story as its own cluster.
  function deriveClusters(stories) {
    return stories.map(function (s) {
      return {
        id: s.id, topic: s.topic, leadId: s.id, storyIds: [s.id], publishers: [s.publisher], independentSources: 1,
        multiSource: false, latest: s.published || s.firstSeen || ''
      };
    });
  }

  function setData(storiesFile) {
    var stories = arr(storiesFile.stories).filter(function (s) { return s && typeof s.id === 'string'; });
    state.stories = stories;
    state.storiesById = {};
    stories.forEach(function (s) { state.storiesById[s.id] = s; });
    var clusters = arr(storiesFile.clusters).length ? storiesFile.clusters : deriveClusters(stories);
    state.clusters = clusters.map(function (c) {
      var ids = arr(c.storyIds).filter(function (id) { return state.storiesById[id]; });
      if (!ids.length) return null;
      var lead = state.storiesById[c.leadId] ? c.leadId : ids[0];
      return {
        id: String(c.id), topic: str(c.topic) || state.storiesById[lead].topic, leadId: lead, storyIds: ids,
        publishers: arr(c.publishers).map(str), independentSources: Number(c.independentSources) || 1,
        multiSource: c.multiSource === true, latest: str(c.latest)
      };
    }).filter(Boolean);
    state.demo = storiesFile.demo === true;
    state.generatedAt = storiesFile.generatedAt || null;
  }

  function findCluster(id) {
    for (var i = 0; i < state.clusters.length; i++) {
      if (state.clusters[i].id === id || state.clusters[i].storyIds.indexOf(id) !== -1) return state.clusters[i];
    }
    return null;
  }

  function explainerFor(cluster) {
    var item = state.explainers[cluster.id];
    return item && typeof item === 'object' ? item : null;
  }

  function visibleClustersForAll() {
    var enabled = enabledTopicIds();
    var mine = profile.get().topics;
    return state.clusters.filter(function (c) {
      if (enabled.indexOf(c.topic) === -1) return false;
      return !mine || mine.length === 0 || mine.indexOf(c.topic) !== -1;
    });
  }

  function trackedMatches() {
    return Search.matchTracked(profile.get().terms, state.clusters, state.storiesById);
  }

  function newTrackedCount() {
    var terms = profile.get().terms;
    var count = 0;
    trackedMatches().forEach(function (m) {
      var isNew = m.terms.some(function (name) {
        var t = terms.filter(function (x) { return x.text === name; })[0];
        return t && t.lastChecked && Date.parse(m.cluster.latest) > Date.parse(t.lastChecked);
      });
      if (isNew) count += 1;
    });
    return count;
  }

  /* ---------- routing ---------- */

  function parseHash() {
    var raw = location.hash.replace(/^#/, '');
    var params = {};
    raw.split('&').forEach(function (p) {
      if (!p) return;
      var i = p.indexOf('=');
      params[i < 0 ? p : p.slice(0, i)] = i < 0 ? '' : safeDecode(p.slice(i + 1));
    });
    var page = parseInt(params.page, 10);
    if (!page || page < 1) page = 1;

    if (params.story) return { name: 'story', id: safeId(params.story), listen: params.listen === '1', tab: params.tab === 'full' ? 'full' : 'quick' };
    if ('settings' in params) return { name: 'settings' };
    if ('tracked' in params) return { name: 'tracked', page: page };
    if (params.search != null) return { name: 'search', q: params.search.slice(0, 80), page: page };
    return { name: 'feed', topic: safeId(params.topic) || 'all', page: page };
  }

  function go(hash) {
    if (location.hash === hash) onRoute(); else location.hash = hash;
  }

  // Notification taps open /?story=ID&listen=1. Turn that into a normal in-app address.
  function consumeDeepLink() {
    var q = new URLSearchParams(location.search);
    var id = safeId(q.get('story'));
    if (!id) return false;
    var listen = q.get('listen') === '1';
    history.replaceState(null, '', location.pathname + '#story=' + id + (listen ? '&listen=1' : ''));
    return true;
  }

  /* ---------- cards ---------- */

  function coverageBadge(cluster) {
    if (state.demo) return el('span', 'badge demo', 'Demo data');
    if (cluster.multiSource) return el('span', 'badge multi', cluster.independentSources + ' independent outlets');
    return el('span', 'badge single', 'Single source');
  }

  function renderCard(cluster, extra) {
    extra = extra || {};
    var lead = state.storiesById[cluster.leadId];
    var card = el('article', 'card t-' + safeId(cluster.topic));
    card.insertAdjacentHTML('afterbegin', sceneSvg(cluster.topic, pictureText(cluster)));

    var body = el('div', 'card-body');
    var badges = el('div', 'badges');
    badges.appendChild(el('span', 'badge topic', topicLabel(cluster.topic)));
    badges.appendChild(coverageBadge(cluster));
    var ex = explainerFor(cluster);
    if (ex && ex.status === 'ok') badges.appendChild(el('span', 'badge explained', 'Explained'));
    if (extra.isNew) badges.appendChild(el('span', 'badge fresh', 'New'));
    body.appendChild(badges);

    var h = el('h2', 'headline');
    var link = el('a', 'headline-link', lead.title);
    link.href = '#story=' + encodeURIComponent(cluster.id);
    h.appendChild(link);
    body.appendChild(h);
    if (lead.snippet) body.appendChild(el('p', 'snippet', lead.snippet));

    if (extra.terms && extra.terms.length) {
      var tl = el('p', 'matched');
      tl.appendChild(document.createTextNode('Matches: '));
      tl.appendChild(el('strong', null, extra.terms.join(', ')));
      body.appendChild(tl);
    }

    var meta = el('p', 'meta');
    meta.appendChild(document.createTextNode(lead.publisher || 'Unknown source'));
    var when = timeAgo(lead.published || lead.firstSeen);
    if (lead.published && when) { meta.appendChild(el('span', 'dot', '•')); meta.appendChild(document.createTextNode(when)); }
    if (cluster.storyIds.length > 1) {
      meta.appendChild(el('span', 'dot', '•'));
      meta.appendChild(document.createTextNode('+' + (cluster.storyIds.length - 1) + ' more ' + (cluster.storyIds.length === 2 ? 'report' : 'reports')));
    }
    body.appendChild(meta);

    var actions = el('div', 'actions');
    var more = el('a', 'btn primary', ex && ex.status === 'ok' ? 'Explain it' : 'Details');
    more.href = '#story=' + encodeURIComponent(cluster.id);
    actions.appendChild(more);
    var href = safeHttpsUrl(lead.url);
    if (href) {
      var a = el('a', 'read', state.demo ? 'Visit an example outlet ↗' : 'Read at ' + (lead.publisher || 'the source') + ' ↗');
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      actions.appendChild(a);
    }
    body.appendChild(actions);
    card.appendChild(body);
    return card;
  }

  function viewTitle(text, sub) {
    var wrap = el('div', 'view-head wide');
    wrap.appendChild(el('h2', 'view-title', text));
    if (sub) wrap.appendChild(el('p', 'view-sub', sub));
    return wrap;
  }

  /* ---------- pagination & views ---------- */

  var PAGE_SIZE = 9;
  var MAX_PAGES = 9;

  function renderPagination(totalItems, currentPage, makeHash) {
    var totalPages = Math.ceil(totalItems / PAGE_SIZE);
    if (totalPages <= 1) return null;

    var maxPage = Math.min(totalPages, MAX_PAGES);
    if (currentPage < 1) currentPage = 1;
    if (currentPage > maxPage) currentPage = maxPage;

    var wrap = el('nav', 'pagination wide');
    wrap.setAttribute('aria-label', 'Pagination');

    var controls = el('div', 'pagination-controls');

    var prev = button('‹ Prev', 'btn page-prev', function () {
      if (currentPage > 1) {
        go(makeHash(currentPage - 1));
      }
    });
    prev.setAttribute('aria-label', 'Previous page');
    if (currentPage <= 1) {
      prev.disabled = true;
    }
    controls.appendChild(prev);

    for (var p = 1; p <= maxPage; p++) {
      (function (pageNumber) {
        var isCurrent = pageNumber === currentPage;
        var btn = button(String(pageNumber), 'btn page-num' + (isCurrent ? ' primary active' : ''), function () {
          if (!isCurrent) {
            go(makeHash(pageNumber));
          }
        });
        btn.setAttribute('aria-label', 'Page ' + pageNumber);
        if (isCurrent) {
          btn.setAttribute('aria-current', 'page');
        }
        controls.appendChild(btn);
      })(p);
    }

    var next = button('Next ›', 'btn page-next', function () {
      if (currentPage < maxPage) {
        go(makeHash(currentPage + 1));
      }
    });
    next.setAttribute('aria-label', 'Next page');
    if (currentPage >= maxPage) {
      next.disabled = true;
    }
    controls.appendChild(next);

    wrap.appendChild(controls);

    var info = el('p', 'pagination-info', 'Page ' + currentPage + ' of ' + maxPage + ' · ' + totalItems + ' stories');
    wrap.appendChild(info);

    return wrap;
  }

  function renderFeedView(feed) {
    var topic = state.view.topic;
    var list = topic === 'all' ? visibleClustersForAll() : state.clusters.filter(function (c) { return c.topic === topic; });
    if (!list.length) {
      feed.appendChild(mascotBlock('sleep', 'Nothing here yet. Check back after the next update.', 'wide'));
      return;
    }

    var totalPages = Math.min(Math.ceil(list.length / PAGE_SIZE), MAX_PAGES);
    var currentPage = state.view.page || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    var start = (currentPage - 1) * PAGE_SIZE;
    var pageItems = list.slice(start, start + PAGE_SIZE);

    pageItems.forEach(function (c) { feed.appendChild(renderCard(c)); });

    var pag = renderPagination(list.length, currentPage, function (p) {
      return '#topic=' + encodeURIComponent(topic) + (p > 1 ? '&page=' + p : '');
    });
    if (pag) feed.appendChild(pag);
  }

  function renderSearchView(feed) {
    var q = state.view.q || '';
    var results = Search.searchClusters(q, state.clusters, state.storiesById);
    feed.appendChild(viewTitle(results.length + (results.length === 1 ? ' story' : ' stories') + ' for “' + q + '”', 'Searched across the last few days of headlines from Buzz’s sources.'));
    if (state.searchNote) {
      var note = el('p', 'search-note wide');
      note.appendChild(document.createTextNode(state.searchNote.text + ' '));
      if (state.searchNote.undo) {
        var undoTerm = state.searchNote.undo;
        note.appendChild(button('Undo', 'linkish', function () {
          profile.removeTerm(undoTerm);
          state.searchNote = null;
          afterProfileChange();
          render(true);
        }));
      }
      feed.appendChild(note);
    }
    if (!results.length) {
      feed.appendChild(mascotBlock('think', 'Nothing found in the last few days. Buzz only watches its listed sources, so a quiet topic can mean no coverage there yet. Try fewer or different words.', 'wide'));
      return;
    }

    var totalPages = Math.min(Math.ceil(results.length / PAGE_SIZE), MAX_PAGES);
    var currentPage = state.view.page || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    var start = (currentPage - 1) * PAGE_SIZE;
    var pageResults = results.slice(start, start + PAGE_SIZE);

    pageResults.forEach(function (r) { feed.appendChild(renderCard(r.cluster)); });

    var pag = renderPagination(results.length, currentPage, function (p) {
      return '#search=' + encodeURIComponent(q) + (p > 1 ? '&page=' + p : '');
    });
    if (pag) feed.appendChild(pag);
  }

  function renderTrackedView(feed) {
    var p = profile.get();
    feed.appendChild(viewTitle('My Tracked', 'Anything you search is remembered here, and new matches show up as stories arrive. Saved on this device only.'));

    if (!p.terms.length) {
      feed.appendChild(mascotBlock('think', 'Nothing tracked yet. Search for anything: a company, a country, a person, a thing. Buzz will remember it for you.', 'wide'));
      return;
    }

    var chips = el('ul', 'term-list wide');
    p.terms.forEach(function (t) {
      var li = el('li', 'term');
      li.appendChild(el('span', null, t.text));
      var x = button('×', 'term-x', function () { profile.removeTerm(t.text); afterProfileChange(); render(true); });
      x.setAttribute('aria-label', 'Stop tracking ' + t.text);
      li.appendChild(x);
      chips.appendChild(li);
    });
    feed.appendChild(chips);

    var snapshot = {};
    p.terms.forEach(function (t) { snapshot[t.text] = t.lastChecked; });
    var matches = trackedMatches();
    if (!matches.length) {
      feed.appendChild(mascotBlock('sleep', 'No matches in the last few days. They will appear here when a source reports on your terms.', 'wide'));
    }

    var totalPages = Math.min(Math.ceil(matches.length / PAGE_SIZE), MAX_PAGES);
    var currentPage = state.view.page || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    var start = (currentPage - 1) * PAGE_SIZE;
    var pageMatches = matches.slice(start, start + PAGE_SIZE);

    pageMatches.forEach(function (m) {
      var isNew = m.terms.some(function (name) { return snapshot[name] && Date.parse(m.cluster.latest) > Date.parse(snapshot[name]); });
      feed.appendChild(renderCard(m.cluster, { terms: m.terms, isNew: isNew }));
    });

    var pag = renderPagination(matches.length, currentPage, function (p) {
      return '#tracked' + (p > 1 ? '&page=' + p : '');
    });
    if (pag) feed.appendChild(pag);

    profile.markChecked(nowIso());
    renderChips();
  }

  function listItems(title, items, className) {
    if (!items.length) return null;
    var sec = el('section', 'ex-block ' + (className || ''));
    sec.appendChild(el('h3', null, title));
    var ul = el('ul');
    items.forEach(function (it) { ul.appendChild(it); });
    sec.appendChild(ul);
    return sec;
  }

  function publishersFor(ids) {
    var names = [];
    arr(ids).forEach(function (id) {
      var s = state.storiesById[id];
      if (s && names.indexOf(s.publisher) === -1) names.push(s.publisher);
    });
    return names;
  }

  var LEVEL_LABELS = ['Plain version (like for an 18-year-old)', 'Simpler and longer (like for a 12-year-old)'];

  function markAskable(node, c) {
    node.classList.add('askable');
    node.setAttribute('data-headline', str(c.headline).slice(0, 120));
  }

  function glossaryBlock(c) {
    var gl = arr(c.glossary).filter(function (g) { return g && str(g.term) && str(g.meaning); });
    if (!gl.length) return null;
    var gs = el('section', 'ex-block gl');
    gs.appendChild(el('h3', null, 'Words to know'));
    var dl = el('dl');
    gl.forEach(function (g) { dl.appendChild(el('dt', null, str(g.term))); dl.appendChild(el('dd', null, str(g.meaning))); });
    gs.appendChild(dl);
    return gs;
  }

  function askHint() {
    var cfgOk = window.BuzzAsk && window.BuzzAsk.configured();
    return el('p', 'ask-hint', cfgOk
      ? 'Tip: select any word or sentence to get a quick explanation of it.'
      : 'Tip: select any word or sentence to look it up here. The AI helper is not switched on yet (see Settings).');
  }

  // Quick read: the plain explainer, with a Simplify button.
  function renderExplainer(cluster, ex, wrap) {
    var c = ex.content || {};
    var levels = arr(c.levels).map(str).filter(Boolean);
    var panel = el('section', 'explainer');
    markAskable(panel, c);
    if (state.level > 0) panel.setAttribute('data-level', 'simple');
    panel.appendChild(el('h3', 'ex-title', str(c.headline) || 'In plain words'));
    panel.appendChild(el('p', 'ex-what', str(c.whatHappened)));

    if (levels.length) {
      var level = Math.min(state.level, levels.length - 1);
      panel.appendChild(el('p', 'level-label', LEVEL_LABELS[level] || LEVEL_LABELS[0]));
      var text = el('div', 'ex-text');
      text.setAttribute('aria-live', 'polite');
      levels[level].split(/\n{2,}/).forEach(function (para) { if (para.trim()) text.appendChild(el('p', null, para.trim())); });
      panel.appendChild(text);

      var row = el('div', 'actions');
      if (level < levels.length - 1) {
        row.appendChild(button('Simplify more', 'btn primary', function () { state.level = level + 1; speech.stop(); render(true); }));
      }
      if (level > 0) row.appendChild(button('Back to plain version', 'btn', function () { state.level = 0; speech.stop(); render(true); }));
      var fullLink = el('a', 'btn', 'Full explanation');
      fullLink.href = '#story=' + encodeURIComponent(cluster.id) + '&tab=full';
      row.appendChild(fullLink);
      panel.appendChild(row);
      panel.appendChild(renderListen((str(c.headline) ? str(c.headline) + '. ' : '') + levels[level]));
    }
    panel.appendChild(askHint());

    var confirmed = arr(c.confirmed).map(function (it) {
      var li = el('li');
      li.appendChild(document.createTextNode(str(it.text)));
      var by = publishersFor(it.refs);
      if (by.length) li.appendChild(el('span', 'by', ' (' + by.join(', ') + ')'));
      return li;
    });
    var claimed = arr(c.claimed).map(function (it) {
      var li = el('li');
      li.appendChild(document.createTextNode(str(it.text)));
      var who = str(it.by);
      if (who) li.appendChild(el('span', 'by', ' (' + who + ')'));
      return li;
    });
    var unknown = arr(c.unknown).map(function (t) { return el('li', null, str(t)); });
    [
      listItems('Confirmed by two or more independent outlets', confirmed, 'ok'),
      listItems('Claimed, not confirmed', claimed, 'claim'),
      listItems('Still unknown', unknown, 'unk')
    ].forEach(function (s) { if (s) panel.appendChild(s); });

    var gs = glossaryBlock(c);
    if (gs) panel.appendChild(gs);
    panel.appendChild(el('p', 'ai-note', 'Written by AI from only the headlines and short snippets listed below. It can be wrong. Open the sources to check.'));
    wrap.appendChild(panel);
  }

  function paragraphs(texts, className) {
    var box = el('div', className || 'prose');
    texts.forEach(function (t) { box.appendChild(el('p', null, t)); });
    return box;
  }

  // Full explanation: background, the real numbers as charts, what happened so far, who is affected, what may come next.
  function renderFull(cluster, ex, wrap) {
    var c = ex.content || {};
    var f = c.full || {};
    var panel = el('section', 'explainer full');
    markAskable(panel, c);
    panel.appendChild(el('h3', 'ex-title', str(c.headline) || 'The full picture'));

    var s1 = el('section', 'ex-block premise');
    s1.appendChild(el('h3', null, 'The story in short'));
    s1.appendChild(el('p', null, str(c.whatHappened)));
    panel.appendChild(s1);

    var bg = arr(f.background).map(str).filter(Boolean);
    if (bg.length) {
      var s2 = el('section', 'ex-block bg');
      s2.appendChild(el('h3', null, 'Background'));
      s2.appendChild(el('p', 'tag', 'General context from the AI. It is not from today’s reports, so check anything important.'));
      s2.appendChild(paragraphs(bg));
      panel.appendChild(s2);
    }

    var Charts = window.BuzzCharts;
    var charts = Charts ? arr(ex.charts) : [];
    var notes = {};
    arr(f.chartNotes).forEach(function (n) { if (n && n.seriesId) notes[n.seriesId] = str(n.text); });
    var figs = [];
    charts.forEach(function (series) { var fig = Charts.line(series, notes[series.id]); if (fig) figs.push(fig); });
    var ev = f.expectedVsActual && Charts ? Charts.expectedVsActual(f.expectedVsActual, publishersFor(f.expectedVsActual.refs)) : null;
    if (ev) figs.push(ev);
    if (figs.length) {
      var s3 = el('section', 'ex-block numbers');
      s3.appendChild(el('h3', null, 'The numbers'));
      s3.appendChild(el('p', 'tag', 'Charts use real public data, named under each chart. The AI did not draw them.'));
      figs.forEach(function (fig) { s3.appendChild(fig); });
      panel.appendChild(s3);
    }

    var soFar = arr(f.soFar).filter(function (x) { return x && str(x.text); }).map(function (x) {
      var li = el('li');
      li.appendChild(document.createTextNode(str(x.text)));
      var by = publishersFor(x.refs);
      if (by.length) li.appendChild(el('span', 'by', ' (' + by.join(', ') + ')'));
      return li;
    });
    var s4 = listItems('What has happened so far', soFar, 'ok');
    if (s4) panel.appendChild(s4);

    var impact = arr(f.impact).map(str).filter(Boolean).map(function (t) { return el('li', null, t); });
    var s5 = listItems('Who could be affected, and how', impact, 'eff');
    if (s5) panel.appendChild(s5);

    var preds = arr(f.predictions).filter(function (x) { return x && str(x.text); });
    var reported = preds.filter(function (x) { return x.basis === 'reported'; });
    var reasoned = preds.filter(function (x) { return x.basis !== 'reported'; });
    var s6 = listItems('Predictions reported by outlets', reported.map(function (x) {
      var li = el('li');
      li.appendChild(document.createTextNode(str(x.text)));
      if (str(x.by)) li.appendChild(el('span', 'by', ' (' + str(x.by) + ')'));
      return li;
    }), 'claim');
    if (s6) panel.appendChild(s6);
    var s7 = listItems('What could happen next (the AI’s reasoning, not a forecast)', reasoned.map(function (x) { return el('li', null, str(x.text)); }), 'eff');
    if (s7) panel.appendChild(s7);

    var unknown = arr(c.unknown).map(function (t) { return el('li', null, str(t)); });
    var s8 = listItems('Still unknown', unknown, 'unk');
    if (s8) panel.appendChild(s8);

    var gs = glossaryBlock(c);
    if (gs) panel.appendChild(gs);
    panel.appendChild(askHint());
    panel.appendChild(el('p', 'ai-note', 'Written by AI from only the headlines and short snippets listed below, plus the public data named under each chart. It can be wrong. Open the sources to check.'));
    wrap.appendChild(panel);
  }

  function renderListen(text) {
    var box = el('div', 'listen');
    if (!speech.supported) {
      box.appendChild(el('p', 'foot-note', 'Reading aloud is not available in this browser.'));
      return box;
    }
    var main = button('Listen', 'btn listen-btn');
    main.id = 'listen-main';
    var stop = button('Stop', 'btn', function () { speech.stop(); });
    function paint() {
      var s = speech.state();
      main.textContent = s === 'speaking' ? 'Pause' : s === 'paused' ? 'Resume' : 'Listen';
      stop.hidden = s === 'idle';
      main.setAttribute('aria-pressed', String(s === 'speaking'));
    }
    main.addEventListener('click', function () {
      var s = speech.state();
      if (s === 'speaking') speech.pause();
      else if (s === 'paused') speech.resume();
      else speech.speak(text);
    });
    speech.onChange(paint);
    paint();
    box.appendChild(main);
    box.appendChild(stop);
    return box;
  }

  function renderStoryView(feed) {
    var cluster = findCluster(state.view.id);
    var wrap = el('div', 'story wide');
    feed.appendChild(wrap);
    var back = el('a', 'back', '← Back to headlines');
    back.href = '#' + state.lastFeedHash;
    wrap.appendChild(back);
    if (!cluster) {
      wrap.appendChild(mascotBlock('sleep', 'That story has dropped out of the feed. Headlines older than a week are removed.'));
      return;
    }
    var lead = state.storiesById[cluster.leadId];
    var card = el('article', 'story-card t-' + safeId(cluster.topic));
    card.insertAdjacentHTML('afterbegin', sceneSvg(cluster.topic, pictureText(cluster)));
    var body = el('div', 'card-body');
    var badges = el('div', 'badges');
    badges.appendChild(el('span', 'badge topic', topicLabel(cluster.topic)));
    badges.appendChild(coverageBadge(cluster));
    body.appendChild(badges);
    body.appendChild(el('h2', 'headline big', lead.title));
    card.appendChild(body);
    wrap.appendChild(card);

    var leadHref = safeHttpsUrl(lead.url);
    if (leadHref) {
      var srow = el('div', 'source-row');
      var sa = el('a', 'read', (state.demo ? 'Visit an example outlet' : 'Read the original at ' + (lead.publisher || 'the source')) + ' ↗');
      sa.href = leadHref;
      sa.target = '_blank';
      sa.rel = 'noopener noreferrer';
      srow.appendChild(sa);
      wrap.appendChild(srow);
    }

    var ex = explainerFor(cluster);
    if (ex && ex.status === 'ok' && ex.content) {
      var tab = state.view.tab === 'full' ? 'full' : 'quick';
      var tabs = el('nav', 'tabs');
      tabs.setAttribute('aria-label', 'Explanation style');
      [['quick', 'Quick read', ''], ['full', 'Full explanation', '&tab=full']].forEach(function (d) {
        var a = el('a', 'tab' + (tab === d[0] ? ' on' : ''), d[1]);
        a.href = '#story=' + encodeURIComponent(cluster.id) + d[2];
        if (tab === d[0]) a.setAttribute('aria-current', 'page');
        tabs.appendChild(a);
      });
      wrap.appendChild(tabs);
      if (tab === 'full') renderFull(cluster, ex, wrap); else renderExplainer(cluster, ex, wrap);
    } else if (ex && ex.status === 'insufficient') {
      wrap.appendChild(mascotBlock('think', str(ex.reason) || 'There is not enough information in the reports to explain this responsibly yet.', 'inline'));
    } else {
      wrap.appendChild(mascotBlock('think', 'No plain-language explainer for this story yet. The sources below have the full report.', 'inline'));
    }

    var src = el('section', 'ex-block reported');
    src.appendChild(el('h3', null, cluster.storyIds.length > 1 ? 'Reported by' : 'Source'));
    var ul = el('ul', 'report-list');
    cluster.storyIds.forEach(function (id) {
      var s = state.storiesById[id];
      var li = el('li');
      li.appendChild(el('strong', null, s.publisher + ': '));
      var href = safeHttpsUrl(s.url);
      if (href) {
        var a = el('a', null, s.title);
        a.href = href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        li.appendChild(a);
        li.appendChild(document.createTextNode(' ↗'));
      } else {
        li.appendChild(document.createTextNode(s.title));
      }
      ul.appendChild(li);
    });
    src.appendChild(ul);
    src.appendChild(el('p', 'foot-note', cluster.multiSource
      ? 'Several independent outlets report this. That shows it is being widely reported, not that every detail is true.'
      : 'Only one source so far. Treat details with care until others report it.'));
    wrap.appendChild(src);

    if (state.view.listen) {
      var lb = $('#listen-main');
      if (lb) { lb.classList.add('attention'); lb.focus(); }
    }
  }

  function renderSettingsView(feed) {
    var wrap = el('div', 'settings wide');
    feed.appendChild(wrap);
    wrap.appendChild(viewTitle('Settings', 'Everything here is saved on this device.'));
    var p = profile.get();

    // Topics
    var s1 = el('section', 'panel');
    s1.appendChild(el('h3', null, 'Topics in your main feed'));
    s1.appendChild(el('p', 'foot-note', 'Choose what shows under “All”. Leave everything ticked to see it all.'));
    var list = el('div', 'check-grid');
    var chosen = p.topics && p.topics.length ? p.topics : enabledTopicIds();
    state.topics.filter(function (t) { return t.enabled; }).forEach(function (t) {
      var label = el('label', 'check');
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = chosen.indexOf(t.id) !== -1;
      cb.setAttribute('data-id', t.id);
      cb.addEventListener('change', function () {
        var now = [];
        list.querySelectorAll('input').forEach(function (i) { if (i.checked) now.push(i.getAttribute('data-id')); });
        if (!now.length) { cb.checked = true; return; } // always keep at least one topic
        profile.setTopics(now.length === enabledTopicIds().length ? null : now);
        afterProfileChange();
      });
      label.appendChild(cb);
      label.appendChild(el('span', null, t.label));
      list.appendChild(label);
    });
    s1.appendChild(list);
    wrap.appendChild(s1);

    // Tracking
    var s2 = el('section', 'panel');
    s2.appendChild(el('h3', null, 'My Tracked'));
    var autoLabel = el('label', 'check');
    var auto = document.createElement('input');
    auto.type = 'checkbox';
    auto.checked = p.autoSave;
    auto.addEventListener('change', function () { profile.setAutoSave(auto.checked); });
    autoLabel.appendChild(auto);
    autoLabel.appendChild(el('span', null, 'Remember what I search for'));
    s2.appendChild(autoLabel);
    var count = el('p', 'foot-note', p.terms.length + ' of ' + profile.MAX_TERMS + ' terms saved.');
    s2.appendChild(count);
    var row = el('div', 'actions');
    row.appendChild(button('Clear all tracked terms', 'btn', function () { profile.clearTerms(); afterProfileChange(); count.textContent = '0 of ' + profile.MAX_TERMS + ' terms saved.'; }));
    s2.appendChild(row);
    wrap.appendChild(s2);

    // Notifications
    var s3 = el('section', 'panel');
    s3.appendChild(el('h3', null, 'Notifications'));
    var body = el('div', 'notify-body');
    body.appendChild(el('p', 'foot-note', 'Checking…'));
    s3.appendChild(body);
    wrap.appendChild(s3);
    renderNotifyPanel(body);

    // AI helper (explain a selected word)
    var sa = el('section', 'panel');
    sa.appendChild(el('h3', null, 'AI helper for words'));
    var Ask = window.BuzzAsk;
    if (Ask && Ask.configured()) {
      sa.appendChild(el('p', 'foot-note', 'Select any word or sentence in an explanation to get a short explanation of it in the context of that story. Type your access code once, so only you can use it.'));
      var codeLabel = el('label', 'field');
      codeLabel.appendChild(el('span', null, 'Access code'));
      var codeIn = document.createElement('input');
      codeIn.type = 'password';
      codeIn.autocomplete = 'off';
      codeIn.maxLength = 80;
      codeIn.value = Ask.getCode();
      var saved = el('p', 'foot-note', Ask.getCode() ? 'Saved on this device.' : 'Not saved yet.');
      codeIn.addEventListener('change', function () { Ask.setCode(codeIn.value.trim()); saved.textContent = codeIn.value.trim() ? 'Saved on this device.' : 'Not saved yet.'; });
      codeLabel.appendChild(codeIn);
      sa.appendChild(codeLabel);
      sa.appendChild(saved);
    } else {
      sa.appendChild(el('p', 'foot-note', 'Not switched on yet. This lets you select any word in an explanation and ask the AI what it means in that story. It needs the free helper set up once (README, Part 4).'));
    }
    wrap.appendChild(sa);

    // Privacy
    var s4 = el('section', 'panel');
    s4.appendChild(el('h3', null, 'Your data'));
    s4.appendChild(el('p', 'foot-note', 'Buzz has no accounts. Your searches, topics and times are stored in this browser. If you turn on notifications, your chosen times, topics and tracked terms are also stored on a server so the daily message can be built. They are deleted when you turn notifications off.'));
    var r2 = el('div', 'actions');
    r2.appendChild(button('Delete everything Buzz saved about me', 'btn danger', function () {
      var N = window.BuzzNotify;
      var done = function () { profile.clearAll(); state.level = 0; render(true); };
      if (N && N.disable) N.disable().then(done, done); else done();
    }));
    s4.appendChild(r2);
    wrap.appendChild(s4);
  }

  function renderNotifyPanel(body) {
    var N = window.BuzzNotify;
    body.textContent = '';
    if (!N) { body.appendChild(el('p', 'foot-note', 'Notifications are not available in this build.')); return; }
    N.status().then(function (st) {
      body.textContent = '';
      var p = profile.get();
      var messages = {
        unconfigured: 'Notifications are built but not switched on for this site yet. The site owner needs to finish the notification setup (see the README).',
        unsupported: 'This browser cannot receive web notifications.',
        'needs-install': 'On iPhone, notifications only work after you add Buzz to your Home Screen (Share, then Add to Home Screen) and open it from there.',
        denied: 'Notifications are blocked for Buzz. Allow them in your phone’s Settings, then come back.'
      };
      if (messages[st.state]) { body.appendChild(el('p', 'foot-note', messages[st.state])); return; }

      body.appendChild(el('p', 'foot-note', 'Pick up to two times a day. Buzz sends one short message at each time, never more.'));
      var times = el('div', 'time-row');
      var inputs = [];
      for (var i = 0; i < 2; i++) {
        var lab = el('label', 'time');
        lab.appendChild(el('span', null, i === 0 ? 'First time' : 'Second time (optional)'));
        var inp = document.createElement('input');
        inp.type = 'time';
        inp.value = p.times[i] || '';
        inp.step = 900;
        inputs.push(inp);
        lab.appendChild(inp);
        times.appendChild(lab);
      }
      body.appendChild(times);
      body.appendChild(el('p', 'foot-note', 'Times use your phone’s time zone: ' + N.timeZone() + '.'));
      var msg = el('p', 'foot-note', st.state === 'on' ? 'Notifications are on.' : 'Notifications are off.');
      msg.setAttribute('role', 'status');
      var act = el('div', 'actions');
      act.appendChild(button(st.state === 'on' ? 'Save times' : 'Turn on notifications', 'btn primary', function () {
        var t = inputs.map(function (x) { return x.value; }).filter(Boolean);
        if (!t.length) { msg.textContent = 'Pick at least one time first.'; return; }
        profile.setTimes(t, N.timeZone());
        msg.textContent = 'Working…';
        N.enable(N.payload(profile.get())).then(function () { renderNotifyPanel(body); }, function (e) { msg.textContent = (e && e.message) || 'Could not turn on notifications.'; });
      }));
      if (st.state === 'on') {
        act.appendChild(button('Turn off', 'btn', function () {
          N.disable().then(function () { profile.setTimes([], N.timeZone()); renderNotifyPanel(body); }, function (e) { msg.textContent = (e && e.message) || 'Could not turn off.'; });
        }));
      }
      body.appendChild(act);
      body.appendChild(msg);
    }, function () { body.textContent = ''; body.appendChild(el('p', 'foot-note', 'Could not check notification status.')); });
  }

  /* ---------- chips, notices, footer ---------- */

  function renderChips() {
    var nav = $('#chips');
    nav.textContent = '';
    var v = state.view;
    var active = v.name === 'tracked' ? 'tracked' : v.name === 'feed' ? v.topic : '';
    var add = function (id, label, hash) {
      var b = button(label, 'chip', function () { go(hash); });
      b.setAttribute('aria-pressed', String(active === id));
      nav.appendChild(b);
      return b;
    };
    add('all', 'All', '#topic=all');
    var tr = add('tracked', 'My Tracked', '#tracked');
    var n = newTrackedCount();
    if (n > 0) {
      var c = el('span', 'count', String(n));
      c.setAttribute('aria-label', n + ' new');
      tr.appendChild(c);
    }
    state.topics.filter(function (t) { return t.enabled; }).forEach(function (t) { add(t.id, t.label, '#topic=' + encodeURIComponent(t.id)); });
  }

  function notice(kind, title, text, onDismiss) {
    var box = el('div', 'notice ' + kind);
    var p = el('p');
    p.appendChild(el('strong', null, title + ' '));
    p.appendChild(document.createTextNode(text));
    box.appendChild(p);
    if (onDismiss) box.appendChild(button('Got it', null, function () { box.remove(); onDismiss(); }));
    $('#notices').appendChild(box);
    return box;
  }

  function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function isStandalone() {
    return window.navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  }
  function remember(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* blocked */ } }
  function recall(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }

  function renderNotices() {
    $('#notices').textContent = '';
    if (state.demo) notice('', 'Demo data.', 'These cards are examples, not real news. Real headlines appear after the first scheduled update.');
    if (isIos() && !isStandalone() && recall('buzz.installHint') !== 'seen') {
      notice('info', 'Install me.', 'Tap the Share button, then “Add to Home Screen”. Open Buzz from the new icon on your Home Screen, because saved settings and notifications only work there.', function () { remember('buzz.installHint', 'seen'); });
    }
    if (navigator.onLine === false) notice('warn', 'You are offline.', 'Showing the headlines saved on this device.');
  }

  function renderSources() {
    var ul = $('#sources');
    ul.textContent = '';
    var statuses = (state.status && state.status.sources) || {};
    state.sources.filter(function (s) { return s.active; }).forEach(function (src) {
      var li = el('li');
      li.appendChild(el('span', null, src.publisher + ' · ' + src.id.replace(/^[a-z]+-/, '').replace(/-/g, ' ')));
      var st = statuses[src.id];
      var text, bad = false;
      if (!st || !st.lastAttempt) { text = 'not fetched yet'; }
      else if (st.paused) { text = 'paused after repeated failures'; bad = true; }
      else if (!st.ok) { text = 'last update failed' + (st.lastSuccess ? ', last good ' + timeAgo(st.lastSuccess) : ''); bad = true; }
      else {
        var ageH = (Date.now() - Date.parse(st.lastSuccess)) / 3600000;
        text = 'updated ' + timeAgo(st.lastSuccess);
        if (ageH > 24) { text += ' (stale)'; bad = true; }
      }
      li.appendChild(el('span', 'state' + (bad ? ' bad' : ''), text));
      ul.appendChild(li);
    });
    $('#refreshed').textContent = state.generatedAt && !state.demo ? 'Last refresh: ' + new Date(state.generatedAt).toLocaleString() : '';
  }

  /* ---------- render ---------- */

  function viewKey(v) { return v.name + '|' + (v.topic || '') + '|' + (v.q || '') + '|' + (v.id || '') + '|' + (v.page || 1); }

  function render(keepScroll) {
    var feed = $('#feed');
    var v = state.view;
    if (v.name !== 'story') speech.stop();
    feed.textContent = '';
    feed.className = 'feed' + (v.name === 'story' || v.name === 'settings' ? ' single' : '');
    if (v.name === 'feed') state.lastFeedHash = 'topic=' + encodeURIComponent(v.topic) + (v.page > 1 ? '&page=' + v.page : '');
    if (v.name === 'tracked') state.lastFeedHash = 'tracked' + (v.page > 1 ? '&page=' + v.page : '');
    if (v.name === 'search') state.lastFeedHash = 'search=' + encodeURIComponent(v.q) + (v.page > 1 ? '&page=' + v.page : '');
    renderChips();
    var q = $('#q');
    if (q && v.name !== 'search') q.value = '';
    else if (q && v.name === 'search') q.value = v.q;
    if (v.name === 'story') renderStoryView(feed);
    else if (v.name === 'settings') renderSettingsView(feed);
    else if (v.name === 'tracked') renderTrackedView(feed);
    else if (v.name === 'search') renderSearchView(feed);
    else renderFeedView(feed);
    document.title = (v.name === 'story' ? 'Story' : v.name === 'settings' ? 'Settings' : v.name === 'tracked' ? 'My Tracked' : v.name === 'search' ? 'Search' : 'Buzz') + ' · Buzz';
    if (!keepScroll) window.scrollTo(0, 0);
    if (!state.firstRender && !keepScroll) feed.focus({ preventScroll: true });
    state.firstRender = false;
  }

  function onRoute() {
    var next = parseHash();
    if (viewKey(next) !== viewKey(state.view)) {
      state.level = 0;
      if (next.name !== 'search') state.searchNote = null;
    }
    state.view = next;
    render();
  }

  /* ---------- profile changes and notification sync ---------- */

  var syncTimer = null;
  function afterProfileChange() {
    renderChips();
    var N = window.BuzzNotify;
    if (!N || !N.sync) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () { N.sync(profile.get()).catch(function () { /* retried on the next change */ }); }, 800);
  }

  function onSearchSubmit(e) {
    e.preventDefault();
    var input = $('#q');
    var query = input.value.replace(/\s+/g, ' ').trim();
    if (query.length < 2) { input.focus(); return; }
    var res = profile.recordSearch(query, nowIso());
    var note = null;
    if (res.ok && res.saved) note = { text: 'Saved “' + res.term + '” to My Tracked.', undo: res.term };
    else if (res.ok && res.already) note = { text: '“' + res.term + '” is already in My Tracked.' };
    else if (!res.ok) note = { text: res.reason };
    state.searchNote = note;
    if (res.ok && res.saved) afterProfileChange();
    go('#search=' + encodeURIComponent(query));
  }

  /* ---------- start ---------- */

  function init() {
    addFilterDefs();
    if (window.BuzzAsk) window.BuzzAsk.attach();
    var bm = $('#brand-mascot');
    if (bm && Art) bm.innerHTML = Art.mascot('happy');
    $('#search-form').addEventListener('submit', onSearchSubmit);
    $('#open-settings').addEventListener('click', function () { go('#settings'); });
    consumeDeepLink();
    state.view = parseHash();
    window.addEventListener('hashchange', onRoute);
    window.addEventListener('online', renderNotices);
    window.addEventListener('offline', renderNotices);

    Promise.all([
      loadJSON('data/topics.json'),
      loadJSON('data/stories.json'),
      loadJSON('data/sources.json').catch(function () { return { sources: [] }; }),
      loadJSON('data/status.json').catch(function () { return null; }),
      loadJSON('data/explainers.json').catch(function () { return { items: {} }; })
    ]).then(function (res) {
      state.topics = arr(res[0].topics);
      setData(res[1]);
      state.sources = arr(res[2].sources);
      state.status = res[3];
      state.explainers = (res[4] && res[4].items) || {};
      if (state.view.name === 'feed' && state.view.topic !== 'all' && !state.topics.some(function (t) { return t.id === state.view.topic && t.enabled; })) state.view = { name: 'feed', topic: 'all' };
      renderNotices();
      render();
      renderSources();
    }).catch(function () {
      var feed = $('#feed');
      feed.textContent = '';
      feed.appendChild(mascotBlock('sleep', 'Could not load headlines. Check your connection and try again.', 'wide'));
      renderNotices();
    });
  }

  /* ---------- service worker (offline support) ---------- */

  if ('serviceWorker' in navigator) {
    var hadController = !!navigator.serviceWorker.controller;
    var reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (hadController && !reloaded) { reloaded = true; location.reload(); } // new version took over: reload once
    });
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(function () { /* offline support is optional */ });
    });
  }

  init();
})();
