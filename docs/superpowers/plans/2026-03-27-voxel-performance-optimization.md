# Voxel Performance Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate four sources of per-frame algorithmic waste so the high-quality preset runs smoothly on low-performance machines without any reduction in visual quality.

**Architecture:** Extract pure sphere/AABB algorithms to a dependency-free module; replace the O(r³) triple-loop stamp with an O(r²) row-fill; stamp walls once at init; track a dirty AABB each frame and upload only that sub-region to the GPU via `texSubImage3D`; gate shadow renders on cumulative light displacement so redundant passes are skipped.

**Tech Stack:** Three.js r0.170.0, WebGL2 (`texSubImage3D`), ES modules, Node.js 18+ (tests only — no install required)

---

## File Map

| File | Change |
|---|---|
| `js/voxel-math.js` | **New.** Pure `stampSphere`, `entityBounds`, `unionBounds`, `clearRegion` — zero imports, testable in Node.js |
| `js/entities.js` | Import from `voxel-math.js`; add `initWalls`; `updateEntities` returns dirty AABB; remove wall stamp |
| `js/textures.js` | Add `allocateScratchBuffer` and `uploadDirtyRegion` |
| `js/main.js` | Call `initWalls` at startup; use dirty upload instead of `needsUpdate`; shadow change-detection gate |
| `tests/voxel-math.test.mjs` | **New.** Node.js tests for pure functions |

`js/config.js`, `js/scene.js`, `js/lights.js`, `js/shadow.js`, `js/shaders/` — **unchanged**.

---

## Task 1: Pure voxel-math module + tests

**Files:**
- Create: `js/voxel-math.js`
- Create: `tests/voxel-math.test.mjs`

- [ ] **Step 1: Create `js/voxel-math.js`**

```js
/**
 * Stamps a filled sphere into voxelData using O(r²) row-fill algorithm.
 * Matches the output of the original O(r³) triple-loop exactly.
 *
 * @param {Uint8Array} voxelData
 * @param {number} px - Math.floor(entity.pos.x)
 * @param {number} py - Math.floor(entity.pos.y)
 * @param {number} pz - Math.floor(entity.pos.z)
 * @param {number} r  - sphere radius (positive integer)
 * @param {number} color - palette index 1–255
 * @param {number} W - volume width
 * @param {number} H - volume height
 * @param {number} D - volume depth
 */
export function stampSphere(voxelData, px, py, pz, r, color, W, H, D) {
    const r2 = r * r;
    for (let dz = -r; dz < r; dz++) {
        const rz2 = r2 - dz * dz;
        if (rz2 <= 0) continue;
        const vz = pz + dz;
        if (vz < 0 || vz >= D) continue;
        for (let dy = -r; dy < r; dy++) {
            const ry2 = rz2 - dy * dy;
            if (ry2 <= 0) continue;
            const vy = py + dy;
            if (vy < 0 || vy >= H) continue;
            const xSpan = Math.floor(Math.sqrt(ry2 - 1e-9));
            const vx0 = Math.max(0, px - xSpan);
            const vx1 = Math.min(W - 1, px + xSpan);
            if (vx0 > vx1) continue;
            voxelData.fill(color, vx0 + vy * W + vz * W * H, vx1 + 1 + vy * W + vz * W * H);
        }
    }
}

/**
 * Returns the AABB of a sphere entity, clamped to volume bounds.
 * maxX/maxY/maxZ are inclusive.
 */
export function entityBounds(px, py, pz, r, W, H, D) {
    return {
        minX: Math.max(0, px - r),
        minY: Math.max(0, py - r),
        minZ: Math.max(0, pz - r),
        maxX: Math.min(W - 1, px + r - 1),
        maxY: Math.min(H - 1, py + r - 1),
        maxZ: Math.min(D - 1, pz + r - 1),
    };
}

/**
 * Returns the union AABB of two bounds objects.
 */
export function unionBounds(a, b) {
    return {
        minX: Math.min(a.minX, b.minX),
        minY: Math.min(a.minY, b.minY),
        minZ: Math.min(a.minZ, b.minZ),
        maxX: Math.max(a.maxX, b.maxX),
        maxY: Math.max(a.maxY, b.maxY),
        maxZ: Math.max(a.maxZ, b.maxZ),
    };
}

/**
 * Zeroes a rectangular sub-region of voxelData using row fills.
 * Wall voxels (volume boundary) are never inside any entity AABB so
 * they are never touched by this function.
 */
export function clearRegion(voxelData, bounds, W, H) {
    const { minX, minY, minZ, maxX, maxY, maxZ } = bounds;
    const rowLen = maxX - minX + 1;
    for (let vz = minZ; vz <= maxZ; vz++) {
        for (let vy = minY; vy <= maxY; vy++) {
            const start = minX + vy * W + vz * W * H;
            voxelData.fill(0, start, start + rowLen);
        }
    }
}
```

