# Optimize to 30 FPS on Android (Medium Preset) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hit 30 FPS on a mid-range Android phone on the medium quality preset by capping DPR at 1, reducing shadow PCF from 5-tap to 1-tap, and shrinking the medium grid from 128³ to 96³.

**Architecture:** All three changes are purely data-driven through `config.js` presets — add `maxDpr` and `shadowPcfTaps` fields to each preset, then thread those values through `scene.js` and `shaders/main.js`. No new modules needed.

**Tech Stack:** Three.js r0.170.0, GLSL ES 3.0, Vitest (tests run under Node — no browser/WebGL required for unit tests)

---

## File Map

| File | Change |
|---|---|
| `js/config.js` | Add `maxDpr` + `shadowPcfTaps` to each preset; export `MAX_DPR`, `SHADOW_PCF_TAPS`; change medium grid to 96³ |
| `js/scene.js` | Import `MAX_DPR`; use it in `onResize` instead of hardcoded `2` |
| `js/main.js` | Call `onResize()` once at startup to set initial pixel ratio |
| `js/shaders/main.js` | Add `pcfTaps` param to `genShadowSamplerUnroll`; add `pcfTaps` param to `createShaders`; template the `shadow /= N.0` divisor |
| `voxel_dda.html` | Update medium quality spec label from `128³` to `96³` |
| `tests/config.test.js` | New: verify preset field values (grid size, maxDpr, shadowPcfTaps) |
| `tests/shaders.test.js` | New: verify `genShadowSamplerUnroll` emits correct number of texture samples |

---

## Task 1: Medium grid 96³

**Files:**
- Create: `tests/config.test.js`
- Modify: `js/config.js`
- Modify: `voxel_dda.html`

- [ ] **Step 1: Write the failing test**

Create `tests/config.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { qualityPresets } from '../js/config.js';

describe('qualityPresets', () => {
    it('medium grid is 96³', () => {
        const m = qualityPresets.medium;
        expect(m.w).toBe(96);
        expect(m.h).toBe(96);
        expect(m.d).toBe(96);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npx vitest run tests/config.test.js
```

Expected: FAIL — `expected 128 to be 96`

- [ ] **Step 3: Change medium grid in config.js**

In `js/config.js`, change the `medium` preset from:
```js
    medium: {
        name: 'Medium Quality',
        description: 'Balanced performance and visuals',
        numEntities: 32,
        nLights: 1,
        w: 128,
        h: 128,
        d: 128,
        shadowCastDistance: 64,
        ambient: 0.0
    },
```
to:
```js
    medium: {
        name: 'Medium Quality',
        description: 'Balanced performance and visuals',
        numEntities: 32,
        nLights: 1,
        w: 96,
        h: 96,
        d: 96,
        shadowCastDistance: 64,
        ambient: 0.0
    },
```

- [ ] **Step 4: Update HTML spec label**

In `voxel_dda.html`, change the medium quality spec `<span class="spec">128³ voxels</span>` to:
```html
<span class="spec">96³ voxels</span>
```

- [ ] **Step 5: Run test to verify it passes**

```
npx vitest run tests/config.test.js
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add js/config.js voxel_dda.html tests/config.test.js
git commit -m "perf: reduce medium grid from 128³ to 96³ (~25% fewer DDA steps)"
```

---

## Task 2: DPR cap at 1 for medium preset

**Files:**
- Modify: `js/config.js`
- Modify: `js/scene.js`
- Modify: `js/main.js`
- Modify: `tests/config.test.js`

- [ ] **Step 1: Add failing tests for maxDpr**

Add to `tests/config.test.js` (inside the existing `describe` block):

```js
    it('low preset maxDpr is 1', () => {
        expect(qualityPresets.low.maxDpr).toBe(1);
    });

    it('medium preset maxDpr is 1', () => {
        expect(qualityPresets.medium.maxDpr).toBe(1);
    });

    it('high preset maxDpr is 2', () => {
        expect(qualityPresets.high.maxDpr).toBe(2);
    });

    it('setConfig sets MAX_DPR', async () => {
        // Dynamic import to get live binding after setConfig runs
        const cfg = await import('../js/config.js');
        cfg.setConfig('high');
        expect(cfg.MAX_DPR).toBe(2);
        cfg.setConfig('medium');
        expect(cfg.MAX_DPR).toBe(1);
    });
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run tests/config.test.js
```

Expected: FAIL — `qualityPresets.low.maxDpr` is undefined

- [ ] **Step 3: Add maxDpr to config.js presets and export MAX_DPR**

In `js/config.js`:

1. Add `export let MAX_DPR = 2;` near the top with the other exports:
```js
export let MAX_DPR = 2;
```

