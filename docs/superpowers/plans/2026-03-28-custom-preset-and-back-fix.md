# Custom Preset + Back-Button Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the back-button preset-restore bug and add a "Custom" quality preset with configurable sliders on the setup screen and a live Apply panel in the demo.

**Architecture:** All custom state lives in `sessionStorage` (`lastPreset` string + `customSettings` JSON). The HTML script block handles reading/writing sessionStorage and routing. A new `setCustomConfig(s)` export in `config.js` mirrors `setConfig` but takes an arbitrary settings object. The demo overlay is injected into the DOM only when `urlPreset === 'custom'`.

**Tech Stack:** Vanilla ES modules, Three.js r0.170.0, no bundler. Tests run under Node via Vitest.

---

## File Map

| File | Change |
|---|---|
| `js/config.js` | Add `setCustomConfig` export |
| `voxel_dda.html` | Back-button fix; Custom radio + slider panel; startup routing; demo overlay HTML/CSS/JS |

---

## Task 1: setCustomConfig export

**Files:**
- Modify: `js/config.js`

No unit test needed — the function is eight direct assignments with no conditionals, identical in structure to the already-tested `setConfig`. Adding a test would be testing JS variable assignment.

- [ ] **Step 1: Add `setCustomConfig` to config.js**

Open `js/config.js`. After the closing `}` of `setConfig`, add:

```js
export function setCustomConfig(s) {
    NUM_ENTITIES         = s.numEntities;
    N_LIGHTS             = s.nLights;
    W                    = s.w;
    H                    = s.h;
    D                    = s.d;
    SHADOW_CAST_DISTANCE = s.shadowCastDistance;
    MAX_DPR              = s.maxDpr;
    SHADOW_PCF_TAPS      = s.shadowPcfTaps;
}
```

- [ ] **Step 2: Verify existing tests still pass**

```bash
npx vitest run
```

Expected: all tests PASS (no changes to existing logic).

- [ ] **Step 3: Commit**

```bash
git add js/config.js
git commit -m "feat: add setCustomConfig export for arbitrary preset values"
```

---

## Task 2: Back-button preset restore

**Files:**
- Modify: `voxel_dda.html` (script block only)

- [ ] **Step 1: Save last preset before clearing hash**

In `voxel_dda.html`, find the back-button handler (near the bottom of the `<script>` block):

```js
    backBtn.addEventListener('click', () => {
        window.location.hash = '';
        window.location.reload();
    });
```

Replace with:

```js
    backBtn.addEventListener('click', () => {
        sessionStorage.setItem('lastPreset', window.location.hash.slice(1));
        window.location.hash = '';
        window.location.reload();
    });
```

- [ ] **Step 2: Restore selection on setup screen**

In the `else` branch (setup screen path), after the `options.forEach` click-listener loop ends, add:

```js
        // Restore last selection if returning from demo
        const lastPreset = sessionStorage.getItem('lastPreset');
        if (lastPreset) {
            const target = document.querySelector(`[data-preset="${lastPreset}"]`);
            if (target) {
                options.forEach(o => o.classList.remove('selected'));
                target.classList.add('selected');
                target.querySelector('input').checked = true;
            }
        }
```

- [ ] **Step 3: Manual test**

1. Load page → select **High** → Start Demo → click **Change Quality**.
2. Setup screen should show **High** selected (not Low).
3. Repeat with Medium. Confirm Medium is restored.

- [ ] **Step 4: Commit**

```bash
git add voxel_dda.html
git commit -m "fix: restore last-selected preset when returning to setup screen"
```

---

## Task 3: Custom option + setup-screen slider panel

**Files:**
- Modify: `voxel_dda.html` (CSS + HTML + JS)

- [ ] **Step 1: Add CSS for the slider panel**

Inside the `<style>` tag, before `</style>`, add:

