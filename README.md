# voxel_balls

A real-time voxel renderer that runs in the browser with no build step. Colored spheres bounce around inside a 3D grid of voxels, illuminated by point lights with soft shadows.

## Live demo

Coming soon.
<!-- TODO: add URL -->

## How to run

Open `voxel_dda.html` in a browser. Pick a quality preset on the setup screen and click **Start**.

No server required — just open the file directly.

## How to run tests

```bash
npx vitest run
```

## Architecture

| Document | What it explains |
|----------|-----------------|
| [DDA Raymarching](docs/architecture/dda-raymarching.md) | How rays step through the voxel grid one cell at a time to find the first solid voxel |
| [Shadow Mapping](docs/architecture/shadow-mapping.md) | How point lights cast shadows using an equirectangular depth texture |
| [PCF](docs/architecture/pcf.md) | How multi-sample averaging softens jagged shadow edges |
| [Palette Textures](docs/architecture/palette-textures.md) | How 1 byte per voxel replaces full RGB using a 256-color lookup table |
| [Dirty Region Uploads](docs/architecture/dirty-region-uploads.md) | How only the changed voxels are uploaded to the GPU each frame |

## Tech stack

| | |
|---|---|
| Renderer | [Three.js r170](https://threejs.org) |
| Graphics API | WebGL2 (`texSubImage3D`) |
| Modules | ES modules — no bundler |
| Tests | [Vitest](https://vitest.dev) — Node 18+ |

## Key parameters

These are the most impactful knobs. All live in [`js/config.js`](js/config.js) and are set by the quality preset at startup.

| Parameter | Default (High) | What it controls |
|-----------|---------------|-----------------|
| `W` × `H` × `D` | 320 × 200 × 200 | Grid dimensions — dominates GPU cost; halving each axis cuts work by 8× |
| `N_LIGHTS` | 3 | Number of point lights — each adds one shadow map and one DDA pass per shadow ray |
| `SHADOW_CAST_DISTANCE` | 128 | Max DDA steps in the shadow shader — caps shadow ray length |
| `SHADOW_PCF_TAPS` | 5 | Shadow samples per pixel — 1 = sharp/fast, 5 = soft/5× shadow reads |
| `MAX_DPR` | 2 | Max device pixel ratio — caps render resolution on high-DPI screens |
| `NUM_ENTITIES` | 128 | Number of bouncing spheres |