2. Add `maxDpr` to each preset:
```js
    low: {
        name: 'Low Quality',
        description: 'Best performance for mobile devices',
        numEntities: 8,
        nLights: 1,
        w: 64,
        h: 64,
        d: 64,
        shadowCastDistance: 32,
        ambient: 0.3,
        maxDpr: 1
    },
    medium: {
        name: 'Medium Quality',
        description: 'Balanced performance and visuals',
        numEntities: 32,
        nLights: 1,
        w: 96,
        h: 96,
        d: 96,
        shadowCastDistance: 64,
        ambient: 0.0,
        maxDpr: 1
    },
    high: {
        name: 'High Quality',
        description: 'Best visuals for powerful devices',
        numEntities: 128,
        nLights: 3,
        w: 320,
        h: 200,
        d: 200,
        shadowCastDistance: 128,
        ambient: 0.0,
        maxDpr: 2
    }
```

3. In `setConfig`, assign `MAX_DPR`:
```js
export function setConfig(preset) {
    const p = qualityPresets[preset];
    if (!p) return;
    NUM_ENTITIES = p.numEntities;
    N_LIGHTS = p.nLights;
    W = p.w;
    H = p.h;
    D = p.d;
    SHADOW_CAST_DISTANCE = p.shadowCastDistance;
    AMBIENT = p.ambient;
    MAX_DPR = p.maxDpr;
}
```

- [ ] **Step 4: Use MAX_DPR in scene.js onResize**

In `js/scene.js`, change the import line:
```js
import { W, H, D, AMBIENT, MAX_DPR } from './config.js';
```

Change line 57 in `onResize` from:
```js
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
```
to:
```js
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_DPR));
```

- [ ] **Step 5: Call onResize once at startup in main.js**

In `js/main.js`, add a call to `onResize()` immediately after the destructured `createScene` call. Change:
```js
const { scene, camera, renderer, mainMat, onResize } = createScene(dataTexture, paletteTexture, shadowRTs, pointLights, vertexShader, fragmentShader);
```
to:
```js
const { scene, camera, renderer, mainMat, onResize } = createScene(dataTexture, paletteTexture, shadowRTs, pointLights, vertexShader, fragmentShader);
onResize(); // Set initial pixel ratio from preset
```

- [ ] **Step 6: Run tests to verify they pass**

```
npx vitest run tests/config.test.js
```

Expected: PASS for all config tests

- [ ] **Step 7: Commit**

```bash
git add js/config.js js/scene.js js/main.js tests/config.test.js
git commit -m "perf: cap DPR at 1 for low/medium presets; call onResize at startup"
```

---

## Task 3: Shadow PCF 1-tap for medium/low presets

**Files:**
- Modify: `js/config.js`
- Modify: `js/shaders/main.js`
- Modify: `js/main.js`
- Modify: `tests/config.test.js`
- Create: `tests/shaders.test.js`

- [ ] **Step 1: Write failing shader test**

Create `tests/shaders.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { genShadowSamplerUnroll } from '../js/shaders/main.js';

describe('genShadowSamplerUnroll', () => {
    it('1-tap emits exactly 1 texture sample per light', () => {
        const code = genShadowSamplerUnroll(1, 1);
        const calls = (code.match(/texture\(/g) || []).length;
        expect(calls).toBe(1);
    });

    it('5-tap emits exactly 5 texture samples per light', () => {
        const code = genShadowSamplerUnroll(1, 5);
        const calls = (code.match(/texture\(/g) || []).length;
        expect(calls).toBe(5);
    });

    it('5-tap with 2 lights emits 10 texture samples', () => {
        const code = genShadowSamplerUnroll(2, 5);
        const calls = (code.match(/texture\(/g) || []).length;
        expect(calls).toBe(10);
    });

    it('1-tap with 2 lights emits 2 texture samples', () => {
        const code = genShadowSamplerUnroll(2, 1);
        const calls = (code.match(/texture\(/g) || []).length;
        expect(calls).toBe(2);
    });
});
```

- [ ] **Step 2: Write failing config test for shadowPcfTaps**

Add to the existing `describe` block in `tests/config.test.js`:

```js
    it('low preset shadowPcfTaps is 1', () => {
        expect(qualityPresets.low.shadowPcfTaps).toBe(1);
    });

    it('medium preset shadowPcfTaps is 1', () => {
        expect(qualityPresets.medium.shadowPcfTaps).toBe(1);
    });

    it('high preset shadowPcfTaps is 5', () => {
        expect(qualityPresets.high.shadowPcfTaps).toBe(5);
    });

    it('setConfig sets SHADOW_PCF_TAPS', async () => {
        const cfg = await import('../js/config.js');
        cfg.setConfig('high');
        expect(cfg.SHADOW_PCF_TAPS).toBe(5);
        cfg.setConfig('medium');
        expect(cfg.SHADOW_PCF_TAPS).toBe(1);
    });
```

- [ ] **Step 3: Run tests to verify they fail**

```
npx vitest run tests/config.test.js tests/shaders.test.js
```

Expected: FAIL — `genShadowSamplerUnroll` doesn't accept a second arg; `shadowPcfTaps` is undefined

- [ ] **Step 4: Add shadowPcfTaps to config.js**

In `js/config.js`:

1. Add `export let SHADOW_PCF_TAPS = 5;` near the top exports.

2. Add `shadowPcfTaps` to each preset:
   - `low`: `shadowPcfTaps: 1`
   - `medium`: `shadowPcfTaps: 1`
   - `high`: `shadowPcfTaps: 5`

