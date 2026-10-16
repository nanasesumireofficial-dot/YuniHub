import assert from 'node:assert/strict';
import test from 'node:test';
import { createScriptSearch } from '../renderer/script-search.mjs';

const scripts = [
  { id: 'fps', title: 'FPS Toolkit', name: 'fps.lua', description: 'Frame-rate helpers', author: 'Yuniku', tags: ['performance'], games: ['Game A'], supportedExecutors: ['Executor X'] },
  { id: 'camera', title: 'Camera Tools', name: 'camera.lua', description: 'Camera controls', author: 'Community', tags: ['utility'], games: ['Game B'], supportedExecutors: ['Executor Y'] },
  { id: 'map', title: 'Map Notes', name: 'map.lua', description: 'Map markers', author: 'Community', tags: ['map'], games: ['Game A'], supportedExecutors: ['Executor Y'] }
];

test('search matches titles, descriptions, tags, and executor names', () => {
  const search = createScriptSearch(scripts);
  assert.deepEqual(search('performance').map((script) => script.id), ['fps']);
  assert.ok(search('Executor X').some((script) => script.id === 'fps'));
  assert.equal(search('camera')[0].id, 'camera');
});

test('game and executor filters compose with fuzzy search', () => {
  const search = createScriptSearch(scripts);
  assert.deepEqual(search('', 'Game A').map((script) => script.id), ['fps', 'map']);
  assert.deepEqual(search('', 'Game A', 'Executor Y').map((script) => script.id), ['map']);
  assert.deepEqual(search('markers', 'Game B'), []);
});

test('empty query returns all scripts without mutating the catalog', () => {
  const search = createScriptSearch(scripts);
  assert.deepEqual(search().map((script) => script.id), ['fps', 'camera', 'map']);
  assert.equal(scripts.length, 3);
});