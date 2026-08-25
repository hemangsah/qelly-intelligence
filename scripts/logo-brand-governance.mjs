import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
const required=[
'apps/web/public/assets/brand/qelly-logo-primary.svg',
'apps/web/public/assets/brand/qelly-logo-dark.svg',
'apps/web/public/assets/brand/qelly-logo-light.svg',
'apps/web/public/assets/brand/qelly-symbol.svg',
'apps/web/public/assets/brand/qelly-symbol-small.svg',
'apps/web/public/favicon.svg','apps/web/public/favicon.ico','apps/web/public/apple-touch-icon.png',
'apps/web/public/icons/qelly-192.png','apps/web/public/icons/qelly-512.png','apps/web/public/icons/qelly-maskable-512.png',
'apps/web/public/manifest.webmanifest','apps/web/public/assets/qelly-brand.css','apps/web/public/assets/qelly-brand.mjs',
'design/brand/QELLY_LOGO_TOKENS.json','design/brand/QELLY_LOGO_STANDARD.md'
];
const failures=[];
for(const file of required){try{const s=await stat(path.join(root,file));if(!s.isFile()||s.size===0)failures.push(`${file}: empty`)}catch{failures.push(`${file}: missing`)}}
const svgFiles=required.filter((f)=>f.endsWith('.svg'));
for(const file of svgFiles){
 const source=await readFile(path.join(root,file),'utf8');
 if(!source.includes('<svg')||!source.includes('viewBox='))failures.push(`${file}: invalid SVG root`);
 if(/<script|on\w+\s*=|foreignObject|(?:href|src)\s*=\s*[\"']https?:\/\/|data:text\/html/i.test(source))failures.push(`${file}: unsafe SVG content`);
 const ids=[...source.matchAll(/\\bid="([^"]+)"/g)].map((m)=>m[1]);
 if(new Set(ids).size!==ids.length)failures.push(`${file}: duplicate IDs`);
}
const index=await readFile(path.join(root,'apps/web/public/index.html'),'utf8');
const fontGovernance=await readFile(path.join(root,'apps/web/public/assets/qelly-font-governance.css'),'utf8');
for(const needle of ['./assets/qelly-brand.css','./assets/qelly-brand.mjs','./manifest.webmanifest','./favicon.svg'])if(!index.includes(needle))failures.push(`index missing ${needle}`);
if(!fontGovernance.includes('ibm-plex-sans-variable.woff2'))failures.push('IBM Plex self-hosted source missing');
if(/fonts\.googleapis|use\.typekit|https?:\/\/[^\"']+\\.(?:woff2?|ttf|otf)/i.test(index))failures.push('external font request detected');
const moduleSource=await readFile(path.join(root,'apps/web/public/assets/qelly-brand.mjs'),'utf8');
for(const needle of ['prefers-reduced-motion','sessionStorage','qelly.brand.opening.v1','data-qelly-brand-hero'])if(!moduleSource.includes(needle))failures.push(`brand runtime missing ${needle}`);
const manifest=JSON.parse(await readFile(path.join(root,'apps/web/public/manifest.webmanifest'),'utf8'));
if(!manifest.icons?.some((item)=>item.purpose==='maskable'))failures.push('maskable manifest icon missing');
const pngChecks=[['apps/web/public/apple-touch-icon.png',180,180],['apps/web/public/icons/qelly-192.png',192,192],['apps/web/public/icons/qelly-512.png',512,512],['apps/web/public/icons/qelly-maskable-512.png',512,512]];
for(const [file,w,h] of pngChecks){const data=await readFile(path.join(root,file));if(data.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')failures.push(`${file}: invalid PNG`);else if(data.readUInt32BE(16)!==w||data.readUInt32BE(20)!==h)failures.push(`${file}: expected ${w}x${h}`)}
if(failures.length){console.error(JSON.stringify({result:'failed',failures},null,2));process.exit(1)}
console.log(JSON.stringify({result:'passed',requiredFiles:required.length,svgFiles:svgFiles.length,ibmPlexLocked:true,externalFontRequests:0},null,2));
