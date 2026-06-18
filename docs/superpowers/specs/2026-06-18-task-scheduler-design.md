# Task Scheduler — Design

**Date:** 2026-06-18
**File under change:** `index.html` (single self-contained file) + `pomodoro.test.js`
**Builds on:** the per-session log (version 3), the "Done by" planner, and the collapsible History/Stats panels already on `main`.

## Goal

Let the user write out the day's tasks, see them **laid out on a timeline with estimated start/end times**, and have the **timer auto-advance through them**. A task list drives the Pomodoro timer: the active task's name auto-loads into the timer, each completed pomodoro burns down that task's count, and the schedule shows when each task runs and when the day finishes — checked against the existing "Done by" deadline.

Also in scope: **remove the entire stats block** (Day Streak, Today, and the Week/Month/3-Month/Year panel). History stays.

Out of scope (separate future spec): **Banked Time** — "Complete Task · Bank Remaining Time," which banks a finished task's leftover minutes into a pool spent on guilt-free distractions. The manual check-off built here is where it will later hook in.

## 1. Data model (version 3 → version 4)

```json
{
  "version": 4,
  "sessions": [ { "id": "…", "ts": 1718480700000, "minutes": 25, "task": "CTS Emails" } ],
  "lengthPref": 25,
  "sound": "chime",
  "muted": false,
  "preheat": false,
  "endTime": "16:45",
  "plan": [ { "id": "…", "name": "CTS Emails", "count": 1, "done": false } ],
  "startOverride": "",
  "pills": ["CTS Emails", "Rockstar Emails", "CTS Pipeline", "Lesson Planning", "Song writing"]
}
```

New fields:
- **`plan`** — ordered array of tasks. Each: stable `id`, `name` (trimmed, ≤80 chars), `count` (pomodoros remaining, integer ≥1 while active), `done` (bool).
- **`startOverride`** — `"HH:MM"` or `""`. Blank ⇒ the schedule starts from *now*; set ⇒ that clock time today (3a-C).
- **`pills`** — editable quick-add labels, seeded with the five recurring tasks above. Used to append tasks without typing.

Unchanged: `sessions` (the append-only completed-pomodoro log — History depends on it), `endTime` (the "Done by" deadline, now also feeds the schedule reality-check).

**Migration `v4`:** any prior shape is normalized. `migrate()` gains the three new fields with safe defaults (`plan: []`, `startOverride: ""`, `pills: [<the five seeds>]`). All existing v3→ logic is preserved; a v3 object simply has the new defaults added. Validation: `plan` entries coerced to `{id, name:String, count: max(1,int), done: bool}`; non-array `pills` falls back to the seed list.

## 2. Pure-logic core

Extends the existing `==PURE-LOGIC==` block — DOM-free, deterministic, `now`/`startMs` always passed in (never `new Date()` inside). All unit-tested.

