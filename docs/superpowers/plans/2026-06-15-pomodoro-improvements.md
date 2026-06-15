# Pomodoro App Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 25/50-minute pomodoro selection, an auto-starting 10-minute rest, and multi-window streak/total stats to the existing single-file Pomodoro web app.

**Architecture:** Keep `pomodoro.html` as one self-contained file. Extract all date/streak/total/migration logic into a clearly-delimited, DOM-free "pure logic" block inside the `<script>`. A dependency-free Node test file (`pomodoro.test.js`) reads the HTML, extracts that block between marker comments, and tests it with `node --test`. The DOM/timer wiring consumes those pure functions and is verified manually in a browser.

**Tech Stack:** Plain HTML/CSS/vanilla JS (no build, no runtime deps). Node 26 built-in `node:test` + `node:assert` for unit tests. localStorage for persistence.

---

## File Structure

- **Modify:** `/Users/jasoncraig/Documents/Claude/Projects/Pomodoro/pomodoro.html`
  - New pure-logic block (functions: `localDateKey`, `mostRecentMonday`, `computeStreak`, `sumRange`, `computeTotals`, `migrate`) between `// ==PURE-LOGIC-START==` / `// ==PURE-LOGIC-END==` markers.
  - Rewired data layer (`loadData`/`saveData`/`recordSession`/`renderStats`) using the pure functions and a per-day history model.
  - New 25/50 length toggle (markup + CSS + behavior).
  - Rewired timer flow for auto-rest and wait-after-rest.
  - New stats markup: always-visible streak + today; collapsible panel for week/month/3mo/year.
- **Create:** `/Users/jasoncraig/Documents/Claude/Projects/Pomodoro/pomodoro.test.js` — Node test harness + unit tests for the pure logic.

**Key invariant:** the pure-logic functions never touch the DOM and always receive `today` as a `Date` argument (never call `new Date()` internally), so tests are deterministic. The DOM code passes `new Date()`.

---

### Task 0: Initialize git repository

**Files:**
- Create: `.gitignore`

- [ ] **Step 1: Initialize the repo (project is not yet under git)**

Run:
```bash
cd /Users/jasoncraig/Documents/Claude/Projects/Pomodoro && git init
```
Expected: "Initialized empty Git repository".

- [ ] **Step 2: Create `.gitignore`**

Create `/Users/jasoncraig/Documents/Claude/Projects/Pomodoro/.gitignore`:
```
.superpowers/
.DS_Store
```

- [ ] **Step 3: Commit the existing app, spec, and plan**

```bash
cd /Users/jasoncraig/Documents/Claude/Projects/Pomodoro
git add .gitignore pomodoro.html docs/
git commit -m "chore: baseline pomodoro app, spec, and plan under git"
```
Expected: a commit is created listing the existing files.

---

### Task 1: Pure-logic scaffold, test harness, and `localDateKey`

**Files:**
- Modify: `pomodoro.html` (add pure-logic block in `<script>`)
- Create: `pomodoro.test.js`

- [ ] **Step 1: Add the pure-logic block with stubs to `pomodoro.html`**

In `pomodoro.html`, find the config section in `<script>`:
```js
  // ── Config ──
  const WORK_DURATION = 50 * 60;
  const BREAK_DURATION = 10 * 60;
```
Insert this block immediately **after** those lines (leave the old constants for now — they are removed in Task 6):
```js
  // ==PURE-LOGIC-START==
  // DOM-free, deterministic helpers. `today` is always passed in (never new Date() here).
  function localDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function mostRecentMonday(date) {
    throw new Error('not implemented');
  }

  function computeStreak(history, today) {
    throw new Error('not implemented');
  }

  function sumRange(history, fromKey, toKey) {
    throw new Error('not implemented');
  }

  function computeTotals(history, today) {
    throw new Error('not implemented');
  }

  function migrate(raw) {
    throw new Error('not implemented');
  }
  // ==PURE-LOGIC-END==
```

- [ ] **Step 2: Create the test harness with the first failing test**

Create `/Users/jasoncraig/Documents/Claude/Projects/Pomodoro/pomodoro.test.js`:
```js
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
```

- [ ] **Step 3: Run the test to confirm it passes**

