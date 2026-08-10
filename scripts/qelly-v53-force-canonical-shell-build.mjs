import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const builtConfig=path.join(root,'dist/frontend/qelly-config.js');
const sourceConfig=path.join(root,'apps/web/public/qelly-config.js');
const sourceToken='staticVisualPreview:true';
const evidenceToken='staticVisualPreview:false';
const marker='qelly-v53-canonical-shell-evidence';

export async function forceCanonicalShellOnBuiltFrontend({enabled=process.env.QELLY_V53_CANONICAL_SHELL_EVIDENCE==='true'}={}){
  if(!enabled)throw new Error('Refusing canonical-shell evidence mutation without QELLY_V53_CANONICAL_SHELL_EVIDENCE=true.');
  const [built,source]=await Promise.all([readFile(builtConfig,'utf8'),readFile(sourceConfig,'utf8')]);
  if(!source.includes(sourceToken))throw new Error('Source qelly-config.js no longer exposes the expected staticVisualPreview:true fallback contract.');
  if(source.includes(marker)||source.includes(evidenceToken))throw new Error('Source qelly-config.js already contains canonical-shell evidence state; product source must remain untouched.');
  if(built.includes(marker))return {changed:false,path:path.relative(root,builtConfig),marker};
  if(!built.includes(sourceToken))throw new Error('Built qelly-config.js does not contain the expected static preview token; refusing ambiguous mutation.');
  const mutated=built.replace(sourceToken,`${evidenceToken}/* ${marker} */`);
  await writeFile(builtConfig,mutated,'utf8');
  return {changed:true,path:path.relative(root,builtConfig),marker};
}

if(path.resolve(process.argv[1]||'')===fileURLToPath(import.meta.url)){
  const result=await forceCanonicalShellOnBuiltFrontend();
  process.stdout.write(`${JSON.stringify({schemaVersion:1,...result,evidenceBoundary:'dist/frontend/qelly-config.js only; repository product source is not modified'},null,2)}\n`);
}
