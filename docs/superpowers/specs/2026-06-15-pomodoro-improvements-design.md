# Pomodoro App Improvements — Design

**Date:** 2026-06-15
**File under change:** `pomodoro.html` (single self-contained file, no build step, no dependencies)

## Goal

Extend the existing Pomodoro web app with three capabilities:

1. Choose between a 25-minute and a 50-minute pomodoro.
2. View progress across multiple time windows: a headline day streak plus
   week / month / 3-month / year totals.
3. Auto-start a 10-minute rest when a pomodoro ends (for either length).

## Decisions

| Topic | Decision |
|---|---|
| Timer lengths | 25 or 50 minutes, chosen via a segmented `[ 25 \| 50 ]` toggle |
| When length is changeable | Only while idle; toggle disabled (dimmed) during a running session; Reset re-enables |
| Default length | 25 on first-ever load; thereafter reopens to last-used length |
| Rest length | 10 minutes, identical for both pomodoro lengths |
| Rest auto-start | Yes — starts immediately when a work session reaches 0 |
| After rest ends | Arm next pomodoro at selected length, but wait for user to press Start (no continuous auto-cycle) |
| Streak meaning | Both: a consecutive **day streak** headline + **totals** for longer windows |
| Always-visible stats | Day streak + Today's completed count |
| Expandable stats | "View all stats ▾" panel reveals This week / This month / 3 months / This year |
| Window basis | Calendar-based: this week (Monday start), this month, this year (Jan 1 → now); **"3 months" = last 90 days** |
| Count unit | One completed work session = 1, whether 25 or 50 |
| Stats layout | Collapsible panel (option B) |

## Feature Details

### 1. Timer length selection

- Add a segmented control near the top of the card (above or beside the
  session label) with two segments: **25** and **50**.
- The selected segment is highlighted in the active accent color.
- The control is interactive only when the timer is idle (not running, not
  paused mid-session). While a session is running it is visually dimmed and
  non-interactive.
- **Reset** returns the app to an idle work session and re-enables the toggle.
- Selecting a length while idle re-arms the work timer to that length and
  updates the displayed digits and "of N min" fraction.
- The chosen length persists in localStorage and is restored on next load.
  On the very first load (no saved preference) the default is **25**.

### 2. Rest timer

- When a **work** session reaches 0:
  - Record the completed pomodoro (see Data Model).
  - Switch to break mode (purple), label "Break Time".
  - Play the notification beep and trigger the flash.
  - **Auto-start** the 10-minute rest countdown.
- When the **rest** reaches 0:
  - Switch back to work mode (blue), label "Work Session".
  - Play the beep and trigger the flash.
  - Arm the next pomodoro at the currently selected length but **do not
    auto-start** it — wait for the user to press Start (button reads "Start").
- **Reset** at any time stops the timer and returns to an idle work session at
  the selected length.

### 3. Stats & streaks

**Always visible:**
- **Day streak** — number of consecutive calendar days, ending today (or
  yesterday if today has no sessions yet), each with ≥1 completed pomodoro.
- **Today** — completed pomodoros recorded for today's date.

**Collapsible "View all stats ▾" panel** (collapsed by default) reveals four
totals, computed from history at display time:
- **This week** — completed pomodoros since the most recent Monday 00:00.
- **This month** — completed pomodoros since the 1st of the current month.
- **3 months** — completed pomodoros within the last 90 days (rolling).
- **This year** — completed pomodoros since January 1 of the current year.

All windows count completed work sessions; a 25 and a 50 each count as 1.

### 4. Data model

localStorage moves from the current single-counter format to a per-day
history map plus preferences:

```json
{
  "version": 2,
  "history": { "2026-06-15": 4, "2026-06-14": 6, "2026-06-12": 2 },
  "lengthPref": 25
}
```

- `history` maps `YYYY-MM-DD` → count of completed pomodoros that day. Days with
  no sessions are simply absent.
- `lengthPref` is the last-used pomodoro length (25 or 50).
- **Day streak** and **all window totals are derived from `history`** on load
  and after each completed session — no separately tracked streak counter to
  drift out of sync.
- **Migration:** on load, if data is in the old format
  (`{date, count, streak, lastActiveDate}`), convert it: seed
  `history[oldDate] = oldCount` (when count > 0) so the current day's progress
  carries over, set `version: 2`, and persist. The derived streak then
  recomputes from history going forward. (The old incremental `streak` value is
  not perfectly reconstructable from a single day of history; this is an
  accepted, minor one-time reset of the historical streak for pre-existing
  users.)

### 5. Computation rules

- **todayKey / date keys:** local date as `YYYY-MM-DD` (use local time, not
  UTC, so day boundaries match the user's clock).
- **Day streak:** walk backwards from today (or yesterday if today is empty)
  one day at a time; count consecutive days present in `history`; stop at the
  first gap.
- **Week start:** Monday. "This week" = all history keys with date ≥ the most
  recent Monday (inclusive), local time.
- **3 months:** all history keys with date ≥ (today − 89 days), i.e. a 90-day
  inclusive rolling window.

## Out of Scope (YAGNI)

- No long-break-every-N-pomodoros logic (flat 10-minute rest only).
- No charts/graphs — numeric totals only.
- No backend, accounts, or cross-device sync (localStorage only).
- No configurable rest length or custom durations beyond 25/50.

## Non-Goals / Preserved Behavior

- Remains a single self-contained `pomodoro.html`.
- Task input, SVG progress ring, Web Audio beep, ambient glow, flash overlay,
  and the blue/purple work/break theming all remain.
