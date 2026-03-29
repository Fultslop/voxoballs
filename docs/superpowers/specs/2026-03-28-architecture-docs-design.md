---
title: Architecture Documentation
date: 2026-03-28
status: approved
---

# Architecture Documentation — Design Spec

## Goal

Create a README and a set of architecture docs that teach a developer unfamiliar with rendering how the voxel engine works. Audience: competent developers who know `[x,y,z]` positions and basic arithmetic, but have not worked with GPU rendering, ray casting, or shadow techniques.

## Approach

**Concept → Theory → Code** per document. Each doc:
1. Opens with "what problem does this solve" framing
2. Builds the mental model with SVG diagrams
3. Explains math at level B (dot products, ray equations, normalization explained when encountered)
4. Shows exactly where in this codebase the technique lives (file + function references)

No ASCII diagrams. Mermaid for flow/data diagrams. SVG files for visual/spatial concepts.

---

## File Structure

```
README.md

docs/architecture/
  img/
    ray-box-intersection.svg
    dda-2d-grid.svg
    dda-tmax-tdelta.svg
    shadow-map-overview.svg
    shadow-equirectangular.svg
    pcf-tap-pattern.svg
    palette-lookup.svg
    dirty-region-aabb.svg
  dda-raymarching.md
  shadow-mapping.md
  pcf.md
  palette-textures.md
  dirty-region-uploads.md
```

---

## README.md

Sections:
- **What this is** — one paragraph: real-time voxel renderer in the browser, no bundler, pure WebGL2
- **Live demo** — placeholder URL
- **How to run** — open `voxel_dda.html`, pick a preset
- **How to run tests** — `npx vitest run`
- **Architecture** — table linking to each doc with one-line description
- **Tech stack** — Three.js r170, WebGL2, ES modules, Vitest
- **Key parameters** — table of most impactful knobs (W×H×D, N_LIGHTS, MAX_DPR)

---

## Architecture Docs

### `dda-raymarching.md`

| Section | Content |
|---------|---------|
| Problem | How do you render a 3D grid of voxels without a polygon mesh? |
| Concept | Cast a ray per pixel, step through the grid one cell at a time (DDA) |
| SVGs | `dda-2d-grid.svg` — bird's-eye 2D grid with a ray stepping through cells; `dda-tmax-tdelta.svg` — tMax and tDelta diagram showing parametric distances to next grid lines |
| Math | Ray equation `p = origin + t*direction`; how tMax (distance to next boundary per axis) and tDelta (grid cell width in ray-space) are computed; the step loop logic |
| Code refs | `js/shaders/main.js` — ray setup from vertex shader, DDA loop in fragment shader, normal from step direction; `js/config.js` W/H/D |
| Parameters | W, H, D — grid dimensions directly control max DDA iterations per ray |

---

### `shadow-mapping.md`

| Section | Content |
|---------|---------|
| Problem | How does a surface know if it's in shadow from a point light? |
| Concept | Render the scene from the light's point of view, store distances to the nearest voxel in a texture (shadow map); at shade time, compare actual distance to stored distance |
| SVGs | `shadow-map-overview.svg` — light perspective vs camera perspective, with a blocked path; `shadow-equirectangular.svg` — how a sphere of directions around a point light maps to a flat 2D texture (equirectangular projection) |
| Math | Equirectangular projection: UV coordinates → spherical angles → direction vector; distance comparison with bias |
| Code refs | `js/shaders/shadow.js` — shadow depth render (equirectangular DDA from light); `js/shaders/main.js` — shadow map lookup at shade time; `js/shadow.js` — shadow render targets, gating logic |
| Parameters | `SHADOW_CAST_DISTANCE` (max DDA iterations in shadow shader), shadow gate: 1.0 voxel displacement threshold, 3-frame max skip |

---

### `pcf.md`

