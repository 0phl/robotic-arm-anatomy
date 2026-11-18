import * as THREE from 'three';
import { rad } from './machining.js';

export const duration=599/30;
const clamp=THREE.MathUtils.clamp, mix=THREE.MathUtils.lerp;
function smooth(a,b,t) { const x=clamp((t-a)/(b-a),0,1); return x*x*(3-2*x); }
function curve(t,keys) {
  for(let i=1;i<keys.length;i++) {
    if(t<=keys[i][0]) return mix(keys[i-1][1],keys[i][1],smooth(keys[i-1][0],keys[i][0],t));
  }
  return keys.at(-1)[1];
}

export function pose(arm,t) {
  for (const f of arm.flights) {
    f.part.visible=t>=f.start;
    if (!f.part.visible) continue;
    const remaining=1-smooth(f.start,f.end,t);
    f.part.position.copy(f.rest).addScaledVector(f.offset,remaining);
    f.part.rotation.set(f.angles.x+remaining*f.rotation.x,f.angles.y+remaining*f.rotation.y,f.angles.z+remaining*f.rotation.z);
  }
  const lift=curve(t,[[0,40.3],[16.23,40.3],[17.74,50.5],[18.65,52.7],[19.96,64.1]]);
  const upper=curve(t,[[0,190],[16.23,190],[17.68,204],[18.72,205],[19.96,216]]);
  arm.lift.rotation.z=rad(lift);
  arm.elbow.rotation.z=rad(upper-lift);
  const swivel=smooth(16.20,17.93,t);
  arm.carriage.rotation.y=rad(-62*swivel);
  arm.carriage.getWorldQuaternion(arm.wristOrigin.quaternion).invert();
  arm.backDrive.rotation.z+=rad(12*swivel);
  const sweep=curve(t,[[0,-4],[16.04,-4],[16.60,-28],[17.36,-81],[17.92,-86],[18.50,-86],[19.04,-81],[19.96,-72]]);
  arm.wristYaw.rotation.y=rad(sweep);
  arm.wristPitch.rotation.z=rad(curve(t,[[0,-25],[16.13,-25],[17.39,-21],[18.22,-18],[19.08,-15],[19.96,-11]]));
  arm.toolAxis.rotation.order='YXZ';
  arm.toolAxis.rotation.y=rad(curve(t,[[0,0],[16.18,0],[17.35,-17],[18.26,-21],[18.87,-22],[19.96,-15]]));
  arm.toolAxis.rotation.x=rad(curve(t,[[0,0],[16.18,0],[17.35,23],[18.31,64],[18.81,71],[19.96,12]]));
  arm.toolAxis.rotation.z=rad(11-7*swivel);
  for(const {pivot,sign} of arm.jaws) {
    const opening=curve(t,[[0,6],[14.54,6],[15.51,-2.3],[16.16,.5],[17.31,-5],[17.95,11.8],[18.80,14.5],[19.96,-4.5]]);
    pivot.rotation.z=sign*rad(opening);
  }
}

export function setCamera(camera,t) {
  const follow=smooth(1.05,14.4,t);
  // The perspective starts above the spindle and lowers almost to the plate.
  // A narrowing orbit reveals the full profile as the camera pulls out.
  const yaw=rad(mix(-44.7,-2.2,smooth(.84,13.37,t)));
  const pitch=rad(mix(24.8,3.1,smooth(1.05,12.45,t)));
  const height=curve(t,[[0,3.84],[1.32,3.84],[3.0,4.30],[5.6,5.20],[9.4,5.48],[14.5,5.70],[16.1,5.72],[19.96,6.42]]);
  const y=curve(t,[[0,.62],[1.40,.62],[3.6,1.26],[5.5,1.79],[8.75,2.12],[12.60,2.30],[16.2,2.30],[19.96,2.44]]);
  const x=curve(t,[[0,0],[5,0],[11,.07],[15,.06],[19.96,.03]]);
  camera.fov=10.4;
  const d=height/(2*Math.tan(rad(camera.fov/2)));
  camera.position.set(x+d*Math.sin(yaw)*Math.cos(pitch),y+d*Math.sin(pitch),d*Math.cos(yaw)*Math.cos(pitch));
  camera.lookAt(x,y,0);
  camera.updateProjectionMatrix();
  return follow;
}
