// GLSL ES requires constant indices into sampler arrays; generate unrolled if/else at build time.
// Use at least 1 for array declarations to avoid GLSL compilation errors when N_LIGHTS=0
// pcfTaps=1: center sample only. pcfTaps=5: cross pattern (center + 4 cardinal neighbors).
export function genShadowSamplerUnroll(n, pcfTaps = 5) {
    const offsets = pcfTaps === 1
        ? ['vec2(0.0, 0.0)']
        : ['vec2(0.0, 0.0)', 'vec2( ts.x, 0.0)', 'vec2(-ts.x, 0.0)', 'vec2(0.0,  ts.y)', 'vec2(0.0, -ts.y)'];
    let code = '';
    for (let i = 0; i < n; i++) {
        code += `                    ${i === 0 ? 'if' : '} else if'}(l == ${i}) {\n`;
        for (const offset of offsets) {
            code += `                        shadow += step(plDist - bias, texture(uShadowMap[${i}], shadowUV + ${offset}).r);\n`;
        }
    }
    if (n > 0) {
        code += '                    }';
    }
    return code;
}

export function createShaders(nLights, ambient, pcfTaps = 5) {
    const shaderNLights = Math.max(1, nLights);
    
    const vertexShader = `
out vec3 vOrigin;
out vec3 vDirection;

void main(){
    vOrigin = vec3(inverse(modelMatrix)*vec4(cameraPosition,1.0));
    vDirection = position - vOrigin;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
}
`;

    const fragmentShader = `
precision highp float;
precision highp sampler3D;

#define PI 3.14159265358979323846
#define N_LIGHTS ${shaderNLights}

in vec3 vOrigin;
in vec3 vDirection;

out vec4 fragColor;

uniform sampler3D uData;
uniform sampler2D uPalette;
uniform sampler2D uShadowMap[N_LIGHTS];
uniform vec3 uVolumeSize;
uniform vec3 uFillLightPos[3];
uniform vec3 uPointLightPos[N_LIGHTS];
uniform vec3 uPointLightColor[N_LIGHTS];
uniform float uAmbient;

vec2 rayBoxIntersection(vec3 ro, vec3 rd, vec3 bmin, vec3 bmax){
    vec3 inv = 1.0 / rd;
    vec3 t0 = (bmin - ro) * inv;
    vec3 t1 = (bmax - ro) * inv;
    vec3 tmin = min(t0, t1);
    vec3 tmax = max(t0, t1);
    float tN = max(max(tmin.x, tmin.y), tmin.z);
    float tF = min(min(tmax.x, tmax.y), tmax.z);
    return vec2(tN, tF);
}

vec2 dirToEquirectUV(vec3 dir) {
    float phi = atan(dir.x, dir.z);
    float theta = asin(clamp(dir.y, -1.0, 1.0));
    return vec2(phi / (2.0 * PI) + 0.5, theta / PI + 0.5);
}

void main(){
    vec3 rd = normalize(vDirection);
    vec2 bounds = rayBoxIntersection(vOrigin, rd, vec3(0.0), uVolumeSize);

    if(bounds.x > bounds.y || bounds.y < 0.0) discard;

    float t = max(bounds.x, 0.0) + 1e-4;
    vec3 pos = vOrigin + rd * t;

    ivec3 voxel = ivec3(floor(pos));
    ivec3 stepDir = ivec3(sign(rd));

    vec3 invDir = 1.0 / (rd + vec3(1e-9));
    vec3 tMax = (vec3(voxel) + max(sign(rd), 0.0) - pos) * invDir;
    vec3 tDelta = abs(invDir);

    vec3 normal = vec3(0.0);
    if (bounds.x > 0.0) {
        vec3 hitPoint = vOrigin + rd * bounds.x;
        vec3 c = (hitPoint - uVolumeSize * 0.5);
        vec3 r = abs(c) - uVolumeSize * 0.5;
        float m = max(r.x, max(r.y, r.z));
        normal = step(vec3(m), r) * -sign(c);
    }

    for(int i = 0; i < 1024; i++){
        if(voxel.x < 0 || voxel.y < 0 || voxel.z < 0 ||
           voxel.x >= int(uVolumeSize.x) ||
           voxel.y >= int(uVolumeSize.y) ||
           voxel.z >= int(uVolumeSize.z)) break;

        vec3 tc = (vec3(voxel) + 0.5) / uVolumeSize;
        float val = texture(uData, tc).r;

        if(val > 0.0){
            vec3 baseColor = texture(uPalette, vec2(val, 0.5)).rgb;
            vec3 light = vec3(uAmbient); // Ambient
            vec3 hitCenter = vec3(voxel) + 0.5;

            // Unshadowed fill lights
            for(int l = 0; l < 3; l++){
                vec3 lDir = normalize(uFillLightPos[l] - hitCenter);
                light += max(dot(normal, lDir), 0.0) * 0.15;
            }
            light += max(dot(normal, -rd), 0.0) * 0.1;

            // Shadow-mapped point lights (PCF shadow sampling)
            vec2 ts = vec2(1.0 / 256.0, 1.0 / 128.0);
            float bias = 4.0;

            for(int l = 0; l < N_LIGHTS; l++){
                vec3 plVec = uPointLightPos[l] - hitCenter;
                float plDist = length(plVec);
                vec3 plDirNorm = plVec / plDist;
                float plNDotL = max(dot(normal, plDirNorm), 0.0);

                if(plNDotL > 0.0) {
                    vec2 shadowUV = dirToEquirectUV(-plDirNorm);
                    float shadow = 0.0;
                    ${genShadowSamplerUnroll(shaderNLights, pcfTaps)}
                    shadow /= ${pcfTaps}.0;

                    float att = 1.0 / (1.0 + 0.01 * plDist + 0.0002 * plDist * plDist);
                    light += uPointLightColor[l] * plNDotL * att * 3.0 * shadow;
                }
            }

            fragColor = vec4(baseColor * light, 1.0);
            return;
        }

        if(tMax.x < tMax.y){
            if(tMax.x < tMax.z){
                voxel.x += stepDir.x;
                normal = vec3(-float(stepDir.x), 0.0, 0.0);
                tMax.x += tDelta.x;
            } else {
                voxel.z += stepDir.z;
                normal = vec3(0.0, 0.0, -float(stepDir.z));
                tMax.z += tDelta.z;
            }
        } else {
            if(tMax.y < tMax.z){
                voxel.y += stepDir.y;
                normal = vec3(0.0, -float(stepDir.y), 0.0);
                tMax.y += tDelta.y;
            } else {
                voxel.z += stepDir.z;
                normal = vec3(0.0, 0.0, -float(stepDir.z));
                tMax.z += tDelta.z;
            }
        }
    }

    discard;
}
`;

    return { vertexShader, fragmentShader };
}
