import * as THREE from 'three';

/** CONFIG **/
const W = 320, H = 200, D = 200;
const N_LIGHTS = 2;
const AMBIENT = 0.0;
const SHADOW_CAST_DISTANCE = 128;
const voxelData = new Uint8Array(W * H * D);

const dataTexture = new THREE.Data3DTexture(voxelData, W, H, D);
dataTexture.format = THREE.RedFormat;
dataTexture.type = THREE.UnsignedByteType;
dataTexture.minFilter = THREE.NearestFilter;
dataTexture.magFilter = THREE.NearestFilter;
dataTexture.unpackAlignment = 1;
dataTexture.needsUpdate = true;

/** Palette **/
const paletteData = new Uint8Array(256 * 4);
for(let i=0;i<256;i++){
    paletteData[i*4]=Math.random()*255;
    paletteData[i*4+1]=Math.random()*255;
    paletteData[i*4+2]=Math.random()*255;
    paletteData[i*4+3]=255;
}
// Reserve index 255 for the floor/walls — warm concrete
paletteData[255*4]=210; paletteData[255*4+1]=200; paletteData[255*4+2]=185; paletteData[255*4+3]=255;

const paletteTexture = new THREE.DataTexture(paletteData,256,1,THREE.RGBAFormat);
paletteTexture.needsUpdate = true;

/** ENTITIES **/
const entities = Array.from({length:32},()=>({
    pos:new THREE.Vector3(Math.random()*W,Math.random()*H,Math.random()*D),
    vel:new THREE.Vector3((Math.random()-0.5)*2,(Math.random()-0.5)*2,(Math.random()-0.5)*2),
    color:Math.floor(Math.random()*254)+1,
    size:Math.floor(Math.random()*20)+4
}));

/** SHADERS **/

// GLSL ES requires constant indices into sampler arrays; generate unrolled if/else at build time.
function genShadowSamplerUnroll(n) {
    let code = '';
    for (let i = 0; i < n; i++) {
        code += `                    ${i === 0 ? 'if' : '} else if'}(l == ${i}) {\n`;
        for (const offset of ['vec2(0.0, 0.0)', 'vec2( ts.x, 0.0)', 'vec2(-ts.x, 0.0)', 'vec2(0.0,  ts.y)', 'vec2(0.0, -ts.y)']) {
            code += `                        shadow += step(plDist - bias, texture(uShadowMap[${i}], shadowUV + ${offset}).r);\n`;
        }
    }
    code += '                    }';
    return code;
}

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
#define N_LIGHTS ${N_LIGHTS}

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
            vec3 light = vec3(${AMBIENT}); // Ambient
            vec3 hitCenter = vec3(voxel) + 0.5;

            // Unshadowed fill lights
            for(int l = 0; l < 3; l++){
                vec3 lDir = normalize(uFillLightPos[l] - hitCenter);
                light += max(dot(normal, lDir), 0.0) * 0.15;
            }
            light += max(dot(normal, -rd), 0.0) * 0.1;

            // Shadow-mapped point lights (5-tap PCF each)
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
                    ${genShadowSamplerUnroll(N_LIGHTS)}
                    shadow /= 5.0;

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