3. In `setConfig`, assign `SHADOW_PCF_TAPS`:
```js
    SHADOW_PCF_TAPS = p.shadowPcfTaps;
```

The complete updated `setConfig`:
```js
export function setConfig(preset) {
    const p = qualityPresets[preset];
    if (!p) return;
    NUM_ENTITIES = p.numEntities;
    N_LIGHTS = p.nLights;
    W = p.w;
    H = p.h;
    D = p.d;
    SHADOW_CAST_DISTANCE = p.shadowCastDistance;
    AMBIENT = p.ambient;
    MAX_DPR = p.maxDpr;
    SHADOW_PCF_TAPS = p.shadowPcfTaps;
}
```

- [ ] **Step 5: Update genShadowSamplerUnroll to accept pcfTaps**

In `js/shaders/main.js`, replace the current `genShadowSamplerUnroll` function:

```js
// pcfTaps=1: center sample only. pcfTaps=5: cross pattern (center + 4 cardinal neighbors).
export function genShadowSamplerUnroll(n, pcfTaps = 5) {
    const offsets = pcfTaps === 1
        ? ['vec2(0.0, 0.0)']
        : ['vec2(0.0, 0.0)', 'vec2( ts.x, 0.0)', 'vec2(-ts.x, 0.0)', 'vec2(0.0,  ts.y)', 'vec2(0.0, -ts.y)'];
    let code = '';
    for (let i = 0; i < n; i++) {
        code += `                    ${i === 0 ? 'if' : '} else if'}(l == ${i}) {\n`;
        for (const offset of offsets) {
            code += `                        shadow += step(plDist - bias, texture(uShadowMap[${i}], shadowUV + ${offset}).r);\n`;
        }
    }
    if (n > 0) {
        code += '                    }';
    }
    return code;
}
```

- [ ] **Step 6: Add pcfTaps param to createShaders and template the divisor**

In `js/shaders/main.js`, update the `createShaders` signature and the fragment shader:

Change:
```js
export function createShaders(nLights, ambient) {
```
to:
```js
export function createShaders(nLights, ambient, pcfTaps = 5) {
```

Inside the fragment shader string, find:
```glsl
                    ${genShadowSamplerUnroll(shaderNLights)}
                    shadow /= 5.0;
```
and change to:
```glsl
                    ${genShadowSamplerUnroll(shaderNLights, pcfTaps)}
                    shadow /= ${pcfTaps}.0;
```

- [ ] **Step 7: Thread SHADOW_PCF_TAPS from main.js into createShaders**

In `js/main.js`, add `SHADOW_PCF_TAPS` to the config import:
```js
import { N_LIGHTS, AMBIENT, W, H, D, SHADOW_PCF_TAPS } from './config.js';
```

Change:
```js
const { vertexShader, fragmentShader } = createShaders(N_LIGHTS, AMBIENT);
```
to:
```js
const { vertexShader, fragmentShader } = createShaders(N_LIGHTS, AMBIENT, SHADOW_PCF_TAPS);
```

- [ ] **Step 8: Run all tests to verify they pass**

```
npx vitest run
```

Expected: all tests PASS

- [ ] **Step 9: Commit**

```bash
git add js/config.js js/shaders/main.js js/main.js tests/config.test.js tests/shaders.test.js
git commit -m "perf: 1-tap PCF shadow for low/medium presets; 5-tap retained for high"
```

---

## Self-Review

**Spec coverage:**
1. DPR Capping (`scene.js onResize`) — covered in Task 2: `MAX_DPR` in config, used in `onResize`, initial call in startup
2. Shadow PCF 1-tap for mid — covered in Task 3: `SHADOW_PCF_TAPS` in config, `genShadowSamplerUnroll` updated
3. Grid 96³ for mid — covered in Task 1: config + HTML label
4. Hierarchical DDA — explicitly marked "last resort" in spec, excluded from this plan

**Placeholder scan:** No TBDs, no "implement later", all code blocks are complete.

**Type consistency:**
- `MAX_DPR` — defined in config.js Task 2, imported in scene.js Task 2 ✓
- `SHADOW_PCF_TAPS` — defined in config.js Task 3, imported in main.js Task 3 ✓
- `genShadowSamplerUnroll(n, pcfTaps)` — defined in Task 3 Step 5, called in Task 3 Step 6 ✓
- `createShaders(nLights, ambient, pcfTaps)` — updated signature Task 3 Step 6, call updated Task 3 Step 7 ✓
- `shadow /= ${pcfTaps}.0` — pcfTaps is always 1 or 5, both produce valid GLSL float literals ✓

**Note on setConfig test isolation:** The `setConfig` tests use dynamic `import()` which in Vitest shares the same module registry. If tests run in sequence and mutate the same module, the last call to `setConfig` wins. The tests reset state by calling `setConfig('medium')` at the end, but tests may interfere if run in parallel. If this causes flakiness, wrap the `setConfig` tests in `beforeEach`/`afterEach` to restore the original config.