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
