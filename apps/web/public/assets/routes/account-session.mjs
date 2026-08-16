const esc=(value,escapeHtml)=>escapeHtml(value??'—');
const date=(value)=>{const parsed=new Date(value||'');return Number.isNaN(parsed.getTime())?'Not supplied':parsed.toLocaleString('en-IN');};
const initials=(value)=>String(value||'Q').trim().split(/\s+/).slice(0,2).map(part=>part[0]||'').join('').toUpperCase()||'Q';

function ensureStyles(){
  if(document.querySelector('link[data-qelly-account-v6]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';link.href='/assets/routes/account-session-v6.css';link.dataset.qellyAccountV6='true';document.head.append(link);
}

export async function renderAccountSession(main,{api,pageHead,escapeHtml,toast,onLoggedOut,onAuthenticated}){
  ensureStyles();
  const [profile,sessions,capabilities]=await Promise.all([
    api('/api/v1/profile'),
    api('/api/v1/sessions').catch(()=>({scope:'current-session-only',items:[]})),
    api('/api/v1/platform/capabilities').catch(()=>({items:[]}))
  ]);
  const current=sessions.items?.find(item=>item.current)||sessions.items?.[0]||null;
  const unavailable=Array.isArray(capabilities.items)?capabilities.items:[];
  const mfa=unavailable.find((item)=>item.id==='mfa');
  const remoteSessions=unavailable.find((item)=>item.id==='remote-session-control');
  const user=profile.user||{},settings=profile.profile||{},workspace=profile.workspace||{},session=profile.session||{};
  const profileCapabilities=profile.capabilities||{};
  const cloudProfile=profileCapabilities.profilePersistence==='cloud-rls';
  const cloudSyncAvailable=cloudProfile&&profileCapabilities.cloudSync!==false;
  const persistenceLabel=cloudProfile?'CLOUD RLS':'LOCAL ATOMIC JSON';
  const authenticationLabel=String(session.authenticationMethod||current?.authenticationMethod||'declared session').toUpperCase();
  main.innerHTML=`<section class="q-page q-v6-account-page">
    ${pageHead('Qelly Intelligence · Identity','Profile & Security','Manage the authenticated Qelly profile, research preferences and current browser session. Unsupported identity controls remain explicitly unavailable rather than simulated.',`<button class="q-button q-button--secondary" data-refresh>Refresh session</button><button class="q-button q-button--primary" data-save-profile>Save profile</button>`)}
    <div class="q-v6-account-hero">
      <section class="q-panel q-v6-identity-card"><div class="q-v6-identity-primary"><div class="q-v6-avatar">${escapeHtml(initials(settings.displayName||user.displayName||user.email))}</div><div><h2>${esc(settings.displayName||user.displayName,escapeHtml)}</h2><p>${esc(user.email,escapeHtml)}</p></div></div><div class="q-v6-identity-tags"><span class="q-status q-status--${user.emailConfirmedAt?'live':'warning'}">${user.emailConfirmedAt?'EMAIL VERIFIED':'EMAIL PENDING'}</span><span class="q-status q-status--cached">${escapeHtml(authenticationLabel)}</span><span class="q-status q-status--cached">${persistenceLabel} PROFILE</span><span class="q-status q-status--unavailable">EXECUTION OFF</span></div></section>
      <section class="q-panel q-v6-security-card"><div class="q-panel-head"><div><h2>Current assurance</h2><p>Authenticated browser-session evidence.</p></div><span class="q-status q-status--live">ACTIVE</span></div><div class="q-v6-security-list"><div class="q-v6-security-row"><span>Method</span><strong>${esc(session.authenticationMethod,escapeHtml)}</strong><span class="q-status q-status--cached">declared</span></div><div class="q-v6-security-row"><span>Assurance</span><strong>${esc(session.assurance,escapeHtml)}</strong><span class="q-status q-status--cached">current</span></div><div class="q-v6-security-row"><span>Expires</span><strong>${escapeHtml(date(current?.expiresAt||session.expiresAt))}</strong><span class="q-status q-status--cached">browser</span></div></div></section>
    </div>
    <div class="q-v6-profile-layout">
      <section class="q-panel"><div class="q-panel-head"><div><h2>Profile preferences</h2><p>${cloudProfile?'Persisted to the authenticated RLS profile, not browser-only storage.':'Persisted only in the governed local test runtime; no cloud profile is claimed.'}</p></div><span class="q-status q-status--${cloudProfile?'live':'simulated'}">${cloudProfile?'CLOUD':'LOCAL'}</span></div><form id="v6-profile-form" class="q-panel-body q-v6-profile-form">
        <label class="q-setting q-setting--wide"><span>Display name</span><input name="displayName" maxlength="80" required value="${esc(settings.displayName||'',escapeHtml)}"></label>
        <label class="q-setting"><span>Base currency</span><select name="baseCurrency">${['USD','INR','EUR','GBP','SGD','AED','JPY'].map((currency)=>`<option value="${currency}" ${currency===settings.baseCurrency?'selected':''}>${currency}</option>`).join('')}</select></label>
        <label class="q-setting"><span>Timezone</span><input name="timezone" maxlength="64" required value="${esc(settings.timezone||'UTC',escapeHtml)}" placeholder="Asia/Kolkata"></label>
        <label class="q-v6-cloud-toggle q-setting--wide"><input type="checkbox" name="cloudSyncOptIn" ${settings.cloudSyncOptIn?'checked':''} ${cloudSyncAvailable?'':'disabled'}><span><strong>Cloud synchronization</strong><small>${cloudSyncAvailable?'Allow saved deterministic calculations and supported workspace state to synchronize through the authenticated Qelly cloud contract.':'Unavailable in the deterministic local identity fixture; profile changes remain local.'}</small></span></label>
        <div class="q-v6-profile-actions"><button type="button" class="q-button q-button--secondary" data-reset-profile>Reset form</button><button type="submit" class="q-button q-button--primary">Save profile</button></div>
      </form></section>
      <aside class="q-panel"><div class="q-panel-head"><div><h2>Workspace identity</h2><p>Current bootstrapped workspace and policy versions.</p></div><span class="q-status q-status--cached">CURRENT</span></div><div class="q-panel-body"><dl class="q-v6-evidence-list"><dt>Workspace</dt><dd>${esc(workspace.name,escapeHtml)}</dd><dt>Workspace ID</dt><dd>${esc(workspace.workspaceId,escapeHtml)}</dd><dt>User ID</dt><dd>${esc(user.userId,escapeHtml)}</dd><dt>Privacy version</dt><dd>${esc(settings.privacyVersion,escapeHtml)}</dd><dt>Terms version</dt><dd>${esc(settings.termsVersion,escapeHtml)}</dd><dt>Profile updated</dt><dd>${escapeHtml(date(settings.updatedAt))}</dd><dt>Execution</dt><dd>Disabled</dd></dl></div></aside>
    </div>
    <div class="q-two-column">
      <section class="q-panel"><div class="q-panel-head"><div><h2>Session control</h2><p>Only the current browser session is proven. This is not a complete multi-device session inventory.</p></div><span class="q-status q-status--cached">${current?'1 CURRENT':'UNAVAILABLE'}</span></div><div class="q-panel-body"><div class="q-v6-security-list">${current?`<div class="q-v6-security-row"><span>Session</span><strong>${esc(current.sessionId,escapeHtml)}</strong><span class="q-status q-status--live">CURRENT</span></div><div class="q-v6-security-row"><span>Auth method</span><strong>${esc(current.authenticationMethod,escapeHtml)}</strong><span class="q-status q-status--cached">${cloudProfile?'SUPABASE':'LOCAL FIXTURE'}</span></div><div class="q-v6-security-row"><span>Expiry</span><strong>${escapeHtml(date(current.expiresAt))}</strong><span class="q-status q-status--cached">BROWSER SCOPE</span></div>`:'<div class="q-empty-state">Current session details unavailable.</div>'}</div><div class="q-v6-account-actions"><button class="q-button q-button--secondary" data-refresh>Refresh this session</button><a class="q-button q-button--secondary" href="#/account-recovery">Account recovery</a><button class="q-button q-button--primary" data-logout>Sign out this browser</button></div></div></section>
      <section class="q-panel"><div class="q-panel-head"><div><h2>Security capability boundary</h2><p>Unavailable identity controls are visible as engineering debt, not interactive mock controls.</p></div><span class="q-status q-status--warning">PARTIAL</span></div><div class="q-panel-body q-v6-capability-grid"><article class="q-v6-capability-card"><strong>MFA / TOTP</strong><small>${escapeHtml(mfa?.reason||'Full production MFA is not currently proven.')}</small><span class="q-status q-status--unavailable">UNAVAILABLE</span></article><article class="q-v6-capability-card"><strong>Remote session control</strong><small>${escapeHtml(remoteSessions?.reason||'Multi-device revoke and inventory are not currently proven.')}</small><span class="q-status q-status--unavailable">UNAVAILABLE</span></article><article class="q-v6-capability-card"><strong>Password recovery</strong><small>Recovery is available only when the transactional email capability is proven by the auth runtime.</small><span class="q-status q-status--cached">RUNTIME-GATED</span></article><article class="q-v6-capability-card"><strong>Profile persistence</strong><small>Display name, base currency and timezone use ${cloudProfile?'authenticated RLS storage':'the disposable local atomic store'}.</small><span class="q-status q-status--live">${persistenceLabel}</span></article></div></section>
    </div>
  </section>`;

  const form=main.querySelector('#v6-profile-form');
  const save=async()=>{
    const data=new FormData(form);const payload={displayName:String(data.get('displayName')||''),baseCurrency:String(data.get('baseCurrency')||'USD'),timezone:String(data.get('timezone')||'UTC'),cloudSyncOptIn:Boolean(form.elements.cloudSyncOptIn.checked)};
    try{await api('/api/v1/profile',{method:'PATCH',body:JSON.stringify(payload)});toast('Profile preferences saved',{tone:'success'});await onAuthenticated('account-session');}catch(error){toast(error.message,{tone:'danger'});}
  };
  form.addEventListener('submit',(event)=>{event.preventDefault();void save();});
  main.querySelectorAll('[data-save-profile]').forEach((button)=>button.addEventListener('click',()=>void save()));
  main.querySelector('[data-reset-profile]')?.addEventListener('click',()=>form.reset());
  main.querySelectorAll('[data-logout]').forEach((button)=>button.addEventListener('click',async()=>{try{await api('/api/v1/auth/logout',{method:'POST',body:'{}'});toast('Signed out from this browser',{tone:'success'});await onLoggedOut();}catch(error){toast(error.message,{tone:'danger'});}}));
  main.querySelectorAll('[data-refresh]').forEach((button)=>button.addEventListener('click',async()=>{try{await api('/api/v1/auth/refresh',{method:'POST',body:'{}'});toast('Current browser session refreshed',{tone:'success'});await onAuthenticated('account-session');}catch(error){toast(error.message,{tone:'danger'});}}));
}
