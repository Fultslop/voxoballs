import assert from 'node:assert/strict';
import { stampSphere, entityBounds, unionBounds, clearRegion } from '../js/voxel-math.js';

const W = 32, H = 32, D = 32;

// Reference: original O(r³) algorithm, used to verify stampSphere output matches exactly.
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

// stampSphere: centred sphere matches reference
{
    const ref = new Uint8Array(W * H * D);
    const opt = new Uint8Array(W * H * D);
    stampSphereRef(ref, 16, 16, 16, 6, 42, W, H, D);
    stampSphere(opt, 16, 16, 16, 6, 42, W, H, D);
    assert.deepEqual(opt, ref, 'stampSphere: centred r=6');
}

// stampSphere: sphere near corner (tests clamping)
{
    const ref = new Uint8Array(W * H * D);
    const opt = new Uint8Array(W * H * D);
    stampSphereRef(ref, 2, 2, 2, 4, 7, W, H, D);
    stampSphere(opt, 2, 2, 2, 4, 7, W, H, D);
    assert.deepEqual(opt, ref, 'stampSphere: near corner r=4');
}

// stampSphere: small radius
{
    const ref = new Uint8Array(W * H * D);
    const opt = new Uint8Array(W * H * D);
    stampSphereRef(ref, 10, 10, 10, 2, 1, W, H, D);
    stampSphere(opt, 10, 10, 10, 2, 1, W, H, D);
    assert.deepEqual(opt, ref, 'stampSphere: r=2');
}

// entityBounds: centred entity
{
    const b = entityBounds(16, 16, 16, 6, W, H, D);
    assert.equal(b.minX, 10, 'minX');
    assert.equal(b.maxX, 21, 'maxX');
    assert.equal(b.minY, 10, 'minY');
    assert.equal(b.maxY, 21, 'maxY');
    assert.equal(b.minZ, 10, 'minZ');
    assert.equal(b.maxZ, 21, 'maxZ');
}

// entityBounds: clamped to zero
{
    const b = entityBounds(1, 1, 1, 4, W, H, D);
    assert.equal(b.minX, 0, 'minX clamped to 0');
    assert.equal(b.minY, 0, 'minY clamped to 0');
    assert.equal(b.minZ, 0, 'minZ clamped to 0');
}

// unionBounds
{
    const a = { minX: 2, minY: 3, minZ: 4, maxX: 10, maxY: 11, maxZ: 12 };
    const b = { minX: 5, minY: 1, minZ: 6, maxX: 15, maxY:  8, maxZ: 10 };
    const u = unionBounds(a, b);
    assert.equal(u.minX, 2,  'union minX');
    assert.equal(u.minY, 1,  'union minY');
    assert.equal(u.minZ, 4,  'union minZ');
    assert.equal(u.maxX, 15, 'union maxX');
    assert.equal(u.maxY, 11, 'union maxY');
    assert.equal(u.maxZ, 12, 'union maxZ');
}

// clearRegion: zeroes only the specified sub-region
{
    const buf = new Uint8Array(W * H * D).fill(99);
    const bounds = { minX: 4, minY: 4, minZ: 4, maxX: 8, maxY: 8, maxZ: 8 };
    clearRegion(buf, bounds, W, H);
    for (let vz = 4; vz <= 8; vz++)
        for (let vy = 4; vy <= 8; vy++)
            for (let vx = 4; vx <= 8; vx++)
                assert.equal(buf[vx + vy * W + vz * W * H], 0, `cleared at (${vx},${vy},${vz})`);
    // voxel just outside the region must be untouched
    assert.equal(buf[3 + 4 * W + 4 * W * H], 99, 'voxel outside bounds untouched');
}

console.log('All tests passed.');