/** SHADOW PASS SHADERS **/

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

    for(int i = 0; i < ${SHADOW_CAST_DISTANCE}; i++){
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

/** POINT LIGHTS — N_LIGHTS colored bouncing lights **/
const pointLights = Array.from({length: N_LIGHTS}, (_, i) => {
    const hue = i / N_LIGHTS;
    // Evenly-spaced hues converted to RGB
    const h6 = hue * 6, s = 1, v = 1;
    const f = h6 - Math.floor(h6), p = 0, q = 1 - f, t = f;
    const seg = Math.floor(h6) % 6;
    const [r, g, b] = [
        [v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]
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

/** SHADOW RENDER TARGETS — one per light **/
const shadowRTs = pointLights.map(() => new THREE.WebGLRenderTarget(1024, 512, {
    format: THREE.RedFormat,
    type: THREE.FloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false
}));

/** SHADOW SCENE — single quad, reuse per light by updating uLightPos **/
const shadowScene = new THREE.Scene();
const shadowCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const shadowMat = new THREE.ShaderMaterial({
    uniforms: {
        uData:       { value: dataTexture },
        uVolumeSize: { value: new THREE.Vector3(W, H, D) },
        uLightPos:   { value: new THREE.Vector3() }
    },
    vertexShader:   shadowVertShader,
    fragmentShader: shadowFragShader,
    glslVersion:    THREE.GLSL3
});

shadowScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), shadowMat));

/** MAIN SCENE **/
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(80, innerWidth/innerHeight, 0.1, 2000);
const fovY = 75 * Math.PI / 180;
const aspect = innerWidth / innerHeight;
const fitDist = Math.min(H/2 / Math.tan(fovY/2), W/2 / (Math.tan(fovY/2) * aspect));
camera.position.set(W/2, H/2, -fitDist * 0.85);
camera.lookAt(W/2, H/2, D/2);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const geom = new THREE.BoxGeometry(W, H, D);
geom.translate(W/2, H/2, D/2);

const mainMat = new THREE.ShaderMaterial({
    uniforms: {
        uData:           { value: dataTexture },
        uPalette:        { value: paletteTexture },
        uShadowMap:      { value: shadowRTs.map(rt => rt.texture) },
        uVolumeSize:     { value: new THREE.Vector3(W, H, D) },
        uFillLightPos:   { value: [
            new THREE.Vector3(0,   0,   0),
            new THREE.Vector3(W,   H,   0),
            new THREE.Vector3(W/2, H/2, D*2)
        ]},
        uPointLightPos:  { value: pointLights.map(l => l.pos) },
        uPointLightColor:{ value: pointLights.map(l => l.color) }
    },
    vertexShader,
    fragmentShader,
    side:        THREE.BackSide,
    glslVersion: THREE.GLSL3
});

scene.add(new THREE.Mesh(geom, mainMat));

/** UPDATE **/
function updateGrid(){
    voxelData.fill(0);

    entities.forEach(e=>{
        e.pos.add(e.vel);

        if(e.pos.x<e.size||e.pos.x>W-e.size) e.vel.x*=-1;
        if(e.pos.y<e.size||e.pos.y>H-e.size) e.vel.y*=-1;
        if(e.pos.z<e.size||e.pos.z>D-e.size) e.vel.z*=-1;

        let r=e.size;
        for(let x=-r;x<r;x++)
        for(let y=-r;y<r;y++)
        for(let z=-r;z<r;z++){
            if(x*x+y*y+z*z<r*r){
                let vx=Math.floor(e.pos.x+x);
                let vy=Math.floor(e.pos.y+y);
                let vz=Math.floor(e.pos.z+z);
                if(vx>=0&&vy>=0&&vz>=0&&vx<W&&vy<H&&vz<D)
                    voxelData[vx+vy*W+vz*W*H]=e.color;
            }
        }
    });

    // Floor, ceiling, left/right walls (stamped last so they're never overwritten)
    for(let x = 0; x < W; x++) {
        for(let z = 0; z < D; z++) {
            voxelData[x + 0*W      + z*W*H] = 255; // floor
            voxelData[x + (H-1)*W  + z*W*H] = 255; // ceiling
        }
    }
    for(let y = 0; y < H; y++) {
        for(let z = 0; z < D; z++) {
            voxelData[0       + y*W + z*W*H] = 255; // left wall
            voxelData[(W-1)   + y*W + z*W*H] = 255; // right wall
        }
    }

    dataTexture.needsUpdate = true;
}

function updatePointLights(){
    pointLights.forEach(l => {
        l.pos.add(l.vel);
        if(l.pos.x < 0 || l.pos.x > W) l.vel.x *= -1;
        if(l.pos.y < 0 || l.pos.y > H) l.vel.y *= -1;
        if(l.pos.z < 0 || l.pos.z > D) l.vel.z *= -1;
    });
}

/** LOOP **/
function animate(){
    updateGrid();
    updatePointLights();

    // Shadow pass — render one equirect depth map per light
    pointLights.forEach((light, i) => {
        shadowMat.uniforms.uLightPos.value.copy(light.pos);
        renderer.setRenderTarget(shadowRTs[i]);
        renderer.render(shadowScene, shadowCamera);
    });

    // Main pass
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);

    requestAnimationFrame(animate);
}

window.addEventListener('resize', () => {
    const aspect = window.innerWidth / window.innerHeight;
    const fitDist = Math.min(H/2 / Math.tan(fovY/2), W/2 / (Math.tan(fovY/2) * aspect));
    camera.position.set(W/2, H/2, -fitDist * 0.85);
    camera.lookAt(W/2, H/2, D/2);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

animate();
