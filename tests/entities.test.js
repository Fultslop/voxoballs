import { vi, describe, it, expect, beforeEach } from 'vitest';

// Use a small volume so tests run fast
const W = 64, H = 64, D = 64;

vi.mock('three', () => {
    class Vector3 {
        constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
        add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
        clone() { return new Vector3(this.x, this.y, this.z); }
        copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
        distanceTo(v) {
            return Math.sqrt((this.x - v.x) ** 2 + (this.y - v.y) ** 2 + (this.z - v.z) ** 2);
        }
    }
    return { Vector3 };
});

vi.mock('../js/config.js', () => ({ W, H, D, NUM_ENTITIES: 4 }));

// Re-import entities fresh for each test so prevDirtyBounds resets
let initWalls, createEntities, updateEntities;
beforeEach(async () => {
    vi.resetModules();
    vi.mock('three', () => {
        class Vector3 {
            constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
            add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
            clone() { return new Vector3(this.x, this.y, this.z); }
            copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
            distanceTo(v) {
                return Math.sqrt((this.x - v.x) ** 2 + (this.y - v.y) ** 2 + (this.z - v.z) ** 2);
            }
        }
        return { Vector3 };
    });
    vi.mock('../js/config.js', () => ({ W, H, D, NUM_ENTITIES: 4 }));
    ({ initWalls, createEntities, updateEntities } = await import('../js/entities.js'));
});

describe('initWalls', () => {
    it('stamps floor (y=0) with 255 for all x,z', () => {
        const buf = new Uint8Array(W * H * D);
        initWalls(buf);
        for (let x = 0; x < W; x++)
            for (let z = 0; z < D; z++)
                expect(buf[x + 0 * W + z * W * H]).toBe(255);
    });

    it('stamps ceiling (y=H-1) with 255 for all x,z', () => {
        const buf = new Uint8Array(W * H * D);
        initWalls(buf);
        for (let x = 0; x < W; x++)
            for (let z = 0; z < D; z++)
                expect(buf[x + (H - 1) * W + z * W * H]).toBe(255);
    });

    it('stamps left wall (x=0) with 255 for all y,z', () => {
        const buf = new Uint8Array(W * H * D);
        initWalls(buf);
        for (let y = 0; y < H; y++)
            for (let z = 0; z < D; z++)
                expect(buf[0 + y * W + z * W * H]).toBe(255);
    });

    it('stamps right wall (x=W-1) with 255 for all y,z', () => {
        const buf = new Uint8Array(W * H * D);
        initWalls(buf);
        for (let y = 0; y < H; y++)
            for (let z = 0; z < D; z++)
                expect(buf[(W - 1) + y * W + z * W * H]).toBe(255);
    });

    it('does not touch interior voxels', () => {
        const buf = new Uint8Array(W * H * D);
        initWalls(buf);
        // A voxel well away from all walls
        expect(buf[10 + 10 * W + 10 * W * H]).toBe(0);
        expect(buf[32 + 32 * W + 32 * W * H]).toBe(0);
    });
});

describe('createEntities', () => {
    it('returns NUM_ENTITIES entities', () => {
        const entities = createEntities();
        expect(entities).toHaveLength(4);
    });

    it('each entity size is in [8, 15]', () => {
        for (let i = 0; i < 20; i++) {
            const entities = createEntities();
            for (const e of entities) {
                expect(e.size).toBeGreaterThanOrEqual(8);
                expect(e.size).toBeLessThanOrEqual(15);
            }
        }
    });

    it('each entity color is in [1, 254]', () => {
        for (let i = 0; i < 20; i++) {
            const entities = createEntities();
            for (const e of entities) {
                expect(e.color).toBeGreaterThanOrEqual(1);
                expect(e.color).toBeLessThanOrEqual(254);
            }
        }
    });

    it('spawn positions are at least size away from all walls (C1 fix)', () => {
        for (let i = 0; i < 50; i++) {
            const entities = createEntities();
            for (const e of entities) {
                expect(e.pos.x).toBeGreaterThanOrEqual(e.size);
                expect(e.pos.x).toBeLessThan(W - e.size);
                expect(e.pos.y).toBeGreaterThanOrEqual(e.size);
                expect(e.pos.y).toBeLessThan(H - e.size);
                expect(e.pos.z).toBeGreaterThanOrEqual(e.size);
                expect(e.pos.z).toBeLessThan(D - e.size);
            }
        }
    });
});

describe('updateEntities', () => {
    it('returns null for an empty entity array', () => {
        const buf = new Uint8Array(W * H * D);
        const result = updateEntities([], buf);
        expect(result).toBeNull();
    });

    it('returns a dirty AABB covering the entity footprint', async () => {
        const buf = new Uint8Array(W * H * D);
        const { Vector3 } = await import('three');
        const entity = {
            pos: new Vector3(32, 32, 32),
            vel: new Vector3(0, 0, 0), // stationary
            color: 1,
            size: 8,
        };
        const dirty = updateEntities([entity], buf);
        expect(dirty).not.toBeNull();
        expect(dirty.minX).toBeLessThanOrEqual(32 - 8);
        expect(dirty.maxX).toBeGreaterThanOrEqual(32 + 7);
        expect(dirty.minY).toBeLessThanOrEqual(32 - 8);
        expect(dirty.maxY).toBeGreaterThanOrEqual(32 + 7);
        expect(dirty.minZ).toBeLessThanOrEqual(32 - 8);
        expect(dirty.maxZ).toBeGreaterThanOrEqual(32 + 7);
    });

    it('wall voxels (x=0, x=W-1, y=0, y=H-1) are never zeroed by clearRegion', async () => {
        const buf = new Uint8Array(W * H * D);
        initWalls(buf);

        const { Vector3 } = await import('three');
        // Entity spawns at valid (clamped) position; move it around for many frames
        const entity = {
            pos: new Vector3(32, 32, 32),
            vel: new Vector3(1, 1, 1),
            color: 7,
            size: 8,
        };

        // Run 10 frames
        for (let i = 0; i < 10; i++) {
            updateEntities([entity], buf);
        }

        // Wall voxels must still be 255
        for (let x = 0; x < W; x++) {
            expect(buf[x + 0 * W + 0 * W * H]).toBe(255);        // floor sample
            expect(buf[x + (H - 1) * W + 0 * W * H]).toBe(255);  // ceiling sample
        }
        for (let y = 0; y < H; y++) {
            expect(buf[0 + y * W + 0 * W * H]).toBe(255);         // left wall sample
            expect(buf[(W - 1) + y * W + 0 * W * H]).toBe(255);   // right wall sample
        }
    });

    it('dirty AABB union covers both old and new positions', async () => {
        const buf = new Uint8Array(W * H * D);
        const { Vector3 } = await import('three');
        const entity = {
            pos: new Vector3(20, 20, 20),
            vel: new Vector3(5, 5, 5),
            color: 1,
            size: 4,
        };
        // Frame 1: old pos ~(20,20,20), new pos ~(25,25,25)
        const dirty = updateEntities([entity], buf);
        expect(dirty.minX).toBeLessThanOrEqual(20 - 4);
        expect(dirty.maxX).toBeGreaterThanOrEqual(25 + 3);
    });
});
