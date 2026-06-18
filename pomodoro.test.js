const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

function loadLogic() {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const m = html.match(/\/\/ ==PURE-LOGIC-START==([\s\S]*?)\/\/ ==PURE-LOGIC-END==/);
  if (!m) throw new Error('pure-logic markers not found in index.html');
  const names = ['localDateKey', 'migrate', 'pomodorosLeft'];
  const factory = new Function(`${m[1]}\nreturn { ${names.join(', ')} };`);
  return factory();
}

const L = loadLogic();

test('localDateKey formats local Y-M-D with zero padding', () => {
  assert.strictEqual(L.localDateKey(new Date(2026, 0, 5)), '2026-01-05');
  assert.strictEqual(L.localDateKey(new Date(2026, 11, 31)), '2026-12-31');
});


test('migrate passes through and normalizes v3 data', () => {
  const v3 = { version: 3, sessions: [{ id: 'a', ts: 1, minutes: 25, task: 'x' }], lengthPref: 50, sound: 'bell', muted: true, preheat: true, endTime: '17:00' };
  assert.deepStrictEqual(L.migrate(v3), v3);
});

test('migrate clamps invalid v3 fields to defaults', () => {
  const r = L.migrate({ version: 3, sessions: 'nope', lengthPref: 99, sound: 'foo', muted: 'yes', preheat: 1, endTime: 42 });
  assert.deepStrictEqual(r, { version: 3, sessions: [], lengthPref: 25, sound: 'chime', muted: false, preheat: false, endTime: '' });
});

test('migrate converts v2 history into synthesized sessions', () => {
  const r = L.migrate({ version: 2, history: { '2026-06-15': 3, '2026-06-14': 1 }, lengthPref: 50 });
  assert.strictEqual(r.lengthPref, 50);
  assert.strictEqual(r.sessions.length, 4);
  assert.ok(r.sessions.every((s) => s.migrated === true && s.minutes === null && s.task === ''));
  const keys = r.sessions.map((s) => L.localDateKey(new Date(s.ts))).sort();
  assert.deepStrictEqual(keys, ['2026-06-14', '2026-06-15', '2026-06-15', '2026-06-15']);
});

test('migrate converts old single-counter format into sessions', () => {
  const r = L.migrate({ date: '2026-06-15', count: 2, streak: 9 });
  assert.strictEqual(r.sessions.length, 2);
  assert.ok(r.sessions.every((s) => L.localDateKey(new Date(s.ts)) === '2026-06-15'));
});

test('migrate turns null into a fresh v3 default', () => {
  assert.deepStrictEqual(L.migrate(null), { version: 3, sessions: [], lengthPref: 25, sound: 'chime', muted: false, preheat: false, endTime: '' });
});

test('migrate ignores old format with zero count', () => {
  assert.deepStrictEqual(L.migrate({ date: '2026-06-15', count: 0 }).sessions, []);
});

test('pomodorosLeft fits sessions with a break between, no trailing break', () => {
  // 2 hours left, 25-min focus + 10-min break: 25+10+25+10+25 = 95 <= 120, 4th would need 130
  assert.strictEqual(L.pomodorosLeft(120, 25, 10), 3);
  // 2 hours left, 50-min focus: 50+10+50 = 110 <= 120, 3rd would need 170
  assert.strictEqual(L.pomodorosLeft(120, 50, 10), 2);
});

test('pomodorosLeft fits exactly one when time equals one focus block', () => {
  assert.strictEqual(L.pomodorosLeft(25, 25, 10), 1);
  assert.strictEqual(L.pomodorosLeft(60, 25, 10), 2); // 25+10+25 = 60 exactly
});

test('pomodorosLeft returns zero when not even one session fits', () => {
  assert.strictEqual(L.pomodorosLeft(20, 25, 10), 0);
  assert.strictEqual(L.pomodorosLeft(0, 25, 10), 0);
  assert.strictEqual(L.pomodorosLeft(-30, 25, 10), 0); // end time already passed
});
