# Task Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a task-list scheduler that lays the day out on a timeline with estimated start/end times and auto-advances the Pomodoro timer through the tasks, while removing the stats block.

**Architecture:** Pure, DOM-free schedule logic lives in the existing `==PURE-LOGIC==` block in `index.html` (unit-tested via `pomodoro.test.js`, which extracts that block by regex markers). A new collapsible "Plan" panel renders the task list and timeline from that logic and persists to the same `localStorage` object (bumped to version 4). The timer's existing phase machine (`advancePhase`) gains a hook to burn down the active task and auto-load the next.

**Tech Stack:** Single self-contained `index.html` (vanilla HTML/CSS/JS, Web Audio, localStorage). Tests are Node's built-in `node:test` runner, run with `node --test pomodoro.test.js`.

## Global Constraints

- **Single file:** all app code lives in `index.html`. No build step, no dependencies, no frameworks.
- **Pure-logic discipline:** functions between `// ==PURE-LOGIC-START==` and `// ==PURE-LOGIC-END==` must be DOM-free and deterministic. Never call `Date.now()` or argless `new Date()` inside them — the current time / start time is always passed in as a parameter (`new Date(ms)` from a passed number is fine).
- **Test harness coupling:** `pomodoro.test.js` `loadLogic()` lists exported function names in its `names` array. Every function the tests call must appear there AND be defined in the pure-logic block, or `loadLogic()` throws. Keep them in sync.
- **Storage key:** `'pomodoro_data'`. **Version after this work:** `4`.
- **Pill seeds (verbatim):** `CTS Emails`, `Rockstar Emails`, `CTS Pipeline`, `Lesson Planning`, `Song writing`.
- **Break model (verbatim from spec):** sessions laid end-to-end with a 10-min break *between* every consecutive session and **no trailing break** after the final session of the day. A task with `count = n` spans `n` focus blocks + `n−1` internal breaks; between two tasks there is one break.
- **Name length cap:** task names and pills ≤ 80 chars (matches the existing `maxlength="80"` on the task input).
- **Commit style:** frequent commits, one per task. Conventional-commit prefixes (`feat:`, `refactor:`, `test:`).

---

### Task 1: Remove the stats feature

**Files:**
- Modify: `index.html` (DOM block ~601-633; CSS ~305-362; JS `renderStats` ~917-929, pure-logic `computeStreak`/`sumRange`/`computeTotals`/`mostRecentMonday`/`dailyCounts`, init + `recordSession` call sites, stats-toggle listener ~1191-1195)
- Modify: `pomodoro.test.js` (`names` array line 10; delete/rewrite stats tests)

**Interfaces:**
- Produces: a pure-logic block exporting only `localDateKey`, `migrate`, `pomodorosLeft`, `dayKeyToNoon` (helper, unexported). History, timer, audio, plan-counter all still work.

- [ ] **Step 1: Update the test harness `names` and delete stats tests**

In `pomodoro.test.js`, change line 10 to:

```javascript
  const names = ['localDateKey', 'migrate', 'pomodorosLeft'];
```

Delete these tests entirely: `mostRecentMonday returns…`, `computeStreak counts…` (all three), `sumRange sums…`, `computeTotals computes…`, and `dailyCounts tallies…`.

Rewrite the two migration tests that reference `dailyCounts` so they assert on sessions directly:

```javascript
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
```

- [ ] **Step 2: Run tests to confirm they now fail on the still-present `names`**

