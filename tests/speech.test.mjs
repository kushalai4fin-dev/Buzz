import test from 'node:test';
import assert from 'node:assert/strict';
await import('../speech.js');
const { BuzzSpeech } = globalThis;

class FakeUtter { constructor(t) { this.text = t; } }
const fakeSynth = (voices = []) => {
  const s = { spoken: [], paused: false, cancelled: 0, queue: [], getVoices: () => voices,
    speak(u) { s.spoken.push(u); s.queue.push(u); }, pause() { s.paused = true; }, resume() { s.paused = false; }, cancel() { s.cancelled += 1; s.queue = []; },
    finish() { const u = s.queue.shift(); if (u && u.onend) u.onend(); } };
  return s;
};

test('splitText keeps sentences together up to a limit and cuts long ones', () => {
  assert.deepEqual(BuzzSpeech.splitText(''), []);
  assert.deepEqual(BuzzSpeech.splitText('One. Two! Three?'), ['One. Two! Three?']);
  const long = 'word '.repeat(120).trim() + '.';
  const parts = BuzzSpeech.splitText(long);
  assert.ok(parts.length > 2 && parts.every((p) => p.length <= 200));
  assert.equal(parts.join(' ').replace(/\s+/g, ' '), long);
  const many = Array.from({ length: 30 }, (_, i) => `Sentence number ${i} is here.`).join(' ');
  assert.ok(BuzzSpeech.splitText(many).every((p) => p.length <= 200));
});

test('pickVoice prefers local English voices in the preferred order', () => {
  const v = [{ lang: 'fr-FR', name: 'f' }, { lang: 'en-US', name: 'us', localService: true }, { lang: 'en-GB', name: 'gb', localService: false }, { lang: 'en_IN', name: 'in', localService: true }];
  assert.equal(BuzzSpeech.pickVoice(v).name, 'in');
  assert.equal(BuzzSpeech.pickVoice([{ lang: 'de-DE' }]), null);
  assert.equal(BuzzSpeech.pickVoice([]), null);
});

test('speaks chunk by chunk, with pause, resume and stop, and reports state', () => {
  const synth = fakeSynth();
  const sp = BuzzSpeech.create(synth, FakeUtter);
  const states = [];
  sp.onChange((s) => states.push(s));
  const text = Array.from({ length: 20 }, (_, i) => `This is sentence number ${i} of the story.`).join(' ');
  assert.equal(sp.speak(text), true);
  assert.equal(sp.state(), 'speaking');
  assert.equal(synth.spoken.length, 1);
  synth.finish();
  assert.equal(synth.spoken.length, 2);
  sp.pause(); assert.equal(sp.state(), 'paused'); assert.equal(synth.paused, true);
  sp.resume(); assert.equal(sp.state(), 'speaking');
  sp.stop(); assert.equal(sp.state(), 'idle');
  const before = synth.spoken.length;
  synth.spoken[synth.spoken.length - 1].onend();
  assert.equal(synth.spoken.length, before, 'a stale callback after stop must not keep speaking');
  assert.deepEqual(states, ['speaking', 'paused', 'speaking', 'idle']);
});

test('finishes by itself and returns to idle', () => {
  const synth = fakeSynth();
  const sp = BuzzSpeech.create(synth, FakeUtter);
  sp.speak('Short story. Done.');
  synth.finish();
  assert.equal(sp.state(), 'idle');
});

test('starting a new reading cancels the old one; errors reset to idle; cancel errors are ignored', () => {
  const synth = fakeSynth();
  const sp = BuzzSpeech.create(synth, FakeUtter);
  sp.speak('First story.');
  sp.speak('Second story.');
  assert.ok(synth.cancelled >= 2);
  synth.spoken[synth.spoken.length - 1].onerror({ error: 'canceled' });
  assert.equal(sp.state(), 'speaking');
  synth.spoken[synth.spoken.length - 1].onerror({ error: 'synthesis-failed' });
  assert.equal(sp.state(), 'idle');
});

test('unsupported browsers fail gracefully', () => {
  const sp = BuzzSpeech.create(undefined, undefined);
  assert.equal(sp.supported, false);
  assert.equal(sp.speak('hello'), false);
  sp.pause(); sp.resume(); sp.stop();
  assert.equal(sp.state(), 'idle');
  assert.equal(BuzzSpeech.create(fakeSynth(), FakeUtter).speak('   '), false);
});
