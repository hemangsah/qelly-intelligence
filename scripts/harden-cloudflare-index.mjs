import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

export function isValidSupabasePublishableKey(value,projectReference=''){
  const key=String(value||'').trim();
  if(!key||key===String(projectReference||'').trim())return false;
  if(/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(key))return true;
  const parts=key.split('.');
  return parts.length===3&&parts.every((part)=>/^[A-Za-z0-9_-]+$/.test(part)&&part.length>=16)&&key.length>=100;
}

const inlineScripts=(html)=>[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter((match)=>!/(?:^|\s)src\s*=/.test(match[1])&&match[2].trim());

export function hardenIndexHtml(source){
  let html=String(source);
  const themePattern=/<script>\s*\(\(\)=>\{[\s\S]*?root\.dataset\.themeReady='true';[\s\S]*?<\/script>/;
  const readinessPattern=/<script type="module">\s*const root=document\.documentElement;[\s\S]*?finally\{reveal\(\);\}\s*<\/script>/;
  if(!themePattern.test(html))throw new Error('Qelly prepaint inline bootstrap was not found');
  if(!readinessPattern.test(html))throw new Error('Qelly app-ready inline bootstrap was not found');
  html=html.replace(themePattern,'<script src="./assets/qelly-prepaint-bootstrap.js"></script>');
  html=html.replace(readinessPattern,'');
  const configScript='  <script src="./qelly-config.js"></script>';
  const readyScript='  <script type="module" src="./assets/qelly-app-ready.mjs"></script>';
  if(!html.includes(configScript))throw new Error('Qelly runtime config script was not found');
  if(!html.includes(readyScript))html=html.replace(configScript,`${configScript}\n${readyScript}`);
  if(inlineScripts(html).length)throw new Error('CSP-incompatible inline JavaScript remains in the public runtime index');
  if(html.indexOf(readyScript)>html.indexOf('src="./assets/app.js"'))throw new Error('Qelly app-ready guard must execute before the application module');
  return html;
}

export async function hardenCloudflareBuild({environment=process.env}={}){
  const output=path.join(root,'dist/frontend');
  const indexPath=path.join(output,'index.html');
  const requirePublicRuntime=environment.QELLY_REQUIRE_PUBLIC_RUNTIME==='true';
  const githubPagesMirror=environment.QELLY_GITHUB_PAGES_MIRROR==='true';
  // Cloudflare runtime embeds a browser-safe Supabase publishable key because
  // auth is brokered through its same-origin facade. The GitHub Pages mirror
  // deliberately contains no Supabase credential and calls only the canonical
  // Cloudflare public API, so the key check does not apply there.
  if(requirePublicRuntime&&!githubPagesMirror){
    const supabaseUrl=new URL(String(environment.QELLY_PUBLIC_SUPABASE_URL||''));
    const projectReference=supabaseUrl.hostname.split('.')[0];
    const key=String(environment.QELLY_PUBLIC_SUPABASE_PUBLISHABLE_KEY??environment.QELLY_PUBLIC_SUPABASE_ANON_KEY??'');
    if(!isValidSupabasePublishableKey(key,projectReference)){
      throw new Error('QELLY_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be a real browser-safe publishable or legacy anon key, not the Supabase project reference');
    }
  }
  const source=await readFile(indexPath,'utf8');
  const hardened=hardenIndexHtml(source);
  await writeFile(indexPath,hardened);
  return {status:'cloudflare-index-hardened',indexPath:path.relative(root,indexPath),inlineScripts:0,githubPagesMirror};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  console.log(JSON.stringify(await hardenCloudflareBuild(),null,2));
}