Run: `node --test pomodoro.test.js`
Expected: FAIL — `loadLogic()` still returns the removed names fine (they exist in index.html), but this step is to confirm the suite runs. If the only failures are the two migration tests above (because `dailyCounts` is gone from `names` — it isn't yet), proceed. Realistically: PASS except nothing references removed names yet. Move on.

- [ ] **Step 3: Remove the stats DOM**

In `index.html`, delete the entire stats block (the `<div class="stats">…</div>` with Day Streak + Today, the `<button class="stats-toggle" id="statsToggle">…`, and the `<div class="stats-panel" id="statsPanel">…</div>`). Leave the History toggle/panel that follows it untouched.

- [ ] **Step 4: Remove the stats CSS**

Delete these rule groups from the `<style>`: `.stats`, `.stat`, `.stat-value`, `.stat-label`, `.stats-toggle` (and its `:hover`, `.chevron`, `.open .chevron`, `body.break-mode` variant), `.stats-panel` (and `.open`, `.stat-value` override).

Keep `.history-panel`, `.hist-*`, and the `.chevron` rules still used by History/Plan toggles — note the `.chevron` rules live under `.stats-toggle`; History reuses the `stats-toggle` class. **Therefore: do NOT delete the base `.stats-toggle` rule** — History's toggle (`class="stats-toggle history-toggle"`) depends on it. Only delete `#statsPanel`-specific rules and the standalone stats markup. Re-read the History button to confirm it keeps the `stats-toggle` class.

- [ ] **Step 5: Remove the stats JS**

Delete the function `renderStats()` (~917-929). Delete the pure-logic functions `computeStreak`, `sumRange`, `computeTotals`, `mostRecentMonday`, and `dailyCounts` from the `==PURE-LOGIC==` block. Keep `localDateKey`, `pomodorosLeft`, `dayKeyToNoon`, and `migrate`.

In `recordSession()` remove the `renderStats();` call (keep `renderHistory();`). Delete the DOM refs `sessionCountEl`, `streakCountEl`, `weekCountEl`, `monthCountEl`, `threeMoCountEl`, `yearCountEl` and the `statsToggle`/`statsPanel` refs. Delete the stats-toggle click listener (~1191-1195). In the init block remove the `renderStats();` call.

- [ ] **Step 6: Run tests**

Run: `node --test pomodoro.test.js`
Expected: PASS — all remaining tests green (`localDateKey`, `migrate` variants, `pomodorosLeft`).

- [ ] **Step 7: Manual smoke check**

Open `index.html` in a browser. Confirm: timer runs, ring tap starts/pauses, History still opens and lists sessions, "Done by" planner still shows "≈ N × 25 …", no stats row remains, no console errors.

- [ ] **Step 8: Commit**

```bash
git add index.html pomodoro.test.js
git commit -m "refactor: remove stats block (streak/today/week/month)"
```

---

### Task 2: Migrate storage to version 4

**Files:**
- Modify: `index.html` (pure-logic `migrate`, add `PILL_SEEDS`, `normalizePlan`, `normalizePills` helpers in the pure-logic block)
- Modify: `pomodoro.test.js` (update v3/null migration tests; add v4 tests)

**Interfaces:**
- Produces: `migrate(raw)` returns a v4 object: `{ version:4, sessions, lengthPref, sound, muted, preheat, endTime, plan:[{id,name,count,done}], startOverride:'', pills:[...] }`. Helpers `normalizePlan(raw)` and `normalizePills(raw)` (not exported).

- [ ] **Step 1: Write the failing tests**

In `pomodoro.test.js`, **replace** the existing `migrate passes through and normalizes v3 data`, `migrate clamps invalid v3 fields to defaults`, and `migrate turns null into a fresh v3 default` tests with:

```javascript
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

test('migrate turns null into a fresh v4 default', () => {
  assert.deepStrictEqual(L.migrate(null), V4_DEFAULTS);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test pomodoro.test.js`
Expected: FAIL — current `migrate` returns `version: 3` and lacks `plan`/`startOverride`/`pills`.

- [ ] **Step 3: Implement v4 migration**

In the pure-logic block, just above `migrate`, add:

```javascript
  const PILL_SEEDS = ['CTS Emails', 'Rockstar Emails', 'CTS Pipeline', 'Lesson Planning', 'Song writing'];

  function normalizePlan(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map((t, i) => ({
      id: (t && t.id != null) ? String(t.id) : `t${i}`,
      name: (t && typeof t.name === 'string') ? t.name.slice(0, 80) : '',
      count: (t && Number.isFinite(t.count)) ? Math.max(1, Math.floor(t.count)) : 1,
      done: !!(t && t.done),
    }));
  }

  function normalizePills(raw) {
    if (!Array.isArray(raw)) return PILL_SEEDS.slice();
    return raw.filter((p) => typeof p === 'string' && p.trim()).map((p) => p.slice(0, 80));
  }
```

Replace the body of `migrate` with:

```javascript
  function migrate(raw) {
    const fresh = { version: 4, sessions: [], lengthPref: 25, sound: 'chime', muted: false, preheat: false, endTime: '', plan: [], startOverride: '', pills: PILL_SEEDS.slice() };
    if (!raw || typeof raw !== 'object') return fresh;

    if (raw.version === 3 || raw.version === 4) {
      return {
        version: 4,
        sessions: Array.isArray(raw.sessions) ? raw.sessions : [],
        lengthPref: raw.lengthPref === 50 ? 50 : 25,
        sound: ['chime', 'bell', 'arcade'].includes(raw.sound) ? raw.sound : 'chime',
        muted: raw.muted === true,
        preheat: raw.preheat === true,
        endTime: typeof raw.endTime === 'string' ? raw.endTime : '',
        plan: normalizePlan(raw.plan),
        startOverride: typeof raw.startOverride === 'string' ? raw.startOverride : '',
        pills: ('pills' in raw) ? normalizePills(raw.pills) : PILL_SEEDS.slice(),
      };
    }

    // Older formats (v2 per-day counts, or the original single counter) -> synthesize sessions.
    const result = Object.assign({}, fresh, { lengthPref: raw.lengthPref === 50 ? 50 : 25 });
    const addMigrated = (dateKey, count) => {
      for (let i = 0; i < count; i++) {
        result.sessions.push({ id: `m${dateKey}-${i}`, ts: dayKeyToNoon(dateKey), minutes: null, task: '', migrated: true });
      }
    };
    if (raw.version === 2 && raw.history && typeof raw.history === 'object') {
      for (const dateKey in raw.history) addMigrated(dateKey, raw.history[dateKey]);
    } else if (raw.date && raw.count > 0) {
      addMigrated(raw.date, raw.count);
    }
    return result;
  }
```

Note: the v4-passthrough test expects `pills: []` to be preserved, so the migration distinguishes "absent" (`'pills' in raw` false → seeds) from "explicit empty" (kept). `normalizePlan` always yields a fresh array, so the v4-passthrough test's `plan` must `deepStrictEqual` its input — it does (same shape).

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test pomodoro.test.js`
Expected: PASS — all migration tests green, plus the rewritten v2/single-counter tests from Task 1.

- [ ] **Step 5: Commit**

```bash
git add index.html pomodoro.test.js
git commit -m "feat: migrate storage to v4 (plan, startOverride, pills)"
```

---

### Task 3: buildSchedule + scheduleFinish

**Files:**
- Modify: `index.html` (pure-logic block: add `buildSchedule`, `scheduleFinish`)
- Modify: `pomodoro.test.js` (`names` array; new tests)

**Interfaces:**
- Consumes: a `plan` array of `{id,name,count,done}` (from Task 2).
- Produces:
  - `buildSchedule(plan, { startMs, focusMin, breakMin })` → `[{ taskId, name, remaining, startMs, endMs }]`, one block per not-done task with `count > 0`, in list order.
  - `scheduleFinish(plan, opts)` → `endMs` of the last block, or `null` if none.

- [ ] **Step 1: Add the names to the harness and write failing tests**

In `pomodoro.test.js` line 10, extend `names`:

```javascript
  const names = ['localDateKey', 'migrate', 'pomodorosLeft', 'buildSchedule', 'scheduleFinish'];
```

Add tests:

```javascript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test pomodoro.test.js`
Expected: FAIL — `loadLogic()` throws "buildSchedule is not defined" (name listed but function missing).

- [ ] **Step 3: Implement the functions**

Add to the pure-logic block (after `pomodorosLeft`):

```javascript
  // Lay the not-done tasks end-to-end. A `count=n` task = n focus blocks + (n-1) internal
  // breaks; one break sits between consecutive tasks; no trailing break after the last session.
  function buildSchedule(plan, opts) {
    const focusMs = opts.focusMin * 60000;
    const breakMs = opts.breakMin * 60000;
    const blocks = [];
    let cursor = opts.startMs;
    let first = true;
    for (const task of plan) {
      if (task.done) continue;
      const count = Math.max(0, Math.floor(task.count));
      if (count <= 0) continue;
      if (!first) cursor += breakMs;
      const startMs = cursor;
      const endMs = startMs + count * focusMs + (count - 1) * breakMs;
      blocks.push({ taskId: task.id, name: task.name, remaining: count, startMs, endMs });
      cursor = endMs;
      first = false;
    }
    return blocks;
  }

  function scheduleFinish(plan, opts) {
    const blocks = buildSchedule(plan, opts);
    return blocks.length ? blocks[blocks.length - 1].endMs : null;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test pomodoro.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html pomodoro.test.js
git commit -m "feat: buildSchedule + scheduleFinish pure logic"
```

---

### Task 4: deadlineCheck

**Files:**
- Modify: `index.html` (pure-logic: add `deadlineCheck`)
- Modify: `pomodoro.test.js` (`names`; tests)

**Interfaces:**
- Consumes: a `finishMs` (from `scheduleFinish`), the `endTime` string, and `nowMs`.
- Produces: `deadlineCheck(finishMs, endTime, nowMs)` → `{ madeIt: boolean, deltaMin: integer }` (positive `deltaMin` = minutes of slack, negative = overrun), or `null` when `endTime` is blank or `finishMs` is `null`.

- [ ] **Step 1: Add the name and write failing tests**

`names` becomes:

```javascript
  const names = ['localDateKey', 'migrate', 'pomodorosLeft', 'buildSchedule', 'scheduleFinish', 'deadlineCheck'];
```

Tests:

```javascript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test pomodoro.test.js`
Expected: FAIL — "deadlineCheck is not defined".

- [ ] **Step 3: Implement**

Add to the pure-logic block:

```javascript
  // Compare the projected finish against today's "HH:MM" deadline. nowMs supplies the date.
  function deadlineCheck(finishMs, endTime, nowMs) {
    if (!endTime || finishMs == null) return null;
    const now = new Date(nowMs);
    const [h, m] = endTime.split(':').map(Number);
    const deadline = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0).getTime();
    const deltaMin = Math.round((deadline - finishMs) / 60000);
    return { madeIt: deltaMin >= 0, deltaMin };
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test pomodoro.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html pomodoro.test.js
git commit -m "feat: deadlineCheck pure logic"
```

---

### Task 5: activeTaskId + completeOnePomodoro

**Files:**
- Modify: `index.html` (pure-logic: add `activeTaskId`, `completeOnePomodoro`)
- Modify: `pomodoro.test.js` (`names`; tests)

**Interfaces:**
- Produces:
  - `activeTaskId(plan)` → `id` of the first task with `done === false`, else `null`.
  - `completeOnePomodoro(plan)` → a **new** plan array; the active task's `count` is decremented, and at 0 its `done` becomes `true` (count clamped at 0). No-op (returns a shallow clone) when no active task.

- [ ] **Step 1: Add names and write failing tests**

`names` becomes:

```javascript
  const names = ['localDateKey', 'migrate', 'pomodorosLeft', 'buildSchedule', 'scheduleFinish', 'deadlineCheck', 'activeTaskId', 'completeOnePomodoro'];
```

Tests:

```javascript
test('activeTaskId returns the first not-done task', () => {
  assert.strictEqual(L.activeTaskId([t('a', 1, true), t('b', 2), t('c', 1)]), 'b');
  assert.strictEqual(L.activeTaskId([t('a', 1, true)]), null);
  assert.strictEqual(L.activeTaskId([]), null);
});

test('completeOnePomodoro decrements the active task without mutating input', () => {
  const plan = [t('a', 1, true), t('b', 3)];
  const next = L.completeOnePomodoro(plan);
  assert.strictEqual(next[1].count, 2);
  assert.strictEqual(next[1].done, false);
  assert.strictEqual(plan[1].count, 3); // original untouched
});

test('completeOnePomodoro marks the task done when it hits zero', () => {
  const next = L.completeOnePomodoro([t('a', 1)]);
  assert.deepStrictEqual(next[0], { id: 'a', name: 'a', count: 0, done: true });
});

test('completeOnePomodoro is a no-op when nothing is active', () => {
  const plan = [t('a', 1, true)];
  const next = L.completeOnePomodoro(plan);
  assert.deepStrictEqual(next, plan);
  assert.notStrictEqual(next, plan); // returns a copy, not the same reference
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test pomodoro.test.js`
Expected: FAIL — "activeTaskId is not defined".

- [ ] **Step 3: Implement**

Add to the pure-logic block:

```javascript
  function activeTaskId(plan) {
    for (const task of plan) if (!task.done) return task.id;
    return null;
  }

  // Returns a new plan with the active task's count decremented; done at 0.
  function completeOnePomodoro(plan) {
    const id = activeTaskId(plan);
    return plan.map((task) => {
      if (task.id !== id) return Object.assign({}, task);
      const count = Math.max(0, task.count - 1);
      return Object.assign({}, task, { count, done: count <= 0 });
    });
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test pomodoro.test.js`
Expected: PASS — full suite green.

- [ ] **Step 5: Commit**

```bash
git add index.html pomodoro.test.js
git commit -m "feat: activeTaskId + completeOnePomodoro pure logic"
```

---

### Task 6: Plan panel scaffold (toggle, panel, relocate "Done by", Start control)

**Files:**
- Modify: `index.html` (DOM: replace the old `.plan-row`; add Plan toggle + panel before the History toggle. CSS: add Plan panel styles. JS: refs, toggle listener, start-time persistence)

**Interfaces:**
- Consumes: `loadData()`/`saveData()` (existing), `migrate` v4 fields `startOverride`/`endTime`.
- Produces: DOM ids `planToggle`, `planPanel`, `startTimeInput`, `taskList`, `pillRow`, `addTaskInput`, `planSummary`; `endTimeInput` relocated inside the panel. JS functions `scheduleStartMs()` and a stubbed `renderPlan()` (filled in Task 7).

- [ ] **Step 1: Replace the old "Done by" row and insert the Plan panel**

In `index.html`, delete the existing `<div class="plan-row">…</div>` (the standalone "Done by" planner with `#endTimeInput` and `#planResult`).

Immediately before the History toggle (`<button class="stats-toggle history-toggle" id="historyToggle" …>`), insert:

```html
    <button class="stats-toggle plan-toggle" id="planToggle" aria-expanded="false" aria-controls="planPanel">
      Plan <span class="chevron">▾</span>
    </button>

    <div class="plan-panel" id="planPanel">
      <div class="plan-ctrl-row">
        <label class="plan-label" for="startTimeInput">Start</label>
        <input type="time" id="startTimeInput" class="end-time-input" aria-label="When the schedule starts" />
        <button type="button" class="plan-now-btn" id="startNowBtn" title="Start from now">now</button>
      </div>
      <div class="plan-ctrl-row">
        <label class="plan-label" for="endTimeInput">Done by</label>
        <input type="time" id="endTimeInput" class="end-time-input" aria-label="What time you want to finish today" />
      </div>

      <div class="pill-row" id="pillRow"></div>

      <input class="task-input add-task-input" id="addTaskInput" type="text" placeholder="Add a task…" maxlength="80" />

      <div class="task-list" id="taskList"></div>
      <div class="plan-summary" id="planSummary"></div>
    </div>
```

- [ ] **Step 2: Add Plan panel CSS**

Add to `<style>` (reuse existing tokens; `.plan-label`/`.end-time-input` already exist from the old planner — keep those rules):

```css
  .plan-panel {
    display: none;
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid rgba(255,255,255,0.06);
    text-align: left;
  }
  .plan-panel.open { display: block; }
  .plan-ctrl-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }
  .plan-now-btn {
    background: var(--surface);
    color: var(--text-muted);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
    font-family: inherit;
    font-size: 11px;
    font-weight: 600;
    padding: 5px 10px;
    cursor: pointer;
  }
  .plan-now-btn:hover { color: var(--text); }
  .add-task-input { margin: 10px 0; }
  .task-list { display: flex; flex-direction: column; }
  .plan-summary {
    margin-top: 12px;
    font-size: 13px;
    color: var(--text);
    text-align: center;
  }
  .plan-summary .ok { color: var(--accent-work); font-weight: 700; }
  .plan-summary .over { color: var(--accent-warmup); font-weight: 700; }
  body.break-mode .plan-summary .ok { color: var(--accent-break); }
  .plan-empty-msg { color: var(--text-muted); font-size: 12px; padding: 6px 0; }
```

- [ ] **Step 3: Update DOM refs and remove the old planner refs**

In the `// ── DOM refs ──` section: the old code had `endTimeInput` and `planResult` refs. Keep `endTimeInput` (the element moved but the id is the same). Delete the `planResult` ref. Add:

```javascript
  const planToggle = document.getElementById('planToggle');
  const planPanel = document.getElementById('planPanel');
  const startTimeInput = document.getElementById('startTimeInput');
  const startNowBtn = document.getElementById('startNowBtn');
  const pillRow = document.getElementById('pillRow');
  const addTaskInput = document.getElementById('addTaskInput');
  const taskList = document.getElementById('taskList');
  const planSummary = document.getElementById('planSummary');
```

- [ ] **Step 4: Replace the old plan rendering with start-time wiring + a renderPlan stub**

Delete the old `renderPlan()` (the one that wrote to `planResult`), the `setEndTime` helper, the `BREAK_MINUTES` line if only used there (keep it — Task 7 reuses it), and the old `endTimeInput` input listener. Add:

```javascript
  const BREAK_MINUTES = REST_DURATION / 60; // breaks count against the schedule

  function scheduleStartMs() {
    const data = loadData();
    const now = new Date();
    if (data.startOverride) {
      const [h, m] = data.startOverride.split(':').map(Number);
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0).getTime();
    }
    return now.getTime();
  }

  function renderPlan() { /* filled in Task 7 */ }

  planToggle.addEventListener('click', () => {
    const open = planPanel.classList.toggle('open');
    planToggle.classList.toggle('open', open);
    planToggle.setAttribute('aria-expanded', String(open));
    if (open) renderPlan();
  });

  startTimeInput.addEventListener('input', () => {
    const data = loadData();
    data.startOverride = startTimeInput.value;
    saveData(data);
    renderPlan();
  });

  startNowBtn.addEventListener('click', () => {
    const data = loadData();
    data.startOverride = '';
    saveData(data);
    startTimeInput.value = '';
    renderPlan();
  });

  endTimeInput.addEventListener('input', () => {
    const data = loadData();
    data.endTime = endTimeInput.value;
    saveData(data);
    renderPlan();
  });
```

- [ ] **Step 5: Update init**

In the init block, the old code set `endTimeInput.value = bootData.endTime;` and called `renderPlan();`. Keep both. Add `startTimeInput.value = bootData.startOverride;`. The existing `setInterval(renderPlan, 60000)` and the `visibilitychange`→`renderPlan()` call stay (they now drive the schedule re-flow).

- [ ] **Step 6: Manual check**

Open `index.html`. The "Plan ▾" toggle appears where the old planner was; clicking expands the panel showing Start / Done by rows, an empty pill row, an add-task input, and an empty list. Setting Start/Done-by/now persists across reload (check via DevTools → Application → Local Storage → `pomodoro_data`). No console errors. (List/pills/summary are still empty — next tasks.)

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat: plan panel scaffold with start/done-by controls"
```

---

### Task 7: Render the task list (zebra rows + windows) and summary

**Files:**
- Modify: `index.html` (JS: implement `renderPlan`, add `formatClock`, plan helpers)

**Interfaces:**
- Consumes: `buildSchedule`, `scheduleFinish`, `deadlineCheck`, `activeTaskId` (pure logic); `loadData`, `scheduleStartMs`, `workMinutes`, `BREAK_MINUTES`, `escapeHtml`.
- Produces: a working `renderPlan()` that paints `#taskList` and `#planSummary` from `data.plan`. Row markup carries `data-id` and per-action hooks (`data-act`) consumed by Task 8/9. Helper `formatClock(ms)`.

- [ ] **Step 1: Implement `formatClock` and `renderPlan`**

Replace the `renderPlan` stub with:

```javascript
  function formatClock(ms) {
    return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function planScheduleOpts() {
    return { startMs: scheduleStartMs(), focusMin: workMinutes, breakMin: BREAK_MINUTES };
  }

  function rowHtmlForTask(task, block, isActive) {
    const cls = 'task-row' + (isActive ? ' active' : '') + (task.done ? ' done' : '');
    const window = block ? `${formatClock(block.startMs)}–${formatClock(block.endMs)}` : '';
    const name = task.name ? escapeHtml(task.name) : 'Untitled task';
    return `
      <div class="${cls}" data-id="${escapeHtml(task.id)}">
        <div class="task-reorder">
          <button type="button" class="task-btn" data-act="up" aria-label="Move up">▲</button>
          <button type="button" class="task-btn" data-act="down" aria-label="Move down">▼</button>
        </div>
        <span class="task-name" data-act="edit" title="Click to edit">${name}</span>
        <span class="task-window">${window}</span>
        <span class="task-stepper">
          <button type="button" class="task-btn" data-act="dec" aria-label="Fewer pomodoros">−</button>
          <span class="task-count">×${task.count}</span>
          <button type="button" class="task-btn" data-act="inc" aria-label="More pomodoros">+</button>
        </span>
        <button type="button" class="task-btn task-check" data-act="check" aria-label="Mark done / skip">${task.done ? '↺' : '✓'}</button>
        <button type="button" class="task-btn task-del" data-act="del" aria-label="Delete task">✕</button>
      </div>`;
  }

  function renderPlan() {
    const data = loadData();
    const plan = data.plan;
    const opts = planScheduleOpts();
    const blocks = buildSchedule(plan, opts);
    const blockByTask = {};
    for (const b of blocks) blockByTask[b.taskId] = b;
    const activeId = activeTaskId(plan);

    if (!plan.length) {
      taskList.innerHTML = '<div class="plan-empty-msg">Add tasks to plan your day.</div>';
    } else {
      taskList.innerHTML = plan.map((task) => rowHtmlForTask(task, blockByTask[task.id], task.id === activeId)).join('');
    }

    // Summary
    const finish = scheduleFinish(plan, opts);
    if (!plan.length) {
      planSummary.textContent = '';
    } else if (finish == null) {
      planSummary.textContent = 'All done 🎉';
    } else {
      const check = deadlineCheck(finish, data.endTime, Date.now());
      let tail = '';
      if (check) {
        tail = check.madeIt
          ? ` · <span class="ok">✅ ${check.deltaMin} min early</span>`
          : ` · <span class="over">⚠️ runs ${-check.deltaMin} min over</span>`;
      }
      planSummary.innerHTML = `Finishes ~${formatClock(finish)}${tail}`;
    }
  }
```

- [ ] **Step 2: Add task-row CSS (zebra + active highlight)**

Add to `<style>`:

```css
  .task-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 6px;
    border-radius: 8px;
    font-size: 12px;
  }
  .task-row:nth-child(odd) { background: rgba(255,255,255,0.03); } /* zebra */
  .task-row.active { background: rgba(56,189,248,0.12); }
  body.break-mode .task-row.active { background: rgba(167,139,250,0.12); }
  .task-row.done .task-name { text-decoration: line-through; color: var(--text-muted); }
  .task-reorder { display: flex; flex-direction: column; line-height: 0.7; }
  .task-name { flex: 1; min-width: 0; cursor: text; overflow-wrap: anywhere; color: var(--text); }
  .task-window { color: var(--text-muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
  .task-stepper { display: inline-flex; align-items: center; gap: 4px; }
  .task-count { font-variant-numeric: tabular-nums; min-width: 22px; text-align: center; }
  .task-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-family: inherit;
    font-size: 11px;
    cursor: pointer;
    padding: 1px 4px;
    border-radius: 4px;
  }
  .task-btn:hover { color: var(--text); background: var(--surface); }
  .task-edit-input {
    flex: 1; min-width: 0;
    font-family: inherit; font-size: 12px;
    background: var(--surface); color: var(--text);
    border: 1px solid rgba(56,189,248,0.35); border-radius: 4px;
    padding: 1px 4px; outline: none;
  }
```

- [ ] **Step 3: Manual check with seeded data**

Open `index.html`, open DevTools console, seed a plan:

```javascript
const d = JSON.parse(localStorage.pomodoro_data);
d.plan = [{id:'a',name:'CTS Emails',count:1,done:false},{id:'b',name:'Song writing',count:3,done:false}];
localStorage.pomodoro_data = JSON.stringify(d); location.reload();
```

Open the Plan panel. Expect: two zebra-striped rows, first row highlighted (active), windows like `9:00–9:25` and a later span for Song writing with one 10-min gap between them. Summary reads "Finishes ~…". Set "Done by" later than finish → "✅ N min early"; set it earlier → "⚠️ runs N min over". (Buttons don't do anything yet.)

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: render plan task list with windows and summary"
```

---

### Task 8: Task interactions (add, edit, delete, reorder, stepper, check-off)

**Files:**
- Modify: `index.html` (JS: plan mutation helpers + event delegation on `#taskList` and the add-task input)

**Interfaces:**
- Consumes: `loadData`/`saveData`, `renderPlan`, `newId`, `completeOnePomodoro` is NOT used here (manual check toggles `done` directly).
- Produces: plan-mutation helpers `addTask(name)`, `updateTask(id, patch)`, `removeTask(id)`, `moveTask(id, dir)`; event delegation that re-renders after each change. After this task, the list is fully editable; timer auto-load comes in Task 9.

- [ ] **Step 1: Add plan mutation helpers**

Add near `renderPlan`:

```javascript
  function addTask(name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const data = loadData();
    data.plan.push({ id: newId(), name: trimmed.slice(0, 80), count: 1, done: false });
    saveData(data);
    renderPlan();
  }

  function updateTask(id, patch) {
    const data = loadData();
    const task = data.plan.find((x) => x.id === id);
    if (!task) return;
    Object.assign(task, patch);
    saveData(data);
    renderPlan();
  }

  function removeTask(id) {
    const data = loadData();
    data.plan = data.plan.filter((x) => x.id !== id);
    saveData(data);
    renderPlan();
  }

  function moveTask(id, dir) {
    const data = loadData();
    const i = data.plan.findIndex((x) => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= data.plan.length) return;
    const [moved] = data.plan.splice(i, 1);
    data.plan.splice(j, 0, moved);
    saveData(data);
    renderPlan();
  }
```

- [ ] **Step 2: Wire the add-task input**

```javascript
  addTaskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      addTask(addTaskInput.value);
      addTaskInput.value = '';
    }
  });
```

- [ ] **Step 3: Delegate row button clicks**

```javascript
  taskList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const row = e.target.closest('.task-row');
    if (!row) return;
    const id = row.dataset.id;
    const data = loadData();
    const task = data.plan.find((x) => x.id === id);
    if (!task) return;

    switch (btn.dataset.act) {
      case 'up': moveTask(id, -1); break;
      case 'down': moveTask(id, 1); break;
      case 'inc': updateTask(id, { count: task.count + 1 }); break;
      case 'dec': updateTask(id, { count: Math.max(1, task.count - 1) }); break;
      case 'del': removeTask(id); break;
      case 'check': updateTask(id, { done: !task.done }); break;
      case 'edit': startTaskNameEdit(row, id); break;
    }
  });
```

- [ ] **Step 4: Inline name editing**

Mirror the History inline-edit pattern:

```javascript
  function startTaskNameEdit(row, id) {
    const span = row.querySelector('.task-name');
    if (!span) return;
    const data = loadData();
    const task = data.plan.find((x) => x.id === id);
    if (!task) return;
    const input = document.createElement('input');
    input.className = 'task-edit-input';
    input.value = task.name;
    input.maxLength = 80;
    span.replaceWith(input);
    input.focus();
    input.select();
    let done = false;
    const commit = (save) => {
      if (done) return;
      done = true;
      if (save) {
        const v = input.value.trim();
        if (v) updateTask(id, { name: v.slice(0, 80) }); else renderPlan(); // empty reverts
      } else { renderPlan(); }
    };
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') commit(true);
      else if (ev.key === 'Escape') commit(false);
    });
    input.addEventListener('blur', () => commit(true));
  }
```

- [ ] **Step 5: Manual check**

Open `index.html`, open the Plan panel. Verify each: typing a name + Enter adds a zebra row; ▲/▼ reorder (and windows/active highlight re-flow); +/− change ×N (min 1) and shift the timeline; ✕ deletes; ✓ strikes through + flips to ↺ and moves the active highlight to the next task; clicking a name edits inline (Enter saves, Esc cancels, empty reverts). All survive reload. No console errors.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: task list add/edit/delete/reorder/stepper/check-off"
```

---

### Task 9: Quick-add pills (render, tap-to-add, manage)

**Files:**
- Modify: `index.html` (JS: pill rendering + management; CSS: pill styles)

**Interfaces:**
- Consumes: `loadData`/`saveData`, `addTask`, `renderPlan`.
- Produces: `renderPills()` painting `#pillRow`; an edit mode toggled by a ✎ control that reveals per-pill ✕ removers and an add-pill input. Pills persist to `data.pills`.

- [ ] **Step 1: Add pill CSS**

```css
  .pill-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 6px; }
  .pill {
    background: var(--surface);
    border: 1px solid rgba(255,255,255,0.08);
    color: var(--text);
    font-family: inherit; font-size: 11px; font-weight: 600;
    padding: 4px 10px; border-radius: 999px; cursor: pointer;
  }
  .pill:hover { background: var(--surface-hover); }
  .pill .pill-x { color: var(--text-muted); margin-left: 6px; }
  .pill-edit-toggle {
    background: transparent; border: none; color: var(--accent-work);
    font-family: inherit; font-size: 11px; font-weight: 600; cursor: pointer; padding: 4px;
  }
  body.break-mode .pill-edit-toggle { color: var(--accent-break); }
  .pill-add-input {
    font-family: inherit; font-size: 11px;
    background: var(--surface); color: var(--text);
    border: 1px solid rgba(56,189,248,0.35); border-radius: 999px;
    padding: 4px 10px; outline: none; width: 130px;
  }
```

- [ ] **Step 2: Implement pill rendering + management**

Add:

```javascript
  let pillEditMode = false;

  function renderPills() {
    const data = loadData();
    let html = data.pills.map((p, i) =>
      `<button type="button" class="pill" data-i="${i}">${escapeHtml(p)}${pillEditMode ? '<span class="pill-x" data-x="' + i + '">✕</span>' : ''}</button>`
    ).join('');
    if (pillEditMode) {
      html += '<input class="pill-add-input" id="pillAddInput" type="text" placeholder="New pill…" maxlength="80" />';
    }
    html += `<button type="button" class="pill-edit-toggle" id="pillEditToggle">${pillEditMode ? 'done' : '✎'}</button>`;
    pillRow.innerHTML = html;
    if (pillEditMode) {
      const add = document.getElementById('pillAddInput');
      add.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const v = add.value.trim();
          if (v) { const d = loadData(); d.pills.push(v.slice(0, 80)); saveData(d); renderPills(); }
        }
      });
    }
  }

  pillRow.addEventListener('click', (e) => {
    if (e.target.id === 'pillEditToggle') { pillEditMode = !pillEditMode; renderPills(); return; }
    const x = e.target.closest('[data-x]');
    if (x) {
      const d = loadData();
      d.pills.splice(Number(x.dataset.x), 1);
      saveData(d);
      renderPills();
      return;
    }
    const pill = e.target.closest('.pill');
    if (pill && !pillEditMode) {
      addTask(loadData().pills[Number(pill.dataset.i)]);
    }
  });
```

- [ ] **Step 3: Render pills when the panel opens and on init**

In the `planToggle` click listener, add `renderPills();` alongside `renderPlan();` inside the `if (open)` branch. In the init block, add `renderPills();` after `renderPlan();`.

- [ ] **Step 4: Manual check**

Open `index.html`, open the Plan panel. Expect five seeded pills (CTS Emails, Rockstar Emails, CTS Pipeline, Lesson Planning, Song writing) + a ✎ button. Tapping a pill adds that task to the list. Click ✎ → each pill shows ✕ and a "New pill…" input appears; removing and adding pills persists across reload; "done" exits edit mode. Tapping pills in edit mode does NOT add tasks.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: quick-add pills with edit/add/remove"
```

---

### Task 10: Timer integration (auto-load active task, burn down on completion)

**Files:**
- Modify: `index.html` (JS: `advancePhase` work-done branch, a `loadActiveTaskName()` helper, start/arm hooks)

**Interfaces:**
- Consumes: `completeOnePomodoro`, `activeTaskId` (pure logic); `loadData`/`saveData`, `renderPlan`, `taskInput`.
- Produces: the active task's name auto-fills `taskInput` when a work session arms/starts (editable); each completed work session decrements the active task and re-loads the next name.

- [ ] **Step 1: Add the auto-load helper**

Add near `renderPlan`:

```javascript
  // Write the active task's name into the timer's task field (editable; does not mutate the plan).
  function loadActiveTaskName() {
    const data = loadData();
    const id = activeTaskId(data.plan);
    const task = id ? data.plan.find((x) => x.id === id) : null;
    taskInput.value = task ? task.name : '';
  }
```

- [ ] **Step 2: Burn down the active task when a work session completes**

In `advancePhase()`, in the `else if (phase === 'work')` branch, right after `recordSession();` add:

```javascript
      // Burn one pomodoro off the active task, then surface the next task's name.
      const data = loadData();
      data.plan = completeOnePomodoro(data.plan);
      saveData(data);
      renderPlan();
      loadActiveTaskName();
```

Note: `recordSession()` reads `taskInput.value` for the session label *before* this runs, so the just-finished session is logged under the task name that was loaded for it. Correct ordering — do not move this above `recordSession()`.

- [ ] **Step 3: Auto-load the active task name when a fresh work session starts**

In `start()`, after the warm-up branch and before `running = true`, the session is being armed/started. Add a guard so manual typing isn't clobbered mid-session: only auto-load on a fresh start when the field is empty.

```javascript
    // On a fresh work start, surface the active task's name if the user hasn't typed one.
    if (!hasStarted && phase === 'work' && !taskInput.value.trim()) {
      loadActiveTaskName();
    }
```

Place this immediately after `getAudioCtx();`.

- [ ] **Step 4: Load the active task name on init and when the plan changes the active task**

In the init block, after `renderPills();`, add:

```javascript
  if (!taskInput.value.trim()) loadActiveTaskName();
```

In `renderPlan()` there is no need to touch `taskInput` (avoid surprising the user mid-edit); auto-load happens only on start, completion, and init. Leave `renderPlan` as-is.

- [ ] **Step 5: Manual end-to-end check**

Open `index.html`. Seed or build a plan with `Song writing ×2` active. Confirm:
1. With an empty task field, tapping the ring to start a work session loads "Song writing" into the task field.
2. Let a work session complete (or set `workMinutes` low via console for speed: not needed — instead verify the burn-down path by calling the work-done branch indirectly: start, then in console run the completion path is hard to force; acceptable to verify by shortening — set `timeLeft = 2` in console after starting). On completion: the row shows `×1`, History logs the session as "Song writing", and after the break the field still shows "Song writing".
3. After the second completion the task strikes through and the next task's name loads (or the field clears if none left).
4. Manually typing a different name before starting overrides for that session and does not change the plan row.

- [ ] **Step 6: Run the full test suite**

Run: `node --test pomodoro.test.js`
Expected: PASS — all pure-logic tests green (no regressions).

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat: timer auto-loads and burns down scheduled tasks"
```

---

## Plan Self-Review

**Spec coverage:**
- §1 data model v4 → Task 2. ✅
- §2 pure logic (`buildSchedule`, `scheduleFinish`, `deadlineCheck`, `activeTaskId`, `completeOnePomodoro`) → Tasks 3–5. ✅
- §3 timer integration (auto-load, decrement on work-done, manual check-off advance) → Tasks 8 (check-off) + 10 (auto-load/decrement). ✅
- §4 UI panel (toggle, start control, relocated Done-by, pills, add-task, zebra list with windows, summary) → Tasks 6–9. ✅
- §5 removals → Task 1. ✅
- §6 edge cases (empty plan, all done, stepper min 1, start override, no deadline, empty-name revert) → Tasks 7 (empty/all-done/summary), 8 (stepper min, empty-name revert), 6 (start override). ✅
- §7 tests → Tasks 2–5 each ship their unit tests. ✅

**Placeholder scan:** the only intentional stub is `renderPlan(){}` in Task 6, explicitly filled in Task 7. No TBD/TODO/"handle edge cases" left.

**Type consistency:** block shape `{taskId,name,remaining,startMs,endMs}` is consistent across Task 3 (produced) and Task 7 (consumed via `blockByTask`). Task shape `{id,name,count,done}` consistent across migrate/buildSchedule/mutators. `deadlineCheck` returns `{madeIt,deltaMin}` — consumed in Task 7's summary exactly. `completeOnePomodoro` used in Task 10; `activeTaskId` in Tasks 7/10. `names` array is extended additively in Tasks 1–5 and matches the functions defined.
