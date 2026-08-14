import {mkdir,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';

const PUBLIC_URL=process.env.PUBLIC_URL||'https://qelly-intelligence.pages.dev';
const EXPECTED_RELEASE_SHA=process.env.EXPECTED_RELEASE_SHA||'';
const MAIL_API=process.env.MAIL_API||'https://api.mail.tm';
const evidenceDir='auth-canary-evidence';
const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
const mask=(value)=>{if(value)console.log(`::add-mask::${value}`);};
const json=async(response)=>{
  const text=await response.text();
  if(!text)return null;
  try{return JSON.parse(text);}catch{return {raw:text.slice(0,500)};}
};
const requireStatus=(response,allowed,label)=>{
  if(!allowed.includes(response.status))throw new Error(`${label}_http_${response.status}`);
};

class CookieJar{
  #cookies=new Map();
  absorb(response){
    const values=typeof response.headers.getSetCookie==='function'?response.headers.getSetCookie():[];
    for(const value of values){
      const first=String(value).split(';',1)[0];
      const index=first.indexOf('=');
      if(index<1)continue;
      const name=first.slice(0,index).trim();
      const cookieValue=first.slice(index+1).trim();
      if(/max-age=0/i.test(value)||!cookieValue)this.#cookies.delete(name);
      else this.#cookies.set(name,cookieValue);
    }
  }
  header(){return [...this.#cookies].map(([name,value])=>`${name}=${value}`).join('; ');}
}

const jar=new CookieJar();
const qelly=async(path,{method='GET',body,csrf}={})=>{
  const headers=new Headers({'Cache-Control':'no-cache'});
  const cookie=jar.header();
  if(cookie)headers.set('Cookie',cookie);
  if(method!=='GET'&&method!=='HEAD')headers.set('Origin',PUBLIC_URL);
  if(body!==undefined){headers.set('Content-Type','application/json');body=JSON.stringify(body);}
  if(csrf)headers.set('X-Qelly-CSRF',csrf);
  const response=await fetch(`${PUBLIC_URL}${path}`,{method,headers,body,redirect:'follow',signal:AbortSignal.timeout(45_000)});
  jar.absorb(response);
  return response;
};

const mailFetch=async(path,{method='GET',body,token}={})=>{
  const headers=new Headers({Accept:'application/json'});
  if(token)headers.set('Authorization',`Bearer ${token}`);
  if(body!==undefined){headers.set('Content-Type','application/json');body=JSON.stringify(body);}
  return fetch(`${MAIL_API}${path}`,{method,headers,body,redirect:'follow',signal:AbortSignal.timeout(30_000)});
};

const decodeHtml=(value)=>String(value||'')
  .replaceAll('&amp;','&')
  .replace(/&#x3D;/gi,'=')
  .replaceAll('&#61;','=')
  .replaceAll('&quot;','"')
  .replaceAll('&#39;',"'");
const stripHtml=(value)=>decodeHtml(String(value||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim());
const confirmationUrlFrom=(message)=>{
  const html=Array.isArray(message?.html)?message.html.join('\n'):String(message?.html||'');
  const text=String(message?.text||'');
  const anchors=[];
  const anchorPattern=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for(const match of html.matchAll(anchorPattern))anchors.push({href:decodeHtml(match[1]),label:stripHtml(match[2])});
  let url=anchors.find(item=>/confirm.*email|verify.*email/i.test(item.label))?.href||'';
  if(!url){
    const candidates=decodeHtml(`${html}\n${text}`).match(/https?:\/\/[^\s<>"']+/g)||[];
    url=candidates.find(value=>/click\.|brevo|auth\/v1\/verify|supabase\.co/i.test(value))||'';
  }
  if(!/^https:\/\//.test(url))throw new Error('confirmation_url_missing');
  return url;
};

await mkdir(evidenceDir,{recursive:true});
let mailAccountId='';
let mailToken='';
let stage='mail-domain';
const evidence={
  target:'canonical-production',
  expectedReleaseSha:EXPECTED_RELEASE_SHA,
  mailboxProvider:'Mail.tm',
  attribution:'https://mail.tm',
  registration:{accepted:false,verificationRequired:null,callbackMode:null},
  confirmation:{messageReceived:false,confirmationLinkConsumed:false},
  signIn:{authenticated:false,authenticationMethod:null,assurance:null},
  authenticatedConfig:{authenticated:false,csrfMode:null},
  cleanup:{requested:false,identityDeleted:false,evidenceCompleted:false,postDeletionLoginRejected:false}
};

try{
  console.log('Temporary QA mailbox provider: Mail.tm — https://mail.tm');
  const domainsResponse=await mailFetch('/domains?page=1');
  requireStatus(domainsResponse,[200],'mailtm_domains');
  const domainsPayload=await json(domainsResponse);
  const domains=domainsPayload?.['hydra:member']||domainsPayload?.member||[];
  const domain=(domains.find(item=>item?.isActive===true&&item?.isPrivate!==true)||domains.find(item=>item?.isActive===true)||domains[0])?.domain;
  if(!domain)throw new Error('mailtm_active_domain_missing');

  stage='mail-account';
  const mailboxEmail=`qelly-${process.env.GITHUB_SHA?.slice(0,8)||'canary'}-${randomBytes(5).toString('hex')}@${domain}`;
  const mailboxPassword=`Mt!${randomBytes(24).toString('hex')}`;
  const qellyPassword=`Qe2!${randomBytes(28).toString('hex')}`;
  for(const value of [mailboxEmail,mailboxPassword,qellyPassword])mask(value);

  const accountResponse=await mailFetch('/accounts',{method:'POST',body:{address:mailboxEmail,password:mailboxPassword}});
  requireStatus(accountResponse,[201],'mailtm_account_create');
  const account=await json(accountResponse);
  mailAccountId=String(account?.id||'');
  if(!mailAccountId)throw new Error('mailtm_account_id_missing');
  mask(mailAccountId);

  const tokenResponse=await mailFetch('/token',{method:'POST',body:{address:mailboxEmail,password:mailboxPassword}});
  requireStatus(tokenResponse,[200],'mailtm_token');
  const tokenPayload=await json(tokenResponse);
  mailToken=String(tokenPayload?.token||'');
  if(!mailToken)throw new Error('mailtm_token_missing');
  mask(mailToken);

  stage='qelly-register';
  const registrationResponse=await qelly('/api/v1/auth/register',{method:'POST',body:{
    email:mailboxEmail,
    password:qellyPassword,
    displayName:'Qelly E2E Canary',
    organizationName:'Qelly E2E Canary',
    workspaceName:'Qelly E2E Canary',
    baseCurrency:'USD',
    timezone:'UTC'
  }});
  requireStatus(registrationResponse,[201,202],'qelly_register');
  const registration=await json(registrationResponse);
  if(registration?.accepted!==true)throw new Error('qelly_registration_not_accepted');
  evidence.registration={accepted:true,verificationRequired:registration?.verificationRequired===true,callbackMode:registration?.callbackMode||null};

  stage='confirmation-email';
  let messageId='';
  for(let attempt=1;attempt<=60&&!messageId;attempt++){
    await sleep(5000);
    const messagesResponse=await mailFetch('/messages?page=1',{token:mailToken});
    if(messagesResponse.status!==200)continue;
    const payload=await json(messagesResponse);
    const messages=payload?.['hydra:member']||payload?.member||[];
    const match=messages.find(message=>/confirm your email address|confirm.*email|qelly/i.test(`${message?.subject||''} ${message?.from?.name||''} ${message?.from?.address||''}`));
    if(match?.id)messageId=String(match.id);
  }
  if(!messageId)throw new Error('qelly_confirmation_email_missing');
  mask(messageId);
  evidence.confirmation.messageReceived=true;

  const messageResponse=await mailFetch(`/messages/${encodeURIComponent(messageId)}`,{token:mailToken});
  requireStatus(messageResponse,[200],'mailtm_message_read');
  const message=await json(messageResponse);
  const confirmationUrl=confirmationUrlFrom(message);
  mask(confirmationUrl);

  stage='email-confirmation';
  const confirmationResponse=await fetch(confirmationUrl,{redirect:'follow',signal:AbortSignal.timeout(45_000)});
  requireStatus(confirmationResponse,[200,204],'qelly_confirmation_link');
  await confirmationResponse.arrayBuffer();
  evidence.confirmation.confirmationLinkConsumed=true;
  await sleep(2500);

  stage='qelly-login';
  const loginResponse=await qelly('/api/v1/auth/login',{method:'POST',body:{email:mailboxEmail,password:qellyPassword}});
  const loginPayload=await json(loginResponse);
  if(loginResponse.status!==200)throw new Error(`qelly_login_http_${loginResponse.status}_${loginPayload?.error?.code||'unknown'}`);
  if(loginPayload?.authenticated!==true||!loginPayload?.context)throw new Error('qelly_login_context_invalid');
  evidence.signIn={
    authenticated:true,
    authenticationMethod:loginPayload?.context?.session?.authenticationMethod||null,
    assurance:loginPayload?.context?.session?.assurance||null
  };

  stage='authenticated-config';
  const configResponse=await qelly('/api/v1/config');
  requireStatus(configResponse,[200],'qelly_authenticated_config');
  const config=await json(configResponse);
  if(config?.release?.sha!==EXPECTED_RELEASE_SHA)throw new Error(`qelly_release_identity_mismatch_${config?.release?.sha||'missing'}`);
  if(config?.auth?.authenticated!==true||!config?.csrf?.token)throw new Error('qelly_authenticated_config_invalid');
  const csrf=String(config.csrf.token);
  mask(csrf);
  evidence.releaseSha=config.release.sha;
  evidence.authenticatedConfig={authenticated:true,csrfMode:config?.csrf?.mode||null};

  stage='qelly-self-delete';
  const deleteResponse=await qelly('/api/v1/account/delete',{method:'POST',csrf,body:{
    reason:'Disposable canonical Auth E2E canary cleanup',
    privacyVersion:'2026-08-01',
    termsVersion:'2026-08-01'
  }});
  const deletion=await json(deleteResponse);
  if(deleteResponse.status!==202)throw new Error(`qelly_delete_http_${deleteResponse.status}_${deletion?.error?.code||'unknown'}`);
  evidence.cleanup={
    requested:deletion?.requested===true,
    identityDeleted:deletion?.identityDeleted===true,
    evidenceCompleted:deletion?.evidenceCompleted===true,
    status:deletion?.status||null,
    identityDeletionStatus:deletion?.identityDeletionStatus??null,
    postDeletionLoginRejected:false
  };
  if(!evidence.cleanup.requested||!evidence.cleanup.identityDeleted||!evidence.cleanup.evidenceCompleted){
    throw new Error(`qelly_cleanup_incomplete_${JSON.stringify(evidence.cleanup)}`);
  }

  stage='post-delete-login';
  const postDeleteResponse=await qelly('/api/v1/auth/login',{method:'POST',body:{email:mailboxEmail,password:qellyPassword}});
  await postDeleteResponse.arrayBuffer();
  if(postDeleteResponse.status===200)throw new Error('qelly_deleted_identity_still_authenticates');
  evidence.cleanup.postDeletionLoginRejected=true;

  evidence.status='passed';
  evidence.stage='complete';
  await writeFile(`${evidenceDir}/result.json`,JSON.stringify(evidence,null,2));
  console.log('Canonical production Auth E2E canary passed and disposable identity cleanup completed.');
}catch(error){
  evidence.status='failed';
  evidence.stage=stage;
  evidence.failure=String(error?.message||error||'unknown_failure').slice(0,400);
  await writeFile(`${evidenceDir}/result.json`,JSON.stringify(evidence,null,2));
  throw error;
}finally{
  if(mailAccountId&&mailToken){
    try{await mailFetch(`/accounts/${encodeURIComponent(mailAccountId)}`,{method:'DELETE',token:mailToken});}catch{}
  }
}