| Section | Content |
|---------|---------|
| Problem | Single-sample shadow maps produce jagged, aliased shadow edges |
| Concept | Sample the shadow map at multiple nearby points and average — if 3 of 5 samples say "in shadow", the surface is 60% shadowed |
| SVGs | `pcf-tap-pattern.svg` — the 5-tap cross pattern in UV space, and what a 1-tap vs 5-tap shadow edge looks like |
| Math | Offset directions in UV space; averaging binary (0/1) in-shadow results to get a [0,1] shadow factor |
| Code refs | `js/shaders/main.js` — compile-time unrolled PCF loop; `js/config.js` `SHADOW_PCF_TAPS` |
| Parameters | `SHADOW_PCF_TAPS`: 1 = sharp shadows (fast), 5 = soft shadows (5× shadow texture reads) |

---

### `palette-textures.md`

| Section | Content |
|---------|---------|
| Problem | Storing full RGB per voxel is wasteful — a 320×200×200 grid at 3 bytes/voxel = 38 MB; most voxels share colors |
| Concept | Store 1 byte per voxel (an index 0–255), look up the actual color in a 256-entry table on the GPU |
| SVGs | `palette-lookup.svg` — voxel grid with index values, arrow into 256-entry color table, output color |
| Math | None (table lookup). Brief note on why indices are 1-byte: 256 possible values, 0 = empty, 255 = wall |
| Code refs | `js/textures.js` createDataTexture (RED uint8 3D texture), createPaletteTexture (256 RGB entries); `js/entities.js` palette indices assigned per entity; `js/shaders/main.js` palette uniform lookup |
| Parameters | Index 0 = empty, 1–254 = entity colors (random), 255 = wall (warm concrete) |

---

### `dirty-region-uploads.md`

| Section | Content |
|---------|---------|
| Problem | Uploading the full W×H×D voxel grid to the GPU every frame is expensive — 320×200×200 = 12.8 MB/frame |
| Concept | Track which voxels changed (the axis-aligned bounding box of moved spheres), upload only that sub-region using `texSubImage3D` |
| SVGs | `dirty-region-aabb.svg` — full grid with a small highlighted sub-region (the AABB), showing what gets uploaded |
| Math | AABB (axis-aligned bounding box): min/max corners in x, y, z; AABB union for combining old + new sphere positions |
| Code refs | `js/voxel-math.js` entityBounds, unionBounds, clearRegion; `js/textures.js` uploadDirtyRegion (texSubImage3D); `js/main.js` dirty flag and upload call |
| Parameters | None — automatic. Upload size proportional to sphere radius and velocity |

---

## External References

All URLs to be verified before inclusion.

| Doc | Resource | Type |
|-----|----------|------|
| dda-raymarching | scratchapixel.com ray-box intersection | Article |
| dda-raymarching | javidx9 "3D Game Engine" YouTube series | Video |
| dda-raymarching | Wikipedia DDA algorithm | Article |
| shadow-mapping | learnopengl.com shadow mapping tutorial | Article |
| shadow-mapping | The Cherno shadow mapping YouTube | Video |
| pcf | learnopengl.com PCF section | Article |
| palette-textures | MDN texSubImage3D reference | Reference |
| dirty-region-uploads | MDN texSubImage3D reference | Reference |

---

## SVG Style Guide

All SVGs use a consistent visual language:
- Background: `#1a1a2e` (dark, matches the app aesthetic)
- Grid/structure: `#4fc3f7` (cyan, matches app accent)
- Rays/arrows: `#ff9800` (orange, high contrast)
- Hit/shadow: `#f44336` (red)
- Labels: `#ffffff` (white), 14px sans-serif
- Dimensions: 800×400 or 600×400, viewBox-based (scales cleanly)

---

## Constraints

- No bundler — docs reference files relative to repo root
- No generated output — all SVGs hand-authored
- Mermaid for flow diagrams (module dependency, render pipeline)
- All external links verified to resolve before commit