```css
        #custom-sliders {
            display: none;
            width: 100%;
            max-width: 500px;
            margin-bottom: 20px;
            padding: 16px 20px;
            background: rgba(255,255,255,0.05);
            border-radius: 10px;
            box-sizing: border-box;
        }
        #custom-sliders.visible {
            display: block;
        }
        .slider-row {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
            font-size: 0.85rem;
            color: #ccc;
        }
        .slider-row:last-child {
            margin-bottom: 0;
        }
        .slider-label {
            width: 130px;
            flex-shrink: 0;
        }
        .slider-row input[type="range"] {
            flex: 1;
            accent-color: #4fc3f7;
        }
        .slider-row select {
            flex: 1;
            background: rgba(255,255,255,0.1);
            color: #fff;
            border: 1px solid #555;
            border-radius: 4px;
            padding: 2px 6px;
            font-size: 0.85rem;
        }
        .slider-value {
            width: 36px;
            text-align: right;
            color: #fff;
            font-variant-numeric: tabular-nums;
        }
```

- [ ] **Step 2: Add the Custom radio option to the HTML**

In `voxel_dda.html`, find the closing `</div>` of the `.quality-options` div (after the High label). Add a fourth label immediately before it:

```html
        <label class="quality-option" data-preset="custom">
            <input type="radio" name="quality" value="custom">
            <div class="radio-circle"></div>
            <div class="option-details">
                <div class="option-name">Custom</div>
                <div class="option-description">Tune every parameter to isolate performance</div>
                <div class="option-specs">
                    <span class="spec">Adjustable</span>
                </div>
            </div>
        </label>
```

- [ ] **Step 3: Add the slider panel HTML**

After the closing `</div>` of `.quality-options` and before `<button id="start-btn">`, insert:

```html
    <div id="custom-sliders">
        <div class="slider-row">
            <span class="slider-label">Entities</span>
            <input type="range" id="s-entities" min="1" max="256" step="1" value="128">
            <span class="slider-value" id="v-entities">128</span>
        </div>
        <div class="slider-row">
            <span class="slider-label">Lights</span>
            <input type="range" id="s-lights" min="1" max="3" step="1" value="3">
            <span class="slider-value" id="v-lights">3</span>
        </div>
        <div class="slider-row">
            <span class="slider-label">Grid W</span>
            <input type="range" id="s-w" min="32" max="512" step="8" value="320">
            <span class="slider-value" id="v-w">320</span>
        </div>
        <div class="slider-row">
            <span class="slider-label">Grid H</span>
            <input type="range" id="s-h" min="32" max="512" step="8" value="200">
            <span class="slider-value" id="v-h">200</span>
        </div>
        <div class="slider-row">
            <span class="slider-label">Grid D</span>
            <input type="range" id="s-d" min="32" max="512" step="8" value="200">
            <span class="slider-value" id="v-d">200</span>
        </div>
        <div class="slider-row">
            <span class="slider-label">Shadow Distance</span>
            <input type="range" id="s-shadow-dist" min="16" max="256" step="8" value="128">
            <span class="slider-value" id="v-shadow-dist">128</span>
        </div>
        <div class="slider-row">
            <span class="slider-label">DPR cap</span>
            <input type="range" id="s-dpr" min="1" max="2" step="0.25" value="1">
            <span class="slider-value" id="v-dpr">1</span>
        </div>
        <div class="slider-row">
            <span class="slider-label">PCF Taps</span>
            <select id="s-pcf">
                <option value="1">1 (fast)</option>
                <option value="5" selected>5 (quality)</option>
            </select>
        </div>
    </div>
```

- [ ] **Step 4: Wire up slider show/hide and live readouts in the setup-screen JS**

The setup-screen JS lives in the `else` branch. After the `lastPreset` restore block added in Task 2, add:

```js
        const customSlidersEl = document.getElementById('custom-sliders');

        // Show/hide slider panel when Custom is selected
        options.forEach(option => {
            option.addEventListener('click', () => {
                customSlidersEl.classList.toggle('visible', option.dataset.preset === 'custom');
            });
        });

        // Live readouts for range inputs
        ['entities','lights','w','h','d','shadow-dist','dpr'].forEach(id => {
            const input = document.getElementById('s-' + id);
            const display = document.getElementById('v-' + id);
            input.addEventListener('input', () => { display.textContent = input.value; });
        });

        // If returning to custom, show panel and populate sliders
        if (lastPreset === 'custom') {
            customSlidersEl.classList.add('visible');
            const stored = sessionStorage.getItem('customSettings');
            if (stored) {
                const s = JSON.parse(stored);
                document.getElementById('s-entities').value    = s.numEntities;
                document.getElementById('s-lights').value      = s.nLights;
                document.getElementById('s-w').value           = s.w;
                document.getElementById('s-h').value           = s.h;
                document.getElementById('s-d').value           = s.d;
                document.getElementById('s-shadow-dist').value = s.shadowCastDistance;
                document.getElementById('s-dpr').value         = s.maxDpr;
                document.getElementById('s-pcf').value         = s.shadowPcfTaps;
                // Sync readouts after programmatic value set
                ['entities','lights','w','h','d','shadow-dist','dpr'].forEach(id => {
                    document.getElementById('v-' + id).textContent =
                        document.getElementById('s-' + id).value;
                });
            }
        }
```

