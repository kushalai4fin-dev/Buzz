import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const win = { BuzzArt: {} };
vm.runInNewContext(fs.readFileSync(new URL('../motifs.js', import.meta.url), 'utf8'), { window: win, document: {} });
const A = win.BuzzArt;

test('headline words pick a matching picture', () => {
  assert.equal(A.pick('sports', 'Cricket final: India win by two wickets'), 'cricket');
  assert.equal(A.pick('geopolitics', 'Council votes on ceasefire resolution'), 'peace');
  assert.equal(A.pick('finance', 'Tata Motors posts record quarterly profit'), 'stocks_up');
  assert.equal(A.pick('technology', 'Chipmaker unveils new processor'), 'chip');
  assert.equal(A.pick('animals', 'Rare snow leopard cubs filmed'), 'bigcat');
});
test('no match gives null so the topic scene is used', () => {
  assert.equal(A.pick('general', 'Local council opens new library'), null);
});
test('every picture renders an svg string', () => {
  for (const n of A.motifNames) assert.match(A.motif(n), /<svg/);
});