Run: `cd /Users/jasoncraig/Documents/Claude/Projects/Pomodoro && node --test pomodoro.test.js`
Expected: `localDateKey` test PASSES (it was implemented in Step 1; this also proves the extraction harness works).

- [ ] **Step 4: Commit**

```bash
cd /Users/jasoncraig/Documents/Claude/Projects/Pomodoro
git add pomodoro.html pomodoro.test.js
git commit -m "feat: add pure-logic block, test harness, and localDateKey"
```

---

### Task 2: `mostRecentMonday`

**Files:**
- Modify: `pomodoro.html` (implement `mostRecentMonday`)
- Modify: `pomodoro.test.js` (add test)

- [ ] **Step 1: Write the failing test**

Append to `pomodoro.test.js`:
```js
test('mostRecentMonday returns the Monday on or before the date', () => {
  // 2026-06-15 is a Monday
  assert.strictEqual(L.localDateKey(L.mostRecentMonday(new Date(2026, 5, 15))), '2026-06-15');
  // 2026-06-14 is a Sunday -> previous Monday is 2026-06-08
  assert.strictEqual(L.localDateKey(L.mostRecentMonday(new Date(2026, 5, 14))), '2026-06-08');
  // 2026-06-17 is a Wednesday -> 2026-06-15
  assert.strictEqual(L.localDateKey(L.mostRecentMonday(new Date(2026, 5, 17))), '2026-06-15');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jasoncraig/Documents/Claude/Projects/Pomodoro && node --test pomodoro.test.js`
Expected: FAIL with "not implemented".

- [ ] **Step 3: Implement `mostRecentMonday`**

In `pomodoro.html`, replace the `mostRecentMonday` stub body with:
```js
  function mostRecentMonday(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = d.getDay(); // 0=Sun .. 6=Sat
    const diff = (day === 0) ? 6 : day - 1; // days since Monday
    d.setDate(d.getDate() - diff);
    return d;
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jasoncraig/Documents/Claude/Projects/Pomodoro && node --test pomodoro.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/jasoncraig/Documents/Claude/Projects/Pomodoro
git add pomodoro.html pomodoro.test.js
git commit -m "feat: implement mostRecentMonday"
```

---

### Task 3: `computeStreak`

**Files:**
- Modify: `pomodoro.html` (implement `computeStreak`)
- Modify: `pomodoro.test.js` (add tests)

- [ ] **Step 1: Write the failing tests**

Append to `pomodoro.test.js`:
```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jasoncraig/Documents/Claude/Projects/Pomodoro && node --test pomodoro.test.js`
Expected: FAIL with "not implemented".

- [ ] **Step 3: Implement `computeStreak`**

In `pomodoro.html`, replace the `computeStreak` stub body with:
```js
  function computeStreak(history, today) {
    const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    // If today has no sessions yet, start counting from yesterday so an in-progress day doesn't break the streak.
    if (!history[localDateKey(cursor)]) {
      cursor.setDate(cursor.getDate() - 1);
    }
    let streak = 0;
    while (history[localDateKey(cursor)] > 0) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jasoncraig/Documents/Claude/Projects/Pomodoro && node --test pomodoro.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/jasoncraig/Documents/Claude/Projects/Pomodoro
git add pomodoro.html pomodoro.test.js
git commit -m "feat: implement computeStreak"
```

---

### Task 4: `sumRange` and `computeTotals`

**Files:**
- Modify: `pomodoro.html` (implement `sumRange`, `computeTotals`)
- Modify: `pomodoro.test.js` (add tests)

- [ ] **Step 1: Write the failing tests**

Append to `pomodoro.test.js`:
```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jasoncraig/Documents/Claude/Projects/Pomodoro && node --test pomodoro.test.js`
Expected: FAIL with "not implemented".

- [ ] **Step 3: Implement `sumRange` and `computeTotals`**

