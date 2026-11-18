// Refresh offline component thumbnails directly from the editable model.
import puppeteer from 'puppeteer-core';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const {parts}=JSON.parse(await readFile(new URL('../src/lesson-content.json',import.meta.url),'utf8'));
const folder=path.join(root,'assets','parts');await mkdir(folder,{recursive:true});
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH,headless:true,userDataDir:path.join(root,'.work','illustrate-profile'),
  args:['--no-first-run','--disable-background-networking','--use-angle=d3d11','--enable-webgl','--ignore-gpu-blocklist']});
try{
  const page=await browser.newPage();page.on('pageerror',e=>console.error(e.message));
  await page.goto(new URL('../index.html?illustrate',import.meta.url).href);
  await page.waitForFunction(()=>!!window.atlasIllustrate,{timeout:60000});
  for(const id of [null,...parts.map(p=>p.id)]){
    const url=await page.evaluate(id=>window.atlasIllustrate(id),id);
    await writeFile(path.join(folder,(id||'assembly')+'.webp'),Buffer.from(url.split(',')[1],'base64'));
  }
  console.log('Rendered the assembly and '+parts.length+' component illustrations.');
}finally{await browser.close();}
