import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mat, group, circle, contour, clippedRect, extrude, ring, bolt, circularPattern, toothedRing, rad } from './machining.js';

const up = -Math.PI/2;

// Each moving assembly is batched separately. Shafts, fasteners and machined
// faces share draw calls without baking the articulated hierarchy into a mesh.
function machinePart(part) {
  part.updateWorldMatrix(true,true);
  const inverse=part.matrixWorld.clone().invert(), batches=new Map();
  part.traverse(o => {
    if (!o.isMesh) return;
    const transform=inverse.clone().multiply(o.matrixWorld);
    const g=o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(transform);
    if (transform.determinant()<0) {
      // A mirrored jaw reverses triangle winding when its transform is baked.
      for (const attribute of Object.values(g.attributes)) {
        const a=attribute.array,w=attribute.itemSize;
        for(let i=0;i<a.length;i+=w*3) for(let j=0;j<w;j++) {
          const k=i+w+j,l=k+w;
          [a[k],a[l]]=[a[l],a[k]];
        }
      }
    }
    if (!batches.has(o.material)) batches.set(o.material,[]);
    batches.get(o.material).push(g);
  });
  part.clear();
  for (const [material,geometries] of batches) {
    const geometry=mergeGeometries(geometries);
    const m=new THREE.Mesh(geometry,material);
    m.castShadow=m.receiveShadow=true;
    part.add(m);
    for (const g of geometries) g.dispose();
  }
}

function basePlate(parent, flying) {
  const foundation=group(parent,'Ground plate');
  foundation.rotation.x=up;
  const lower=clippedRect(3.20,3.20,.29,.075);
  const holes=[];
  for (const sign of [-1,1]) {
    for (const v of [-1.31,-.67,0,.67,1.31]) holes.push([v,sign*1.36,Math.abs(v)>1?.109:.084]);
    for (const v of [-.67,0,.67]) holes.push([sign*1.36,v,.084]);
  }
  for (const [x,y,r] of holes) lower.holes.push(circle(x,y,r));
  lower.holes.push(circle(0,0,.48));
  extrude(foundation,lower,.196,mat.plate,.016).position.z=.099;
  // Thread crests catch the overhead strip light inside each tapped hole.
  for (const [x,y,r] of holes) {
    if (r<.1) for (let k=0;k<3;k++) ring(foundation,r+.003,r-.008,.009,mat.steel,x,y,.10+k*.027,.002,36);
  }
  const step=clippedRect(2.46,2.46,.20,.12);
  step.holes.push(circle(0,0,.465));
  for (const x of [-.92,.92]) for (const y of [-.92,.92]) step.holes.push(circle(x,y,.086));
  extrude(foundation,step,.095,mat.plate,.014).position.z=.244;
  const flange=circle(0,0,.862,THREE.Shape);
  flange.holes.push(circle(0,0,.666));
  circularPattern(8,.765,(x,y)=>flange.holes.push(circle(x,y,.037)),Math.PI/8);
  extrude(foundation,flange,.273,mat.turned,.012).position.z=.421;
  ring(foundation,.666,.582,.184,mat.inner,0,0,.450);
  ring(foundation,.580,.505,.114,mat.chrome,0,0,.480);
  ring(foundation,.507,.476,.19,mat.turned,0,0,.420);
  ring(foundation,.50,.461,.17,mat.steel,0,0,.294);
  ring(foundation,.459,0,.012,mat.bore,0,0,.046);
  for (let i=0;i<8;i++) {
    const a=i*Math.PI/4;
    ring(foundation,.035,0,.115,mat.steel,Math.cos(a)*.489,Math.sin(a)*.489,.472,.005,20);
  }
  machinePart(foundation);

  let i=0;
  for (const x of [-.92,.92]) for (const z of [-.92,.92]) {
    const carrier=group(parent,'Mounting cap screw',x,.294,z);
    const orient=group(carrier,'Vertical'); orient.rotation.x=up;
    bolt(orient,0,0,0,.10,.241);
    machinePart(carrier);
    flying(carrier,1.86+i*.065,2.83+i*.056,[0,2.35,0],[0,-1.6,0]);
    i++;
  }
}

