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

/**
 * Allocates a reusable scratch buffer for uploadDirtyRegion.
 * Sized to the full volume so it can hold any sub-region.
 */
export function allocateScratchBuffer(W, H, D) {
    return new Uint8Array(W * H * D);
}

/**
 * Copies the dirty AABB sub-region from voxelData into scratchBuffer,
 * then uploads it to the GPU via texSubImage3D.
 *
 * Requires the Three.js Data3DTexture to have been initialised on the GPU
 * (needsUpdate = true on frame 1) before this is called.
 *
 * @param {WebGL2RenderingContext} gl
 * @param {WebGLTexture} glTexture  - renderer.properties.get(dataTexture).__webglTexture
 * @param {Uint8Array}  voxelData   - full W×H×D source array
 * @param {Uint8Array}  scratchBuffer - reusable buffer allocated by allocateScratchBuffer
 * @param {{ minX,minY,minZ,maxX,maxY,maxZ }} dirty
 * @param {number} W
 * @param {number} H
 */
export function uploadDirtyRegion(gl, glTexture, voxelData, scratchBuffer, dirty, W, H) {
    const { minX, minY, minZ, maxX, maxY, maxZ } = dirty;
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    const d = maxZ - minZ + 1;

    let offset = 0;
    for (let vz = minZ; vz <= maxZ; vz++) {
        for (let vy = minY; vy <= maxY; vy++) {
            const srcStart = minX + vy * W + vz * W * H;
            scratchBuffer.set(voxelData.subarray(srcStart, srcStart + w), offset);
            offset += w;
        }
    }

    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.bindTexture(gl.TEXTURE_3D, glTexture);
    gl.texSubImage3D(gl.TEXTURE_3D, 0, minX, minY, minZ, w, h, d, gl.RED, gl.UNSIGNED_BYTE, scratchBuffer, 0);
    gl.bindTexture(gl.TEXTURE_3D, null);
}
