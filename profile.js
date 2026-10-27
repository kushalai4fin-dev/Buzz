// Buzz profile (Stage 5/6). Everything the reader chooses lives here, on THIS device:
// saved search terms ("My Tracked"), chosen topics, and notification times.
// Until accounts exist nothing leaves the device, except what the reader switches on in Notifications.
// Storage is wrapped in try/catch: private browsing can block it, and the app must still work.

(function (root) {
  'use strict';

  var KEY = 'buzz.profile.v1';
  var MAX_TERMS = 20;
  var MAX_TIMES = 2;

  function defaults() {
    return { v: 1, terms: [], autoSave: true, topics: null, times: [], tz: null };
  }

  function cleanTerm(raw) {
    var t = String(raw == null ? '' : raw).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim();
    if (t.length < 2 || t.length > 60) return null;
    return t;
  }

  function termKey(text) { return text.toLowerCase(); }

  function validTime(t) { return typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t); }

  function validTz(tz) {
    if (typeof tz !== 'string' || tz.length > 64) return false;
    try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch (e) { return false; }
  }

  // Accepts anything read from storage and returns a safe profile.
  function sanitize(raw) {
    var p = defaults();
    if (!raw || typeof raw !== 'object') return p;
    if (Array.isArray(raw.terms)) {
      var seen = {};
      raw.terms.forEach(function (t) {
        if (!t || typeof t !== 'object') return;
        var text = cleanTerm(t.text);
        if (!text || seen[termKey(text)] || p.terms.length >= MAX_TERMS) return;
        seen[termKey(text)] = true;
        p.terms.push({
          text: text,
          added: typeof t.added === 'string' ? t.added.slice(0, 40) : '',
          lastChecked: typeof t.lastChecked === 'string' ? t.lastChecked.slice(0, 40) : ''
        });
      });
    }
    p.autoSave = raw.autoSave !== false;
    if (Array.isArray(raw.topics)) {
      p.topics = raw.topics.filter(function (x) { return typeof x === 'string' && /^[a-z0-9-]{1,30}$/.test(x); }).slice(0, 30);
    }
    if (Array.isArray(raw.times)) {
      p.times = raw.times.filter(validTime).filter(function (t, i, a) { return a.indexOf(t) === i; }).slice(0, MAX_TIMES).sort();
    }
    p.tz = validTz(raw.tz) ? raw.tz : null;
    return p;
  }

  function create(storage) {
    var profile = defaults();

    function load() {
      try { profile = sanitize(JSON.parse(storage.getItem(KEY))); } catch (e) { profile = defaults(); }
      return profile;
    }
    function save() {
      try { storage.setItem(KEY, JSON.stringify(profile)); return true; } catch (e) { return false; }
    }
    load();

    return {
      get: function () { return profile; },
      reload: load,
      hasTerm: function (raw) {
        var t = cleanTerm(raw);
        return !!t && profile.terms.some(function (x) { return termKey(x.text) === termKey(t); });
      },
      // Called when the reader searches. Saves the term unless they turned auto-save off.
      recordSearch: function (raw, nowIso) {
        var t = cleanTerm(raw);
        if (!t) return { ok: false, reason: 'Type at least 2 characters.' };
        if (!profile.autoSave) return { ok: true, saved: false, term: t };
        return this.addTerm(t, nowIso);
      },
      addTerm: function (raw, nowIso) {
        var t = cleanTerm(raw);
        if (!t) return { ok: false, reason: 'Type between 2 and 60 characters.' };
        var existing = profile.terms.filter(function (x) { return termKey(x.text) === termKey(t); })[0];
        if (existing) return { ok: true, saved: false, term: existing.text, already: true };
        if (profile.terms.length >= MAX_TERMS) return { ok: false, reason: 'You can track up to ' + MAX_TERMS + ' terms. Remove one first.' };
        profile.terms.unshift({ text: t, added: nowIso || '', lastChecked: nowIso || '' });
        save();
        return { ok: true, saved: true, term: t };
      },
      removeTerm: function (raw) {
        var k = termKey(String(raw));
        var before = profile.terms.length;
        profile.terms = profile.terms.filter(function (x) { return termKey(x.text) !== k; });
        save();
        return profile.terms.length !== before;
      },
      clearTerms: function () { profile.terms = []; save(); },
      markChecked: function (nowIso) { profile.terms.forEach(function (t) { t.lastChecked = nowIso; }); save(); },
      setAutoSave: function (on) { profile.autoSave = !!on; save(); },
      setTopics: function (list) { profile.topics = Array.isArray(list) ? sanitize({ topics: list }).topics : null; save(); },
      setTimes: function (list, tz) {
        var s = sanitize({ times: list, tz: tz });
        profile.times = s.times;
        profile.tz = s.tz;
        save();
      },
      clearAll: function () { profile = defaults(); try { storage.removeItem(KEY); } catch (e) { /* ignore */ } },
      MAX_TERMS: MAX_TERMS
    };
  }

  root.BuzzProfile = { create: create, sanitize: sanitize, cleanTerm: cleanTerm, validTime: validTime, validTz: validTz, MAX_TERMS: MAX_TERMS, MAX_TIMES: MAX_TIMES };
})(typeof globalThis !== 'undefined' ? globalThis : window);