- [ ] **Step 5: Manual test**

1. Load page. Confirm Low/Medium/High options are unchanged.
2. Click **Custom** — slider panel appears below options.
3. Click **Low** — slider panel hides.
4. Click **Custom** again — slider panel reappears.
5. Drag a slider — the number readout updates live.

- [ ] **Step 6: Commit**

```bash
git add voxel_dda.html
git commit -m "feat: add Custom quality option with configurable slider panel"
```

---

## Task 4: Custom preset startup logic + start button

**Files:**
- Modify: `voxel_dda.html` (script block)

- [ ] **Step 1: Define DEFAULT_CUSTOM at the top of the script block**

At the very top of the `<script type="module">` block (before the `urlPreset` line), add:

```js
    const DEFAULT_CUSTOM = {
        numEntities: 128, nLights: 3,
        w: 320, h: 200, d: 200,
        shadowCastDistance: 128,
        maxDpr: 1,
        shadowPcfTaps: 5
    };
```

- [ ] **Step 2: Add 'custom' to validPresets and handle it in the if-branch**

Find:

```js
    const validPresets = ['low', 'medium', 'high'];

    if (urlPreset && validPresets.includes(urlPreset)) {
        // We have a valid preset, hide setup screen and start demo
        document.getElementById('setup-screen').classList.add('hidden');

        // Set config and start demo
        import('./js/config.js').then(({ setConfig }) => {
            setConfig(urlPreset);
            return import('./js/main.js');
        });
```

Replace with:

```js
    const validPresets = ['low', 'medium', 'high', 'custom'];

    if (urlPreset && validPresets.includes(urlPreset)) {
        // We have a valid preset, hide setup screen and start demo
        document.getElementById('setup-screen').classList.add('hidden');

        // Set config and start demo
        import('./js/config.js').then(({ setConfig, setCustomConfig }) => {
            if (urlPreset === 'custom') {
                const stored = sessionStorage.getItem('customSettings');
                const settings = stored ? JSON.parse(stored) : DEFAULT_CUSTOM;
                setCustomConfig(settings);
            } else {
                setConfig(urlPreset);
            }
            return import('./js/main.js');
        });
```

- [ ] **Step 3: Update the Start button handler to save custom settings**

Find the start button click handler:

```js
        startBtn.addEventListener('click', () => {
            const selectedPreset = document.querySelector('input[name="quality"]:checked').value;
            window.location.hash = selectedPreset;
            window.location.reload();
        });
```

Replace with:

```js
        startBtn.addEventListener('click', () => {
            const selectedPreset = document.querySelector('input[name="quality"]:checked').value;
            if (selectedPreset === 'custom') {
                sessionStorage.setItem('customSettings', JSON.stringify({
                    numEntities:        parseInt(document.getElementById('s-entities').value),
                    nLights:            parseInt(document.getElementById('s-lights').value),
                    w:                  parseInt(document.getElementById('s-w').value),
                    h:                  parseInt(document.getElementById('s-h').value),
                    d:                  parseInt(document.getElementById('s-d').value),
                    shadowCastDistance: parseInt(document.getElementById('s-shadow-dist').value),
                    maxDpr:             parseFloat(document.getElementById('s-dpr').value),
                    shadowPcfTaps:      parseInt(document.getElementById('s-pcf').value)
                }));
            }
            window.location.hash = selectedPreset;
            window.location.reload();
        });
```

- [ ] **Step 4: Manual test**