In `pomodoro.html`, replace the `sumRange` stub body with:
```js
  function sumRange(history, fromKey, toKey) {
    let total = 0;
    for (const key in history) {
      if (key >= fromKey && key <= toKey) total += history[key];
    }
    return total;
  }
```
And replace the `computeTotals` stub body with:
```js
  function computeTotals(history, today) {
    const todayKey = localDateKey(today);
    const weekStart = localDateKey(mostRecentMonday(today));
    const monthStart = localDateKey(new Date(today.getFullYear(), today.getMonth(), 1));
    const yearStart = localDateKey(new Date(today.getFullYear(), 0, 1));
    const ninety = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    ninety.setDate(ninety.getDate() - 89); // inclusive 90-day window
    const ninetyStart = localDateKey(ninety);
    return {
      today: history[todayKey] || 0,
      week: sumRange(history, weekStart, todayKey),
      month: sumRange(history, monthStart, todayKey),
      threeMonths: sumRange(history, ninetyStart, todayKey),
      year: sumRange(history, yearStart, todayKey),
    };
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jasoncraig/Documents/Claude/Projects/Pomodoro && node --test pomodoro.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/jasoncraig/Documents/Claude/Projects/Pomodoro
git add pomodoro.html pomodoro.test.js
git commit -m "feat: implement sumRange and computeTotals"
```

---

### Task 5: `migrate`

**Files:**
- Modify: `pomodoro.html` (implement `migrate`)
- Modify: `pomodoro.test.js` (add tests)

- [ ] **Step 1: Write the failing tests**

Append to `pomodoro.test.js`:
```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jasoncraig/Documents/Claude/Projects/Pomodoro && node --test pomodoro.test.js`
Expected: FAIL with "not implemented".

- [ ] **Step 3: Implement `migrate`**

In `pomodoro.html`, replace the `migrate` stub body with:
```js
  function migrate(raw) {
    if (raw && raw.version === 2) {
      return {
        version: 2,
        history: raw.history || {},
        lengthPref: raw.lengthPref === 50 ? 50 : 25,
      };
    }
    const result = { version: 2, history: {}, lengthPref: 25 };
    if (raw && typeof raw === 'object' && raw.date && raw.count > 0) {
      result.history[raw.date] = raw.count;
    }
    return result;
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jasoncraig/Documents/Claude/Projects/Pomodoro && node --test pomodoro.test.js`
Expected: PASS (all suites green).

- [ ] **Step 5: Commit**

```bash
cd /Users/jasoncraig/Documents/Claude/Projects/Pomodoro
git add pomodoro.html pomodoro.test.js
git commit -m "feat: implement migrate"
```

---

### Task 6: Rewire the data layer onto the history model

This replaces the old `STORAGE_KEY`/`loadData`/`saveData`/`recordSession`/`todayKey`/`yesterdayKey`/`updateStatsDisplay` logic with history-based equivalents. Stats DOM is added in Task 9; for now `renderStats` writes only to the existing `#sessionCount` and `#streakCount` elements so the app keeps working.

**Files:**
- Modify: `pomodoro.html:316-434` (config + storage/stats functions) and the init block near `pomodoro.html:516-519`

- [ ] **Step 1: Replace the old config + storage/stats code**

In `pomodoro.html`, the current config is:
```js
  // ── Config ──
  const WORK_DURATION = 50 * 60;
  const BREAK_DURATION = 10 * 60;
```
Replace those three lines with:
```js
  // ── Config ──
  const REST_DURATION = 10 * 60;
  const STORAGE_KEY = 'pomodoro_data';
```
(The pure-logic block added in Task 1 stays directly below this.)

Then find the entire old storage/stats section — from the `// ── Storage ──` comment through the end of `updateStatsDisplay` (the old `STORAGE_KEY` line, `todayKey`, `yesterdayKey`, `loadData`, `saveData`, `recordSession`, `updateStatsDisplay`) — and replace that whole section with:
```js
  // ── Storage (history model) ──
  function loadData() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { raw = null; }
    const data = migrate(raw);
    saveData(data);
    return data;
  }

  function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function recordSession() {
    const data = loadData();
    const key = localDateKey(new Date());
    data.history[key] = (data.history[key] || 0) + 1;
    saveData(data);
    renderStats();
  }

  function renderStats() {
    const data = loadData();
    const now = new Date();
    const totals = computeTotals(data.history, now);
    const streak = computeStreak(data.history, now);
    streakCountEl.textContent = streak;
    sessionCountEl.textContent = totals.today;
    // Week/month/3mo/year elements are wired in Task 9.
    if (typeof weekCountEl !== 'undefined' && weekCountEl) {
      weekCountEl.textContent = totals.week;
      monthCountEl.textContent = totals.month;
      threeMoCountEl.textContent = totals.threeMonths;
      yearCountEl.textContent = totals.year;
    }
  }
```

