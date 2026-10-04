import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
export function validateScreenThemeMatrix(manifest, definitions) {
  const expected=new Set(definitions.flatMap(({route})=>['desktop','mobile'].flatMap(viewport=>['dark','light'].map(appearance=>`${route}/${viewport}/${appearance}`))));
  const renders=Array.isArray(manifest?.renders)?manifest.renders:[];
  const seen=new Set();
  const errors=[];
  for(const item of renders){
    const key=`${item.route}/${item.viewport}/${item.appearance}`;
    if(!expected.has(key))errors.push(`Unexpected render: ${key}`);
    if(seen.has(key))errors.push(`Duplicate render: ${key}`);
    seen.add(key);
    if(item.resolvedAppearance!==item.appearance||item.status!=='passed')errors.push(`Unproven render: ${key}`);
  }
  for(const key of expected)if(!seen.has(key))errors.push(`Missing render: ${key}`);
  if(manifest?.status!=='passed'||manifest?.themeCount!==2||manifest?.viewportCount!==2||manifest?.duplicateCount!==0||manifest?.routeCount!==definitions.length||manifest?.renderCount!==expected.size||manifest?.expectedRenderCount!==expected.size)errors.push('Incomplete theme manifest');
  return {passed:errors.length===0,expectedRenders:expected.size,errors};
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
  const {routeDefinitions}=await import('../apps/web/public/assets/route-registry.mjs');
  const result=validateScreenThemeMatrix(JSON.parse(await readFile('preview/release-a5-all-screens/manifest.json','utf8')),routeDefinitions);
  console.log(JSON.stringify(result,null,2));
  if(!result.passed)process.exitCode=1;
}
