import { describe, it, expect } from 'vitest';
import { qualityPresets } from '../js/config.js';

describe('qualityPresets', () => {
    it('medium grid is 96³', () => {
        const m = qualityPresets.medium;
        expect(m.w).toBe(96);
        expect(m.h).toBe(96);
        expect(m.d).toBe(96);
    });

    it('low preset maxDpr is 1', () => {
        expect(qualityPresets.low.maxDpr).toBe(1);
    });

    it('medium preset maxDpr is 1', () => {
        expect(qualityPresets.medium.maxDpr).toBe(1);
    });

    it('high preset maxDpr is 2', () => {
        expect(qualityPresets.high.maxDpr).toBe(2);
    });

    it('setConfig sets MAX_DPR', async () => {
        // Dynamic import to get live binding after setConfig runs
        const cfg = await import('../js/config.js');
        cfg.setConfig('high');
        expect(cfg.MAX_DPR).toBe(2);
        cfg.setConfig('medium');
        expect(cfg.MAX_DPR).toBe(1);
    });
});