- [ ] **Step 2: Create `tests/voxel-math.test.mjs`**

```mjs
import assert from 'node:assert/strict';
import { stampSphere, entityBounds, unionBounds, clearRegion } from '../js/voxel-math.js';

const W = 32, H = 32, D = 32;

// Reference: original O(r³) algorithm, used to verify stampSphere output matches exactly.
function stampSphereRef(voxelData, px, py, pz, r, color, W, H, D) {
    for (let x = -r; x < r; x++)
        for (let y = -r; y < r; y++)
            for (let z = -r; z < r; z++) {
                if (x * x + y * y + z * z < r * r) {
                    const vx = px + x, vy = py + y, vz = pz + z;
                    if (vx >= 0 && vy >= 0 && vz >= 0 && vx < W && vy < H && vz < D)
                        voxelData[vx + vy * W + vz * W * H] = color;
                }
            }
}

// stampSphere: centred sphere matches reference
{
    const ref = new Uint8Array(W * H * D);
    const opt = new Uint8Array(W * H * D);
    stampSphereRef(ref, 16, 16, 16, 6, 42, W, H, D);
    stampSphere(opt, 16, 16, 16, 6, 42, W, H, D);
    assert.deepEqual(opt, ref, 'stampSphere: centred r=6');
}

// stampSphere: sphere near corner (tests clamping)
{
    const ref = new Uint8Array(W * H * D);
    const opt = new Uint8Array(W * H * D);
    stampSphereRef(ref, 2, 2, 2, 4, 7, W, H, D);
    stampSphere(opt, 2, 2, 2, 4, 7, W, H, D);
    assert.deepEqual(opt, ref, 'stampSphere: near corner r=4');
}

// stampSphere: small radius
{
    const ref = new Uint8Array(W * H * D);
    const opt = new Uint8Array(W * H * D);
    stampSphereRef(ref, 10, 10, 10, 2, 1, W, H, D);
    stampSphere(opt, 10, 10, 10, 2, 1, W, H, D);
    assert.deepEqual(opt, ref, 'stampSphere: r=2');
}

// entityBounds: centred entity
{
    const b = entityBounds(16, 16, 16, 6, W, H, D);
    assert.equal(b.minX, 10, 'minX');
    assert.equal(b.maxX, 21, 'maxX');
    assert.equal(b.minY, 10, 'minY');
    assert.equal(b.maxY, 21, 'maxY');
    assert.equal(b.minZ, 10, 'minZ');
    assert.equal(b.maxZ, 21, 'maxZ');
}

// entityBounds: clamped to zero
{
    const b = entityBounds(1, 1, 1, 4, W, H, D);
    assert.equal(b.minX, 0, 'minX clamped to 0');
    assert.equal(b.minY, 0, 'minY clamped to 0');
    assert.equal(b.minZ, 0, 'minZ clamped to 0');
}

// unionBounds
{
    const a = { minX: 2, minY: 3, minZ: 4, maxX: 10, maxY: 11, maxZ: 12 };
    const b = { minX: 5, minY: 1, minZ: 6, maxX: 15, maxY:  8, maxZ: 10 };
    const u = unionBounds(a, b);
    assert.equal(u.minX, 2,  'union minX');
    assert.equal(u.minY, 1,  'union minY');
    assert.equal(u.minZ, 4,  'union minZ');
    assert.equal(u.maxX, 15, 'union maxX');
    assert.equal(u.maxY, 11, 'union maxY');
    assert.equal(u.maxZ, 12, 'union maxZ');
}

// clearRegion: zeroes only the specified sub-region
{
    const buf = new Uint8Array(W * H * D).fill(99);
    const bounds = { minX: 4, minY: 4, minZ: 4, maxX: 8, maxY: 8, maxZ: 8 };
    clearRegion(buf, bounds, W, H);
    for (let vz = 4; vz <= 8; vz++)
        for (let vy = 4; vy <= 8; vy++)
            for (let vx = 4; vx <= 8; vx++)
                assert.equal(buf[vx + vy * W + vz * W * H], 0, `cleared at (${vx},${vy},${vz})`);
    // voxel just outside the region must be untouched
    assert.equal(buf[3 + 4 * W + 4 * W * H], 99, 'voxel outside bounds untouched');
}

console.log('All tests passed.');
```

