import * as THREE from 'three';
import { W, H, D } from './config.js';

export function createDataTexture() {
    const voxelData = new Uint8Array(W * H * D);
    const dataTexture = new THREE.Data3DTexture(voxelData, W, H, D);
    dataTexture.format = THREE.RedFormat;
    dataTexture.type = THREE.UnsignedByteType;
    dataTexture.minFilter = THREE.NearestFilter;
    dataTexture.magFilter = THREE.NearestFilter;
    dataTexture.unpackAlignment = 1;
    dataTexture.needsUpdate = true;
    return { dataTexture, voxelData };
}

export function createPaletteTexture() {
    const paletteData = new Uint8Array(256 * 4);
    for (let i = 0; i < 256; i++) {
        paletteData[i * 4] = Math.random() * 255;
        paletteData[i * 4 + 1] = Math.random() * 255;
        paletteData[i * 4 + 2] = Math.random() * 255;
        paletteData[i * 4 + 3] = 255;
    }
    // Reserve index 255 for the floor/walls — warm concrete
    paletteData[255 * 4] = 210;
    paletteData[255 * 4 + 1] = 200;
    paletteData[255 * 4 + 2] = 185;
    paletteData[255 * 4 + 3] = 255;

    const paletteTexture = new THREE.DataTexture(paletteData, 256, 1, THREE.RGBAFormat);
    paletteTexture.needsUpdate = true;
    return { paletteTexture, paletteData };
}
