import * as THREE from 'three';
import { W, H, D, NUM_ENTITIES } from './config.js';

export function createEntities() {
    return Array.from({ length: NUM_ENTITIES }, () => ({
        pos: new THREE.Vector3(Math.random() * W, Math.random() * H, Math.random() * D),
        vel: new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2),
        color: Math.floor(Math.random() * 254) + 1,
        size: Math.floor(Math.random() * 8) + 8
    }));
}

export function updateEntities(entities, voxelData) {
    voxelData.fill(0);

    entities.forEach(e => {
        e.pos.add(e.vel);

        if (e.pos.x < e.size || e.pos.x > W - e.size) e.vel.x *= -1;
        if (e.pos.y < e.size || e.pos.y > H - e.size) e.vel.y *= -1;
        if (e.pos.z < e.size || e.pos.z > D - e.size) e.vel.z *= -1;

        let r = e.size;
        for (let x = -r; x < r; x++)
            for (let y = -r; y < r; y++)
                for (let z = -r; z < r; z++) {
                    if (x * x + y * y + z * z < r * r) {
                        let vx = Math.floor(e.pos.x + x);
                        let vy = Math.floor(e.pos.y + y);
                        let vz = Math.floor(e.pos.z + z);
                        if (vx >= 0 && vy >= 0 && vz >= 0 && vx < W && vy < H && vz < D)
                            voxelData[vx + vy * W + vz * W * H] = e.color;
                    }
                }
    });

    // Floor, ceiling, left/right walls (stamped last so they're never overwritten)
    for (let x = 0; x < W; x++) {
        for (let z = 0; z < D; z++) {
            voxelData[x + 0 * W + z * W * H] = 255; // floor
            voxelData[x + (H - 1) * W + z * W * H] = 255; // ceiling
        }
    }
    for (let y = 0; y < H; y++) {
        for (let z = 0; z < D; z++) {
            voxelData[0 + y * W + z * W * H] = 255; // left wall
            voxelData[(W - 1) + y * W + z * W * H] = 255; // right wall
        }
    }
}
