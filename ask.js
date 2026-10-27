// Buzz "select a word to ask" helper.
// Select any word or sentence inside an explanation and a small sheet offers to explain it IN THE CONTEXT OF THAT NEWS.
// The AI call goes to a tiny free proxy (worker/ask.js on Cloudflare) so that no secret key is ever in this website.
// This file only holds PUBLIC settings: the proxy address (config.js) and the access code you type into Settings
// (kept on this device only). Answers are shown with textContent, never as HTML.
(function (root, factory) {
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BuzzAsk = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  var CODE_KEY = 'buzz.askCode';
  var LIMITS = { selection: 300, context: 600, headline: 140 };

  function config() { return (root.BUZZ_CONFIG && root.BUZZ_CONFIG.askUrl) || ''; }
  function httpsOk(u) { try { return new URL(u).protocol === 'https:'; } catch (e) { return false; } }
  function configured() { var u = config(); return !!u && httpsOk(u); }

  function store() {
    try { return root.localStorage; } catch (e) { return null; }
  }
  function getCode() { var s = store(); try { return (s && s.getItem(CODE_KEY)) || ''; } catch (e) { return ''; } }
  function setCode(v) {
    var s = store();
    try { if (s) { if (v) s.setItem(CODE_KEY, String(v).slice(0, 80)); else s.removeItem(CODE_KEY); } } catch (e) { /* blocked */ }
  }

  function cleanText(s, max) {
    return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  // Keep the part of the paragraph around the selection, so the AI sees the sentence the word sits in.
  function contextAround(block, selection) {
    var text = cleanText(block, 4000);
    var sel = cleanText(selection, LIMITS.selection);
    if (text.length <= LIMITS.context) return text;
    var i = text.indexOf(sel);
    if (i < 0) return text.slice(0, LIMITS.context);
    var start = Math.max(0, i - Math.floor((LIMITS.context - sel.length) / 2));
    return text.slice(start, start + LIMITS.context);
  }

  function buildRequest(parts) {
    var selection = cleanText(parts.selection, LIMITS.selection);
    if (selection.length < 2 || !/[\p{L}\p{N}]/u.test(selection)) return null;
    return {
      selection: selection,
      context: cleanText(parts.context, LIMITS.context),
      headline: cleanText(parts.headline, LIMITS.headline),
      level: parts.level === 'simple' ? 'simple' : 'plain',
      code: cleanText(parts.code, 80)
    };
  }

  var cache = {};
  var sent = 0;

  function ask(parts, fetchFn) {
    var req = buildRequest(parts);
    if (!req) return Promise.reject(new Error('Select a word or a sentence first.'));
    if (!configured()) return Promise.reject(new Error('The AI helper is not switched on yet. Settings explains how to turn it on.'));
    var key = req.selection + '|' + req.context + '|' + req.level;
    if (cache[key]) return Promise.resolve(cache[key]);
    if (sent >= 60) return Promise.reject(new Error('That is a lot of questions for one visit. Please come back a bit later.'));
    sent += 1;
    var f = fetchFn || root.fetch.bind(root);
    return f(config(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    }).then(function (res) {
      if (res.status === 401) throw new Error('The access code is missing or wrong. Add it in Settings.');
      if (res.status === 429) throw new Error('Too many questions for now. Try again in a little while.');
      if (!res.ok) throw new Error('The helper could not answer right now (error ' + res.status + ').');
      return res.json();
    }, function () { throw new Error('Could not reach the helper. Check your connection.'); }).then(function (data) {
      var text = data && typeof data.text === 'string' ? data.text.split(/\n{2,}/).map(function (p) { return cleanText(p, 900); }).filter(Boolean).join('\n\n').slice(0, 1200) : '';
      if (!text) throw new Error('The helper sent back an empty answer.');
      cache[key] = text;
      return text;
    });
  }

  /* ---------- the sheet (browser only) ---------- */

  var sheet = null;

  function mk(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function attach() {
    if (sheet || typeof document === 'undefined') return;
    var pending = null; // what was selected when the sheet last opened
    var timer = null;

    sheet = mk('aside', 'ask-sheet');
    sheet.hidden = true;
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-label', 'Explain the selected words');
    var head = mk('div', 'ask-head');
    var quote = mk('p', 'ask-quote');
    var close = mk('button', 'ask-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close');
    head.appendChild(quote);
    head.appendChild(close);
    var go = mk('button', 'btn primary ask-go', 'Explain this');
    go.type = 'button';
    var out = mk('div', 'ask-out');
    out.setAttribute('aria-live', 'polite');
    sheet.appendChild(head);
    sheet.appendChild(go);
    sheet.appendChild(out);
    document.body.appendChild(sheet);

    function hide() { sheet.hidden = true; out.textContent = ''; pending = null; }
    close.addEventListener('click', hide);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sheet.hidden) hide(); });

    go.addEventListener('click', function () {
      if (!pending) return;
      go.disabled = true;
      out.textContent = 'Thinking…';
      ask(pending).then(function (text) {
        out.textContent = '';
        text.split(/\n{2,}/).forEach(function (p) { out.appendChild(mk('p', null, p)); });
        out.appendChild(mk('p', 'ask-note', 'Written by AI in the context of this story. It can be wrong.'));
      }, function (err) {
        out.textContent = err && err.message ? err.message : 'Something went wrong.';
      }).then(function () { go.disabled = false; });
    });

    function onSelection() {
      var sel = root.getSelection && root.getSelection();
      if (!sel || sel.isCollapsed || !sel.anchorNode || !sel.focusNode) return;
      var a = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
      var b = sel.focusNode.nodeType === 1 ? sel.focusNode : sel.focusNode.parentElement;
      var zone = a && a.closest && a.closest('.askable');
      if (!zone || !b || !zone.contains(b)) return;
      var text = cleanText(sel.toString(), LIMITS.selection);
      if (text.length < 2) return;
      var block = a.closest('p, li, dd, dt, figcaption') || zone;
      pending = {
        selection: text,
        context: contextAround(block.textContent, text),
        headline: zone.getAttribute('data-headline') || '',
        level: zone.getAttribute('data-level') || 'plain',
        code: getCode()
      };
      quote.textContent = '“' + (text.length > 80 ? text.slice(0, 77) + '…' : text) + '”';
      out.textContent = '';
      sheet.hidden = false;
    }
    document.addEventListener('selectionchange', function () {
      clearTimeout(timer);
      timer = setTimeout(onSelection, 350);
    });
  }

  return {
    configured: configured, getCode: getCode, setCode: setCode, ask: ask, attach: attach,
    buildRequest: buildRequest, contextAround: contextAround, cleanText: cleanText, LIMITS: LIMITS
  };
});
