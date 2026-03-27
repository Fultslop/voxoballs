import { describe, it, expect } from 'vitest';
import { stampSphere, entityBounds, unionBounds, clearRegion } from '../js/voxel-math.js';

const W = 32, H = 32, D = 32;

function stampSphereRef(voxelData, px, py, pz, r, color, W, H, D) {
    for (let x = -r; x < r; x++)
        for (let y = -r; y < r; y++)
            for (let z = -r; z < r; z++) {
                if (x * x + y * y + z * z < r * r) {
                    const vx = px + x, vy = py + y, vz = pz + z;
                    if (vx >= 0 && vy >= 0 && vz >= 0 && vx < W && vy < H && vz < D)
                        voxelData[vx + vy * W + vz * W * H] = color;
                }
            }
}

describe('stampSphere', () => {
    it('matches reference O(r³) output for centred r=6', () => {
        const ref = new Uint8Array(W * H * D);
        const opt = new Uint8Array(W * H * D);
        stampSphereRef(ref, 16, 16, 16, 6, 42, W, H, D);
        stampSphere(opt, 16, 16, 16, 6, 42, W, H, D);
        expect(opt).toEqual(ref);
    });

    it('matches reference when sphere is near corner (clamping), r=4', () => {
        const ref = new Uint8Array(W * H * D);
        const opt = new Uint8Array(W * H * D);
        stampSphereRef(ref, 2, 2, 2, 4, 7, W, H, D);
        stampSphere(opt, 2, 2, 2, 4, 7, W, H, D);
        expect(opt).toEqual(ref);
    });

    it('matches reference for small radius r=2', () => {
        const ref = new Uint8Array(W * H * D);
        const opt = new Uint8Array(W * H * D);
        stampSphereRef(ref, 10, 10, 10, 2, 1, W, H, D);
        stampSphere(opt, 10, 10, 10, 2, 1, W, H, D);
        expect(opt).toEqual(ref);
    });

    it('writes nothing when fully outside volume', () => {
        const buf = new Uint8Array(W * H * D);
        stampSphere(buf, -100, -100, -100, 2, 1, W, H, D);
        expect(buf.every(v => v === 0)).toBe(true);
    });
});

describe('entityBounds', () => {
    it('computes correct AABB for centred entity', () => {
        const b = entityBounds(16, 16, 16, 6, W, H, D);
        expect(b).toEqual({ minX: 10, minY: 10, minZ: 10, maxX: 21, maxY: 21, maxZ: 21 });
    });

    it('clamps minX/minY/minZ to 0', () => {
        const b = entityBounds(1, 1, 1, 4, W, H, D);
        expect(b.minX).toBe(0);
        expect(b.minY).toBe(0);
        expect(b.minZ).toBe(0);
    });

    it('clamps maxX/maxY/maxZ to W-1/H-1/D-1', () => {
        const b = entityBounds(30, 30, 30, 6, W, H, D);
        expect(b.maxX).toBe(W - 1);
        expect(b.maxY).toBe(H - 1);
        expect(b.maxZ).toBe(D - 1);
    });
});

describe('unionBounds', () => {
    it('returns the min/max of both AABBs', () => {
        const a = { minX: 2, minY: 3, minZ: 4, maxX: 10, maxY: 11, maxZ: 12 };
        const b = { minX: 5, minY: 1, minZ: 6, maxX: 15, maxY: 8, maxZ: 10 };
        const u = unionBounds(a, b);
        expect(u).toEqual({ minX: 2, minY: 1, minZ: 4, maxX: 15, maxY: 11, maxZ: 12 });
    });

    it('is commutative', () => {
        const a = { minX: 2, minY: 3, minZ: 4, maxX: 10, maxY: 11, maxZ: 12 };
        const b = { minX: 5, minY: 1, minZ: 6, maxX: 15, maxY: 8, maxZ: 10 };
        expect(unionBounds(a, b)).toEqual(unionBounds(b, a));
    });

    it('with itself returns itself', () => {
        const a = { minX: 2, minY: 3, minZ: 4, maxX: 10, maxY: 11, maxZ: 12 };
        expect(unionBounds(a, a)).toEqual(a);
    });
});

describe('clearRegion', () => {
    it('zeroes all voxels inside the AABB', () => {
        const buf = new Uint8Array(W * H * D).fill(99);
        const bounds = { minX: 4, minY: 4, minZ: 4, maxX: 8, maxY: 8, maxZ: 8 };
        clearRegion(buf, bounds, W, H);
        for (let vz = 4; vz <= 8; vz++)
            for (let vy = 4; vy <= 8; vy++)
                for (let vx = 4; vx <= 8; vx++)
                    expect(buf[vx + vy * W + vz * W * H]).toBe(0);
    });

    it('does not touch voxels outside the AABB (all six faces)', () => {
        const buf = new Uint8Array(W * H * D).fill(99);
        const bounds = { minX: 4, minY: 4, minZ: 4, maxX: 8, maxY: 8, maxZ: 8 };
        clearRegion(buf, bounds, W, H);
        // one voxel outside each face
        expect(buf[3 + 4 * W + 4 * W * H]).toBe(99); // x-1 (left)
        expect(buf[9 + 4 * W + 4 * W * H]).toBe(99); // x+1 (right)
        expect(buf[4 + 3 * W + 4 * W * H]).toBe(99); // y-1 (bottom)
        expect(buf[4 + 9 * W + 4 * W * H]).toBe(99); // y+1 (top)
        expect(buf[4 + 4 * W + 3 * W * H]).toBe(99); // z-1 (front)
        expect(buf[4 + 4 * W + 9 * W * H]).toBe(99); // z+1 (back)
    });

    it('handles a 1×1×1 region', () => {
        const buf = new Uint8Array(W * H * D).fill(99);
        const bounds = { minX: 5, minY: 5, minZ: 5, maxX: 5, maxY: 5, maxZ: 5 };
        clearRegion(buf, bounds, W, H);
        expect(buf[5 + 5 * W + 5 * W * H]).toBe(0);
        expect(buf[4 + 5 * W + 5 * W * H]).toBe(99);
        expect(buf[6 + 5 * W + 5 * W * H]).toBe(99);
    });
});