// A stepper's mounting face is z=0. Its laminations extend behind that plane.
function stepper(parent, side, length, connector=true) {
  const body=group(parent,'Stepper housing');
  const face=(width,depth,z,material,corner)=>{
    const p=extrude(body,clippedRect(width,width,corner,.024),depth,material,.011);
    p.position.z=z;
    return p;
  };
  const front=.13*side,back=.12*side;
  face(side,length-front-back,-(length+front-back)/2,mat.black,side*.092);
  face(side*1.012,front,-front/2,mat.plate,side*.082);
  face(side*.989,back,-length+back/2,mat.steel,side*.09);
  // Fine dark seams between the cast end bells and the lamination stack.
  for (const z of [-front-.018,-length+back+.016]) face(side*.999,.016,z,mat.enamel,.091*side);
  face(side*.941,.052,-length-.013,mat.enamel,side*.09);
  ring(body,side*.411,side*.289,.054,mat.turned,0,0,.022);
  ring(body,side*.292,side*.212,.055,mat.inner,0,0,.035);
  ring(body,side*.210,side*.127,.061,mat.chrome,0,0,.047);
  ring(body,side*.129,0,side*.201,mat.steel,0,0,side*.142);
  const spline=toothedRing(body,side*.134,0,side*.14,mat.steel,26);
  spline.position.z=side*.173;
  for (const x of [-1,1]) for (const y of [-1,1]) {
    const px=x*side*.385,py=y*side*.385;
    ring(body,side*.047,0,.009,mat.inner,px,py,.001,.002,26);
    const tail=group(body,'Housing tie screw',px,py,-length-.037);
    tail.rotation.y=Math.PI;
    bolt(tail,0,0,0,side*.037,.10);
  }
  if (connector) {
    const plug=group(body,'Rear connector',0,side*.46,-length*.58);
    const shell=extrude(plug,clippedRect(side*.63,side*.18,.034),length*.56,mat.enamel,.016);
    shell.position.y=side*.07;
    for (const x of [-.28,.28]) ring(plug,side*.027,0,.035,mat.steel,side*x,side*.07,length*.29);
  }
  for(const x of [-1,1]) for(const y of [-1,1]) {
    const tieRod=group(body,'External tie rod',side*.444*x,side*.443*y,-length*.5);
    ring(tieRod,side*.028,0,length*.84,mat.enamel);
    const socket=group(body,'End bell cap screw',side*.411*x,side*.412*y,-front*.85);
    bolt(socket,0,0,front*.88,side*.024,.065);
  }
  return body;
}

// The tangent-sided silhouette tapers into circular bearing bosses at both ends.
function link(parent, length, rootR, endR, depth, pockets, perforated=true) {
  const s=new THREE.Shape();
  const a=Math.acos((rootR-endR)/length);
  s.moveTo(Math.cos(a)*rootR,Math.sin(a)*rootR);
  s.lineTo(length+Math.cos(a)*endR,Math.sin(a)*endR);
  s.absarc(length,0,endR,a,-a,true);
  s.lineTo(rootR*Math.cos(a),-rootR*Math.sin(a));
  s.absarc(0,0,rootR,-a,a,true);
  s.closePath();
  s.holes.push(circle(0,0,rootR*.565));
  s.holes.push(circle(length,0,endR*.558));
  for (let i=0; i<pockets; i++) {
    const start=rootR*1.14+.11, end=length-endR*1.09-.10;
    const unit=(end-start)/pockets, l=start+i*unit, r=l+unit-.135;
    const h1=THREE.MathUtils.lerp(rootR,endR,l/length)-.137;
    const h2=THREE.MathUtils.lerp(rootR,endR,r/length)-.13;
    const skew=(i%2===0?1:-1)*Math.min(.112,(r-l)*.15);
    s.holes.push(contour([[l,-h1],[r-skew,-h2],[r,h2],[l+skew,h1]],.092,THREE.Path));
  }
  if (perforated) circularPattern(8,rootR*.78,(x,y)=>s.holes.push(circle(x,y,.033)),Math.PI/8);
  extrude(parent,s,depth,mat.link,.013);
  ring(parent,endR*.578,endR*.51,.8*depth,mat.turned,length,0,0,.006);
}

