import * as THREE from 'three';
import {SSAOPass} from 'three/addons/postprocessing/SSAOPass.js';
import {makeStudio} from './studio.js';
import {makeArm} from './arm.js';
import {pose,setCamera,duration} from './shot.js';
import {startLesson} from './lesson.js';

// The film exporter uses the original camera and frame timeline.
function startCapture(){
  const canvas=document.createElement('canvas');document.body.replaceChildren(canvas);
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
  renderer.autoClear=false;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.VSMShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(10.4,16/9,.25,150);
  const backdrop=makeStudio(renderer,scene),arm=makeArm(scene),ao=new SSAOPass(scene,camera,640,360,32);
  const floors=scene.children.filter(o=>o.userData.floor);
  ao.renderToScreen=true;ao.kernelRadius=.62;ao.minDistance=.000055;ao.maxDistance=.007;
  function draw(time){
    const t=THREE.MathUtils.clamp(time,0,duration);
    pose(arm,t);backdrop(setCamera(camera,t));renderer.render(scene,camera);
    floors.forEach(f=>f.visible=false);renderer.shadowMap.autoUpdate=false;
    ao.render(renderer,null,null);renderer.shadowMap.autoUpdate=true;floors.forEach(f=>f.visible=true);
  }
  function resize(w,h,dpr=1){
    renderer.setPixelRatio(dpr);renderer.setSize(w,h,false);ao.setSize(Math.round(w*dpr*.72),Math.round(h*dpr*.72));
    camera.aspect=w/h;camera.updateProjectionMatrix();draw(0);
  }
  resize(innerWidth,innerHeight);
  window.armCapture={draw,resize,lighting:value=>scene.environmentRotation.y=value,info:()=>({...renderer.info.render})};
}
if(new URLSearchParams(location.search).has('capture'))startCapture();else startLesson();
