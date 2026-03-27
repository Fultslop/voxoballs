# CLAUDE.md — voxel_balls

## Project-level decisions

**Always ask the user** before making project-level decisions. Do not assume a course. This includes:
- Test framework / tooling choices
- Dependency installation
- Architectural patterns
- Configuration or preset values

Present options and wait for the user's answer before proceeding.

## Test framework

**Vitest** — installed, configured in `vitest.config.js`.

Run tests:
```bash
npx vitest run
```

## Stack

- Three.js r0.170.0
- WebGL2 (`texSubImage3D`)
- ES modules (no bundler)
- Node.js 18+ (for tests only)
