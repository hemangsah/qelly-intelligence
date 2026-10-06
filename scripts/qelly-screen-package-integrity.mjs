import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {basename,join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
export async function verifyScreenPackageIntegrity(directory,expectedSha){
  const checks=JSON.parse(await readFile(join(directory,'checksums.json'),'utf8'));
  if(!/^[0-9a-f]{40}$/.test(expectedSha||'')||checks.commitSha!==expectedSha)throw Error('Screen checksum commit mismatch');
  if(checks.files?.['checksums.json']||JSON.stringify(checks.excludedFiles)!=='["checksums.json"]')throw Error('Invalid checksum self-reference boundary');
  const names=Object.keys(checks.files||{});if(!names.length)throw Error('Empty screen checksum manifest');
  const failures=[];
  for(const name of names){
    if(name!==basename(name)||name==='.'||name==='..'||! /^[0-9a-f]{64}$/.test(checks.files[name]))throw Error('Invalid screen checksum entry');
    const actual=createHash('sha256').update(await readFile(join(directory,name))).digest('hex');
    if(actual!==checks.files[name])failures.push(name);
  }
  if(failures.length)throw Error('Screen evidence checksum mismatch: '+failures.join(', '));
  return {commitSha:expectedSha,filesChecked:names.length,passed:true};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)console.log(JSON.stringify(await verifyScreenPackageIntegrity('preview/release-a5-all-screens',process.env.QELLY_SCREEN_EVIDENCE_SHA)));
