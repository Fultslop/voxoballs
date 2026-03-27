import { createDataTexture, createPaletteTexture } from './textures.js';
import { createEntities, updateEntities } from './entities.js';
import { createPointLights, updatePointLights } from './lights.js';
import { createShadowSystem } from './shadow.js';
import { createScene } from './scene.js';
import { createShaders } from './shaders/main.js';
import { N_LIGHTS, AMBIENT } from './config.js';

// Create shaders with current config values
const { vertexShader, fragmentShader } = createShaders(N_LIGHTS, AMBIENT);

// Initialize textures
const { dataTexture, voxelData } = createDataTexture();
const { paletteTexture } = createPaletteTexture();

// Initialize entities and lights
const entities = createEntities();
const pointLights = createPointLights();

// Initialize shadow system
const { shadowRTs, renderShadows } = createShadowSystem(dataTexture, pointLights);

// Initialize main scene
const { scene, camera, renderer, onResize } = createScene(dataTexture, paletteTexture, shadowRTs, pointLights, vertexShader, fragmentShader);

// Animation loop
function animate() {
    updateEntities(entities, voxelData);
    dataTexture.needsUpdate = true;

    updatePointLights(pointLights);

    renderShadows(renderer);

    renderer.setRenderTarget(null);
    renderer.render(scene, camera);

    requestAnimationFrame(animate);
}

window.addEventListener('resize', onResize);

animate();
