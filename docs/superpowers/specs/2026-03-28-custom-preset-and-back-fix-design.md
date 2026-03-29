# Design: Custom Preset + Back-Button Fix

## Goals

1. **Back-button bug fix** — returning to the setup screen should restore the previously selected preset, not default to "Low".
2. **Custom preset** — a fourth quality option with configurable sliders, usable both on the setup screen and as a live panel in the demo, to help diagnose performance regressions by varying one parameter at a time.

## Approach

sessionStorage holds all custom state. URLs remain clean (`#low`, `#medium`, `#high`, `#custom`). No JS module files are touched except `js/config.js`.

---

## Feature 1: Back-button preset restore

**Problem:** The back button does `window.location.hash = ''; window.location.reload()`, which always shows "Low" selected (hardcoded `checked` in HTML).

**Fix:**
- Back button handler saves `window.location.hash.slice(1)` to `sessionStorage.lastPreset` before clearing the hash.
- Setup screen init reads `sessionStorage.lastPreset` and pre-selects the matching option (low / medium / high / custom).

**File:** `voxel_dda.html` only.

---

## Feature 2: Custom preset

### Setup screen

A fourth radio option "Custom" is added after High. When selected, a slider panel expands inline with the following controls:

| Param | Range | Step | Default |
|---|---|---|---|
| Entities | 1–256 | 1 | 128 |
| Lights | 1–3 | 1 | 3 |
| Grid W | 32–512 | 8 | 320 |
| Grid H | 32–512 | 8 | 200 |
| Grid D | 32–512 | 8 | 200 |
| Shadow Distance | 16–256 | 8 | 128 |
| DPR cap | 1–2 | 0.25 | 1 |
| PCF Taps | 1 / 5 | toggle | 5 |

Defaults come from `sessionStorage.customSettings` (JSON) when present, otherwise from the high-preset values above.

When Start is clicked with Custom selected:
1. Collect slider values into a settings object.
2. Save to `sessionStorage.customSettings`.
3. Set `window.location.hash = 'custom'` and reload.

### Config module

New export in `js/config.js`:

```js
export function setCustomConfig(s) {
    NUM_ENTITIES        = s.numEntities;
    N_LIGHTS            = s.nLights;
    W                   = s.w;
    H                   = s.h;
    D                   = s.d;
    SHADOW_CAST_DISTANCE = s.shadowCastDistance;
    MAX_DPR             = s.maxDpr;
    SHADOW_PCF_TAPS     = s.shadowPcfTaps;
}
```

### Startup logic (HTML script block)

`'custom'` added to `validPresets`. When `urlPreset === 'custom'`:
1. Read `sessionStorage.customSettings` (fall back to high-preset defaults if absent).
2. Call `setCustomConfig(settings)`.
3. Import `./js/main.js`.

### Demo overlay

Shown only when `urlPreset === 'custom'`. Fixed panel in the top-right corner. Collapsible via a toggle button (`▾` / `▸`).

Contains the same eight sliders as the setup screen, pre-populated from `sessionStorage.customSettings`. Each slider has a live readout (number updates as you drag).

"Apply & Restart" button:
1. Reads current slider values.
2. Saves to `sessionStorage.customSettings`.
3. Calls `window.location.reload()`.

The panel is pure HTML/CSS/JS inside `voxel_dda.html`; no changes to any JS module.

---

## Files touched

| File | Change |
|---|---|
| `voxel_dda.html` | Back-button handler; setup-screen init (preset restore); Custom radio + slider panel; startup logic for `#custom`; demo overlay HTML + CSS + JS |
| `js/config.js` | Add `setCustomConfig` export |

No changes to `main.js`, `scene.js`, `shaders/`, `shadow.js`, or any test file.

---

## sessionStorage keys

| Key | Value |
|---|---|
| `lastPreset` | String: `'low'` / `'medium'` / `'high'` / `'custom'` |
| `customSettings` | JSON object with keys: `numEntities`, `nLights`, `w`, `h`, `d`, `shadowCastDistance`, `maxDpr`, `shadowPcfTaps` |