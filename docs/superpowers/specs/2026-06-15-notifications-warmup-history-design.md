# Notifications, Warm-up & History — Design

**Date:** 2026-06-15
**File under change:** `index.html` (single self-contained file) + `pomodoro.test.js`
**Builds on:** the tab-title countdown already on `main`.

## Goal

Four additions to the Pomodoro app:
1. **Tab-title flash** when a session ends (to grab attention from another tab).
2. **Sound:** a mute toggle plus three selectable synthesized sounds, with preview.
3. **5-minute "pre-heat the oven" warm-up** that chains into the chosen 25/50.
4. **Pomodoro history** under the stats — collapsible, inline task editing, 3 most recent with expand.

This requires moving the storage from a per-day count map to a per-session log (**version 3**).

## 1. Data model (version 3)

```json
{
  "version": 3,
  "sessions": [ { "id": "…", "ts": 1718480700000, "minutes": 25, "task": "Write report" } ],
  "lengthPref": 25,
  "sound": "chime",
  "muted": false,
  "preheat": false
}
```

- `sessions`: append-only log of **completed work pomodoros** (warm-ups and rests are NOT logged). Each has a stable `id`, an epoch-ms `ts`, `minutes` (25 or 50), and `task` (trimmed text, may be `""`).
- Streak and all week/month/3mo/year totals are **derived** from `sessions` via a new pure helper `dailyCounts(sessions)` → `{ "YYYY-MM-DD": count }`, which feeds the existing (unchanged) `computeTotals` / `computeStreak`.
- `lengthPref` (25|50), `sound` (chime|bell|arcade), `muted` (bool), `preheat` (bool) all persisted.

### Migration
`migrate(raw)` normalizes any prior shape to v3:
- **v3:** validated pass-through (clamp `lengthPref`, `sound`; coerce booleans; default `sessions: []`).
- **v2** (`{version:2, history:{date:count}}`): for each `date`→`count`, push `count` **migrated** session records: `{ id, ts: <that date at local noon>, minutes: null, task: "", migrated: true }`. Preserves streak/totals exactly.
- **v1** (old `{date,count,...}`): same synthesis from the single day's count.
- **null/garbage:** fresh v3 default.

Migrated rows render as **"Focus session"** with no clock time and no duration (the old format never recorded them), which is acceptable.

## 2. Tab-title flash on session end

- A session ending triggers a title blink **only when the tab is not focused** (`document.hidden`). If the tab is focused, no blink.
- Messages alternate with `⏰ Time's up!`:
  - work → break: `🍅 Break time!`
  - break → armed: `✅ Back to work!`
  - warm-up → work: `Warmed up — let's go 🔥`
- Blinks ~once/second **until the tab regains focus/visibility**, then the normal title resumes. Safety stop after ~30 blinks.
- While flashing, the per-tick `updateTitle()` is suppressed so it doesn't fight the blink.

## 3. Sound

- Three synthesized Web Audio sounds via `playSound(name)`:
  - **chime** — the current pleasant 3-tone (660/880/660).
  - **bell** — a single warm tone with long exponential decay (~1s) and a soft overtone.
  - **arcade** — retro square-wave blips ascending (e.g. 392/523/659/784, short).
- A single shared `AudioContext`, lazily created and `resume()`d on user gestures (Start click, sound pick) to satisfy autoplay rules.
- **Mute toggle:** a 🔊/🔇 button in the **top-right corner** of the card. Persisted (`muted`). Silences end-of-session sound.
- **Sound picker:** a compact `Sound: [Chime ▾]` `<select>` near the stats. Changing it **previews** the chosen sound and persists (`sound`).
- Preview plays **even when muted** (explicit audition action); end-of-session playback respects `muted`.
- End-of-session sound plays on every phase transition (warm-up→work, work→break, break→armed), gated by `muted`.

## 4. 5-minute "pre-heat the oven" warm-up

- A toggle under the 25/50 picker: **`🔥 Just pre-heat the oven · 5 min`** with hint *"Set up your workspace for 5 min — then your session begins."* Persisted (`preheat`). Off by default.
- The timer now has three **phases**: `warmup` | `work` | `break` (replacing the `isWork` boolean).
  - durations: warmup = `WARMUP_DURATION` (5 min), work = `workMinutes*60`, break = `REST_DURATION` (10 min).
  - labels: `Pre-Heating` / `Work Session` / `Break Time`.
  - body class / color: warmup = **amber** (`warmup-mode`, `--accent-warmup: #f59e0b`), work = blue (default), break = purple (`break-mode`).
  - title phase word: `Pre-heating` / `Focus` / `Break`.
- **Start behavior:** when idle/armed, the displayed timer shows the focus length (e.g. `25:00`). Pressing **Start**:
  - if `preheat` is on → begin the **warmup** phase (`05:00`, amber), running.
  - else → begin the **work** phase as today.
- **Phase advance** (`advancePhase`, replacing `switchSession`):
  - warmup → work: auto-continue running; sound + flash `Warmed up — let's go 🔥`. (Not recorded.)
  - work → break: `recordSession()`; auto-continue running; sound + flash `🍅 Break time!`.
  - break → armed work: stop and wait for Start; sound + flash `✅ Back to work!`.
- The 25/50 picker and the warm-up toggle lock during any started/running session (existing `hasStarted || running` rule), re-enable on reset / when armed.
- **Reset** returns to idle `work` phase at the focus length; clears amber/purple.
- The warm-up never counts toward streak/totals and is never added to history.

## 5. Pomodoro history

- A **`History ▾`** collapsible toggle directly under "View all stats", same disclosure pattern (`aria-expanded`/`aria-controls`).
- **Two levels:**
  - Open (default when expanded): show the **3 most recent** completed pomodoros, newest first.
  - A **`Show all (N) ▾`** control expands to the **full list grouped by day** (headers: `Today`, `Yesterday`, then `Mon, Jun 13`), in a scrollable container (capped max-height). **`Show less`** collapses back to 3.
- **Row format:** `2:45 PM · 25m · Write report`. Blank task → `Focus session`. Migrated rows: `Focus session` only (no time, no duration).
- **Inline task editing:** clicking a row's task text turns it into a text input (seeded with current text); Enter or blur saves to that session (by `id`), persists, and re-renders; Escape cancels. Empty save reverts the label to `Focus session` but keeps `task: ""`.

## Testing & scope

- **TDD (pure logic, in `pomodoro.test.js`):** rewrite `migrate` for v3 and add `dailyCounts`; keep existing date/streak/total tests (now fed via `dailyCounts`).
- **Headless smoke** for integration: phase machine (warmup→work→break→armed), recording, sound-mute gating (no throw), title flash flag transitions, and history edit by id.
- **Browser** check by the user for visuals/audio.
- Stays a single self-contained `index.html`; sounds synthesized (no assets). Implemented directly (not the multi-agent pipeline), with the same verification rigor.

## Out of scope (YAGNI)

- No deleting history rows (only editing the task). No export. No per-sound volume levels (just on/off). No configurable warm-up length. No long-break logic.
