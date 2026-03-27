import * as THREE from 'three';
import { W, H, D, SHADOW_CAST_DISTANCE } from './config.js';
import { createShadowShaders } from './shaders/shadow.js';

export function createShadowSystem(dataTexture, pointLights) {
    const { shadowVertShader, shadowFragShader } = createShadowShaders(SHADOW_CAST_DISTANCE);
    
    const shadowRTs = pointLights.map(() => new THREE.WebGLRenderTarget(1024, 512, {
        format: THREE.RedFormat,
        type: THREE.FloatType,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: false
    }));

    const shadowScene = new THREE.Scene();
    const shadowCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const shadowMat = new THREE.ShaderMaterial({
        uniforms: {
            uData: { value: dataTexture },
            uVolumeSize: { value: new THREE.Vector3(W, H, D) },
            uLightPos: { value: new THREE.Vector3() }
        },
        vertexShader: shadowVertShader,
        fragmentShader: shadowFragShader,
        glslVersion: THREE.GLSL3
    });

    shadowScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), shadowMat));

    function renderShadows(renderer) {
        pointLights.forEach((light, i) => {
            shadowMat.uniforms.uLightPos.value.copy(light.pos);
            renderer.setRenderTarget(shadowRTs[i]);
            renderer.render(shadowScene, shadowCamera);
        });
    }

    return { shadowRTs, shadowScene, shadowCamera, shadowMat, renderShadows };
}
