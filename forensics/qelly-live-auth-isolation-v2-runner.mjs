import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';

const sourcePath=path.resolve('forensics/qelly-live-auth-isolation.mjs');
const outputPath=path.resolve('forensics/.generated-qelly-live-auth-isolation-98a88.mjs');
let source=await readFile(sourcePath,'utf8');
source=source.replace("const EXPECTED_RELEASE='150025b9662404e5f98cd397c74c5d8be386460c';","const EXPECTED_RELEASE='98a88d76bbba1017a40012aa2790213af6af485a';");
source=source.replace("domains?.['hydra:member']||[]","Array.isArray(domains)?domains:(domains?.['hydra:member']||domains?.member||domains?.items||domains?.domains||[])");
source=source.replace("listing?.['hydra:member']||[]","Array.isArray(listing)?listing:(listing?.['hydra:member']||listing?.member||listing?.items||listing?.messages||[])");
source=source.replace("const before=(await mailFetch('/messages?page=1',{token:user.mailbox.token}))?.['hydra:member']||[];","const beforeCollection=await mailFetch('/messages?page=1',{token:user.mailbox.token});\n  const before=Array.isArray(beforeCollection)?beforeCollection:(beforeCollection?.['hydra:member']||beforeCollection?.member||beforeCollection?.items||beforeCollection?.messages||[]);");
source=source.replace(".replace(/[),.;]+$/,'')",".replace(/[\\]),.;]+$/,'')");
source=source.replace("user.userId=registration.data.user?.id;","user.userId=registration.data.user?.id;\n  results.cleanup.userIds=[...new Set([...(results.cleanup.userIds||[]),user.userId].filter(Boolean))];");
if(!source.includes("const EXPECTED_RELEASE='98a88d76bbba1017a40012aa2790213af6af485a';"))throw new Error('expected_release_patch_failed');
if(!source.includes(".replace(/[\\]),.;]+$/,''"))throw new Error('mail_link_normalization_patch_failed');
await writeFile(outputPath,source);
await import(pathToFileURL(outputPath).href);
