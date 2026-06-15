const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

function loadLogic() {
  const html = fs.readFileSync(path.join(__dirname, 'pomodoro.html'), 'utf8');
  const m = html.match(/\/\/ ==PURE-LOGIC-START==([\s\S]*?)\/\/ ==PURE-LOGIC-END==/);
  if (!m) throw new Error('pure-logic markers not found in pomodoro.html');
  const names = ['localDateKey', 'mostRecentMonday', 'computeStreak', 'sumRange', 'computeTotals', 'migrate'];
  const factory = new Function(`${m[1]}\nreturn { ${names.join(', ')} };`);
  return factory();
}

const L = loadLogic();

test('localDateKey formats local Y-M-D with zero padding', () => {
  assert.strictEqual(L.localDateKey(new Date(2026, 0, 5)), '2026-01-05');
  assert.strictEqual(L.localDateKey(new Date(2026, 11, 31)), '2026-12-31');
});

test('mostRecentMonday returns the Monday on or before the date', () => {
  // 2026-06-15 is a Monday
  assert.strictEqual(L.localDateKey(L.mostRecentMonday(new Date(2026, 5, 15))), '2026-06-15');
  // 2026-06-14 is a Sunday -> previous Monday is 2026-06-08
  assert.strictEqual(L.localDateKey(L.mostRecentMonday(new Date(2026, 5, 14))), '2026-06-08');
  // 2026-06-17 is a Wednesday -> 2026-06-15
  assert.strictEqual(L.localDateKey(L.mostRecentMonday(new Date(2026, 5, 17))), '2026-06-15');
});

test('computeStreak counts consecutive days ending today', () => {
  const today = new Date(2026, 5, 15);
  const history = { '2026-06-15': 2, '2026-06-14': 1, '2026-06-13': 3, '2026-06-11': 1 };
  assert.strictEqual(L.computeStreak(history, today), 3); // 15,14,13 then gap at 12
});

test('computeStreak counts back from yesterday when today is empty', () => {
  const today = new Date(2026, 5, 15);
  const history = { '2026-06-14': 1, '2026-06-13': 1 };
  assert.strictEqual(L.computeStreak(history, today), 2);
});

test('computeStreak is zero when neither today nor yesterday is active', () => {
  const today = new Date(2026, 5, 15);
  assert.strictEqual(L.computeStreak({ '2026-06-10': 5 }, today), 0);
});
