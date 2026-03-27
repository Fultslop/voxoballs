import * as THREE from 'three';
import { W, H, D, N_LIGHTS } from './config.js';

export function createPointLights() {
    return Array.from({ length: N_LIGHTS }, (_, i) => {
        const hue = i / N_LIGHTS;
        // Evenly-spaced hues converted to RGB
        const h6 = hue * 6, s = 1, v = 1;
        const f = h6 - Math.floor(h6), p = 0, q = 1 - f, t = f;
        const seg = Math.floor(h6) % 6;
        const [r, g, b] = [
            [v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]
        ][seg];
        return {
            pos: new THREE.Vector3(
                W * (i + 1) / (N_LIGHTS + 1),
                H * (0.4 + (i % 2) * 0.3),
                D * (0.3 + (i % 3) * 0.25)
            ),
            vel: new THREE.Vector3(
                (i % 2 === 0 ? 1 : -1) * (0.8 + i * 0.2),
                (i % 3 === 0 ? -1 : 1) * (0.7 + i * 0.15),
                (i % 2 === 0 ? -1 : 1) * (0.9 + i * 0.1)
            ),
            color: new THREE.Vector3(r, g, b)
        };
    });
}

export function updatePointLights(pointLights) {
    pointLights.forEach(l => {
        l.pos.add(l.vel);
        if (l.pos.x < 0 || l.pos.x > W) l.vel.x *= -1;
        if (l.pos.y < 0 || l.pos.y > H) l.vel.y *= -1;
        if (l.pos.z < 0 || l.pos.z > D) l.vel.z *= -1;
    });
}
