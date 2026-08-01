import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';

const sourcePath=path.resolve('forensics/qelly-live-auth-isolation.mjs');
const outputPath=path.resolve('forensics/.generated-qelly-live-auth-isolation-v2.mjs');
let source=await readFile(sourcePath,'utf8');
source=source.replace("domains?.['hydra:member']||[]","domains?.['hydra:member']||domains?.member||domains?.items||domains?.domains||[]");
source=source.replace("listing?.['hydra:member']||[]","listing?.['hydra:member']||listing?.member||listing?.items||listing?.messages||[]");
source=source.replace("const before=(await mailFetch('/messages?page=1',{token:user.mailbox.token}))?.['hydra:member']||[];","const beforeCollection=await mailFetch('/messages?page=1',{token:user.mailbox.token});\n  const before=beforeCollection?.['hydra:member']||beforeCollection?.member||beforeCollection?.items||beforeCollection?.messages||[];");
await writeFile(outputPath,source);
await import(pathToFileURL(outputPath).href);