1. Select **Custom**, leave defaults, click **Start Demo**. Demo should launch (canvas appears, FPS counter visible).
2. Click **Change Quality** → setup screen shows **Custom** selected, slider panel visible with last values.
3. Change entities slider to 8, click **Start Demo**. Confirm 8 entities visible (much fewer balls).
4. Try `#low`, `#medium`, `#high` in URL directly — all still work.

- [ ] **Step 5: Commit**

```bash
git add voxel_dda.html
git commit -m "feat: wire Custom preset startup routing and Start button save"
```

---

## Task 5: Demo overlay panel

**Files:**
- Modify: `voxel_dda.html` (CSS + HTML + JS)

- [ ] **Step 1: Add CSS for the demo overlay**

Inside `<style>`, before `</style>`, add:

```css
        #custom-panel {
            position: fixed;
            top: 50px;
            right: 15px;
            background: rgba(0,0,0,0.82);
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 8px;
            color: #fff;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 0.8rem;
            z-index: 100;
            min-width: 240px;
        }
        #custom-panel-header {
            padding: 7px 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            user-select: none;
        }
        #custom-panel-toggle {
            background: none;
            border: none;
            color: #fff;
            cursor: pointer;
            font-size: 0.8rem;
            padding: 0;
        }
        #custom-panel-body {
            padding: 10px 12px;
        }
        #custom-panel-body.collapsed {
            display: none;
        }
        #custom-panel .slider-row {
            margin-bottom: 8px;
        }
        #custom-panel .slider-label {
            width: 110px;
        }
        #custom-apply {
            width: 100%;
            margin-top: 8px;
            padding: 7px;
            background: linear-gradient(135deg, #4fc3f7 0%, #2196f3 100%);
            color: #fff;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 0.8rem;
            font-weight: 600;
        }
        #custom-apply:hover {
            filter: brightness(1.15);
        }
```

- [ ] **Step 2: Inject the overlay panel when in custom mode**

In the `if (urlPreset && validPresets.includes(urlPreset))` branch, after `document.getElementById('setup-screen').classList.add('hidden');` and before the `import('./js/config.js')...` call, add:

```js
        // Demo overlay — only shown in custom mode
        if (urlPreset === 'custom') {
            const stored = sessionStorage.getItem('customSettings');
            const s = stored ? JSON.parse(stored) : DEFAULT_CUSTOM;

            const panel = document.createElement('div');
            panel.id = 'custom-panel';
            panel.innerHTML = `
                <div id="custom-panel-header">
                    Custom Settings
                    <button id="custom-panel-toggle">▾</button>
                </div>
                <div id="custom-panel-body">
                    <div class="slider-row">
                        <span class="slider-label">Entities</span>
                        <input type="range" id="ps-entities" min="1" max="256" step="1" value="${s.numEntities}">
                        <span class="slider-value" id="pv-entities">${s.numEntities}</span>
                    </div>
                    <div class="slider-row">
                        <span class="slider-label">Lights</span>
                        <input type="range" id="ps-lights" min="1" max="3" step="1" value="${s.nLights}">
                        <span class="slider-value" id="pv-lights">${s.nLights}</span>
                    </div>
                    <div class="slider-row">
                        <span class="slider-label">Grid W</span>
                        <input type="range" id="ps-w" min="32" max="512" step="8" value="${s.w}">
                        <span class="slider-value" id="pv-w">${s.w}</span>
                    </div>
                    <div class="slider-row">
                        <span class="slider-label">Grid H</span>
                        <input type="range" id="ps-h" min="32" max="512" step="8" value="${s.h}">
                        <span class="slider-value" id="pv-h">${s.h}</span>
                    </div>
                    <div class="slider-row">
                        <span class="slider-label">Grid D</span>
                        <input type="range" id="ps-d" min="32" max="512" step="8" value="${s.d}">
                        <span class="slider-value" id="pv-d">${s.d}</span>
                    </div>
                    <div class="slider-row">
                        <span class="slider-label">Shadow Dist</span>
                        <input type="range" id="ps-shadow-dist" min="16" max="256" step="8" value="${s.shadowCastDistance}">
                        <span class="slider-value" id="pv-shadow-dist">${s.shadowCastDistance}</span>
                    </div>
                    <div class="slider-row">
                        <span class="slider-label">DPR cap</span>
                        <input type="range" id="ps-dpr" min="1" max="2" step="0.25" value="${s.maxDpr}">
                        <span class="slider-value" id="pv-dpr">${s.maxDpr}</span>
                    </div>
                    <div class="slider-row">
                        <span class="slider-label">PCF Taps</span>
                        <select id="ps-pcf">
                            <option value="1" ${s.shadowPcfTaps === 1 ? 'selected' : ''}>1 (fast)</option>
                            <option value="5" ${s.shadowPcfTaps === 5 ? 'selected' : ''}>5 (quality)</option>
                        </select>
                    </div>
                    <button id="custom-apply">Apply &amp; Restart</button>
                </div>`;
            document.body.appendChild(panel);

            // Live readouts
            ['entities','lights','w','h','d','shadow-dist','dpr'].forEach(id => {
                const input = document.getElementById('ps-' + id);
                const display = document.getElementById('pv-' + id);
                input.addEventListener('input', () => { display.textContent = input.value; });
            });

            // Collapse toggle
            document.getElementById('custom-panel-toggle').addEventListener('click', () => {
                const body = document.getElementById('custom-panel-body');
                const btn  = document.getElementById('custom-panel-toggle');
                body.classList.toggle('collapsed');
                btn.textContent = body.classList.contains('collapsed') ? '▸' : '▾';
            });

            // Apply & Restart
            document.getElementById('custom-apply').addEventListener('click', () => {
                sessionStorage.setItem('customSettings', JSON.stringify({
                    numEntities:        parseInt(document.getElementById('ps-entities').value),
                    nLights:            parseInt(document.getElementById('ps-lights').value),
                    w:                  parseInt(document.getElementById('ps-w').value),
                    h:                  parseInt(document.getElementById('ps-h').value),
                    d:                  parseInt(document.getElementById('ps-d').value),
                    shadowCastDistance: parseInt(document.getElementById('ps-shadow-dist').value),
                    maxDpr:             parseFloat(document.getElementById('ps-dpr').value),
                    shadowPcfTaps:      parseInt(document.getElementById('ps-pcf').value)
                }));
                window.location.reload();
            });
        }
```

