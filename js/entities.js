import * as THREE from 'three';
import { W, H, D, NUM_ENTITIES, ENTITY_RADIUS_MIN, ENTITY_RADIUS_MAX } from './config.js';
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
        const size = ENTITY_RADIUS_MIN + Math.floor(Math.random() * (ENTITY_RADIUS_MAX - ENTITY_RADIUS_MIN + 1));
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
        // Clamp to interior to avoid clearing wall voxels (walls are at index 0 and W/H/D-1).
        // Entities can drift inside the wall layer before the bounce triggers, making the
        // dirty AABB include wall coordinates even though we never intend to stamp there.
        const cb = prevDirtyBounds;
        clearRegion(voxelData, {
            minX: Math.max(1, cb.minX), minY: Math.max(1, cb.minY), minZ: Math.max(1, cb.minZ),
            maxX: Math.min(W - 2, cb.maxX), maxY: Math.min(H - 2, cb.maxY), maxZ: Math.min(D - 2, cb.maxZ),
        }, W, H);
    }

    let dirtyBounds = null;

    entities.forEach(e => {
        const px = Math.floor(e.pos.x);
        const py = Math.floor(e.pos.y);
        const pz = Math.floor(e.pos.z);
        const oldBounds = entityBounds(px, py, pz, e.size, W, H, D);
        dirtyBounds = dirtyBounds ? unionBounds(dirtyBounds, oldBounds) : oldBounds;

        e.pos.add(e.vel);

        // Clamp + bounce: keep the sphere centre at least size+1 voxels from each
        // wall face so that stampSphere never writes into the wall layer (index 0 /
        // W-1 / H-1 / D-1).  A plain vel *= -1 without clamping lets the centre
        // overshoot into the boundary zone before the next frame can correct it.
        if (e.pos.x < e.size + 1)        { e.pos.x = e.size + 1;        e.vel.x =  Math.abs(e.vel.x); }
        else if (e.pos.x > W - e.size - 1) { e.pos.x = W - e.size - 1;    e.vel.x = -Math.abs(e.vel.x); }
        if (e.pos.y < e.size + 1)        { e.pos.y = e.size + 1;        e.vel.y =  Math.abs(e.vel.y); }
        else if (e.pos.y > H - e.size - 1) { e.pos.y = H - e.size - 1;    e.vel.y = -Math.abs(e.vel.y); }
        if (e.pos.z < e.size + 1)        { e.pos.z = e.size + 1;        e.vel.z =  Math.abs(e.vel.z); }
        else if (e.pos.z > D - e.size - 1) { e.pos.z = D - e.size - 1;    e.vel.z = -Math.abs(e.vel.z); }

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
