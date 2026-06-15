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