- [ ] **Step 3: Run tests — expect pass**

```
node tests/voxel-math.test.mjs
```

Expected output:
```
All tests passed.
```

- [ ] **Step 4: Commit**

```bash
git add js/voxel-math.js tests/voxel-math.test.mjs
git commit -m "feat: pure voxel-math module with O(r²) sphere fill and AABB utilities"
```

---

## Task 2: Wire voxel-math into entities.js + add initWalls

**Files:**
- Modify: `js/entities.js`
- Modify: `js/main.js`

After this task the visual output is identical to before. `updateEntities` now returns a dirty AABB (used in Task 3). Walls are stamped once at startup, never cleared.

- [ ] **Step 1: Rewrite `js/entities.js`**

```js
import * as THREE from 'three';
import { W, H, D, NUM_ENTITIES } from './config.js';
import { stampSphere, entityBounds, unionBounds, clearRegion } from './voxel-math.js';

/**
 * Stamps wall voxels into voxelData once at startup.
 * Must be called before the first animate() tick.
 */
export function initWalls(voxelData) {
    for (let x = 0; x < W; x++) {
        for (let z = 0; z < D; z++) {
            voxelData[x + 0 * W + z * W * H] = 255;           // floor
            voxelData[x + (H - 1) * W + z * W * H] = 255;     // ceiling
        }
    }
    for (let y = 0; y < H; y++) {
        for (let z = 0; z < D; z++) {
            voxelData[0 + y * W + z * W * H] = 255;            // left wall
            voxelData[(W - 1) + y * W + z * W * H] = 255;      // right wall
        }
    }
}

export function createEntities() {
    return Array.from({ length: NUM_ENTITIES }, () => ({
        pos: new THREE.Vector3(Math.random() * W, Math.random() * H, Math.random() * D),
        vel: new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2),
        color: Math.floor(Math.random() * 254) + 1,
        size: Math.floor(Math.random() * 8) + 8
    }));
}

// Bounds of the region stamped during the previous frame — cleared at the start of each frame.
let prevDirtyBounds = null;

/**
 * Moves entities, clears their previous footprints, stamps their new positions.
 * Returns the dirty AABB: the union of all old and new entity bounding boxes.
 * This is the minimum region that needs to be re-uploaded to the GPU.
 */
export function updateEntities(entities, voxelData) {
    if (prevDirtyBounds) {
        clearRegion(voxelData, prevDirtyBounds, W, H);
    }

    let dirtyBounds = null;

    entities.forEach(e => {
        const px = Math.floor(e.pos.x);
        const py = Math.floor(e.pos.y);
        const pz = Math.floor(e.pos.z);
        const oldBounds = entityBounds(px, py, pz, e.size, W, H, D);
        dirtyBounds = dirtyBounds ? unionBounds(dirtyBounds, oldBounds) : oldBounds;

        e.pos.add(e.vel);

        if (e.pos.x < e.size || e.pos.x > W - e.size) e.vel.x *= -1;
        if (e.pos.y < e.size || e.pos.y > H - e.size) e.vel.y *= -1;
        if (e.pos.z < e.size || e.pos.z > D - e.size) e.vel.z *= -1;

        const npx = Math.floor(e.pos.x);
        const npy = Math.floor(e.pos.y);
        const npz = Math.floor(e.pos.z);
        stampSphere(voxelData, npx, npy, npz, e.size, e.color, W, H, D);

        const newBounds = entityBounds(npx, npy, npz, e.size, W, H, D);
        dirtyBounds = unionBounds(dirtyBounds, newBounds);
    });

    prevDirtyBounds = dirtyBounds;
    return dirtyBounds;
}
```

- [ ] **Step 2: Update `js/main.js` — call `initWalls`, capture dirty return value**

```js
import { createDataTexture, createPaletteTexture } from './textures.js';
import { createEntities, updateEntities, initWalls } from './entities.js';
import { createPointLights, updatePointLights } from './lights.js';
import { createShadowSystem } from './shadow.js';
import { createScene } from './scene.js';
import { createShaders } from './shaders/main.js';
import { N_LIGHTS, AMBIENT } from './config.js';

const { vertexShader, fragmentShader } = createShaders(N_LIGHTS, AMBIENT);

const { dataTexture, voxelData } = createDataTexture();
const { paletteTexture } = createPaletteTexture();

initWalls(voxelData);

const entities = createEntities();
const pointLights = createPointLights();

const { shadowRTs, renderShadows } = createShadowSystem(dataTexture, pointLights);
const { scene, camera, renderer, onResize } = createScene(dataTexture, paletteTexture, shadowRTs, pointLights, vertexShader, fragmentShader);

function animate() {
    const _dirty = updateEntities(entities, voxelData);
    dataTexture.needsUpdate = true;  // replaced in Task 3

    updatePointLights(pointLights);
    renderShadows(renderer);

    renderer.setRenderTarget(null);
    renderer.render(scene, camera);

    requestAnimationFrame(animate);
}

window.addEventListener('resize', onResize);
animate();
```

