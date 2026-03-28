import { describe, it, expect } from 'vitest';
import { qualityPresets } from '../js/config.js';

describe('qualityPresets', () => {
    it('medium grid is 96³', () => {
        const m = qualityPresets.medium;
        expect(m.w).toBe(96);
        expect(m.h).toBe(96);
        expect(m.d).toBe(96);
    });
});