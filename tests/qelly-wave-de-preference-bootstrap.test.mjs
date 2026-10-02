import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('new authenticated workspaces get finite first-paint preferences without converting API failures into sign-in',async()=>{
 const app=await readFile(new URL('../apps/web/public/assets/app.js',import.meta.url),'utf8');
 assert.match(app,/const \[layout,overview,identity\]=await Promise\.all/);
 assert.match(app,/if\(!identity\?\.user\|\|!identity\?\.workspace\)throw new Error/);
 assert.match(app,/const persisted=layout&&typeof layout==='object'&&!Array\.isArray\(layout\)\?layout:\{\}/);
 assert.match(app,/Object\.entries\(persisted\)\.filter\(\(\[key,value\]\)=>Object\.hasOwn\(defaultPreferences,key\)&&value!=null\)/);
 assert.match(app,/state\.prefs=\{\.\.\.defaultPreferences/);
 assert.match(app,/state\.overview=overview\?\?anonymousOverview/);
 assert.match(app,/state\.authenticated=true/);
 assert.doesNotMatch(app,/\[state\.prefs,state\.overview,state\.identity\]=await Promise\.all/);
});
