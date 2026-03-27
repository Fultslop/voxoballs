# Voxel Performance Optimization Design

**Date:** 2026-03-27
**Status:** Approved

## Goal

Make the "high quality" preset run smoothly on low-performance machines by eliminating genuine algorithmic waste in the current renderer — without reducing visual quality and without painting the codebase into a corner for the planned voxel Space Invaders game.

## Context

The current system has four compounding per-frame costs at high quality:

1. `voxelData.fill(0)` zeros 12.8M bytes unconditionally every frame
2. 128 entities each stamp a sphere using a triple nested loop — O(r³) individual writes
3. `dataTexture.needsUpdate = true` re-uploads the full 12.8MB to GPU every frame
4. All shadow map passes run unconditionally every frame

None of these are quality tradeoffs — they are algorithmic waste that can be eliminated.

## Future Compatibility

The planned game architecture is per-entity voxel volumes with multi-volume DDA rendering and destructible voxels. Each optimization in this spec is compatible with that future:

- Dirty bounding box tracking is the same concept used for per-entity texture uploads
- O(r²) sphere fill is reused for explosion destruction (boolean sphere subtraction)
- The shadow gate becomes more useful in a game where lights are often stationary
- No new architectural patterns are introduced that would need to be undone

## Optimizations

### 1. O(r²) Sphere Fill

**File:** `js/entities.js`

**Problem:** The current triple nested loop iterates `(2r)³` voxels and tests each one against the sphere equation. For r=12, that is ~13,800 iterations per entity, the majority of which are rejected. For 128 entities, ~1.7M iterations per frame just to reject them.

**Solution:** For each `(y, z)` pair, compute the x-span analytically using one `sqrt` call, then call `voxelData.fill(color, rowStart, rowEnd)` for that x-range. This replaces per-voxel boolean tests with a native memset.

```
for z in -r..r:
  for y in -r..r:
    xSpan = floor(sqrt(r² - y² - z²))   // one sqrt per row
    fill voxelData[cx-xSpan .. cx+xSpan] = color
```

**Complexity change:** O(r³) individual writes → O(r²) typed array fills.
**Estimated gain:** ~10× faster sphere stamping. For r=12: 13,800 iterations → 450 fills.

This same algorithm is used for explosion destruction (boolean sphere subtraction sets color to 0 instead of entity color) — no separate implementation needed.

---

### 2. Partial voxelData Clear

**File:** `js/entities.js`

**Problem:** `voxelData.fill(0)` zeros the entire 12.8M byte array every frame, including wall voxels which are immediately re-stamped identically afterward.

**Solution:**

- Stamp walls once at init into `voxelData`. Never clear or re-stamp them.
- Before moving entities each frame, record each entity's previous AABB (axis-aligned bounding box) as a dirty region.
- At the start of the update loop, zero only the union of all previous-frame entity AABBs.

The wall boundary voxels sit at `x=0`, `x=W-1`, `y=0`, `y=H-1` — they are never inside any entity AABB (entities bounce off walls before reaching them), so the partial clear never touches them.

**Data structure:**

```js
// Accumulated dirty bounds across all entities (previous positions)
let clearBounds = { minX, minY, minZ, maxX, maxY, maxZ }
```

Zeroing is done as a series of row-fills over the dirty AABB, same pattern as the sphere fill.

**Estimated gain:** ~4× faster clear. For 128 entities with r=12 in a 320×200×200 grid, the dirty clear region is typically 15–25% of total volume.

---

### 3. Dirty Bounding Box Texture Upload

**Files:** `js/entities.js`, `js/main.js`, `js/textures.js`

**Problem:** `dataTexture.needsUpdate = true` triggers Three.js to re-upload the entire `Uint8Array` to the GPU unconditionally — 12.8MB every frame regardless of how much changed.

**Solution:** Track a dirty AABB across all entity updates (union of previous and new entity bounding boxes). In `main.js`, replace `dataTexture.needsUpdate = true` with a direct `texSubImage3D` call on the raw WebGL context, uploading only the dirty sub-region.

```js
// In main.js animate loop:
const dirty = updateEntities(entities, voxelData); // returns dirty AABB
uploadDirtyRegion(renderer, dataTexture, voxelData, scratchBuffer, dirty);
```