- [ ] **Step 3: Open `voxel_dda.html` → High Quality → Start. Verify visually:**
  - Floor, ceiling and left/right walls are visible and solid
  - Coloured spheres move and bounce correctly
  - Shadows appear under all lights

- [ ] **Step 4: Commit**

```bash
git add js/entities.js js/main.js
git commit -m "perf: O(r²) sphere fill, partial dirty clear, initWalls once at startup"
```

---

## Task 3: Dirty-region GPU texture upload

**Files:**
- Modify: `js/textures.js`
- Modify: `js/main.js`

Replaces `dataTexture.needsUpdate = true` (full 12.8 MB upload every frame) with a `texSubImage3D` call that uploads only the dirty bounding box. Frame 1 still does a full upload to initialise the GPU texture.

- [ ] **Step 1: Append `allocateScratchBuffer` and `uploadDirtyRegion` to `js/textures.js`**

Add the following to the bottom of the existing file:

```js
/**
 * Allocates a reusable scratch buffer for uploadDirtyRegion.
 * Sized to the full volume so it can hold any sub-region.
 */
export function allocateScratchBuffer(W, H, D) {
    return new Uint8Array(W * H * D);
}

/**
 * Copies the dirty AABB sub-region from voxelData into scratchBuffer,
 * then uploads it to the GPU via texSubImage3D.
 *
 * Requires the Three.js Data3DTexture to have been initialised on the GPU
 * (needsUpdate = true on frame 1) before this is called.
 *
 * @param {WebGL2RenderingContext} gl
 * @param {WebGLTexture} glTexture  - renderer.properties.get(dataTexture).__webglTexture
 * @param {Uint8Array}  voxelData   - full W×H×D source array
 * @param {Uint8Array}  scratchBuffer - reusable buffer allocated by allocateScratchBuffer
 * @param {{ minX,minY,minZ,maxX,maxY,maxZ }} dirty
 * @param {number} W
 * @param {number} H
 */
export function uploadDirtyRegion(gl, glTexture, voxelData, scratchBuffer, dirty, W, H) {
    const { minX, minY, minZ, maxX, maxY, maxZ } = dirty;
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    const d = maxZ - minZ + 1;

    let offset = 0;
    for (let vz = minZ; vz <= maxZ; vz++) {
        for (let vy = minY; vy <= maxY; vy++) {
            const srcStart = minX + vy * W + vz * W * H;
            scratchBuffer.set(voxelData.subarray(srcStart, srcStart + w), offset);
            offset += w;
        }
    }

    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.bindTexture(gl.TEXTURE_3D, glTexture);
    gl.texSubImage3D(gl.TEXTURE_3D, 0, minX, minY, minZ, w, h, d, gl.RED, gl.UNSIGNED_BYTE, scratchBuffer, 0);
    gl.bindTexture(gl.TEXTURE_3D, null);
}
```

- [ ] **Step 2: Rewrite `js/main.js` to use dirty-region upload**

```js
import { createDataTexture, createPaletteTexture, allocateScratchBuffer, uploadDirtyRegion } from './textures.js';
import { createEntities, updateEntities, initWalls } from './entities.js';
import { createPointLights, updatePointLights } from './lights.js';
import { createShadowSystem } from './shadow.js';
import { createScene } from './scene.js';
import { createShaders } from './shaders/main.js';
import { N_LIGHTS, AMBIENT, W, H, D } from './config.js';

const { vertexShader, fragmentShader } = createShaders(N_LIGHTS, AMBIENT);

const { dataTexture, voxelData } = createDataTexture();
const { paletteTexture } = createPaletteTexture();

initWalls(voxelData);

const entities = createEntities();
const pointLights = createPointLights();

const { shadowRTs, renderShadows } = createShadowSystem(dataTexture, pointLights);
const { scene, camera, renderer, onResize } = createScene(dataTexture, paletteTexture, shadowRTs, pointLights, vertexShader, fragmentShader);

const scratchBuffer = allocateScratchBuffer(W, H, D);
let isFirstFrame = true;

function animate() {
    const dirty = updateEntities(entities, voxelData);

    if (isFirstFrame) {
        // Full upload on frame 1 initialises the GPU texture including wall voxels.
        dataTexture.needsUpdate = true;
        isFirstFrame = false;
    } else if (dirty) {
        const gl = renderer.getContext();
        const glTexture = renderer.properties.get(dataTexture).__webglTexture;
        uploadDirtyRegion(gl, glTexture, voxelData, scratchBuffer, dirty, W, H);
    }

    updatePointLights(pointLights);
    renderShadows(renderer);

    renderer.setRenderTarget(null);
    renderer.render(scene, camera);

    requestAnimationFrame(animate);
}

window.addEventListener('resize', onResize);
animate();
```

