const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

function loadLogic() {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const m = html.match(/\/\/ ==PURE-LOGIC-START==([\s\S]*?)\/\/ ==PURE-LOGIC-END==/);
  if (!m) throw new Error('pure-logic markers not found in index.html');
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

test('sumRange sums counts inclusive of both bounds', () => {
  const h = { '2026-06-10': 1, '2026-06-12': 2, '2026-06-15': 4, '2026-06-20': 8 };
  assert.strictEqual(L.sumRange(h, '2026-06-12', '2026-06-15'), 6);
  assert.strictEqual(L.sumRange(h, '2026-06-01', '2026-06-30'), 15);
});

test('computeTotals computes today/week/month/3mo/year windows', () => {
  const today = new Date(2026, 5, 15); // Mon Jun 15 2026; 90-day window starts 2026-03-18
  const h = {
    '2026-06-15': 4, // today, week, month, 3mo, year
    '2026-06-14': 2, // Sunday: last week (not this week), month, 3mo, year
    '2026-06-01': 1, // month, 3mo, year
    '2026-03-20': 5, // inside 90 days, year
    '2026-03-10': 7, // outside 90 days, this year
    '2025-12-31': 9, // last year
  };
  const t = L.computeTotals(h, today);
  assert.strictEqual(t.today, 4);
  assert.strictEqual(t.week, 4);          // week starts Mon Jun 15 -> only Jun 15
  assert.strictEqual(t.month, 7);         // 4 + 2 + 1
  assert.strictEqual(t.threeMonths, 12);  // 4 + 2 + 1 + 5
  assert.strictEqual(t.year, 19);         // 4 + 2 + 1 + 5 + 7
});

test('migrate passes through v2 data', () => {
  const v2 = { version: 2, history: { '2026-06-15': 3 }, lengthPref: 50 };
  assert.deepStrictEqual(L.migrate(v2), v2);
});

test('migrate converts old format, carrying today count into history', () => {
  const old = { date: '2026-06-15', count: 4, streak: 9, lastActiveDate: '2026-06-15' };
  const r = L.migrate(old);
  assert.strictEqual(r.version, 2);
  assert.strictEqual(r.lengthPref, 25);
  assert.deepStrictEqual(r.history, { '2026-06-15': 4 });
});

test('migrate turns null into a fresh v2 default', () => {
  assert.deepStrictEqual(L.migrate(null), { version: 2, history: {}, lengthPref: 25 });
});

test('migrate ignores old format with zero count', () => {
  const r = L.migrate({ date: '2026-06-15', count: 0, streak: 0 });
  assert.deepStrictEqual(r.history, {});
});