function hub(parent,r,depth) {
  ring(parent,r,r*.54,depth,mat.turned);
  ring(parent,r*.55,r*.34,depth+.029,mat.gunmetal);
  ring(parent,r*.36,r*.19,depth+.049,mat.chrome);
  const cog=toothedRing(parent,r*1.04,r*.74,depth*.55,mat.steel,68);
  cog.position.z=-depth*.43;
}

function circleBolts(parent,flying,t0,t1,r,z,n=7,direction=[2.8,.55,2.8],size=.057) {
  circularPattern(n,r,(x,y,i)=>{
    const holder=group(parent,'Socket screw '+(i+1),x,y,z);
    bolt(holder,0,0,0,size,.20);
    machinePart(holder);
    const d=direction.map((v,axis)=>v+(axis===1?y*.9:axis===0?x*.6:0));
    flying(holder,t0+i*.028,t1+i*.037,d,[0,0,-2.5]);
  },Math.PI/7);
}

function makeGripper(parent) {
  const body=group(parent,'Gripper casting');
  const outline=contour([[-.35,-.31],[-.23,-.395],[.24,-.395],[.405,-.229],
    [.405,.225],[.23,.388],[-.235,.388],[-.35,.295]],.054);
  const screwPoints=[[-.247,-.25],[-.245,.25],[.155,.29],[.30,.16],[.30,-.16],[.159,-.29]];
  for (const [x,y] of screwPoints) outline.holes.push(circle(x,y,.026));
  extrude(body,outline,.394,mat.jaw,.022);
  for (const side of [-1,1]) {
    const face=extrude(body,outline,.063,mat.plate,.011);
    face.position.z=side*.225;
    for (const [x,y] of screwPoints) {
      const screw=group(body,'Cover screw',x,y,side*.251);
      if (side<0) screw.rotation.y=Math.PI;
      bolt(screw,0,0,0,.032,.06);
    }
    ring(body,.057,.035,.009,mat.steel,0,0,side*.258);
  }
  // Two front and rear four-bar sets run on hardened transverse pivot pins.
  machinePart(body);
  const jaws=[];
  for (const sign of [-1,1]) {
    const pivot=group(parent,sign>0?'Upper finger':'Lower finger',.24,sign*.23,0);
    const finger=group(pivot,'Finger linkage'); finger.scale.y=sign;
    const bar=(ax,ay,bx,by,width,depth,z,material)=>{
      const length=Math.hypot(bx-ax,by-ay);
      const s=new THREE.Shape(),r=width/2;
      s.absarc(0,0,r,Math.PI/2,Math.PI*1.5,false);
      s.lineTo(length,-r); s.absarc(length,0,r,-Math.PI/2,Math.PI/2,false); s.closePath();
      const m=extrude(finger,s,depth,material,.011);
      m.position.set(ax,ay,z); m.rotation.z=Math.atan2(by-ay,bx-ax);
    };
    for (const z of [-.15,.15]) {
      bar(0,.01,.38,.275,.118,.059,z,mat.jaw);
      bar(.38,.275,.66,.10,.141,.063,z,mat.black);
      bar(.025,-.139,.54,-.014,.111,.052,z,mat.jaw);
    }
    const pad=contour([[.52,-.042],[1.285,-.062],[1.34,-.015],[1.31,.066],[.70,.213],[.59,.173]],.04);
    extrude(finger,pad,.314,mat.jaw,.012);
    for(const z of [-.158,.158]) {
      const insert=extrude(finger,contour([[.685,.038],[1.28,-.008],[1.26,.036],[.715,.143]],.019),.018,mat.steel,.004);
      insert.position.z=z;
    }
    const rubber=extrude(finger,contour([[.78,-.067],[1.255,-.074],[1.28,-.027],[.77,-.003]],.012),.329,mat.rubber,.006);
    rubber.position.y=-.022;
    for (let i=0;i<9;i++) {
      const tooth=extrude(finger,contour([[-.018,0],[.016,0],[.010,-.023],[-.009,-.023]],.003),.323,mat.rubber,.002);
      tooth.position.set(.785+i*.056,-.079,0);
    }
    for (const [x,y] of [[0,.01],[.38,.275],[.66,.10],[.025,-.139],[.54,-.014]]) {
      ring(finger,.040,0,.39,mat.steel,x,y,0,.005,32);
      ring(finger,.019,0,.008,mat.gunmetal,x,y,.197,.002,20);
    }
    machinePart(pivot);
    jaws.push({pivot,sign});
  }
  return jaws;
}