- **`buildSchedule(plan, { startMs, focusMin, breakMin })`** → array of blocks, one per **not-done** task, in list order:
  `{ taskId, name, remaining, startMs, endMs }`.
  Sessions are laid end-to-end with a `breakMin` gap **between** every session and **no trailing break** after the final session of the day (matches how the timer actually runs, and the existing `pomodorosLeft` convention). A task with `count = n` occupies `n` focus blocks plus `n−1` internal breaks; its window spans its first session's start to its last session's end. Between two tasks there is one break gap. Done tasks are skipped (they're in the past).
- **`scheduleFinish(plan, opts)`** → `endMs` of the last block, or `null` if no not-done tasks.
- **`deadlineCheck(finishMs, endTime, nowMs)`** → `{ madeIt: bool, deltaMin: int }` where `deltaMin` is minutes of slack (positive) or overrun (negative) vs. today's `endTime`. Returns `null` if `endTime` is blank or `finishMs` is null. Reuses the `minutesUntil` style of math.
- **`activeTaskId(plan)`** → `id` of the first task with `done === false`, or `null`.
- **`completeOnePomodoro(plan)`** → returns a new plan with the active task's `count` decremented; if it reaches 0, `done` is set `true` (and `count` left at 0). No-op if no active task.

`focusMin` = current `workMinutes` (25/50); `breakMin` = `REST_DURATION/60` (10).

## 3. Timer integration (the auto-load loop)

- **Auto-load:** whenever a work session is armed or started, the active task's `name` is written into the timer's task input. It stays **editable** (4a-A) — manual typing wins for that one session and does **not** mutate the plan.
- **Recording:** `recordSession()` already labels the session from the task input — unchanged.
- **Advance:** in `advancePhase()`'s work-done branch, after `recordSession()`, call the plan-update path: `completeOnePomodoro()` → save → re-render plan → refill the task input with the new active task's name (or clear it if none).
- **Manual check-off** (4b-A): each row has a ✓ control to mark the task done / skip it; this advances the active task immediately (save → re-render → refill input). This is the seam Banked Time will later extend.
- **Re-flow:** the schedule recomputes on every plan change, on `visibilitychange` (tab regain), and on the existing 60-second `renderPlan` tick, so start/end times stay honest as the day moves.

## 4. UI — collapsible "Plan" panel

A `Plan ▾` toggle using the same pattern as History/Stats, inserted where the removed stats block was (between the task input and History). Contents, top to bottom:

1. **Start control** — label `Start:` with `now` as default and an optional `HH:MM` override (3a-C); blank clears back to *now*. Persists to `startOverride`.
2. **"Done by" deadline** — the existing `endTime` time input, **moved into this panel** where it belongs. Its old standalone "≈ N×25 / N×50 left" line is removed; the schedule summary (item 6) is now the readout.
3. **Quick-add pills** — tappable chips from `pills`; tapping appends a task `{name, count:1, done:false}`. A small **＋/edit** affordance adds, renames, or removes pills (persisted).
4. **Add-task input** — type a name, Enter appends a one-off task (count 1).
5. **Task list** — **zebra-striped rows** (alternating background for skimming). Each row:
   - name (click-to-edit inline, like History editing),
   - `[−] ×N [+]` stepper (min 1),
   - computed window `9:00–9:25`,
   - **▲ / ▼** reorder buttons (reliable on mobile; drag-and-drop is a possible later nicety),
   - **✓** mark done / skip,
   - **✕** delete.
   The **active task is highlighted**; **done tasks are struck through**.
6. **Summary line** — e.g. *"Finishes ~2:15 PM · ✅ 30 min before your 4:45 deadline"*, or *"⚠️ runs 2 sessions over"*, or just the finish time when no deadline is set. Driven by `scheduleFinish` + `deadlineCheck`.

Styling follows existing tokens (`--surface`, `--accent-work`/`--accent-break`, panel borders). Active-task highlight uses the accent color; zebra rows use `--surface` at low alpha on odd rows.

## 5. Removals

Delete the stats feature entirely:
- **DOM:** `.stats` (Day Streak + Today), `#statsToggle`, `#statsPanel` (Week/Month/3 Months/Year), and their labels.
- **CSS:** `.stats`, `.stat`, `.stat-value`, `.stat-label`, `.stats-toggle`, `.stats-panel` rules.
- **JS:** `renderStats`, `computeStreak`, `computeTotals`, `sumRange`, `mostRecentMonday`, `dailyCounts`, and all call sites (in `recordSession`, init, and the stats-toggle listener).

Keep: the session log, `recordSession`'s append, and all of History.

## 6. Edge cases

- **Empty plan** → panel shows "Add tasks to plan your day." No auto-load; the timer behaves exactly as today (manual task input).
- **All tasks done** → summary shows "All done 🎉"; no active task; auto-load clears the input.
- **Stepper** min is 1; reaching 0 happens only via completion (which sets `done`). ✕ removes a task outright.
- **Start override in the past** → honored as-is; windows simply read earlier clock times. Blank = now.
- **No deadline** (`endTime` blank) → summary shows the finish time only, no ✅/⚠️ check.
- **Editing a task to an empty name** → reverts to the prior name (no nameless tasks), mirroring History edit behavior.

## 7. Tests (`pomodoro.test.js`)

New cases:
- `buildSchedule`: single task; multi-pomo task internal breaks; multiple tasks with one break between; done tasks skipped; empty plan ⇒ `[]`.
- `scheduleFinish`: correct final `endMs`; `null` on empty.
- `deadlineCheck`: slack (positive), overrun (negative), blank deadline ⇒ `null`.
- `activeTaskId`: first not-done; `null` when all done/empty.
- `completeOnePomodoro`: decrement; transition to `done` at 0; no-op when none active.
- `migrate`: `v3 → v4` adds defaults and preserves sessions/endTime; malformed `plan`/`pills` coerced safely.
