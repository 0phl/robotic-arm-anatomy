import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {makeArm} from './arm.js';
import {makeStudio} from './studio.js';
import {pose} from './shot.js';
import {rad} from './machining.js';
import content from './lesson-content.json';

export const joints=[
  {id:'base',name:'Base rotation',min:-90,max:90,initial:0,unit:'°'},
  {id:'lift',name:'Shoulder lift',min:32,max:64,initial:47,unit:'°'},
  {id:'elbow',name:'Elbow bend',min:130,max:148,initial:143,unit:'°'},
  {id:'wrist',name:'Wrist swivel',min:-85,max:35,initial:-13,unit:'°'},
  {id:'pitch',name:'Tool pitch',min:-20,max:13,initial:-18,unit:'°'},
  {id:'jaw',name:'Jaw opening',min:0,max:100,initial:64,unit:'%'}
];
const directions={perspective:[-4.1,3.5,10],front:[0,.035,1],side:[1,.08,.01],top:[0,1,.001]};
const initialPose=()=>Object.fromEntries(joints.map(j=>[j.id,j.initial]));
const svgNS='http://www.w3.org/2000/svg';

function assignParts(root,parts) {
  const groups=new Map(parts.map(p=>[p.id,root.getObjectByName(p.group)]));
  const ids=new Map([...groups].map(([id,group])=>[group,id]));
  const neighbors={'Shoulder axis':'shoulder','Elevation axis':'lift','Wrist pivot bracket':'wrist-link','Tool pitch':'wrist-link','Tool axis':'wrist-drive'};
  const meshes=[];
  root.traverse(mesh=>{
    if(!mesh.isMesh) return;
    let node=mesh, id;
    while(node&&!id){id=ids.get(node)||neighbors[node.name];node=node.parent;}
    mesh.userData.part=id||'base';
    mesh.geometry.computeBoundingBox();
    meshes.push(mesh);
  });
  return {groups,meshes};
}

