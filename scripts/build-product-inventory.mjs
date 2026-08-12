import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { routes, apiRoutes, productVersion } from '../src/server/route-manifest.mjs';
import {classifyApiContractAccess} from '../src/server/api-access-policy.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'artifacts');await mkdir(out,{recursive:true});
const registry=await import('../apps/web/public/assets/route-registry.mjs');
const routeRows=registry.routeDefinitions.map((item,index)=>({index:index+1,route:item.route,label:item.label,section:item.section,public:Boolean(item.public),implementation:'runnable-route'}));
const apiRows=apiRoutes.map((route,index)=>({index:index+1,route,access:classifyApiContractAccess(route),implementation:'documented-contract'}));
await writeFile(path.join(out,'QELLY_ROUTE_INVENTORY.json'),JSON.stringify({productVersion,count:routeRows.length,items:routeRows},null,2)+'\n');
await writeFile(path.join(out,'QELLY_API_INVENTORY.json'),JSON.stringify({productVersion,count:apiRows.length,items:apiRows},null,2)+'\n');
const csv=(rows,columns)=>[columns.join(','),...rows.map(row=>columns.map(key=>`"${String(row[key]??'').replaceAll('"','""')}"`).join(','))].join('\n')+'\n';
await writeFile(path.join(out,'QELLY_ROUTE_INVENTORY.csv'),csv(routeRows,['index','route','label','section','public','implementation']));
await writeFile(path.join(out,'QELLY_API_INVENTORY.csv'),csv(apiRows,['index','route','access','implementation']));
const excludes=new Set(['node_modules','dist','.git','runtime','preview','__pycache__']);
async function walk(dir){const out=[];for(const entry of await readdir(dir,{withFileTypes:true})){if(excludes.has(entry.name))continue;const full=path.join(dir,entry.name);if(entry.isDirectory())out.push(...await walk(full));else out.push(path.relative(root,full).replaceAll('\\','/'));}return out;}
const tree=(await walk(root)).sort();await writeFile(path.join(out,'QELLY_SOURCE_TREE.txt'),tree.join('\n')+'\n');
console.log(JSON.stringify({status:'product-inventory-written',productVersion,routes:routeRows.length,apiContracts:apiRows.length,sourceFiles:tree.length},null,2));
