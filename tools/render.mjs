// Render with CHROME_PATH and FFMPEG_PATH set to the local executables.
// Pass timestamps to inspect individual frames, or no arguments for the film.
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL,fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const times=process.argv.slice(2).map(Number);
const w=times.length?1000:1920, h=times.length?562:1080, fps=30, count=599;
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH,headless:true,
  userDataDir:path.join(root,'.work','capture-profile'),protocolTimeout:180000,
  args:['--no-first-run','--disable-extensions','--disable-background-networking','--use-angle=d3d11','--enable-webgl','--ignore-gpu-blocklist']});
let encoder;
try {
  const page=await browser.newPage();
  page.on('pageerror',e=>console.error(e));
  page.on('console',message=>{if(message.type()==='error')console.error(message.text());});
  await page.setViewport({width:w,height:h,deviceScaleFactor:1});
  await page.goto(pathToFileURL(path.join(root,'index.html')).href+'?capture');
  await page.waitForFunction(()=>!!window.armCapture,{timeout:90000});
  await page.evaluate(([w,h])=>window.armCapture.resize(w,h,1),[w,h]);
  const frame=async t=>{
    const data=await page.evaluate(([t,film])=>{
      const glCanvas=document.querySelector('canvas');
      if(!film) {
        window.armCapture.draw(t);
        return glCanvas.toDataURL('image/jpeg',.975).split(',')[1];
      }
      // Three exposures over a 180-degree shutter keep the entering screws
      // and sweeping gripper legible without strobing on the moving edges.
      const target=window.shutterBuffer??=Object.assign(document.createElement('canvas'),{width:glCanvas.width,height:glCanvas.height});
      const ctx=target.getContext('2d',{alpha:false});
      for(let j=0;j<3;j++) {
        window.armCapture.draw(t+(j-1)/180);
        ctx.globalAlpha=1/(j+1);ctx.drawImage(glCanvas,0,0);
      }
      ctx.globalAlpha=1;
      return target.toDataURL('image/jpeg',.975).split(',')[1];
    },[t,!times.length]);
    return Buffer.from(data,'base64');
  };
  if(times.length) {
    await mkdir(path.join(root,'.work'),{recursive:true});
    for(const t of times) await writeFile(path.join(root,'.work','test-'+t+'.jpg'),await frame(t));
    console.log(await page.evaluate(()=>window.armCapture.info()));
  } else {
    const output=path.join(root,'.work',`render-${randomUUID()}.mp4`);
    encoder=spawn(process.env.FFMPEG_PATH||'ffmpeg',['-y','-hide_banner','-loglevel','warning',
      '-f','image2pipe','-framerate',String(fps),'-vcodec','mjpeg','-i','pipe:0',
      '-i',path.join(root,'assets','mechanism.m4a'),'-map','0:v','-map','1:a','-c:v','libx264','-preset','medium','-crf','16',
      '-vf','scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p',
      '-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-c:a','copy',
      '-movflags','+faststart',output],{stdio:['pipe','ignore','inherit']});
    const finished=once(encoder,'close');
    for(let i=0;i<count;i++) {
      if(!encoder.stdin.write(await frame(i/fps))) await once(encoder.stdin,'drain');
      if(i%60===0) console.log(`Frame ${i+1}/${count}`);
    }
    encoder.stdin.end();
    const [code]=await finished;
    if(code!==0) throw new Error('Video encoder exited with code '+code);
    await rename(output,path.join(root,'robotic-arm.mp4'));
  }
} finally {
  if(encoder&&encoder.exitCode===null) encoder.kill();
  await browser.close();
}
