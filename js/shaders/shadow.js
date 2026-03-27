export function createShadowShaders(shadowCastDistance) {
    const shadowVertShader = `
out vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

    const shadowFragShader = `
precision highp float;
precision highp sampler3D;

#define PI 3.14159265358979323846

in vec2 vUv;
out vec4 fragColor;

uniform sampler3D uData;
uniform vec3 uVolumeSize;
uniform vec3 uLightPos;

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

void main(){
    float phi   = (vUv.x * 2.0 - 1.0) * PI;
    float theta = (vUv.y * 2.0 - 1.0) * PI * 0.5;
    float cosT  = cos(theta);
    vec3 rd = normalize(vec3(cosT * sin(phi), sin(theta), cosT * cos(phi)));

    vec3 ro = uLightPos;
    vec2 bounds = rayBoxIntersection(ro, rd, vec3(0.0), uVolumeSize);

    if(bounds.x > bounds.y) {
        fragColor = vec4(9999.0);
        return;
    }

    float t = max(bounds.x, 0.0) + 1e-4;
    vec3 pos = ro + rd * t;
    ivec3 voxel = ivec3(floor(pos));
    ivec3 stepDir = ivec3(sign(rd));
    vec3 invDir = 1.0 / (rd + vec3(1e-9));
    vec3 tMax = (vec3(voxel) + max(sign(rd), 0.0) - pos) * invDir;
    vec3 tDelta = abs(invDir);

    for(int i = 0; i < ${shadowCastDistance}; i++){
        if(voxel.x < 0 || voxel.y < 0 || voxel.z < 0 ||
           voxel.x >= int(uVolumeSize.x) ||
           voxel.y >= int(uVolumeSize.y) ||
           voxel.z >= int(uVolumeSize.z)) break;

        float val = texture(uData, (vec3(voxel) + 0.5) / uVolumeSize).r;
        if(val > 0.0) {
            fragColor = vec4(length(vec3(voxel) + 0.5 - ro), 0.0, 0.0, 1.0);
            return;
        }

        if(tMax.x < tMax.y){
            if(tMax.x < tMax.z) {
                voxel.x += stepDir.x; tMax.x += tDelta.x;
            } else {
                voxel.z += stepDir.z; tMax.z += tDelta.z;
            }
        } else {
            if(tMax.y < tMax.z){ voxel.y += stepDir.y; tMax.y += tDelta.y; }
            else                { voxel.z += stepDir.z; tMax.z += tDelta.z; }
        }
    }

    fragColor = vec4(9999.0, 0.0, 0.0, 1.0);
}
`;

    return { shadowVertShader, shadowFragShader };
}
