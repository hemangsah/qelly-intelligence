import {chromium,request as playwrightRequest} from 'playwright';
import {randomBytes,randomUUID} from 'node:crypto';
import {writeFile,mkdir} from 'node:fs/promises';
import vm from 'node:vm';

const PUBLIC_URL='https://qelly-intelligence.pages.dev';
const EXPECTED_RELEASE='150025b9662404e5f98cd397c74c5d8be386460c';
const MAIL_API='https://api.mail.tm';
const OUT='dist/live-auth-isolation';
const results={observedAt:new Date().toISOString(),publicUrl:PUBLIC_URL,expectedReleaseSha:EXPECTED_RELEASE,mailProvider:'Mail.tm temporary testing only',release:null,auth:{},cloud:{},isolation:{},cleanup:{},screenshots:[],blocker:null};
const secrets=[];
const delay=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
const safeError=(error)=>String(error?.code||error?.message||error||'unknown_error').replace(/https?:\/\/\S+/g,'[URL_REDACTED]').replace(/[A-Za-z0-9_-]{30,}/g,'[TOKEN_REDACTED]').slice(0,500);
const password=()=>`Qe!${randomBytes(18).toString('base64url')}9a`;
const headers=(token)=>({'Accept':'application/json','Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})});

async function mailFetch(path,{method='GET',token,body}={}){
  const response=await fetch(`${MAIL_API}${path}`,{method,headers:headers(token),body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  const text=await response.text();
  const data=text?JSON.parse(text):null;
  if(!response.ok)throw Object.assign(new Error(`mail_${response.status}`),{code:`mail_${response.status}`,data});
  return data;
}

async function createMailbox(label){
  const domains=await mailFetch('/domains?page=1');
  const domain=(domains?.['hydra:member']||[]).find(item=>item.isActive!==false)?.domain;
  if(!domain)throw new Error('mail_domain_unavailable');
  const marker=`qelly-${label}-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`;
  const address=`${marker}@${domain}`;
  const mailPassword=password();
  const account=await mailFetch('/accounts',{method:'POST',body:{address,password:mailPassword}});
  const tokenResult=await mailFetch('/token',{method:'POST',body:{address,password:mailPassword}});
  secrets.push(address,mailPassword,tokenResult.token);
  return {id:account.id,address,password:mailPassword,token:tokenResult.token,seen:new Set()};
}

async function deleteMailbox(mailbox){
  if(!mailbox?.id||!mailbox?.token)return false;
  try{await mailFetch(`/accounts/${mailbox.id}`,{method:'DELETE',token:mailbox.token});return true;}catch{return false;}
}

const extractUrls=(message)=>{
  const text=[message?.text,message?.html,message?.intro].flat(Infinity).filter(Boolean).join('\n').replaceAll('&amp;','&');
  return [...text.matchAll(/https?:\/\/[^\s"'<>]+/g)].map(match=>match[0].replace(/[),.;]+$/,''));
};

async function waitForAuthLink(mailbox,{kind='signup',timeoutMs=150000}={}){
  const started=Date.now();
  while(Date.now()-started<timeoutMs){
    const listing=await mailFetch('/messages?page=1',{token:mailbox.token});
    for(const item of listing?.['hydra:member']||[]){
      if(mailbox.seen.has(item.id))continue;
      mailbox.seen.add(item.id);
      const message=await mailFetch(`/messages/${item.id}`,{token:mailbox.token});
      const urls=extractUrls(message);
      const link=urls.find(url=>{
        try{const parsed=new URL(url);return parsed.hostname==='ssdgfgqnjlwzkgukzeef.supabase.co'&&parsed.pathname==='/auth/v1/verify'&&parsed.searchParams.get('type')===(kind==='recovery'?'recovery':'signup');}catch{return false;}
      });
      if(link)return link;
    }
    await delay(3000);
  }
  throw new Error(`mail_${kind}_timeout`);
}

async function qelly(context,path,{method='GET',body,csrf,expected=[200]}={}){
  const response=await context.request.fetch(`${PUBLIC_URL}${path}`,{method,headers:{Origin:PUBLIC_URL,Accept:'application/json','Content-Type':'application/json',...(csrf?{'X-Qelly-CSRF':csrf}:{})},data:body===undefined?undefined:JSON.stringify(body),timeout:30000});
  const text=await response.text();
  let data={};try{data=text?JSON.parse(text):{};}catch{data={raw:text.slice(0,200)}}
  if(!expected.includes(response.status()))throw Object.assign(new Error(data?.error?.code||`qelly_${response.status()}`),{code:data?.error?.code||`qelly_${response.status()}`,status:response.status(),data});
  return {status:response.status(),data,response};
}

async function fetchRuntimeConfig(){
  const [releaseResponse,configResponse]=await Promise.all([fetch(`${PUBLIC_URL}/qelly-release.json`,{cache:'no-store'}),fetch(`${PUBLIC_URL}/qelly-config.js`,{cache:'no-store'})]);
  const release=await releaseResponse.json();
  if(release.releaseSha!==EXPECTED_RELEASE)throw new Error('release_sha_mismatch');
  const source=await configResponse.text(),sandbox={window:{}};
  vm.runInNewContext(source,sandbox,{timeout:1000});
  const config=sandbox.window.__QELLY_CONFIG__||{};
  const key=String(config.supabase?.publishableKey||'');
  if(!key||key==='ssdgfgqnjlwzkgukzeef')throw new Error('publishable_key_invalid');
  results.release={releaseSha:release.releaseSha,fallbackReleaseSha:release.fallbackReleaseSha,capabilities:{authentication:release.authentication,cloudSync:release.cloudSync,liveProviders:release.liveProviders,protectedWrites:release.protectedWrites},siteUrl:config.publicSiteUrl,keyShape:{length:key.length,modern:key.startsWith('sb_publishable_'),legacyJwt:key.split('.').length===3,equalsProjectReference:key==='ssdgfgqnjlwzkgukzeef'}};
  return {supabaseUrl:config.supabase.url,key};
}

async function confirmMailboxUser(user,kind='signup'){
  const link=await waitForAuthLink(user.mailbox,{kind});
  const verification=await fetch(link,{redirect:'manual',signal:AbortSignal.timeout(30000)});
  const location=verification.headers.get('location');
  if(!location)throw new Error(`${kind}_redirect_missing`);
  const redirect=new URL(location);
  const expectedPath='/auth/callback.html';
  if(redirect.origin!==PUBLIC_URL||redirect.pathname!==expectedPath)throw new Error(`${kind}_redirect_not_allowlisted`);
  const hash=new URLSearchParams(redirect.hash.replace(/^#/,''));
  const accessToken=hash.get('access_token'),refreshToken=hash.get('refresh_token');
  if(!accessToken||!refreshToken)throw new Error(`${kind}_session_tokens_missing`);
  secrets.push(accessToken,refreshToken,location);
  user.accessToken=accessToken;user.refreshToken=refreshToken;
  if(kind==='signup'){
    await user.page.goto(location,{waitUntil:'domcontentloaded',timeout:45000});
    await user.page.waitForSelector('#qelly-auth-callback[data-state="success"]',{timeout:30000});
    await user.page.screenshot({path:`${OUT}/${user.label}-confirmation.png`,fullPage:true});
    results.screenshots.push(`${user.label}-confirmation.png`);
    await user.page.waitForURL(url=>url.hash.includes('/account-session'),{timeout:30000});
  }else{
    await user.page.goto(location,{waitUntil:'domcontentloaded',timeout:45000});
    await user.page.waitForSelector('#qelly-auth-callback[data-state="ready"]',{timeout:30000});
    await user.page.screenshot({path:`${OUT}/${user.label}-recovery.png`,fullPage:true});
    results.screenshots.push(`${user.label}-recovery.png`);
  }
  return {redirectOrigin:redirect.origin,redirectPath:redirect.pathname,flow:kind,hasAccessToken:true,hasRefreshToken:true};
}

async function createQellyUser(browser,label){
  const mailbox=await createMailbox(label),qellyPassword=password();
  secrets.push(qellyPassword);
  const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'}),page=await context.newPage();
  const user={label,mailbox,password:qellyPassword,context,page};
  await page.goto(`${PUBLIC_URL}/#/auth-register`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForTimeout(1500);
  await page.screenshot({path:`${OUT}/${label}-registration.png`,fullPage:true});results.screenshots.push(`${label}-registration.png`);
  const registration=await qelly(context,'/api/v1/auth/register',{method:'POST',body:{email:mailbox.address,password:qellyPassword,displayName:`Qelly ${label.toUpperCase()} Test`,workspaceName:`Qelly ${label.toUpperCase()} Workspace`,baseCurrency:'USD',timezone:'Asia/Kolkata'},expected:[202]});
  if(registration.data.verificationRequired!==true)throw new Error('email_confirmation_not_required');
  user.userId=registration.data.user?.id;
  const confirmation=await confirmMailboxUser(user,'signup');
  const config=await qelly(context,'/api/v1/config');
  const status=await qelly(context,'/api/v1/auth/status');
  if(!status.data.authenticated||!config.data.auth.authenticated||!config.data.csrf?.token)throw new Error('confirmed_session_invalid');
  user.csrf=config.data.csrf.token;user.userId=status.data.context.user.userId;user.workspaceId=status.data.context.workspace.workspaceId;
  await page.goto(`${PUBLIC_URL}/#/account-session`,{waitUntil:'domcontentloaded',timeout:45000});await page.waitForTimeout(1500);
  await page.screenshot({path:`${OUT}/${label}-account.png`,fullPage:true});results.screenshots.push(`${label}-account.png`);
  return {user,confirmation,contextSummary:{userId:user.userId,workspaceId:user.workspaceId,emailConfirmed:Boolean(status.data.context.user.emailConfirmedAt),profile:Boolean(status.data.context.profile),workspace:Boolean(status.data.context.workspace)}};
}

async function directSupabase(runtime,token,path,{method='GET',body,prefer}={}){
  const response=await fetch(`${runtime.supabaseUrl}/rest/v1/${path}`,{method,headers:{apikey:runtime.key,Authorization:`Bearer ${token}`,Accept:'application/json','Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  const text=await response.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text.slice(0,200)}
  return {status:response.status,ok:response.ok,data};
}

async function passwordToken(runtime,user,passwordValue=user.password){
  const response=await fetch(`${runtime.supabaseUrl}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:runtime.key,Authorization:`Bearer ${runtime.key}`,'Content-Type':'application/json'},body:JSON.stringify({email:user.mailbox.address,password:passwordValue}),signal:AbortSignal.timeout(30000)});
  const data=await response.json();
  if(!response.ok||!data.access_token)throw new Error(`direct_login_${response.status}`);
  secrets.push(data.access_token,data.refresh_token);
  return data;
}

async function refreshCsrf(user){
  const config=await qelly(user.context,'/api/v1/config');
  user.csrf=config.data.csrf?.token;
  if(!user.csrf)throw new Error('csrf_missing');
  return config.data;
}

async function verifyAuthLifecycle(runtime,user){
  const anonymous=await playwrightRequest.newContext({baseURL:PUBLIC_URL,extraHTTPHeaders:{Origin:PUBLIC_URL,Accept:'application/json','Content-Type':'application/json'}});
  const invalid=await anonymous.post('/api/v1/auth/login',{data:JSON.stringify({email:user.mailbox.address,password:'Wrong!Password12345'}),headers:{'Content-Type':'application/json'}});
  const invalidBody=await invalid.json().catch(()=>({}));
  await anonymous.dispose();
  if(invalid.status()!==400&&invalid.status()!==401)throw new Error(`invalid_login_status_${invalid.status()}`);
  const restored=await qelly(user.context,'/api/v1/auth/status');
  if(!restored.data.authenticated)throw new Error('session_restore_failed');
  await qelly(user.context,'/api/v1/auth/refresh',{method:'POST',csrf:user.csrf,body:{}});
  await refreshCsrf(user);
  await qelly(user.context,'/api/v1/auth/logout',{method:'POST',csrf:user.csrf,body:{}});
  const loggedOut=await qelly(user.context,'/api/v1/auth/status');
  if(loggedOut.data.authenticated)throw new Error('logout_failed');
  const login=await qelly(user.context,'/api/v1/auth/login',{method:'POST',body:{email:user.mailbox.address,password:user.password}});
  if(!login.data.authenticated)throw new Error('valid_login_failed');
  await refreshCsrf(user);
  const callbackPage=await user.context.newPage();
  await callbackPage.goto(`${PUBLIC_URL}/auth/callback.html`,{waitUntil:'domcontentloaded',timeout:45000});
  await callbackPage.waitForSelector('#qelly-auth-callback[data-state="error"]',{timeout:15000});
  const invalidCallbackText=await callbackPage.locator('#qelly-auth-callback p').innerText();
  await callbackPage.close();
  return {invalidLoginDenied:true,invalidLoginCode:invalidBody?.error?.code||null,sessionRestored:true,refreshPassed:true,logoutPassed:true,reloginPassed:true,invalidCallbackHandled:/incomplete/i.test(invalidCallbackText)};
}

async function verifyRecovery(runtime,user){
  const before=(await mailFetch('/messages?page=1',{token:user.mailbox.token}))?.['hydra:member']||[];
  for(const item of before)user.mailbox.seen.add(item.id);
  const requestResult=await qelly(user.context,'/api/v1/auth/recovery/request',{method:'POST',body:{email:user.mailbox.address},expected:[200]});
  if(!requestResult.data.accepted)throw new Error('recovery_request_failed');
  const recovery=await confirmMailboxUser(user,'recovery');
  const config=await refreshCsrf(user),newPassword=password();secrets.push(newPassword);
  await qelly(user.context,'/api/v1/auth/recovery/reset',{method:'POST',csrf:config.csrf.token,body:{newPassword}});
  const revoked=await qelly(user.context,'/api/v1/auth/status');
  if(revoked.data.authenticated)throw new Error('recovery_session_not_revoked');
  const oldDirect=await fetch(`${runtime.supabaseUrl}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:runtime.key,Authorization:`Bearer ${runtime.key}`,'Content-Type':'application/json'},body:JSON.stringify({email:user.mailbox.address,password:user.password}),signal:AbortSignal.timeout(30000)});
  if(oldDirect.ok)throw new Error('old_password_still_valid');
  user.password=newPassword;
  const login=await qelly(user.context,'/api/v1/auth/login',{method:'POST',body:{email:user.mailbox.address,password:newPassword}});
  if(!login.data.authenticated)throw new Error('recovery_new_login_failed');
  await refreshCsrf(user);
  return {requestAccepted:true,redirect:recovery,newPasswordLogin:true,oldPasswordDenied:true,priorSessionRevoked:true};
}

async function verifyCloudLifecycle(user){
  const status0=await qelly(user.context,'/api/v1/cloud/status');
  if(status0.data.optIn!==false)throw new Error('cloud_default_not_opt_out');
  await qelly(user.context,'/api/v1/cloud/opt-in',{method:'POST',csrf:user.csrf,body:{enabled:true}});
  const status1=await qelly(user.context,'/api/v1/cloud/status');
  if(status1.data.optIn!==true)throw new Error('cloud_opt_in_failed');
  const primaryId=randomUUID(),duplicateId=randomUUID(),syncId=randomUUID();
  const baseResult={formulaId:'qelly-live-verification',inputs:{principal:1000,rate:8},value:1080,provenance:{source:'controlled-live-test'}};
  const created=await qelly(user.context,'/api/v1/saved-calculations',{method:'POST',csrf:user.csrf,body:{id:primaryId,name:'Live verification primary',result:baseResult}});
  if(created.status!==201||created.data.item?.id!==primaryId)throw new Error('cloud_create_failed');
  const reopened=await qelly(user.context,`/api/v1/saved-calculations/${primaryId}`);
  await qelly(user.context,`/api/v1/saved-calculations/${primaryId}`,{method:'PATCH',csrf:user.csrf,body:{title:'Live verification renamed',result_payload:{...baseResult,value:1090}}});
  const duplicate=await qelly(user.context,'/api/v1/saved-calculations',{method:'POST',csrf:user.csrf,body:{id:duplicateId,name:'Live verification duplicate',result:baseResult}});
  await qelly(user.context,`/api/v1/saved-calculations/${duplicateId}`,{method:'DELETE',csrf:user.csrf,body:{}});
  await qelly(user.context,`/api/v1/saved-calculations/${duplicateId}/restore`,{method:'POST',csrf:user.csrf,body:{}});
  const revisions=await qelly(user.context,`/api/v1/saved-calculations/${primaryId}/revisions`);
  if(!(revisions.data.items?.length>=2))throw new Error('revision_history_missing');
  const oldest=Math.min(...revisions.data.items.map(item=>item.revision_no));
  await qelly(user.context,`/api/v1/saved-calculations/${primaryId}/revisions/restore`,{method:'POST',csrf:user.csrf,body:{revision:oldest}});
  const syncItem={id:syncId,name:'Live sync queue record',result:{...baseResult,value:1111},updatedAt:new Date().toISOString(),version:1};
  const pushed=await qelly(user.context,'/api/v1/sync/push',{method:'POST',csrf:user.csrf,body:{items:[syncItem]},expected:[200]});
  if(pushed.data.applied!==1)throw new Error('sync_push_failed');
  const pulled=await qelly(user.context,'/api/v1/sync/pull');
  if(!pulled.data.items?.some(item=>item.id===syncId))throw new Error('sync_pull_failed');
  await qelly(user.context,`/api/v1/saved-calculations/${syncId}`,{method:'PATCH',csrf:user.csrf,body:{title:'Server advanced revision'}});
  const conflict=await qelly(user.context,'/api/v1/sync/push',{method:'POST',csrf:user.csrf,body:{items:[{...syncItem,baseCloudRevision:1,name:'Stale offline edit'}]},expected:[200]});
  if(conflict.data.conflicts!==1)throw new Error('sync_conflict_missing');
  const exported=await qelly(user.context,'/api/v1/account/export');
  if(exported.data.schemaVersion!==1||!Array.isArray(exported.data.calculations))throw new Error('account_export_failed');
  await user.page.goto(`${PUBLIC_URL}/#/saved-calculations`,{waitUntil:'domcontentloaded',timeout:45000});await user.page.waitForTimeout(1800);
  await user.page.screenshot({path:`${OUT}/${user.label}-cloud.png`,fullPage:true});results.screenshots.push(`${user.label}-cloud.png`);
  return {defaultOptOut:true,optIn:true,create:true,reopen:reopened.data.item?.id===primaryId,rename:true,duplicate:duplicate.data.item?.id===duplicateId,softDelete:true,restore:true,revisionCount:revisions.data.items.length,revisionRestore:true,syncPush:true,syncPull:true,conflictDetected:true,accountExport:true,recordIds:[primaryId,duplicateId,syncId]};
}

async function verifyIsolation(runtime,a,b){
  const targetId=randomUUID();
  await qelly(a.context,'/api/v1/saved-calculations',{method:'POST',csrf:a.csrf,body:{id:targetId,name:'Tenant A protected record',result:{formulaId:'tenant-test',inputs:{owner:'A'},value:1}}});
  const bRead=await qelly(b.context,`/api/v1/saved-calculations/${targetId}`,{expected:[404]});
  const [aToken,bToken]=await Promise.all([passwordToken(runtime,a),passwordToken(runtime,b)]);
  a.accessToken=aToken.access_token;b.accessToken=bToken.access_token;
  const directRead=await directSupabase(runtime,b.accessToken,`qelly_saved_calculations?select=id,title&id=eq.${targetId}`);
  const directInsert=await directSupabase(runtime,b.accessToken,'qelly_saved_calculations',{method:'POST',prefer:'return=representation',body:{id:randomUUID(),workspace_id:a.workspaceId,owner_id:a.userId,title:'Cross-tenant insert attempt',formula_id:'tenant-test',input_payload:{},result_payload:{value:2},provenance:{controlledTest:true},client_updated_at:new Date().toISOString()}});
  const directUpdate=await directSupabase(runtime,b.accessToken,`qelly_saved_calculations?id=eq.${targetId}`,{method:'PATCH',prefer:'return=representation',body:{title:'Cross-tenant mutation'}});
  const directDelete=await directSupabase(runtime,b.accessToken,`qelly_saved_calculations?id=eq.${targetId}`,{method:'DELETE',prefer:'return=representation'});
  const ownerAfter=await qelly(a.context,`/api/v1/saved-calculations/${targetId}`);
  const readDenied=bRead.status===404&&Array.isArray(directRead.data)&&directRead.data.length===0;
  const insertDenied=!directInsert.ok;
  const updateDenied=!directUpdate.ok||(Array.isArray(directUpdate.data)&&directUpdate.data.length===0);
  const deleteDenied=!directDelete.ok||(Array.isArray(directDelete.data)&&directDelete.data.length===0);
  const ownerPreserved=ownerAfter.data.item?.title==='Tenant A protected record';
  if(!readDenied||!insertDenied||!updateDenied||!deleteDenied||!ownerPreserved)throw new Error('cross_tenant_isolation_failed');
  return {readDenied,insertDenied,updateDenied,deleteDenied,ownerPreserved,targetId,statuses:{apiRead:bRead.status,directRead:directRead.status,directInsert:directInsert.status,directUpdate:directUpdate.status,directDelete:directDelete.status}};
}

async function main(){
  await mkdir(OUT,{recursive:true});
  const runtime=await fetchRuntimeConfig();
  const browser=await chromium.launch({headless:true});
  let a,b;
  try{
    const createdA=await createQellyUser(browser,'user-a');a=createdA.user;
    const createdB=await createQellyUser(browser,'user-b');b=createdB.user;
    results.auth.registration={userA:createdA.contextSummary,userB:createdB.contextSummary};
    results.auth.confirmation={userA:createdA.confirmation,userB:createdB.confirmation};
    results.auth.lifecycle=await verifyAuthLifecycle(runtime,a);
    results.auth.recovery=await verifyRecovery(runtime,a);
    results.cloud.userA=await verifyCloudLifecycle(a);
    results.isolation=await verifyIsolation(runtime,a,b);
    const deletion=await qelly(a.context,'/api/v1/account/delete',{method:'POST',csrf:a.csrf,body:{},expected:[202]});
    results.cloud.accountDeletion={requested:deletion.data.requested===true,status:deletion.data.status,identityDeleted:Boolean(deletion.data.identityDeleted)};
    await qelly(b.context,'/api/v1/auth/logout',{method:'POST',csrf:b.csrf,body:{}});
    results.auth.logoutUserB=true;
    results.cleanup.userIds=[a.userId,b.userId];
    results.cleanup.mailboxes={userA:await deleteMailbox(a.mailbox),userB:await deleteMailbox(b.mailbox)};
    results.completed=true;
  }catch(error){
    results.completed=false;results.blocker={code:safeError(error),stage:Object.keys(results).filter(key=>results[key]&&Object.keys(results[key]).length).join(',')};
    if(a?.userId||b?.userId)results.cleanup.userIds=[a?.userId,b?.userId].filter(Boolean);
    results.cleanup.mailboxes={userA:await deleteMailbox(a?.mailbox),userB:await deleteMailbox(b?.mailbox)};
    throw error;
  }finally{
    await a?.context?.close().catch(()=>{});await b?.context?.close().catch(()=>{});await browser.close().catch(()=>{});
    const output=JSON.stringify(results,null,2);
    for(const secret of secrets.filter(Boolean)){if(output.includes(secret))throw new Error('secret_redaction_failure');}
    await writeFile(`${OUT}/result.json`,output);
    await writeFile(`${OUT}/cleanup-user-ids.json`,JSON.stringify({userIds:results.cleanup.userIds||[]},null,2));
  }
}

main().catch(error=>{console.error(`QELLY_LIVE_AUTH_VERIFICATION_FAILED:${safeError(error)}`);process.exit(1);});
