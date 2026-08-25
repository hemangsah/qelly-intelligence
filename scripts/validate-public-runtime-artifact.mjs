import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'dist/frontend');
const read=(relative)=>readFile(path.join(output,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const required=['qelly-release.json','robots.txt','sitemap.xml','qelly-service-worker.js','support.html','legal/beta.html','legal/risk.html','legal/privacy.html','legal/terms.html','legal/legal.css','assets/qelly-public-runtime.css','assets/qelly-public-runtime.mjs'];
for(const file of required)assert((await stat(path.join(output,file))).isFile(),`Missing Qelly public runtime artifact: ${file}`);

const index=await read('index.html');
assert(index.includes('./assets/qelly-public-runtime.css'),'Public runtime stylesheet not injected');
assert(index.includes('./assets/qelly-public-runtime.mjs'),'Public runtime controller not injected');
const controller=await read('assets/qelly-public-runtime.mjs');
for(const phrase of ['QELLY GLOBAL PUBLIC BETA','Authentication · authorization required','Cloud sync · unavailable','qelly-release.json'])assert(controller.includes(phrase),`Public-beta controller missing: ${phrase}`);

const release=JSON.parse(await read('qelly-release.json'));
assert(/^[0-9a-f]{40}$/i.test(release.releaseSha),'Release identity must contain a full commit SHA');
if(process.env.GITHUB_SHA)assert(release.releaseSha===process.env.GITHUB_SHA,'Release identity does not match exact workflow head');
assert(release.cloudMode==='local-only','Static fallback must remain local-only');
for(const key of ['authentication','cloudSync','liveProviders','protectedWrites'])assert(release[key]===false,`Unverified capability must remain disabled: ${key}`);
assert(release.fallbackUrl==='https://hemangsah.github.io/qelly-intelligence/','Fallback URL truth mismatch');

const buildInfo=JSON.parse(await read('BUILD_INFO.json'));
assert(buildInfo.publicRuntimeEnabled===true,'Public runtime build flag missing');
assert(buildInfo.publicBetaMode==='QELLY GLOBAL PUBLIC BETA','Public runtime product mode missing');
assert(buildInfo.connectedCapabilitiesActivated===false,'Static artifact must not activate connected capabilities');

const robots=await read('robots.txt'),sitemap=await read('sitemap.xml'),serviceWorker=await read('qelly-service-worker.js');
for(const route of ['/api/','/auth/','/account/','/saved-calculations/'])assert(robots.includes(`Disallow: ${route}`),`robots.txt missing private-route exclusion: ${route}`);
assert(!/account|auth|saved-calculations/i.test(sitemap),'Private state must not appear in sitemap');
const shell=serviceWorker.match(/const SHELL=(\[[^;]+\]);/)?.[1]??'';
assert(shell&&!/api|auth|account|saved-calculations|secure-import|quarantine|delivery-operations/i.test(shell),'Offline shell includes private or API state');

const pages=await Promise.all(['legal/beta.html','legal/risk.html','legal/privacy.html','legal/terms.html','support.html'].map(read));
assert(pages.every((page)=>page.includes('QELLY GLOBAL PUBLIC BETA')),'Public policy/support page missing beta identity');
assert(pages.join('\n').includes('does not provide personalized investment'),'Financial-risk boundary missing');
assert(pages.join('\n').includes('Cloud synchronization is off'),'Local-first privacy boundary missing');
assert(pages.join('\n').includes('Protected feedback submission is not active'),'Protected-write authorization boundary missing');

console.log(JSON.stringify({status:'qelly-public-runtime-artifact-passed',releaseSha:release.releaseSha,mode:release.mode,requiredFiles:required.length,connectedCapabilitiesActivated:false,publicUrl:release.fallbackUrl},null,2));