```js
// uploadDirtyRegion copies dirty sub-region into scratchBuffer, then:
gl.texSubImage3D(
    gl.TEXTURE_3D, 0,
    dirty.minX, dirty.minY, dirty.minZ,
    dirty.w,    dirty.h,    dirty.d,
    gl.RED, gl.UNSIGNED_BYTE, scratchBuffer
);
```

`scratchBuffer` is a `Uint8Array` of size `W * H * D` allocated once at startup and reused every frame. The sub-region copy into it is O(dirty region size) in JS, which is less than the full upload it replaces.

**Dirty AABB accumulation:** `updateEntities` returns `{ minX, minY, minZ, maxX, maxY, maxZ }` — the union of all entity bounding boxes at their old and new positions. Wall stamps are excluded (they never change after init).

**Estimated gain:** ~5× reduction in GPU upload bandwidth. Dirty region is typically 15–20% of full volume.

**First frame:** On the very first frame, a full texture upload is still performed via `dataTexture.needsUpdate = true` to initialize the GPU texture including wall voxels. From frame 2 onward, only dirty regions are uploaded via `texSubImage3D`.

**Note on Three.js interop:** After calling `texSubImage3D` directly, the Three.js texture object must not have `needsUpdate = true` set (which would trigger a redundant full upload). The texture is initialized normally on first frame, then managed manually thereafter.

---

### 4. Shadow Change-Detection Gate

**Files:** `js/main.js`, `js/shadow.js`

**Problem:** All shadow map passes run every frame unconditionally. Each pass is a full DDA traversal over a 1024×512 render target per light — expensive even when the scene has not changed meaningfully.

**Solution:** Track the cumulative displacement of each light since the last shadow render. Gate the shadow render on two conditions:

1. Any light has moved more than **1.0 voxel** since last shadow render, OR
2. The dirty voxel region from this frame overlaps the scene volume in a way that could affect shadows

Additionally: enforce a **maximum skip of 3 frames** regardless of displacement, so shadows never lag more than ~50ms at 60fps.

```js
// In main.js animate loop:
accumulatedLightDisplacement += maxLightMovementThisFrame;
framesSinceLastShadowRender++;

if (accumulatedLightDisplacement > 1.0 || framesSinceLastShadowRender >= 3) {
    renderShadows(renderer);
    accumulatedLightDisplacement = 0;
    framesSinceLastShadowRender = 0;
}
```

**Current demo:** Lights move every frame, so this gate fires every 1–3 frames depending on light velocity. Gain is modest in the demo (~1.5–2×) but significant in the future game where lights are often stationary during gameplay.

**Estimated gain:** 1.5–2× in the current demo; up to 3× in the game for stationary-light periods.

---

## Files Changed

| File | Changes |
|---|---|
| `js/entities.js` | O(r²) sphere fill; partial clear; return dirty AABB from `updateEntities` |
| `js/textures.js` | Allocate `scratchBuffer`; export `uploadDirtyRegion` helper |
| `js/main.js` | Use `uploadDirtyRegion` instead of `needsUpdate`; shadow gate logic; wall init stamp |
| `js/shadow.js` | Accept accumulated displacement param; expose render condition |

`js/config.js`, `js/scene.js`, `js/lights.js`, `js/shaders/` — **unchanged**.

## Expected Combined Gain

On a frame where entities moved normally:

| Optimization | Gain |
|---|---|
| O(r²) sphere fill | ~10× faster CPU stamping |
| Partial voxelData clear | ~4× faster clear |
| Dirty region upload | ~5× less GPU bandwidth |
| Shadow gate (demo) | ~1.5× on shadow pass |

These are independent costs that each improve. The combined effect on total frame time is a realistic **10–20× improvement** at high quality on a CPU/bandwidth-constrained machine.

## Out of Scope

The following were considered and deferred:

- **Render resolution scaling** — a quality tradeoff, not an algorithmic improvement
- **Chunk occupancy map** — effective now but thrown away when moving to per-entity volumes
- **Per-entity voxel volumes** — the target game architecture; not part of this optimization pass
- **Shadow map resolution scaling** — a quality dial, not a performance fix
