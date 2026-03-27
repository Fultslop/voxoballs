/**
 * Stamps a filled sphere into voxelData using O(r²) row-fill algorithm.
 * Matches the output of the original O(r³) triple-loop exactly.
 *
 * @param {Uint8Array} voxelData
 * @param {number} px - Math.floor(entity.pos.x)
 * @param {number} py - Math.floor(entity.pos.y)
 * @param {number} pz - Math.floor(entity.pos.z)
 * @param {number} r  - sphere radius (positive integer)
 * @param {number} color - palette index 1–255
 * @param {number} W - volume width
 * @param {number} H - volume height
 * @param {number} D - volume depth
 */
export function stampSphere(voxelData, px, py, pz, r, color, W, H, D) {
    const r2 = r * r;
    for (let dz = -r; dz < r; dz++) {
        const rz2 = r2 - dz * dz;
        if (rz2 <= 0) continue;
        const vz = pz + dz;
        if (vz < 0 || vz >= D) continue;
        for (let dy = -r; dy < r; dy++) {
            const ry2 = rz2 - dy * dy;
            if (ry2 <= 0) continue;
            const vy = py + dy;
            if (vy < 0 || vy >= H) continue;
            const xSpan = Math.floor(Math.sqrt(ry2 - 1e-9));
            const vx0 = Math.max(0, px - xSpan);
            const vx1 = Math.min(W - 1, px + xSpan);
            if (vx0 > vx1) continue;
            voxelData.fill(color, vx0 + vy * W + vz * W * H, vx1 + 1 + vy * W + vz * W * H);
        }
    }
}

/**
 * Returns the AABB of a sphere entity, clamped to volume bounds.
 * maxX/maxY/maxZ are inclusive.
 */
export function entityBounds(px, py, pz, r, W, H, D) {
    return {
        minX: Math.max(0, px - r),
        minY: Math.max(0, py - r),
        minZ: Math.max(0, pz - r),
        maxX: Math.min(W - 1, px + r - 1),
        maxY: Math.min(H - 1, py + r - 1),
        maxZ: Math.min(D - 1, pz + r - 1),
    };
}

/**
 * Returns the union AABB of two bounds objects.
 */
export function unionBounds(a, b) {
    return {
        minX: Math.min(a.minX, b.minX),
        minY: Math.min(a.minY, b.minY),
        minZ: Math.min(a.minZ, b.minZ),
        maxX: Math.max(a.maxX, b.maxX),
        maxY: Math.max(a.maxY, b.maxY),
        maxZ: Math.max(a.maxZ, b.maxZ),
    };
}

/**
 * Zeroes a rectangular sub-region of voxelData using row fills.
 * Wall voxels (volume boundary) are never inside any entity AABB so
 * they are never touched by this function.
 */
export function clearRegion(voxelData, bounds, W, H) {
    const { minX, minY, minZ, maxX, maxY, maxZ } = bounds;
    const rowLen = maxX - minX + 1;
    for (let vz = minZ; vz <= maxZ; vz++) {
        for (let vy = minY; vy <= maxY; vy++) {
            const start = minX + vy * W + vz * W * H;
            voxelData.fill(0, start, start + rowLen);
        }
    }
}
