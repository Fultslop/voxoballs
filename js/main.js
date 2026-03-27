import { createDataTexture, createPaletteTexture } from './textures.js';
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

// FPS counter
const fpsEl = document.getElementById('fps-counter');
let fpsFrames = 0;
let fpsLast = performance.now();

// Shadow gate state
let prevLightPositions = null;
let accumulatedLightDisp = Infinity; // Infinity forces a render on frame 1
let framesSinceLastShadow = 0;
const SHADOW_DISP_THRESHOLD = 1.0;  // voxels
const SHADOW_MAX_SKIP = 3;          // frames

function animate() {
    const dirty = updateEntities(entities, voxelData);

    if (dirty) {
        dataTexture.needsUpdate = true;
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

    fpsFrames++;
    const now = performance.now();
    if (now - fpsLast >= 500) {
        fpsEl.textContent = Math.round(fpsFrames * 1000 / (now - fpsLast)) + ' FPS';
        fpsFrames = 0;
        fpsLast = now;
    }

    requestAnimationFrame(animate);
}

window.addEventListener('resize', onResize);
animate();