- [ ] **Step 3: Open `voxel_dda.html` → High Quality → Start. Verify visually:**
  - Scene is identical to Task 2 — walls solid, spheres correct, shadows present
  - No missing voxels, no flickering, no stale ghost voxels from previous positions

- [ ] **Step 4: Commit**

```bash
git add js/textures.js js/main.js
git commit -m "perf: dirty-region texSubImage3D replaces full 12.8MB per-frame texture upload"
```

---

## Task 4: Shadow change-detection gate

**Files:**
- Modify: `js/main.js`

Gates shadow renders on cumulative light displacement. When all lights have moved less than 1.0 voxel since the last shadow render, the shadow pass is skipped. A hard cap of 3 frames ensures shadows never lag more than ~50 ms at 60 fps.

- [ ] **Step 1: Rewrite `js/main.js` with shadow gate**

```js
import { createDataTexture, createPaletteTexture, allocateScratchBuffer, uploadDirtyRegion } from './textures.js';
import { createEntities, updateEntities, initWalls } from './entities.js';
import { createPointLights, updatePointLights } from './lights.js';
import { createShadowSystem } from './shadow.js';
import { createScene } from './scene.js';
import { createShaders } from './shaders/main.js';
import { N_LIGHTS, AMBIENT, W, H, D } from './config.js';

const { vertexShader, fragmentShader } = createShaders(N_LIGHTS, AMBIENT);

const { dataTexture, voxelData } = createDataTexture();
const { paletteTexture } = createPaletteTexture();

initWalls(voxelData);

const entities = createEntities();
const pointLights = createPointLights();

const { shadowRTs, renderShadows } = createShadowSystem(dataTexture, pointLights);
const { scene, camera, renderer, onResize } = createScene(dataTexture, paletteTexture, shadowRTs, pointLights, vertexShader, fragmentShader);

const scratchBuffer = allocateScratchBuffer(W, H, D);

let isFirstFrame = true;

// Shadow gate state
let prevLightPositions = null;
let accumulatedLightDisp = Infinity; // Infinity forces a render on frame 1
let framesSinceLastShadow = 0;
const SHADOW_DISP_THRESHOLD = 1.0;  // voxels
const SHADOW_MAX_SKIP = 3;          // frames

function animate() {
    const dirty = updateEntities(entities, voxelData);

    if (isFirstFrame) {
        dataTexture.needsUpdate = true;
        isFirstFrame = false;
    } else if (dirty) {
        const gl = renderer.getContext();
        const glTexture = renderer.properties.get(dataTexture).__webglTexture;
        uploadDirtyRegion(gl, glTexture, voxelData, scratchBuffer, dirty, W, H);
    }

    updatePointLights(pointLights);

    // Accumulate light displacement since last shadow render
    if (!prevLightPositions) {
        prevLightPositions = pointLights.map(l => l.pos.clone());
    } else {
        let maxMove = 0;
        pointLights.forEach((l, i) => {
            maxMove = Math.max(maxMove, l.pos.distanceTo(prevLightPositions[i]));
            prevLightPositions[i].copy(l.pos);
        });
        accumulatedLightDisp += maxMove;
    }
    framesSinceLastShadow++;

    if (accumulatedLightDisp > SHADOW_DISP_THRESHOLD || framesSinceLastShadow >= SHADOW_MAX_SKIP) {
        renderShadows(renderer);
        accumulatedLightDisp = 0;
        framesSinceLastShadow = 0;
    }

    renderer.setRenderTarget(null);
    renderer.render(scene, camera);

    requestAnimationFrame(animate);
}

window.addEventListener('resize', onResize);
animate();
```

- [ ] **Step 2: Open `voxel_dda.html` → High Quality → Start. Verify visually:**
  - Shadows are present and update smoothly as lights move
  - No visible shadow lag or frozen shadows
  - Scene otherwise identical to Task 3

- [ ] **Step 3: Commit**

```bash
git add js/main.js
git commit -m "perf: shadow change-detection gate skips renders when lights move < 1 voxel"
```