- [ ] **Step 2: Update the init block at the bottom of the script**

Find the init block:
```js
  // ── Init ──
  const initialData = loadData();
  updateStatsDisplay(initialData);
  updateDisplay();
```
Replace it with:
```js
  // ── Init ──
  loadData();
  renderStats();
  updateDisplay();
```

- [ ] **Step 3: Fix remaining references to the removed constant (temporary)**

The timer code still references `WORK_DURATION`/`BREAK_DURATION`, which no longer exist. To keep the app runnable until Task 7/8 rewrite the timer, temporarily add these two lines right under the `// ── Config ──` block:
```js
  let workMinutes = 25;
  const WORK_DURATION = workMinutes * 60; // removed in Task 7
  const BREAK_DURATION = REST_DURATION;   // removed in Task 8
```

- [ ] **Step 4: Re-run unit tests (pure logic must still extract cleanly)**

Run: `cd /Users/jasoncraig/Documents/Claude/Projects/Pomodoro && node --test pomodoro.test.js`
Expected: PASS (the marker block is unchanged).

- [ ] **Step 5: Manual browser verification**

Run: `open /Users/jasoncraig/Documents/Claude/Projects/Pomodoro/pomodoro.html`
In the browser:
1. Open DevTools console and run `localStorage.removeItem('pomodoro_data')`, then reload.
2. Confirm the page shows "0" for Today and "0" for Day Streak and the timer renders (it will show `50:00` until Task 7 — that's expected).
3. In console run `JSON.parse(localStorage.getItem('pomodoro_data'))` and confirm it is `{version:2, history:{}, lengthPref:25}`.
4. (Migration check) In console run:
   `localStorage.setItem('pomodoro_data', JSON.stringify({date:'2026-06-15', count:3, streak:5, lastActiveDate:'2026-06-15'}))` then reload, and confirm `JSON.parse(localStorage.getItem('pomodoro_data'))` is now `{version:2, history:{'2026-06-15':3}, lengthPref:25}`.

- [ ] **Step 6: Commit**

```bash
cd /Users/jasoncraig/Documents/Claude/Projects/Pomodoro
git add pomodoro.html
git commit -m "refactor: rewire data layer onto per-day history model"
```

---

### Task 7: 25/50 length selector (markup, CSS, behavior)

**Files:**
- Modify: `pomodoro.html` — markup near `pomodoro.html:278` (session label), CSS in `<style>`, state + behavior in `<script>`.

- [ ] **Step 1: Add the toggle markup**

In `pomodoro.html`, find:
```html
    <div class="session-label" id="sessionLabel">Work Session</div>
```
Insert directly **above** it:
```html
    <div class="length-toggle" id="lengthToggle">
      <button class="length-btn" id="len25" data-min="25">25</button>
      <button class="length-btn" id="len50" data-min="50">50</button>
    </div>
```

- [ ] **Step 2: Add toggle CSS**

In the `<style>` block, immediately before `/* Session label */`, add:
```css
  /* Length toggle */
  .length-toggle {
    display: inline-flex;
    gap: 4px;
    padding: 4px;
    margin-bottom: 18px;
    background: var(--surface);
    border: 1px solid rgba(255,255,255,0.05);
    border-radius: 12px;
  }
  .length-btn {
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    padding: 6px 18px;
    border-radius: 9px;
    cursor: pointer;
    transition: background 0.2s ease, color 0.2s ease;
  }
  .length-btn.active {
    background: var(--accent-work);
    color: #0c1221;
  }
  body.break-mode .length-btn.active { background: var(--accent-break); }
  .length-toggle.locked { opacity: 0.4; pointer-events: none; }
```

- [ ] **Step 3: Replace the temporary state + add length state and DOM refs**

In `<script>`, replace the temporary lines added in Task 6 Step 3:
```js
  let workMinutes = 25;
  const WORK_DURATION = workMinutes * 60; // removed in Task 7
  const BREAK_DURATION = REST_DURATION;   // removed in Task 8
```
with:
```js
  let workMinutes = 25; // 25 or 50, restored from lengthPref on init
```
Then, in the DOM refs section (near the other `document.getElementById` calls), add:
```js
  const lengthToggle = document.getElementById('lengthToggle');
  const len25Btn = document.getElementById('len25');
  const len50Btn = document.getElementById('len50');
```
And in the State section, add a `hasStarted` flag next to the existing state vars (`let running = false;` etc.):
```js
  let hasStarted = false; // true once the current session has been started (until reset/re-arm)
```

- [ ] **Step 4: Update `updateDisplay` to use `workMinutes`**

Replace the body of `updateDisplay`:
```js
  function updateDisplay() {
    timerDigits.textContent = formatTime(timeLeft);

    const total = isWork ? WORK_DURATION : BREAK_DURATION;
    const progress = (total - timeLeft) / total;
    progressRing.style.strokeDashoffset = CIRCUMFERENCE * (1 - progress);

    timerFraction.textContent = `of ${total / 60} min`;
  }
```
with:
```js
  function updateDisplay() {
    timerDigits.textContent = formatTime(timeLeft);

    const total = isWork ? workMinutes * 60 : REST_DURATION;
    const progress = (total - timeLeft) / total;
    progressRing.style.strokeDashoffset = CIRCUMFERENCE * (1 - progress);

    timerFraction.textContent = `of ${total / 60} min`;
  }
```

- [ ] **Step 5: Add toggle behavior functions**

Add these functions in `<script>` (e.g. just after `updateDisplay`):
```js
  function updateLengthToggleUI() {
    len25Btn.classList.toggle('active', workMinutes === 25);
    len50Btn.classList.toggle('active', workMinutes === 50);
    // Locked while a session is started/running; editable only when idle/armed.
    lengthToggle.classList.toggle('locked', hasStarted || running);
  }

  function setLength(minutes) {
    if (hasStarted || running) return; // only changeable when idle
    workMinutes = minutes;
    const data = loadData();
    data.lengthPref = minutes;
    saveData(data);
    if (isWork) {
      timeLeft = workMinutes * 60;
      updateDisplay();
    }
    updateLengthToggleUI();
  }

  len25Btn.addEventListener('click', () => setLength(25));
  len50Btn.addEventListener('click', () => setLength(50));
```

- [ ] **Step 6: Update the State init and the init block to honor `lengthPref`**

Find the State init:
```js
  let timeLeft = WORK_DURATION;
```
Replace with:
```js
  let timeLeft = workMinutes * 60;
```
Then update the init block:
```js
  // ── Init ──
  loadData();
  renderStats();
  updateDisplay();
```
to:
```js
  // ── Init ──
  const bootData = loadData();
  workMinutes = bootData.lengthPref;
  timeLeft = workMinutes * 60;
  updateLengthToggleUI();
  renderStats();
  updateDisplay();
```

- [ ] **Step 7: Run unit tests**

Run: `cd /Users/jasoncraig/Documents/Claude/Projects/Pomodoro && node --test pomodoro.test.js`
Expected: PASS (pure-logic block untouched).

- [ ] **Step 8: Manual browser verification**

Run: `open /Users/jasoncraig/Documents/Claude/Projects/Pomodoro/pomodoro.html`
1. In console: `localStorage.removeItem('pomodoro_data')`, reload. Confirm **25** is highlighted and timer reads `25:00`.
2. Click **50** → timer reads `50:00`, 50 highlighted. Reload → still 50 (pref persisted).
3. Click **25** → `25:00`. Press **Start** → toggle dims and is unclickable. Press **Pause** → toggle stays dimmed/locked (session in progress). Press **Reset** → toggle re-enabled.

- [ ] **Step 9: Commit**

```bash
cd /Users/jasoncraig/Documents/Claude/Projects/Pomodoro
git add pomodoro.html
git commit -m "feat: add 25/50 length selector with idle-only locking and persistence"
```

---

### Task 8: Timer flow — auto-rest and wait-after-rest

**Files:**
- Modify: `pomodoro.html` — `start`, `pause`, `reset`, `switchSession` in `<script>`.

- [ ] **Step 1: Add a `stopInterval` helper and update `start`**

Replace the existing `start` function:
```js
  function start() {
    if (running) return;
    running = true;
    interval = setInterval(tick, 1000);
    mainBtn.textContent = 'Pause';
    timerFraction.classList.add('visible');
  }
```
with:
```js
  function stopInterval() {
    running = false;
    clearInterval(interval);
    interval = null;
  }

  function start() {
    if (running) return;
    running = true;
    hasStarted = true;
    interval = setInterval(tick, 1000);
    mainBtn.textContent = 'Pause';
    timerFraction.classList.add('visible');
    updateLengthToggleUI();
  }
```

- [ ] **Step 2: Update `pause` to use `stopInterval`**

Replace:
```js
  function pause() {
    running = false;
    clearInterval(interval);
    interval = null;
    mainBtn.textContent = 'Resume';
  }
```
with:
```js
  function pause() {
    stopInterval();
    mainBtn.textContent = 'Resume';
    updateLengthToggleUI();
  }
```

- [ ] **Step 3: Update `reset`**

Replace:
```js
  function reset() {
    pause();
    isWork = true;
    timeLeft = WORK_DURATION;
    document.body.classList.remove('break-mode');
    sessionLabel.textContent = 'Work Session';
    mainBtn.textContent = 'Start';
    timerFraction.classList.remove('visible');
    updateDisplay();
  }
```
with:
```js
  function reset() {
    stopInterval();
    isWork = true;
    hasStarted = false;
    timeLeft = workMinutes * 60;
    document.body.classList.remove('break-mode');
    sessionLabel.textContent = 'Work Session';
    mainBtn.textContent = 'Start';
    timerFraction.classList.remove('visible');
    updateLengthToggleUI();
    updateDisplay();
  }
```

- [ ] **Step 4: Rewrite `switchSession` for auto-rest + wait-after-rest**

Replace:
```js
  function switchSession() {
    if (isWork) recordSession();

    isWork = !isWork;
    timeLeft = isWork ? WORK_DURATION : BREAK_DURATION;
    document.body.classList.toggle('break-mode', !isWork);
    sessionLabel.textContent = isWork ? 'Work Session' : 'Break Time';

    playNotification();
    triggerFlash();
    updateDisplay();
  }
```
with:
```js
  function switchSession() {
    if (isWork) {
      // Work finished -> record it and auto-start the 10-minute rest.
      recordSession();
      isWork = false;
      timeLeft = REST_DURATION;
      document.body.classList.add('break-mode');
      sessionLabel.textContent = 'Break Time';
      playNotification();
      triggerFlash();
      updateDisplay();
      // running / hasStarted stay true: the rest continues automatically.
    } else {
      // Rest finished -> arm the next pomodoro but wait for the user to press Start.
      isWork = true;
      timeLeft = workMinutes * 60;
      document.body.classList.remove('break-mode');
      sessionLabel.textContent = 'Work Session';
      playNotification();
      triggerFlash();
      stopInterval();
      hasStarted = false;
      mainBtn.textContent = 'Start';
      timerFraction.classList.remove('visible');
      updateLengthToggleUI();
      updateDisplay();
    }
  }
```

- [ ] **Step 5: Run unit tests**

Run: `cd /Users/jasoncraig/Documents/Claude/Projects/Pomodoro && node --test pomodoro.test.js`
Expected: PASS.

- [ ] **Step 6: Manual browser verification (use short durations to avoid waiting)**

Run: `open /Users/jasoncraig/Documents/Claude/Projects/Pomodoro/pomodoro.html`
To avoid waiting 25 minutes, temporarily test via console: after loading, run `timeLeft = 3` in the console while a work session is **running**, and watch:
1. Work hits 0 → beep + flash, label switches to "Break Time" (purple), rest **auto-counts down** from `10:00` without pressing anything; toggle is locked.
2. Set `timeLeft = 3` again during rest → rest hits 0 → beep + flash, label back to "Work Session" (blue), timer shows the armed length (`25:00`/`50:00`), button reads **Start**, timer is **stopped** (not counting), toggle is **re-enabled**.
3. Confirm `Today` incremented by 1 after the work session completed.
4. Press **Reset** mid-rest → returns to idle work session at the selected length, toggle enabled.

- [ ] **Step 7: Commit**

```bash
cd /Users/jasoncraig/Documents/Claude/Projects/Pomodoro
git add pomodoro.html
git commit -m "feat: auto-start rest after work, wait for Start after rest"
```

---

### Task 9: Stats UI — always-visible streak/today + collapsible panel

**Files:**
- Modify: `pomodoro.html` — stats markup near `pomodoro.html:304-313`, CSS in `<style>`, DOM refs + toggle behavior in `<script>`.

- [ ] **Step 1: Replace the stats markup**

Find the current stats block:
```html
    <div class="stats">
      <div class="stat">
        <span class="stat-value" id="sessionCount">0</span>
        <span class="stat-label">Today</span>
      </div>
      <div class="stat">
        <span class="stat-value" id="streakCount">0</span>
        <span class="stat-label">Day Streak</span>
      </div>
    </div>
```
Replace it with:
```html
    <div class="stats">
      <div class="stat">
        <span class="stat-value" id="streakCount">0</span>
        <span class="stat-label">Day Streak</span>
      </div>
      <div class="stat">
        <span class="stat-value" id="sessionCount">0</span>
        <span class="stat-label">Today</span>
      </div>
    </div>

    <button class="stats-toggle" id="statsToggle" aria-expanded="false">
      View all stats <span class="chevron">▾</span>
    </button>

    <div class="stats-panel" id="statsPanel">
      <div class="stat">
        <span class="stat-value" id="weekCount">0</span>
        <span class="stat-label">Week</span>
      </div>
      <div class="stat">
        <span class="stat-value" id="monthCount">0</span>
        <span class="stat-label">Month</span>
      </div>
      <div class="stat">
        <span class="stat-value" id="threeMoCount">0</span>
        <span class="stat-label">3 Months</span>
      </div>
      <div class="stat">
        <span class="stat-value" id="yearCount">0</span>
        <span class="stat-label">Year</span>
      </div>
    </div>
```

- [ ] **Step 2: Add stats panel CSS**

In `<style>`, immediately after the `.stat-label { ... }` rule, add:
```css
  .stats-toggle {
    margin: 18px auto 0;
    display: block;
    background: transparent;
    border: none;
    color: var(--accent-work);
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.5px;
    cursor: pointer;
    opacity: 0.85;
    transition: opacity 0.2s ease, color 0.6s ease;
  }
  .stats-toggle:hover { opacity: 1; }
  body.break-mode .stats-toggle { color: var(--accent-break); }
  .stats-toggle .chevron { display: inline-block; transition: transform 0.25s ease; }
  .stats-toggle.open .chevron { transform: rotate(180deg); }

  .stats-panel {
    display: none;
    justify-content: center;
    gap: 24px;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid rgba(255,255,255,0.06);
  }
  .stats-panel.open { display: flex; }
  .stats-panel .stat-value { font-size: 18px; }
```

- [ ] **Step 3: Add DOM refs and toggle behavior**

In `<script>` DOM refs section add:
```js
  const statsToggle = document.getElementById('statsToggle');
  const statsPanel = document.getElementById('statsPanel');
  const weekCountEl = document.getElementById('weekCount');
  const monthCountEl = document.getElementById('monthCount');
  const threeMoCountEl = document.getElementById('threeMoCount');
  const yearCountEl = document.getElementById('yearCount');
```
Then add the toggle handler (e.g. near the other `addEventListener` calls):
```js
  statsToggle.addEventListener('click', () => {
    const open = statsPanel.classList.toggle('open');
    statsToggle.classList.toggle('open', open);
    statsToggle.setAttribute('aria-expanded', String(open));
  });
```

- [ ] **Step 4: Simplify `renderStats` now that the elements always exist**

Replace the `renderStats` function body's tail (the `if (typeof weekCountEl ...)` guard) so the whole function reads:
```js
  function renderStats() {
    const data = loadData();
    const now = new Date();
    const totals = computeTotals(data.history, now);
    const streak = computeStreak(data.history, now);
    streakCountEl.textContent = streak;
    sessionCountEl.textContent = totals.today;
    weekCountEl.textContent = totals.week;
    monthCountEl.textContent = totals.month;
    threeMoCountEl.textContent = totals.threeMonths;
    yearCountEl.textContent = totals.year;
  }
```

- [ ] **Step 5: Run unit tests**

Run: `cd /Users/jasoncraig/Documents/Claude/Projects/Pomodoro && node --test pomodoro.test.js`
Expected: PASS.

- [ ] **Step 6: Manual browser verification**

Run: `open /Users/jasoncraig/Documents/Claude/Projects/Pomodoro/pomodoro.html`
1. In console seed history:
   `localStorage.setItem('pomodoro_data', JSON.stringify({version:2, history:{'2026-06-15':4,'2026-06-14':2,'2026-06-01':1,'2026-03-20':5,'2026-03-10':7,'2025-12-31':9}, lengthPref:25}))` then reload.
   (Note: window totals are relative to the real current date; exact numbers vary by when you run this. The check below is structural.)
2. Confirm **Day Streak** and **Today** show as the two always-visible stats.
3. Confirm the **"View all stats ▾"** button appears and the panel is hidden by default.
4. Click it → panel expands showing Week / Month / 3 Months / Year, chevron rotates. Click again → collapses.
5. Confirm numbers are non-negative integers and Year ≥ 3 Months ≥ Month (sanity for a single calendar year).

- [ ] **Step 7: Commit**

```bash
cd /Users/jasoncraig/Documents/Claude/Projects/Pomodoro
git add pomodoro.html
git commit -m "feat: add collapsible all-stats panel (week/month/3mo/year)"
```

---

### Task 10: Final end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Full unit test run**

Run: `cd /Users/jasoncraig/Documents/Claude/Projects/Pomodoro && node --test pomodoro.test.js`
Expected: all tests PASS, exit code 0.

- [ ] **Step 2: Confirm no stale references remain**

Run: `cd /Users/jasoncraig/Documents/Claude/Projects/Pomodoro && grep -n "WORK_DURATION\|BREAK_DURATION\|updateStatsDisplay\|yesterdayKey\|todayKey(" pomodoro.html || echo "clean"`
Expected: `clean` (these old identifiers were all removed).

- [ ] **Step 3: Clean-slate browser smoke test**

Run: `open /Users/jasoncraig/Documents/Claude/Projects/Pomodoro/pomodoro.html`
1. Console: `localStorage.removeItem('pomodoro_data')`, reload.
2. Verify: defaults to 25; Today=0, Day Streak=0; all-stats panel hidden.
3. Switch to 50, reload → still 50.
4. Start a work session; in console set `timeLeft = 2`; verify auto-rest begins; set `timeLeft = 2` again; verify it stops on Start with the next pomodoro armed; verify Today=1 and Day Streak=1.
5. Expand all-stats → Week/Month/3mo/Year each show 1.

- [ ] **Step 4: Final commit (if any verification fixes were needed)**

```bash
cd /Users/jasoncraig/Documents/Claude/Projects/Pomodoro
git add -A
git commit -m "chore: final verification pass for pomodoro improvements" || echo "nothing to commit"
```

---

## Self-Review Notes

- **Spec coverage:** 25/50 selection + idle-only lock + default-25-then-remember (Task 7); 10-min auto-rest for both lengths + wait-after-rest (Task 8); day streak + today always visible, collapsible week/month/3mo/year (Task 9); calendar windows with Monday week start and 90-day "3 months" (Task 4); completed-pomodoro count unit (recordSession, Task 6); per-day history model + migration with one-time historical-streak reset (Tasks 5, 6); single self-contained file preserved (no deliverable deps; tests are dev-only). All covered.
- **Type/name consistency:** `localDateKey`, `mostRecentMonday`, `computeStreak`, `sumRange`, `computeTotals`, `migrate` used identically across html and tests; DOM ref names (`weekCountEl`, `monthCountEl`, `threeMoCountEl`, `yearCountEl`, `streakCountEl`, `sessionCountEl`) consistent between Task 6 and Task 9; `hasStarted`/`stopInterval`/`workMinutes`/`REST_DURATION` consistent across Tasks 6–8.
- **Placeholders:** none — every code step contains full code.