- [ ] **Step 3: Manual test**

1. Select **Custom**, click **Start Demo** — panel appears in top-right below FPS counter.
2. Drag a slider — readout updates live.
3. Click the header toggle — panel body collapses/expands.
4. Change entities to 8, click **Apply & Restart** — demo restarts with 8 entities.
5. After restart the panel shows the updated values (8 entities).
6. Click **Change Quality** → setup screen shows **Custom** with 8 entities still set.
7. Load `#high` directly — no panel appears.

- [ ] **Step 4: Commit**

```bash
git add voxel_dda.html
git commit -m "feat: add Custom preset demo overlay panel with Apply & Restart"
```

---

## Self-Review

**Spec coverage:**
- Back-button restores last preset → Task 2 ✓
- Custom radio on setup screen → Task 3 ✓
- Slider panel shows/hides on Custom selection → Task 3 ✓
- Sliders populated from sessionStorage on return → Task 3 ✓
- `setCustomConfig` in config.js → Task 1 ✓
- `'custom'` added to validPresets + startup routing → Task 4 ✓
- Start button saves custom settings → Task 4 ✓
- Demo overlay only in custom mode → Task 5 ✓
- Overlay sliders populated from sessionStorage → Task 5 ✓
- Apply & Restart saves + reloads → Task 5 ✓
- Collapse toggle → Task 5 ✓

**Placeholder scan:** No TBDs or "implement later" phrases. All code blocks are complete.

**Type consistency:**
- `setCustomConfig(s)` defined in Task 1; called in Task 4 with `setCustomConfig(settings)` where `settings` matches the object shape ✓
- sessionStorage key `'customSettings'` written in Tasks 4 + 5 Apply handler; read in Tasks 3 + 4 + 5 inject ✓
- sessionStorage key `'lastPreset'` written in Task 2 back handler; read in Task 2 restore + Task 3 custom-panel show ✓
- Slider IDs: setup-screen uses `s-*` / `v-*`; demo overlay uses `ps-*` / `pv-*` — no collision ✓
- `DEFAULT_CUSTOM` defined in Task 4 Step 1 (top of script block); used in Task 4 Step 2 and Task 5 Step 2 ✓
