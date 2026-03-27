import * as THREE from 'three';
import { W, H, D, NUM_ENTITIES } from './config.js';
import { stampSphere, entityBounds, unionBounds, clearRegion } from './voxel-math.js';

/**
 * Stamps wall voxels into voxelData once at startup.
 * Must be called before the first animate() tick.
 */
export function initWalls(voxelData) {
    for (let x = 0; x < W; x++) {
        for (let z = 0; z < D; z++) {
            voxelData[x + 0 * W + z * W * H] = 255;           // floor
            voxelData[x + (H - 1) * W + z * W * H] = 255;     // ceiling
        }
    }
    for (let y = 0; y < H; y++) {
        for (let z = 0; z < D; z++) {
            voxelData[0 + y * W + z * W * H] = 255;            // left wall
            voxelData[(W - 1) + y * W + z * W * H] = 255;      // right wall
        }
    }
}

export function createEntities() {
    return Array.from({ length: NUM_ENTITIES }, () => {
        const size = Math.floor(Math.random() * 8) + 8;
        return {
            pos: new THREE.Vector3(
                size + Math.random() * (W - 2 * size),
                size + Math.random() * (H - 2 * size),
                size + Math.random() * (D - 2 * size)
            ),
            vel: new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2),
            color: Math.floor(Math.random() * 254) + 1,
            size,
        };
    });
}

// Bounds of the region stamped during the previous frame — cleared at the start of each frame.
let prevDirtyBounds = null;

/**
 * Moves entities, clears their previous footprints, stamps their new positions.
 * Returns the dirty AABB: the union of all old and new entity bounding boxes.
 * This is the minimum region that needs to be re-uploaded to the GPU.
 */
export function updateEntities(entities, voxelData) {
    if (prevDirtyBounds) {
        clearRegion(voxelData, prevDirtyBounds, W, H);
    }

    let dirtyBounds = null;

    entities.forEach(e => {
        const px = Math.floor(e.pos.x);
        const py = Math.floor(e.pos.y);
        const pz = Math.floor(e.pos.z);
        const oldBounds = entityBounds(px, py, pz, e.size, W, H, D);
        dirtyBounds = dirtyBounds ? unionBounds(dirtyBounds, oldBounds) : oldBounds;

        e.pos.add(e.vel);

        if (e.pos.x < e.size || e.pos.x > W - e.size) e.vel.x *= -1;
        if (e.pos.y < e.size || e.pos.y > H - e.size) e.vel.y *= -1;
        if (e.pos.z < e.size || e.pos.z > D - e.size) e.vel.z *= -1;

        const npx = Math.floor(e.pos.x);
        const npy = Math.floor(e.pos.y);
        const npz = Math.floor(e.pos.z);
        stampSphere(voxelData, npx, npy, npz, e.size, e.color, W, H, D);

        const newBounds = entityBounds(npx, npy, npz, e.size, W, H, D);
        dirtyBounds = unionBounds(dirtyBounds, newBounds);
    });

    prevDirtyBounds = dirtyBounds;
    return dirtyBounds;
}