function floorGrid() {
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,
    vertexShader:'varying vec2 p;void main(){p=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 p;void main(){vec2 g=p*1.6;vec2 d=abs(fract(g-.5)-.5)/max(fwidth(g),vec2(.0001));float line=1.-clamp(min(d.x,d.y),0.,1.);
      float fade=1.-smoothstep(2.,11.,length(p));gl_FragColor=vec4(.38,.43,.35,line*.20*fade);}`
  });
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(26,26),material);
  floor.rotation.x=-Math.PI/2;floor.position.y=-.016;floor.renderOrder=-1;return floor;
}

export function createExplorer({canvas,stage,overlay,onPick,onViewChange}) {
  const renderAssets=new URLSearchParams(location.search).has('illustrate');
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:renderAssets});
  renderer.autoClear=false;renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.VSMShadowMap;
  const scene=new THREE.Scene(), camera=new THREE.OrthographicCamera(-5,5,3,-3,.05,120);
  const backdrop=makeStudio(renderer,scene,true),arm=makeArm(scene);
  const root=scene.getObjectByName('Robot'), shoulder=root.getObjectByName('Shoulder axis');
  const {groups,meshes}=assignParts(root,content.parts);
  const grid=floorGrid();scene.add(grid);
  const floorShadows=scene.children.filter(o=>o.userData.floor);
  const axisSvg=stage.querySelector('.axis svg');
  const axisPaths=axisSvg.querySelectorAll('path'),axisLetters=axisSvg.querySelectorAll('text');
  const axes=[new THREE.Vector3(0,1,0),new THREE.Vector3(1,0,0),new THREE.Vector3(0,0,1)];
  const controls=new OrbitControls(camera,canvas);
  controls.enableDamping=false;controls.minZoom=.5;controls.maxZoom=6;
  controls.maxPolarAngle=Math.PI*.485;controls.rotateSpeed=.72;controls.zoomSpeed=.85;
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  const tmp=new THREE.Vector3(), up=new THREE.Vector3(0,1,0),baseQ=new THREE.Quaternion();
  const tinted=new Map(), originals=new Map(meshes.map(m=>[m,m.material]));
  const lines=document.createElementNS(svgNS,'svg');lines.setAttribute('class','leaders');lines.setAttribute('aria-hidden','true');overlay.append(lines);
  const markers=content.parts.map((part,i)=>{
    const line=document.createElementNS(svgNS,'line'),dot=document.createElementNS(svgNS,'circle');
    dot.setAttribute('r','2');lines.append(line,dot);
    const button=document.createElement('button');
    button.className='marker';button.dataset.part=part.id;button.setAttribute('aria-label','Inspect '+part.name);
    const number=document.createElement('span');number.className='marker-num';number.textContent=String(i+1).padStart(2,'0');
    const name=document.createElement('span');name.className='marker-name';name.textContent=part.name;
    button.append(number,name);button.addEventListener('click',()=>onPick(part.id));overlay.append(button);
    return {part,button,line,dot};
  });
  const hover=document.createElement('span');hover.className='hover-name';hover.hidden=true;stage.append(hover);
  let values=initialPose(),selected=null,isolated=false,labels=true,quiz=false,view='perspective',width=1,height=1,viewHeight=6;
  let scheduled=false,assetMode=false,ready=false,lastPointer=null,hoverFrame=0;

  function setPose() {
    shoulder.rotation.y=rad(values.base);
    arm.lift.rotation.z=rad(values.lift);arm.elbow.rotation.z=rad(values.elbow);
    arm.carriage.rotation.y=0;
    arm.carriage.getWorldQuaternion(arm.wristOrigin.quaternion).invert();
    arm.wristOrigin.quaternion.multiply(baseQ.setFromAxisAngle(up,rad(values.base)));
    arm.wristYaw.rotation.y=rad(values.wrist);arm.wristPitch.rotation.z=rad(values.pitch);
    for(const {pivot,sign} of arm.jaws) pivot.rotation.z=sign*rad(-5+.20*values.jaw);
    root.updateMatrixWorld(true);
  }
  function appearance() {
    floorShadows.forEach(floor=>{floor.visible=!isolated;});
    for(const mesh of meshes){
      const active=mesh.userData.part===selected;
      mesh.visible=!isolated||active;
      const original=originals.get(mesh);
      if(!active||assetMode||quiz){mesh.material=original;continue;}
      if(!tinted.has(original)){
        const material=original.clone();
        material.onBeforeCompile=original.onBeforeCompile;material.customProgramCacheKey=original.customProgramCacheKey;
        material.color.lerp(new THREE.Color(0xcd844d),.38);
        material.emissive.set(0x512106);material.emissiveIntensity=.13;
        tinted.set(original,material);
      }
      mesh.material=tinted.get(original);
    }
  }

  function fit(direction,padding=1.19) {
    root.updateMatrixWorld(true);
    const dir=new THREE.Vector3(...direction).normalize();
    const right=new THREE.Vector3().crossVectors(up,dir).normalize(), vertical=new THREE.Vector3().crossVectors(dir,right);
    const projected=new THREE.Box3(),point=new THREE.Vector3();
    for(const mesh of meshes) if(mesh.visible){
      const {min,max}=mesh.geometry.boundingBox;
      for(let i=0;i<8;i++){
        tmp.set(i&1?max.x:min.x,i&2?max.y:min.y,i&4?max.z:min.z).applyMatrix4(mesh.matrixWorld);
        projected.expandByPoint(point.set(tmp.dot(right),tmp.dot(vertical),tmp.dot(dir)));
      }
    }
    const middle=projected.getCenter(new THREE.Vector3()),size=projected.getSize(new THREE.Vector3()),aspect=width/height;
    controls.target.copy(right).multiplyScalar(middle.x).addScaledVector(vertical,middle.y).addScaledVector(dir,middle.z);
    camera.position.copy(controls.target).addScaledVector(dir,22);
    viewHeight=Math.max(size.y,size.x/aspect,.35)*padding;
    camera.zoom=1;projection();controls.update();invalidate();
  }
  function projection(){
    const half=viewHeight/2;
    camera.top=half;camera.bottom=-half;camera.left=-half*width/height;camera.right=-camera.left;camera.updateProjectionMatrix();
  }
  function layoutMarkers(){
    overlay.hidden=!labels||assetMode;if(overlay.hidden)return;
    const placed=[];
    const sorted=[...markers].sort((a,b)=>Number(b.part.id===selected)-Number(a.part.id===selected));
    for(const {part,button,line,dot} of sorted){
      const isSelected=part.id===selected&&!quiz;
      groups.get(part.id).localToWorld(tmp.fromArray(part.anchor)).project(camera);
      const x=(tmp.x+1)*width/2, y=(1-tmp.y)*height/2;
      const visible=(!isolated||isSelected)&&tmp.z>-1&&tmp.z<1&&x>3&&x<width-3&&y>3&&y<height-3;
      button.hidden=!visible;line.style.display=dot.style.display=visible?'':'none';if(!visible)continue;
      const factor=width<510?.54:1;
      let mx=THREE.MathUtils.clamp(x+part.offset[0]*factor,15,width-15);
      let my=THREE.MathUtils.clamp(y+part.offset[1]*factor,36,height-31);
      for(let n=0;n<14&&placed.some(([a,b])=>Math.abs(mx-a)<29&&Math.abs(my-b)<26);n++){
        my+=my<height/2?-24:24;
        if(my<35||my>height-31){mx=THREE.MathUtils.clamp(mx+(mx<width/2?-30:30),15,width-15);my=THREE.MathUtils.clamp(y,36,height-31);}
      }
      placed.push([mx,my]);
      button.style.left=mx+'px';button.style.top=my+'px';
      button.classList.toggle('selected',isSelected);button.classList.toggle('flip',mx>width*.57);
      line.setAttribute('x1',x);line.setAttribute('y1',y);line.setAttribute('x2',mx);line.setAttribute('y2',my);
      line.classList.toggle('active',isSelected);dot.setAttribute('cx',x);dot.setAttribute('cy',y);
    }
  }
  function draw(){
    camera.updateMatrixWorld();backdrop(.7);renderer.render(scene,camera);layoutMarkers();
    axes.forEach((axis,i)=>{
      tmp.copy(axis).transformDirection(camera.matrixWorldInverse);
      const x=23+tmp.x*14,y=23-tmp.y*14;
      axisPaths[i].setAttribute('d',`M23 23L${x} ${y}`);
      axisLetters[i].setAttribute('x',x+tmp.x*5-2.5);axisLetters[i].setAttribute('y',y-tmp.y*5+2);
    });
    axisSvg.querySelector('circle').setAttribute('cy','23');
    axisSvg.querySelector('circle').setAttribute('cx','23');
  }
  function invalidate(){
    if(!ready||scheduled||assetMode)return;
    scheduled=true;requestAnimationFrame(()=>{scheduled=false;draw();});
  }
  function resize(w,h,pixelRatio=Math.min(devicePixelRatio,1.75)){
    width=Math.max(1,Math.round(w));height=Math.max(1,Math.round(h));renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width,height,false);projection();
  }
  function hit(e){
    const rect=canvas.getBoundingClientRect();
    pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
    raycaster.setFromCamera(pointer,camera);
    return raycaster.intersectObjects(meshes.filter(m=>m.visible),false)[0]?.object.userData.part;
  }
  function clearHover(){hover.hidden=true;canvas.classList.remove('over-part');cancelAnimationFrame(hoverFrame);}
  canvas.addEventListener('pointerdown',e=>{clearHover();lastPointer={id:e.pointerId,x:e.clientX,y:e.clientY,dragged:!e.isPrimary||e.button!==0};});
  canvas.addEventListener('pointermove',e=>{
    if(e.buttons){if(lastPointer&&Math.hypot(lastPointer.x-e.clientX,lastPointer.y-e.clientY)>5)lastPointer.dragged=true;clearHover();return;}
    if(e.pointerType==='touch')return;
    cancelAnimationFrame(hoverFrame);
    hoverFrame=requestAnimationFrame(()=>{
      const id=hit(e);hover.hidden=!id||quiz;canvas.classList.toggle('over-part',Boolean(id));
      if(!id||quiz)return;
      const r=canvas.getBoundingClientRect();hover.textContent=content.parts.find(p=>p.id===id).name;
      hover.style.left=Math.max(4,Math.min(width-hover.offsetWidth-4,e.clientX-r.left+14))+'px';
      hover.style.top=Math.max(4,Math.min(height-26,e.clientY-r.top+16))+'px';
    });
  });
  canvas.addEventListener('pointerup',e=>{
    if(lastPointer?.id===e.pointerId&&!lastPointer.dragged&&Math.hypot(lastPointer.x-e.clientX,lastPointer.y-e.clientY)<6){
      const id=hit(e);if(id)onPick(id);
    }lastPointer=null;
  });
  canvas.addEventListener('pointercancel',()=>{lastPointer=null;clearHover();});canvas.addEventListener('pointerleave',clearHover);
  function zoom(factor){camera.zoom=THREE.MathUtils.clamp(camera.zoom*factor,controls.minZoom,controls.maxZoom);camera.updateProjectionMatrix();invalidate();}
  function resetCamera(){view='perspective';onViewChange(view);fit(directions[view]);}
  canvas.addEventListener('keydown',e=>{
    if(['ArrowRight','ArrowLeft','ArrowUp','ArrowDown'].includes(e.key)){
      e.preventDefault();const s=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
      if(e.key==='ArrowRight')s.theta+=.13;if(e.key==='ArrowLeft')s.theta-=.13;
      if(e.key==='ArrowUp')s.phi-=.11;if(e.key==='ArrowDown')s.phi+=.11;
      s.phi=THREE.MathUtils.clamp(s.phi,.015,controls.maxPolarAngle);
      camera.position.setFromSpherical(s).add(controls.target);controls.update();onViewChange('custom');
    }else if(['+','=','-','Home'].includes(e.key)){
      e.preventDefault();if(e.key==='Home')resetCamera();else zoom(e.key==='-'?1/1.2:1.2);
    }
  });
  let navigating=false;
  controls.addEventListener('change',()=>{if(navigating&&view!=='custom'){view='custom';onViewChange(view);}invalidate();});
  controls.addEventListener('start',()=>{navigating=true;clearHover();});
  controls.addEventListener('end',()=>{navigating=false;});
  pose(arm,15);setPose();resize(stage.clientWidth,stage.clientHeight);
  ready=true;fit(directions.perspective);draw();
  new ResizeObserver(()=>{
    if(assetMode)return;
    const oldAspect=width/height;resize(stage.clientWidth,stage.clientHeight);
    if(Math.abs(Math.log((width/height)/oldAspect))>.04)fit(camera.position.clone().sub(controls.target).normalize().toArray());else invalidate();
  }).observe(stage);
  return {
    select(id){selected=id;appearance();if(isolated)fit(directions.perspective);invalidate();},
    isolate(on){isolated=on;appearance();resetCamera();},
    labels(on){labels=on;invalidate();},
    quiz(on){quiz=on;clearHover();overlay.classList.toggle('quiz-mode',on);appearance();invalidate();},
    view(name){view=name;fit(directions[name]||directions.perspective);},
    zoom,resetCamera,
    joint(id,value){values[id]=value;setPose();invalidate();},
    resetPose(){values=initialPose();setPose();resetCamera();},
    illustrate(id){
      if(!renderAssets)throw new Error('Illustration capture is disabled');
      assetMode=true;grid.visible=false;selected=id;isolated=Boolean(id);appearance();resize(id?420:1200,id?195:720,1);
      const dir=id==='base'?[4,3.5,6]:id?[2,1.85,6]:directions.perspective;
      fit(dir,id?1.21:1.22);draw();return canvas.toDataURL('image/webp',.92);
    }
  };
}
