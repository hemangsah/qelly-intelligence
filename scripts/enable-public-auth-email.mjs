import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const target=path.join(root,'dist/frontend/qelly-config.js');
const disabled=String(process.env.QELLY_ENABLE_AUTH_EMAIL_DELIVERY||'').trim().toLowerCase()==='false';
const publicBuild=process.env.QELLY_REQUIRE_PUBLIC_RUNTIME==='true'||process.env.CF_PAGES==='1'||String(process.env.QELLY_DEPLOYMENT_ENVIRONMENT||'').includes('cloudflare-pages');

if(publicBuild&&!disabled){
  const source=await readFile(target,'utf8');
  const updated=source.replace('"emailDelivery":false','"emailDelivery":true');
  if(updated===source&&!source.includes('"emailDelivery":true'))throw new Error('Generated Qelly runtime config does not expose emailDelivery capability');
  await writeFile(target,updated);
  console.log(JSON.stringify({status:'public-auth-email-enabled'}));
}else{
  console.log(JSON.stringify({status:'public-auth-email-unchanged',publicBuild,disabled}));
}
