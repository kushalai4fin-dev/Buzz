// Buzz notifications, phone side (Stage 6).
// What happens when someone turns notifications on:
//   1. the browser asks permission (must come from a tap; on iPhone only inside the Home Screen app)
//   2. the browser gives us a private "push address" for this device
//   3. we send that address + the chosen times, time zone, topics and tracked terms to a small database (Supabase)
//   4. a scheduled job reads the database and sends at most one message per chosen time
// Turning notifications off deletes that database row. Nothing is sent unless the site owner finished the setup in README.

(function (root) {
  'use strict';

  var cfg = root.BUZZ_CONFIG || {};
  var MAX_TERMS = 20;

  function configured(c) {
    c = c || cfg;
    return !!(c.supabaseUrl && c.supabaseAnonKey && c.vapidPublicKey) && /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(c.supabaseUrl);
  }

  function timeZone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; }
  }

  function urlBase64ToBytes(b64) {
    var pad = '='.repeat((4 - (b64.length % 4)) % 4);
    var raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function bytesToBase64Url(buf) {
    var bytes = new Uint8Array(buf);
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  // Turns the on-device profile into exactly what the server needs, and nothing else.
  function payload(profile) {
    var P = root.BuzzProfile;
    var times = (profile.times || []).filter(P.validTime).slice(0, 2);
    var terms = (profile.terms || []).map(function (t) { return P.cleanTerm(t.text); }).filter(Boolean).slice(0, MAX_TERMS);
    return {
      times: times,
      tz: P.validTz(profile.tz) ? profile.tz : timeZone(),
      topics: (profile.topics || []).filter(function (x) { return /^[a-z0-9-]{1,30}$/.test(x); }).slice(0, 30),
      terms: terms
    };
  }

  function isIos() {
    var n = root.navigator || {};
    return /iphone|ipad|ipod/i.test(n.userAgent || '') || (n.platform === 'MacIntel' && n.maxTouchPoints > 1);
  }
  function isStandalone() {
    return (root.navigator && root.navigator.standalone === true) || (root.matchMedia && root.matchMedia('(display-mode: standalone)').matches);
  }
  function supported() {
    return 'serviceWorker' in root.navigator && 'PushManager' in root && 'Notification' in root;
  }

  function rpc(name, args) {
    return root.fetch(cfg.supabaseUrl + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + cfg.supabaseAnonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(args)
    }).then(function (r) {
      if (!r.ok) throw new Error('The notification server said no (' + r.status + '). Try again later.');
    }, function () { throw new Error('Could not reach the notification server. Check your connection.'); });
  }

  function currentSubscription() {
    return root.navigator.serviceWorker.ready.then(function (reg) {
      return reg.pushManager.getSubscription().then(function (sub) { return { reg: reg, sub: sub }; });
    });
  }

  function upsert(sub, p) {
    var json = sub.toJSON();
    var keys = json.keys || {};
    return rpc('buzz_upsert_subscription', {
      p_endpoint: sub.endpoint, p_p256dh: keys.p256dh, p_auth: keys.auth,
      p_times: p.times, p_tz: p.tz, p_topics: p.topics, p_terms: p.terms
    });
  }

  function status() {
    if (!configured()) return Promise.resolve({ state: 'unconfigured' });
    if (isIos() && !isStandalone()) return Promise.resolve({ state: 'needs-install' });
    if (!supported()) return Promise.resolve({ state: 'unsupported' });
    if (root.Notification.permission === 'denied') return Promise.resolve({ state: 'denied' });
    return currentSubscription().then(function (r) { return { state: r.sub ? 'on' : 'off' }; }, function () { return { state: 'off' }; });
  }

  // Must be called straight from a tap: the permission prompt only appears for user actions.
  function enable(p) {
    if (!configured() || !supported()) return Promise.reject(new Error('Notifications are not available here.'));
    if (!p.times.length) return Promise.reject(new Error('Pick at least one time first.'));
    return root.Notification.requestPermission().then(function (perm) {
      if (perm !== 'granted') throw new Error('Permission was not given, so notifications stay off.');
      return currentSubscription();
    }).then(function (r) {
      if (r.sub) return r.sub;
      return r.reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBytes(cfg.vapidPublicKey) });
    }).then(function (sub) { return upsert(sub, p); });
  }

  function sync(profile) {
    if (!configured() || !supported()) return Promise.resolve();
    var p = payload(profile);
    return currentSubscription().then(function (r) {
      if (!r.sub || !p.times.length) return;
      return upsert(r.sub, p);
    });
  }

  function disable() {
    if (!configured() || !supported()) return Promise.resolve();
    return currentSubscription().then(function (r) {
      if (!r.sub) return;
      return rpc('buzz_delete_subscription', { p_endpoint: r.sub.endpoint }).then(function () { return r.sub.unsubscribe(); });
    });
  }

  root.BuzzNotify = {
    status: status, enable: enable, disable: disable, sync: sync, payload: payload, timeZone: timeZone,
    _internals: { configured: configured, urlBase64ToBytes: urlBase64ToBytes, bytesToBase64Url: bytesToBase64Url }
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
