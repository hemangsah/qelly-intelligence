import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const builtIndex=path.join(root,'dist/frontend/index.html');
const sourceIndex=path.join(root,'apps/web/public/index.html');
const marker='data-qelly-v53-forced-legacy-evidence="true"';
const injection=`<script ${marker}>document.documentElement.setAttribute('data-ui-lock-v5-3','active');document.documentElement.dataset.v53ForcedLegacyEvidence='true';</script>`;

export async function forceLegacyV53OnBuiltFrontend({enabled=process.env.QELLY_V53_FORCE_LEGACY_EVIDENCE==='true'}={}){
  if(!enabled)throw new Error('Refusing to force the legacy V5.3 contract without QELLY_V53_FORCE_LEGACY_EVIDENCE=true.');

  const [built,source]=await Promise.all([readFile(builtIndex,'utf8'),readFile(sourceIndex,'utf8')]);
  if(source.includes(marker)||source.includes("setAttribute('data-ui-lock-v5-3','active')")){
    throw new Error('Source index unexpectedly contains the evidence-only legacy activation marker. Product source must remain untouched.');
  }
  if(built.includes(marker))return {changed:false,path:path.relative(root,builtIndex),marker};
  if(!built.includes('<head>'))throw new Error('Built frontend index is missing <head>; refusing ambiguous evidence mutation.');

  const mutated=built.replace('<head>',`<head>\n  ${injection}`);
  await writeFile(builtIndex,mutated,'utf8');
  return {changed:true,path:path.relative(root,builtIndex),marker};
}

if(path.resolve(process.argv[1]||'')===fileURLToPath(import.meta.url)){
  const result=await forceLegacyV53OnBuiltFrontend();
  process.stdout.write(`${JSON.stringify({schemaVersion:1,...result,evidenceBoundary:'dist/frontend only; repository product source is not modified'},null,2)}\n`);
}
