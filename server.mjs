import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mp4':'video/mp4','.m4a':'audio/mp4','.wav':'audio/wav','.ttf':'font/ttf','.webp':'image/webp','.txt':'text/plain'};
const port=Number(process.env.PORT||4173);
http.createServer((req,res)=>{
  let file;
  try {
    const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const isAsset=/^\/assets\/(?:[\w-]+\/)*[\w.-]+$/.test(name)&&Object.hasOwn(types,path.extname(name));
    if (!isAsset&&!['/','/index.html','/robotic-arm.mp4'].includes(name)) { res.writeHead(404).end(); return; }
    file=path.join(root,name==='/'?'index.html':name.slice(1));
    const stat=fs.statSync(file);
    const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    const start=range?Number(range[1]):0, end=range?.[2]?Math.min(Number(range[2]),stat.size-1):stat.size-1;
    if (start>end) {res.writeHead(416,{'Content-Range':'bytes */'+stat.size}).end();return;}
    const headers={'Content-Type':types[path.extname(file)],'Content-Length':end-start+1,'Accept-Ranges':'bytes'};
    if(range) headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;
    res.writeHead(range?206:200,headers);
    fs.createReadStream(file,{start,end}).on('error',()=>res.destroy()).pipe(res);
  } catch { res.writeHead(404).end(); }
}).listen(port,'127.0.0.1',()=>console.log(`http://127.0.0.1:${port}`));
