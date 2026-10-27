// Buzz search (Stage 5). Plain matching over the stories already on the device. No server, no tracking.
// A search finds clusters whose headlines or snippets contain every word (or the exact "quoted phrase").
// It can only find what Buzz's sources reported in the last few days. It says so when nothing matches.

(function (root) {
  'use strict';

  function fold(text) {
    return String(text == null ? '' : text).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
  }

  function tokenize(text) {
    return fold(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  }

  // "tata motors" -> words; '"rate cut" fed' -> phrase + word
  function parse(query) {
    var q = String(query == null ? '' : query);
    var phrases = [];
    var rest = q.replace(/"([^"]{2,60})"/g, function (_, p) { phrases.push(fold(p).replace(/\s+/g, ' ').trim()); return ' '; });
    var words = tokenize(rest).filter(function (w) { return w.length >= 2; });
    return { phrases: phrases, words: words };
  }

  function isEmpty(parsed) { return parsed.phrases.length === 0 && parsed.words.length === 0; }

  // Short words must match a whole word; longer ones may match the start of a word (tata -> tata, tatas).
  function wordHit(tokens, w) {
    for (var i = 0; i < tokens.length; i++) {
      if (tokens[i] === w) return true;
      if (w.length >= 4 && tokens[i].indexOf(w) === 0) return true;
    }
    return false;
  }

  function matches(parsed, text) {
    if (isEmpty(parsed)) return false;
    var folded = fold(text).replace(/\s+/g, ' ');
    var tokens = tokenize(text);
    for (var i = 0; i < parsed.phrases.length; i++) {
      if (folded.indexOf(parsed.phrases[i]) === -1) return false;
    }
    for (var j = 0; j < parsed.words.length; j++) {
      if (!wordHit(tokens, parsed.words[j])) return false;
    }
    return true;
  }

  function clusterText(cluster, storiesById) {
    var titles = [];
    var rest = [];
    cluster.storyIds.forEach(function (id) {
      var s = storiesById[id];
      if (!s) return;
      titles.push(s.title || '');
      rest.push((s.snippet || '') + ' ' + (s.publisher || ''));
    });
    return { titles: titles.join(' . '), all: titles.join(' . ') + ' . ' + rest.join(' . ') };
  }

  // Returns [{cluster, score}] best first. Title hits count double; recency breaks ties.
  function searchClusters(query, clusters, storiesById) {
    var parsed = parse(query);
    if (isEmpty(parsed)) return [];
    var out = [];
    clusters.forEach(function (c) {
      var t = clusterText(c, storiesById);
      if (!matches(parsed, t.all)) return;
      out.push({ cluster: c, score: matches(parsed, t.titles) ? 2 : 1 });
    });
    out.sort(function (a, b) {
      return b.score - a.score || (Date.parse(b.cluster.latest) || 0) - (Date.parse(a.cluster.latest) || 0) || (a.cluster.id < b.cluster.id ? -1 : 1);
    });
    return out;
  }

  // For My Tracked: every cluster that matches at least one saved term, with which terms matched.
  function matchTracked(terms, clusters, storiesById) {
    var parsedTerms = terms.map(function (t) { return { text: t.text, parsed: parse(t.text) }; });
    var out = [];
    clusters.forEach(function (c) {
      var all = clusterText(c, storiesById).all;
      var hit = parsedTerms.filter(function (p) { return matches(p.parsed, all); }).map(function (p) { return p.text; });
      if (hit.length) out.push({ cluster: c, terms: hit });
    });
    out.sort(function (a, b) { return (Date.parse(b.cluster.latest) || 0) - (Date.parse(a.cluster.latest) || 0) || (a.cluster.id < b.cluster.id ? -1 : 1); });
    return out;
  }

  root.BuzzSearch = { parse: parse, matches: matches, searchClusters: searchClusters, matchTracked: matchTracked, tokenize: tokenize, fold: fold };
})(typeof globalThis !== 'undefined' ? globalThis : window);
