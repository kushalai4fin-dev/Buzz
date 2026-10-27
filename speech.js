// Buzz Listen (Stage 3). Reads a story aloud with the phone's own voice (Web Speech API).
// Free, on-device, no account. Safari only allows speech after a tap, so it can never start by itself.
// Text is split into short pieces because long utterances stall on some phones.

(function (root) {
  'use strict';

  var CHUNK_MAX = 200;

  function splitText(text) {
    var clean = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
    if (!clean) return [];
    var sentences = clean.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) || [clean];
    var chunks = [];
    var cur = '';
    sentences.forEach(function (s) {
      s = s.trim();
      if (!s) return;
      while (s.length > CHUNK_MAX) { // very long sentence: cut at a space
        var cut = s.lastIndexOf(' ', CHUNK_MAX);
        if (cut < CHUNK_MAX * 0.5) cut = CHUNK_MAX;
        if (cur) { chunks.push(cur); cur = ''; }
        chunks.push(s.slice(0, cut).trim());
        s = s.slice(cut).trim();
      }
      if (!s) return;
      if (cur && (cur + ' ' + s).length > CHUNK_MAX) { chunks.push(cur); cur = s; }
      else cur = cur ? cur + ' ' + s : s;
    });
    if (cur) chunks.push(cur);
    return chunks;
  }

  function pickVoice(voices, prefs) {
    var list = Array.prototype.slice.call(voices || []).filter(function (v) { return v && /^en/i.test(v.lang || ''); });
    prefs = prefs || ['en-IN', 'en-GB', 'en-US'];
    for (var i = 0; i < prefs.length; i++) {
      var hit = list.filter(function (v) { return (v.lang || '').replace('_', '-').toLowerCase() === prefs[i].toLowerCase(); });
      var local = hit.filter(function (v) { return v.localService; });
      if (local.length) return local[0];
      if (hit.length) return hit[0];
    }
    return list[0] || null;
  }

  // synth = window.speechSynthesis, Utter = window.SpeechSynthesisUtterance (injectable for tests)
  function create(synth, Utter) {
    var supported = !!(synth && Utter);
    var state = 'idle'; // idle | speaking | paused
    var listeners = [];
    var token = 0; // changes on every start/stop so stale callbacks are ignored
    var keep = []; // hold utterances: some browsers drop them when garbage collected

    function set(next) {
      if (state === next) return;
      state = next;
      listeners.forEach(function (fn) { try { fn(state); } catch (e) { /* ignore */ } });
    }

    function stop() {
      token += 1;
      keep = [];
      if (supported) { try { synth.cancel(); } catch (e) { /* ignore */ } }
      set('idle');
    }

    function speak(text, opts) {
      opts = opts || {};
      if (!supported) return false;
      var chunks = splitText(text);
      if (!chunks.length) return false;
      stop();
      var my = token;
      var voice = pickVoice(synth.getVoices && synth.getVoices());
      var i = 0;
      function next() {
        if (my !== token) return;
        if (i >= chunks.length) { keep = []; set('idle'); return; }
        var u = new Utter(chunks[i]);
        i += 1;
        if (voice) { u.voice = voice; u.lang = voice.lang; } else { u.lang = 'en'; }
        u.rate = opts.rate || 0.95;
        u.onend = next;
        u.onerror = function (e) { if (my !== token) return; if (e && (e.error === 'canceled' || e.error === 'interrupted')) return; stop(); };
        keep.push(u);
        synth.speak(u);
      }
      set('speaking');
      next();
      return true;
    }

    return {
      supported: supported,
      state: function () { return state; },
      speak: speak,
      pause: function () { if (supported && state === 'speaking') { synth.pause(); set('paused'); } },
      resume: function () { if (supported && state === 'paused') { synth.resume(); set('speaking'); } },
      stop: stop,
      onChange: function (fn) { listeners.push(fn); }
    };
  }

  root.BuzzSpeech = { create: create, splitText: splitText, pickVoice: pickVoice };
})(typeof globalThis !== 'undefined' ? globalThis : window);
