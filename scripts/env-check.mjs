import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const example=await readFile(path.join(root,'.env.example'),'utf8');
const requiredSafety=['QELLY_LIVE_TRADING_ENABLED=false','QELLY_ASSET_TRANSFERS_ENABLED=false','QELLY_WITHDRAWALS_ENABLED=false','QELLY_PRIVATE_KEYS_ENABLED=false','QELLY_RECOVERY_PHRASES_ENABLED=false'];
const missingSafety=requiredSafety.filter(value=>!example.includes(value));
const production=process.env.NODE_ENV==='production';
const value=(key)=>String(process.env[key]??'').trim();
const placeholder=(input)=>!input||/replace|example|changeme|localhost/i.test(input);
const requiredProduction=['DATABASE_URL','REDIS_URL','QELLY_SESSION_SECRET','QELLY_PASSWORD_PEPPER','QELLY_SECRET_KEYRING_JSON','QELLY_SECRET_ACTIVE_KEY_ID','S3_ENDPOINT','S3_BUCKET','S3_REGION','S3_ACCESS_KEY_ID','S3_SECRET_ACCESS_KEY','CLAMAV_HOST','QELLY_WEBHOOK_SIGNING_SECRET','QELLY_EMAIL_API_URL','QELLY_EMAIL_API_TOKEN','QELLY_OUTBOUND_ALLOWED_ORIGINS','QELLY_WEBAUTHN_RP_ID','QELLY_WEBAUTHN_ORIGINS'];
const missingProduction=production?requiredProduction.filter(key=>placeholder(value(key))):[];
const requiredModes={QELLY_DATABASE_MODE:'postgres',QELLY_JOB_QUEUE_MODE:'redis',QELLY_OBJECT_STORAGE_MODE:'s3',QELLY_MALWARE_SCANNER_MODE:'clamav',QELLY_DELIVERY_MODE:'external'};
const invalidProductionModes=production?Object.entries(requiredModes).filter(([key,expected])=>value(key)!==expected).map(([key,expected])=>`${key}=${expected}`):[];
const forbiddenProductionFlags=['QELLY_ALLOW_SQLITE_IN_PRODUCTION','QELLY_ALLOW_DATABASE_QUEUE_IN_PRODUCTION','QELLY_ALLOW_LOCAL_OBJECT_STORAGE_IN_PRODUCTION','QELLY_ALLOW_FOUNDATION_SCANNER_IN_PRODUCTION','QELLY_ALLOW_LOCAL_DELIVERY_IN_PRODUCTION','QELLY_OUTBOUND_ALLOW_PRIVATE','QELLY_OUTBOUND_ALLOW_HTTP'];
const unsafeProductionOverrides=production?forbiddenProductionFlags.filter(key=>value(key)==='true'):[];
const unsafeEnabled=['QELLY_LIVE_TRADING_ENABLED','QELLY_ASSET_TRANSFERS_ENABLED','QELLY_WITHDRAWALS_ENABLED','QELLY_PRIVATE_KEYS_ENABLED','QELLY_RECOVERY_PHRASES_ENABLED'].filter(key=>value(key)==='true');
let keyringError=null;
if(production&&!missingProduction.includes('QELLY_SECRET_KEYRING_JSON')){
  try{const keys=JSON.parse(value('QELLY_SECRET_KEYRING_JSON'));if(!keys||typeof keys!=='object'||Array.isArray(keys)||!Object.keys(keys).length)keyringError='QELLY_SECRET_KEYRING_JSON must contain at least one key';if(!Object.hasOwn(keys,value('QELLY_SECRET_ACTIVE_KEY_ID')))keyringError='QELLY_SECRET_ACTIVE_KEY_ID must exist in QELLY_SECRET_KEYRING_JSON';}
  catch{keyringError='QELLY_SECRET_KEYRING_JSON must be valid JSON';}
}
const failures={missingSafety,missingProduction,invalidProductionModes,unsafeProductionOverrides,unsafeEnabled,keyringError:keyringError?[keyringError]:[]};
if(Object.values(failures).some(items=>items.length)){console.error(JSON.stringify({status:'environment-invalid',production,...failures},null,2));process.exit(1);}
console.log(JSON.stringify({status:'environment-valid',production,strictProductionDependencies:production,publicMarketData:process.env.QELLY_PUBLIC_MARKET_DATA_ENABLED??'configured-by-env-file',safetyFlags:'disabled'},null,2));
