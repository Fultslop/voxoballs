export let W = 320;
export let H = 200;
export let D = 200;
export let N_LIGHTS = 2;
export let AMBIENT = 0.0;
export let SHADOW_CAST_DISTANCE = 128;
export let NUM_ENTITIES = 32;

export const qualityPresets = {
    low: {
        name: 'Low Quality',
        description: 'Best performance for mobile devices',
        numEntities: 8,
        nLights: 1,
        w: 64,
        h: 64,
        d: 64,
        shadowCastDistance: 32,
        ambient: 0.3
    },
    medium: {
        name: 'Medium Quality',
        description: 'Balanced performance and visuals',
        numEntities: 32,
        nLights: 1,
        w: 96,
        h: 96,
        d: 96,
        shadowCastDistance: 64,
        ambient: 0.0
    },
    high: {
        name: 'High Quality',
        description: 'Best visuals for powerful devices',
        numEntities: 128,
        nLights: 3,
        w: 320,
        h: 200,
        d: 200,
        shadowCastDistance: 128,
        ambient: 0.0
    }
};

export function setConfig(preset) {
    const p = qualityPresets[preset];
    if (!p) return;
    NUM_ENTITIES = p.numEntities;
    N_LIGHTS = p.nLights;
    W = p.w;
    H = p.h;
    D = p.d;
    SHADOW_CAST_DISTANCE = p.shadowCastDistance;
    AMBIENT = p.ambient;
}
