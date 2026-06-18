const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

function loadLogic() {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const m = html.match(/\/\/ ==PURE-LOGIC-START==([\s\S]*?)\/\/ ==PURE-LOGIC-END==/);
  if (!m) throw new Error('pure-logic markers not found in index.html');
  const names = ['localDateKey', 'migrate', 'pomodorosLeft', 'buildSchedule', 'scheduleFinish', 'deadlineCheck'];
  const factory = new Function(`${m[1]}\nreturn { ${names.join(', ')} };`);
  return factory();
}

const L = loadLogic();

test('localDateKey formats local Y-M-D with zero padding', () => {
  assert.strictEqual(L.localDateKey(new Date(2026, 0, 5)), '2026-01-05');
  assert.strictEqual(L.localDateKey(new Date(2026, 11, 31)), '2026-12-31');
});


const V4_DEFAULTS = {
  version: 4, sessions: [], lengthPref: 25, sound: 'chime', muted: false,
  preheat: false, endTime: '', plan: [], startOverride: '',
  pills: ['CTS Emails', 'Rockstar Emails', 'CTS Pipeline', 'Lesson Planning', 'Song writing'],
};

test('migrate upgrades v3 to v4 with new defaults', () => {
  const v3 = { version: 3, sessions: [{ id: 'a', ts: 1, minutes: 25, task: 'x' }], lengthPref: 50, sound: 'bell', muted: true, preheat: true, endTime: '17:00' };
  const r = L.migrate(v3);
  assert.strictEqual(r.version, 4);
  assert.deepStrictEqual(r.sessions, v3.sessions);
  assert.strictEqual(r.endTime, '17:00');
  assert.deepStrictEqual(r.plan, []);
  assert.strictEqual(r.startOverride, '');
  assert.deepStrictEqual(r.pills, V4_DEFAULTS.pills);
});

test('migrate passes through and normalizes a v4 object', () => {
  const v4 = { ...V4_DEFAULTS, plan: [{ id: 'p1', name: 'Song writing', count: 3, done: false }], startOverride: '09:00', pills: ['One', 'Two'] };
  assert.deepStrictEqual(L.migrate(v4), v4);
});

test('migrate clamps invalid v4 fields to defaults', () => {
  const r = L.migrate({ version: 4, sessions: 'nope', lengthPref: 99, sound: 'foo', muted: 'yes', preheat: 1, endTime: 42, plan: 'x', startOverride: 5, pills: 'y' });
  assert.deepStrictEqual(r, V4_DEFAULTS);
});

test('migrate coerces malformed plan entries', () => {
  const r = L.migrate({ version: 4, plan: [{ name: 'A', count: 0 }, { id: 7, name: 5, count: 2.9, done: 1 }, null] });
  assert.deepStrictEqual(r.plan, [
    { id: 't0', name: 'A', count: 1, done: false },
    { id: '7', name: '', count: 2, done: true },
    { id: 't2', name: '', count: 1, done: false },
  ]);
});

test('migrate seeds pills only when absent, allows empty after clearing', () => {
  assert.deepStrictEqual(L.migrate({ version: 4 }).pills, V4_DEFAULTS.pills); // absent -> seeds
  assert.deepStrictEqual(L.migrate({ version: 4, pills: [] }).pills, []);     // explicit empty kept
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

test('migrate turns null into a fresh v4 default', () => {
  assert.deepStrictEqual(L.migrate(null), V4_DEFAULTS);
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

const MIN = 60000;
const t = (id, count, done = false) => ({ id, name: id, count, done });
const OPTS = { startMs: 0, focusMin: 25, breakMin: 10 };

test('buildSchedule lays a single task with internal breaks', () => {
  // count 3 -> 3*25 + 2*10 = 95 min window
  const b = L.buildSchedule([t('a', 3)], OPTS);
  assert.strictEqual(b.length, 1);
  assert.deepStrictEqual(b[0], { taskId: 'a', name: 'a', remaining: 3, startMs: 0, endMs: 95 * MIN });
});

test('buildSchedule puts one break between tasks', () => {
  // a:1 -> [0,25]; break 10; b:2 -> [35, 35+50+10=95]
  const b = L.buildSchedule([t('a', 1), t('b', 2)], OPTS);
  assert.deepStrictEqual(b.map((x) => [x.startMs / MIN, x.endMs / MIN]), [[0, 25], [35, 95]]);
});

test('buildSchedule skips done and zero-count tasks', () => {
  const b = L.buildSchedule([t('a', 1, true), t('b', 1), { id: 'c', name: 'c', count: 0, done: false }], OPTS);
  assert.deepStrictEqual(b.map((x) => x.taskId), ['b']);
  assert.strictEqual(b[0].startMs, 0); // b starts at the very start, done task consumes no time
});

test('buildSchedule honors a non-zero startMs', () => {
  const b = L.buildSchedule([t('a', 1)], { startMs: 9 * 60 * MIN, focusMin: 50, breakMin: 10 });
  assert.deepStrictEqual([b[0].startMs / MIN, b[0].endMs / MIN], [540, 590]);
});

test('buildSchedule returns empty for an empty or all-done plan', () => {
  assert.deepStrictEqual(L.buildSchedule([], OPTS), []);
  assert.deepStrictEqual(L.buildSchedule([t('a', 2, true)], OPTS), []);
});

test('scheduleFinish returns the last endMs or null', () => {
  assert.strictEqual(L.scheduleFinish([t('a', 1), t('b', 2)], OPTS), 95 * MIN);
  assert.strictEqual(L.scheduleFinish([], OPTS), null);
});

test('deadlineCheck reports slack when finishing before the deadline', () => {
  const now = new Date(2026, 5, 18, 9, 0).getTime();
  const finish = new Date(2026, 5, 18, 16, 15).getTime();
  assert.deepStrictEqual(L.deadlineCheck(finish, '16:45', now), { madeIt: true, deltaMin: 30 });
});

test('deadlineCheck reports overrun when finishing after the deadline', () => {
  const now = new Date(2026, 5, 18, 9, 0).getTime();
  const finish = new Date(2026, 5, 18, 17, 5).getTime();
  assert.deepStrictEqual(L.deadlineCheck(finish, '16:45', now), { madeIt: false, deltaMin: -20 });
});

test('deadlineCheck returns null without a deadline or finish', () => {
  const now = new Date(2026, 5, 18, 9, 0).getTime();
  assert.strictEqual(L.deadlineCheck(123, '', now), null);
  assert.strictEqual(L.deadlineCheck(null, '16:45', now), null);
});
