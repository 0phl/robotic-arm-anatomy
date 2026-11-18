import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import studioMap from './studio_small_08_1k.hdr';

// Studio Small 08 by Poly Haven (CC0). Keep the floating-point highlights
// while neutralizing the slight blue cast of the photographed cyclorama.
function environment(renderer) {
  const hdr=new HDRLoader().setDataType(THREE.FloatType).parse(studioMap.buffer);
  for(let i=0;i<hdr.data.length;i+=4) {
    const light=.2126*hdr.data[i]+.7152*hdr.data[i+1]+.0722*hdr.data[i+2];
    for(let c=0;c<3;c++) hdr.data[i+c]=.09+.91*(light*.92+hdr.data[i+c]*.08);
  }
  const tex=new THREE.DataTexture(hdr.data,hdr.width,hdr.height,THREE.RGBAFormat,THREE.FloatType);
  tex.mapping=THREE.EquirectangularReflectionMapping; tex.flipY=true; tex.needsUpdate=true;
  const pmrem=new THREE.PMREMGenerator(renderer), target=pmrem.fromEquirectangular(tex);
  tex.dispose(); pmrem.dispose(); return target.texture;
}
export function makeStudio(renderer,scene,study=false) {
  scene.environment=environment(renderer);
  scene.environmentIntensity=1.0;
  scene.environmentRotation.y=4.24;
  RectAreaLightUniformsLib.init();
  const strip=new THREE.RectAreaLight(0xfffdf6,1.45,4,3.5);
  strip.position.set(-3.4,6.5,-1.6);strip.lookAt(0,1.3,0);scene.add(strip);
  const rim=new THREE.RectAreaLight(0xf7fbff,1.2,1.2,4.5);
  rim.position.set(4.5,3.7,2);rim.lookAt(0,1.8,0);scene.add(rim);
  const baseCard=new THREE.RectAreaLight(0xfffefb,1.12,3.9,3.3);
  baseCard.position.set(3.8,2.9,-3.6);baseCard.lookAt(0,.22,0);scene.add(baseCard);
  const bgScene=new THREE.Scene(), bgCamera=new THREE.Camera();
  const bg=new THREE.ShaderMaterial({depthWrite:false,depthTest:false,
    uniforms:{pullback:{value:0},study:{value:study?1:0}},
    vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`varying vec2 vUv; uniform float pullback; uniform float study;
    void main(){
      vec2 q=vUv;
      float side=.019*(1.-q.x);
      float sweep=smoothstep(.09,.40,q.y+.024*cos(q.x*5.1));
      float cloudy=exp(-11.*dot(q-vec2(.24,.30),q-vec2(.24,.30)));
      vec3 floorCol=vec3(.708,.727,.719);
      vec3 wall=vec3(.647,.669,.664);
      vec3 col=mix(floorCol,wall,sweep*(.25+.75*pullback));
      col+=side+.013*cloudy-.020*length(q-.45)-.018*q.y;
      col=mix(col,vec3(.892,.906,.866)+.025*(q.y+.3*q.x)-.025*length(q-.53),study);
      float grain=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
      gl_FragColor=vec4(col+(grain-.5)/360.,1.);
    }`});
  bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),bg));

  const footprints=Array.from({length:3},()=>new THREE.Vector4(0,0,1,0));
  const occlusion=new THREE.Mesh(new THREE.PlaneGeometry(36,36),new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,uniforms:{footprints:{value:footprints}},
    vertexShader:'varying vec2 pos;void main(){pos=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 pos; uniform vec4 footprints[3];
    void main(){vec2 q=abs(pos)-vec2(1.39);float d=max(length(max(q,0.))-.13,0.);
      float tight=.29*exp(-d*10.0);float broad=.105*exp(-d*1.63);
      vec2 falloff=(pos-vec2(-.8,.25))*vec2(.39,.64);
      float shade=tight+broad+.075*exp(-dot(falloff,falloff));
      for(int i=0;i<3;i++){vec2 p=(pos-footprints[i].xy)/footprints[i].z;shade+=footprints[i].w*exp(-dot(p,p)*1.8);}
      gl_FragColor=vec4(.12,.14,.13,shade);
    }`
  }));
  occlusion.rotation.x=-Math.PI/2; occlusion.position.y=-.002; scene.add(occlusion);
  occlusion.userData.floor=true;
  const key=new THREE.DirectionalLight(0xfffcf3,.75);
  key.position.set(4.5,8.8,5.1); key.castShadow=true;
  Object.assign(key.shadow.camera,{left:-6,right:6,top:7,bottom:-4,near:.1,far:28});
  key.shadow.mapSize.set(512,512); key.shadow.bias=-.00024; key.shadow.normalBias=.012;
  key.shadow.radius=18; key.shadow.blurSamples=14;
  scene.add(key);
  let casters;
  const position=new THREE.Vector3();
  return progress=>{
    casters??=['01 / azimuth drive','05 / upper drive','09 / parallel gripper'].map(name=>scene.getObjectByName(name));
    casters.forEach((object,i)=>{
      object.getWorldPosition(position);
      const y=Math.max(.2,position.y);
      footprints[i].set(position.x-y*.31,-position.z+y*.22,.56+y*.32,object.visible ? .105/(1+y*.29) : 0);
    });
    bg.uniforms.pullback.value=progress;
    renderer.clear(); renderer.render(bgScene,bgCamera); renderer.clearDepth();
  };
}
