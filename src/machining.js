import * as THREE from 'three';
import {toCreasedNormals} from 'three/addons/utils/BufferGeometryUtils.js';

export const rad = THREE.MathUtils.degToRad;
export const tau = Math.PI * 2;

function finish(color, metalness, roughness, cut = '') {
  const material = new THREE.MeshStandardMaterial({ color, metalness, roughness });
  if (!cut) return material;
  // Object-space tool marks remain attached to each moving part. Fade subpixel
  // grooves using their screen-space footprint to prevent shimmer in motion.
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>',
      '#include <common>\nvarying vec3 millPosition;');
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nmillPosition = position;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>',
      '#include <common>\nvarying vec3 millPosition;');
    const coordinate = cut === 'lathe' ? 'length(millPosition.xy)' : 'dot(millPosition, vec3(.16,1.,.29))';
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
      #include <roughnessmap_fragment>
      float s = ${coordinate};
      float a = s * 820.0;
      float b = s * 197.0 + sin(s*16.3)*0.8;
      float groove = sin(a)*exp(-0.42*fwidth(a)) + .55*sin(b)*exp(-0.42*fwidth(b));
      float grain = fract(sin(dot(floor(millPosition.xy*740.0), vec2(12.41,36.92)))*43758.32)-.5;
      roughnessFactor = clamp(roughnessFactor + groove*.045 + grain*.026, .08, .85);
      float lick = sin(s*32.1 + .41*sin(s*17.5))*.30 + sin(s*96.4)*.23 + sin(s*254.)*.13;
      diffuseColor.rgb *= 1.0 + groove*.039 + lick*.075;
    `);
  };
  material.customProgramCacheKey = () => cut;
  return material;
}

export const mat = {
  plate: finish(0xb4b7b5, .95, .31, 'mill'),
  link: finish(0x6b6d6b, .96, .31, 'mill'),
  turned: finish(0xd1d1cb, .97, .22, 'lathe'),
  chrome: finish(0xd6d7d3, .99, .17, 'lathe'),
  steel: finish(0x868883, .95, .32, 'lathe'),
  gunmetal: finish(0x484b4a, .84, .31, 'lathe'),
  black: finish(0x242524, .46, .38, 'mill'),
  enamel: finish(0x191b1b, .34, .31),
  jaw: finish(0x303231, .67, .38),
  inner: finish(0x181b1a, .75, .32),
  bore: finish(0x202220, .22, .54),
  rubber: finish(0x252625, .07, .78),
};

export function group(parent, name, x=0, y=0, z=0) {
  const result = new THREE.Group();
  result.name = name;
  result.position.set(x,y,z);
  parent.add(result);
  return result;
}

export function mesh(parent, geometry, material, x=0, y=0, z=0) {
  const result = new THREE.Mesh(geometry, material);
  result.position.set(x,y,z);
  result.castShadow = result.receiveShadow = true;
  parent.add(result);
  return result;
}

// Convex corners are rounded with short quadratic arcs, including the pocket
// openings. The side faces and their edge breaks are actual extruded geometry.
export function contour(vertices, radius=.04, Path=THREE.Shape) {
  const path = new Path();
  const points = vertices.map(([x,y]) => new THREE.Vector2(x,y));
  for (let i=0; i<points.length; i++) {
    const here=points[i], prev=points[(i+points.length-1)%points.length], next=points[(i+1)%points.length];
    const r = Math.min(radius, here.distanceTo(prev)*.46, here.distanceTo(next)*.46);
    const a=here.clone().add(prev.clone().sub(here).setLength(r));
    const b=here.clone().add(next.clone().sub(here).setLength(r));
    if (i===0) path.moveTo(a.x,a.y); else path.lineTo(a.x,a.y);
    path.quadraticCurveTo(here.x,here.y,b.x,b.y);
  }
  path.closePath();
  return path;
}

export function circle(x,y,r,Path=THREE.Path) {
  const p=new Path();
  p.absarc(x,y,r,0,tau,false);
  return p;
}

export function clippedRect(w,h,clip, radius=.03) {
  const x=w/2, y=h/2, c=clip;
  return contour([[-x+c,-y],[x-c,-y],[x,-y+c],[x,y-c],[x-c,y],[-x+c,y],[-x,y-c],[-x,-y+c]],radius);
}

export function extrude(parent, shape, depth, material, bevel=.012) {
  const settings={ depth:depth-2*bevel, bevelEnabled:bevel>0, bevelSegments:3,
    steps:1, bevelSize:bevel, bevelThickness:bevel, curveSegments:22 };
  const g=new THREE.ExtrudeGeometry(shape,settings);
  const capNormals=g.attributes.normal.clone();
  toCreasedNormals(g,rad(48));
  // The flat faces of milled stock retain their plane through triangulation.
  // Only the small radius at a chamfer rolls its highlight into the cap.
  for (const face of g.groups) if(face.materialIndex===0) {
    const n=g.attributes.normal;
    for(let i=face.start;i<face.start+face.count;i++) {
      n.setXYZ(i,capNormals.getX(i)*.96+n.getX(i)*.04,capNormals.getY(i)*.96+n.getY(i)*.04,capNormals.getZ(i)*.96+n.getZ(i)*.04);
    }
  }
  g.translate(0,0,-depth/2+bevel);
  return mesh(parent,g,material);
}

const rings = new Map();
export function ring(parent, outer, inner, depth, material, x=0, y=0, z=0, bevel=.007, sides=64) {
  const b=Math.min(bevel,depth*.31,(outer-inner)*.26);
  const key=[outer,inner,depth,b,sides].join('/');
  if (!rings.has(key)) {
    const h=depth/2;
    const profile=[[inner,-h+b],[inner+b,-h],[outer-b,-h],[outer,-h+b],
      [outer,h-b],[outer-b,h],[inner+b,h],[inner,h-b],[inner,-h+b]];
    const geom=new THREE.LatheGeometry(profile.map(([r,d])=>new THREE.Vector2(Math.max(.00001,r),d)),sides);
    geom.rotateX(Math.PI/2);
    rings.set(key,geom);
  }
  return mesh(parent,rings.get(key),material,x,y,z);
}

const screws = new Map();
export function bolt(parent, x,y,z, size=.05, length=.19) {
  const key=[size,length].join('/');
  if (!screws.has(key)) {
    const proto=new THREE.Group();
    const head=circle(0,0,size,THREE.Shape);
    const hex=[];
    for (let i=0;i<6;i++) hex.push([Math.cos(i*tau/6)*size*.52,Math.sin(i*tau/6)*size*.52]);
    head.holes.push(contour(hex,.0008,THREE.Path));
    extrude(proto,head,size*.94,mat.turned,size*.065).position.z=size*.41;
    ring(proto,size*.48,0,.009,mat.inner,0,0,size*.14,.001,12);
    ring(proto,size*.55,0,length,mat.steel,0,0,-length/2);
    for (let i=0;i<6;i++) ring(proto,size*.59,0,size*.105,mat.chrome,0,0,-length + size*.19*i);
    screws.set(key,proto);
  }
  const result=screws.get(key).clone();
  result.position.set(x,y,z);
  parent.add(result);
  return result;
}

export function circularPattern(n,r,fn,angle=0) {
  for (let i=0; i<n; i++) {
    const a=angle+tau*i/n;
    fn(r*Math.cos(a),r*Math.sin(a),i);
  }
}

export function toothedRing(parent, outer, inner, depth, material, teeth=60) {
  const s=new THREE.Shape();
  for (let i=0;i<teeth*4;i++) {
    const a=i*tau/(teeth*4), r=i%4<2?outer:outer*.963;
    if (i===0) s.moveTo(r,0); else s.lineTo(Math.cos(a)*r,Math.sin(a)*r);
  }
  s.closePath();
  if (inner>0) s.holes.push(circle(0,0,inner));
  return extrude(parent,s,depth,material,.0008);
}
