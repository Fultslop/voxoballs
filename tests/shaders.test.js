import { describe, it, expect } from 'vitest';
import { genShadowSamplerUnroll } from '../js/shaders/main.js';

describe('genShadowSamplerUnroll', () => {
    it('1-tap emits exactly 1 texture sample per light', () => {
        const code = genShadowSamplerUnroll(1, 1);
        const calls = (code.match(/texture\(/g) || []).length;
        expect(calls).toBe(1);
    });

    it('5-tap emits exactly 5 texture samples per light', () => {
        const code = genShadowSamplerUnroll(1, 5);
        const calls = (code.match(/texture\(/g) || []).length;
        expect(calls).toBe(5);
    });

    it('5-tap with 2 lights emits 10 texture samples', () => {
        const code = genShadowSamplerUnroll(2, 5);
        const calls = (code.match(/texture\(/g) || []).length;
        expect(calls).toBe(10);
    });

    it('1-tap with 2 lights emits 2 texture samples', () => {
        const code = genShadowSamplerUnroll(2, 1);
        const calls = (code.match(/texture\(/g) || []).length;
        expect(calls).toBe(2);
    });
});
