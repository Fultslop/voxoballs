import * as THREE from 'three';
import { W, H, D, AMBIENT } from './config.js';

export function createScene(dataTexture, paletteTexture, shadowRTs, pointLights, vertexShader, fragmentShader) {
    const scene = new THREE.Scene();

    const fovY = 75 * Math.PI / 180;
    const camera = new THREE.PerspectiveCamera(80, innerWidth / innerHeight, 0.1, 2000);
    const aspect = innerWidth / innerHeight;
    const fitDist = Math.min(H / 2 / Math.tan(fovY / 2), W / 2 / (Math.tan(fovY / 2) * aspect));
    camera.position.set(W / 2, H / 2, -fitDist * 0.85);
    camera.lookAt(W / 2, H / 2, D / 2);

    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(innerWidth, innerHeight);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100vh';
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    const geom = new THREE.BoxGeometry(W, H, D);
    geom.translate(W / 2, H / 2, D / 2);

    const mainMat = new THREE.ShaderMaterial({
        uniforms: {
            uData: { value: dataTexture },
            uPalette: { value: paletteTexture },
            uShadowMap: { value: shadowRTs.map(rt => rt.texture) },
            uVolumeSize: { value: new THREE.Vector3(W, H, D) },
            uFillLightPos: { value: [
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(W, H, 0),
                new THREE.Vector3(W / 2, H / 2, D * 2)
            ]},
            uPointLightPos: { value: pointLights.map(l => l.pos) },
            uPointLightColor: { value: pointLights.map(l => l.color) },
            uAmbient: { value: AMBIENT }
        },
        vertexShader,
        fragmentShader,
        side: THREE.BackSide,
        glslVersion: THREE.GLSL3
    });

    scene.add(new THREE.Mesh(geom, mainMat));

    function onResize() {
        const aspect = window.innerWidth / window.innerHeight;
        const fitDist = Math.min(H / 2 / Math.tan(fovY / 2), W / 2 / (Math.tan(fovY / 2) * aspect));
        camera.position.set(W / 2, H / 2, -fitDist * 0.85);
        camera.lookAt(W / 2, H / 2, D / 2);
        camera.aspect = aspect;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }

    return { scene, camera, renderer, mainMat, onResize };
}
