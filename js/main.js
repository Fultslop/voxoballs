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