export function makeArm(scene) {
  const root=group(scene,'Robot'), flights=[];
  function fly(part,start,end,offset,rotation=[0,0,0]) {
    flights.push({part,start,end,offset:new THREE.Vector3(...offset),rotation:new THREE.Vector3(...rotation),
      rest:part.position.clone(),angles:part.rotation.clone()});
  }
  basePlate(root,fly);

  const pedestal=group(root,'01 / azimuth drive',0,1.523,0);
  pedestal.rotation.x=up;
  stepper(pedestal,1.233,.892);
  const baseCog=toothedRing(pedestal,.606,.285,.125,mat.gunmetal,88);
  baseCog.position.z=-.953;
  ring(pedestal,.488,.24,.08,mat.chrome,0,0,-1.015);
  machinePart(pedestal);
  fly(pedestal,1.32,2.76,[0,3.05,0]);

  const shoulder=group(root,'Shoulder axis',0,2.065,0);
  const tie=group(shoulder,'02 / lower arm',0,0,-.19);
  const tieProfile=group(tie,'Machined link'); tieProfile.rotation.z=rad(5.5);
  link(tieProfile,2.76,.383,.275,.245,2);
  hub(tie,.354,.192);
  machinePart(tie);
  fly(tie,3.02,3.85,[2.60,2.7,0],[0,.10,.14]);
  circleBolts(shoulder,fly,3.72,4.50,.267,.049,7,[2.8,.3,2.25],.056);

  const shoulderMotor=group(shoulder,'03 / shoulder stepper',0,0,-.375);
  shoulderMotor.rotation.y=rad(23);
  stepper(shoulderMotor,.945,1.45);
  hub(shoulderMotor,.409,.182);
  machinePart(shoulderMotor);
  fly(shoulderMotor,4.35,5.47,[-3.2,.70,-1.22],[-.23,-.52,-.91]);
  circleBolts(shoulder,fly,4.98,5.83,.338,.118,4,[2.3,-.40,2.44],.053);

  const lift=group(shoulder,'Elevation axis',0,0,.153);
  const boom=group(lift,'04 / lift arm');
  link(boom,3.25,.463,.354,.219,2);
  hub(boom,.277,.286);
  machinePart(boom);
  fly(boom,5.93,6.68,[1.7,2.55,.48],[0,-.20,.055]);
  circleBolts(lift,fly,6.56,7.50,.348,.118,8,[2.15,-1.25,2.86],.052);

  const elbow=group(lift,'Elbow axis',3.25,0,-.286);
  const upper=group(elbow,'06 / upper return link');
  link(upper,4.54,.320,.333,.244,4,false);
  ring(upper,.307,.125,.311,mat.turned);
  ring(upper,.133,0,.329,mat.gunmetal);
  machinePart(upper);
  fly(upper,8.45,9.23,[-.35,-2.6,-.25],[0,.08,-.11]);

  const backDrive=group(elbow,'05 / upper drive',2.90,-.016,.06);
  const casting=group(backDrive,'Motor along upper return'); casting.rotation.y=-Math.PI/2;
  stepper(casting,.87,1.57);
  const flange=group(backDrive,'Output collar',.11,.382,-.02); flange.rotation.x=up;
  ring(flange,.398,.184,.14,mat.turned);
  ring(flange,.34,.143,.147,mat.inner,0,0,.131);
  const tail=group(backDrive,'Wrist saddle',1.64,.012,-.02); tail.rotation.y=Math.PI/2;
  ring(tail,.300,.151,.245,mat.turned);
  machinePart(backDrive);
  fly(backDrive,7.43,8.57,[3.4,-1.74,-.65],[.10,-.32,.48]);
  circleBolts(backDrive,fly,7.78,8.78,.283,-.29,4,[2.6,-.11,-1.4],.052);

  const carriage=group(elbow,'Wrist carriage swivel',4.43,0,0);
  const wristOrigin=group(carriage,'Wrist bearing',1.30,-.44,.88);
  const saddle=group(carriage,'Wrist pivot bracket',0,0,-.01);
  const forkSide=group(saddle,'Fork cheek',0,0,.03);
  forkSide.rotation.z=rad(-18.7);
  link(forkSide,1.373,.253,.272,.159,1,false);
  ring(saddle,.253,.102,.83,mat.turned,1.30,-.44,.426);
  ring(saddle,.26,.13,.055,mat.gunmetal,1.30,-.44,.79);
  machinePart(saddle);
  fly(saddle,11.48,12.28,[2.95,-.92,.16],[0,.10,-.06]);
  const wristYaw=group(wristOrigin,'Wrist swivel');
  const wristPitch=group(wristYaw,'Tool pitch');
  const fore=group(wristPitch,'08 / wrist link');
  link(fore,2.91,.348,.445,.313,2,false);
  ring(fore,.316,.147,.333,mat.turned);
  circularPattern(9,.234,(x,y)=>ring(fore,.027,0,.01,mat.inner,x,y,.17,.003,20));
  ring(fore,.154,.11,.36,mat.steel);
  ring(fore,.396,0,.023,mat.gunmetal,2.91,0,.166);
  const backAxle=group(fore,'Wrist journal',0,0,-.305);
  ring(backAxle,.263,.11,.325,mat.turned);
  machinePart(fore);
  fly(fore,11.46,12.39,[-4.45,1.08,.07],[0,.15,.065]);
  circleBolts(wristPitch,fly,12.27,13.16,.283,.164,5,[-2.8,.19,1.68],.044);

  const toolAxis=group(wristPitch,'Tool axis',2.91,0,-.26);
  toolAxis.rotation.z=rad(11);
  const toolMotor=group(toolAxis,'07 / wrist actuator');
  const unit=group(toolMotor,'Inline drive',1.18,0,0); unit.rotation.y=Math.PI/2;
  stepper(unit,.658,1.122,false);
  const sleeve=group(toolMotor,'Wrist hub',.05,0,0); sleeve.rotation.y=Math.PI/2;
  ring(sleeve,.424,.23,.215,mat.turned);
  ring(sleeve,.395,.20,.092,mat.inner,0,0,.128);
  machinePart(toolMotor);
  fly(toolMotor,9.94,11.13,[3.81,2.65,.15],[.25,-.15,.20]);
  circleBolts(toolAxis,fly,10.27,11.43,.247,-.08,4,[2.8,.31,.92],.046);

  const claw=group(toolAxis,'09 / parallel gripper',1.84,0,.035);
  const collar=group(claw,'Coupling');
  const shaft=group(collar,'Pneumatic adapter',-.499,0,0); shaft.rotation.y=Math.PI/2;
  ring(shaft,.316,0,.31,mat.enamel);
  ring(shaft,.306,.21,.055,mat.turned,0,0,-.167);
  for (const s of [-1,1]) {
    const rod=group(collar,'Exposed guide',-.51,s*.254,.143);
    rod.rotation.y=Math.PI/2;
    ring(rod,.032,0,.34,mat.chrome);
    ring(rod,.053,0,.075,mat.steel,0,0,-.142);
  }
  machinePart(collar);
  const jaws=makeGripper(claw);
  fly(claw,13.08,14.05,[3.3,-.25,.14],[0,-.11,.06]);
  circleBolts(claw,fly,13.68,14.55,.285,.259,4,[2.0,.05,1.0],.032);
  return {flights,lift,elbow,backDrive,carriage,wristOrigin,wristYaw,wristPitch,toolAxis,jaws};
}
