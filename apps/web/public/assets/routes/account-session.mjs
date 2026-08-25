import {assuranceLabel,authenticationMethodLabel} from '../customer-copy.mjs';

const esc=(value,escapeHtml)=>escapeHtml(value??'—');
const date=(value)=>{const parsed=new Date(value||'');return Number.isNaN(parsed.getTime())?'Not supplied':parsed.toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'});};
const initials=(value)=>String(value||'Q').trim().split(/\s+/).slice(0,2).map(part=>part[0]||'').join('').toUpperCase()||'Q';

function ensureStyles(){
  if(document.querySelector('link[data-qelly-account-v6]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';link.href='/assets/routes/account-session-v6.css';link.dataset.qellyAccountV6='true';document.head.append(link);
}

export async function renderAccountSession(main,{api,pageHead,escapeHtml,toast,onLoggedOut,onAuthenticated}){
  ensureStyles();
  const [profile,sessions]=await Promise.all([
    api('/api/v1/profile'),
    api('/api/v1/sessions').catch(()=>({scope:'current-session-only',items:[]}))
  ]);
  const current=sessions.items?.find(item=>item.current)||sessions.items?.[0]||null;
  const user=profile.user||{},settings=profile.profile||{},workspace=profile.workspace||{},session=profile.session||{};
  const profileCapabilities=profile.capabilities||{};
  const cloudProfile=profileCapabilities.profilePersistence==='cloud-rls';
  const cloudSyncAvailable=cloudProfile&&profileCapabilities.cloudSync===true;
  const cloudSyncCopy=cloudSyncAvailable
    ?'Keep supported preferences and workspace items available across signed-in devices.'
    :cloudProfile
      ?'Cross-device sync is not available right now. Your profile changes are still saved securely.'
      :'Cross-device sync is not available in this workspace.';
  const method=authenticationMethodLabel(session.authenticationMethod||current?.authenticationMethod);
  const assurance=assuranceLabel(session.assurance);
  const expiresAt=current?.expiresAt||session.expiresAt;
  const storageLabel=cloudProfile?'Secure cloud':'This device';

  main.innerHTML=`<section class="q-page q-v6-account-page" data-profile-storage="${cloudProfile?'secure-cloud':'this-device'}">
    ${pageHead('Qelly Intelligence · Account','Profile & Security','Manage the profile, preferences and current browser session connected to your Qelly account.',`<button class="q-button q-button--secondary" data-refresh>Refresh session</button><button class="q-button q-button--primary" data-save-profile>Save changes</button>`)}
    <div class="q-v6-account-hero">
      <section class="q-panel q-v6-identity-card"><div class="q-v6-identity-primary"><div class="q-v6-avatar" aria-hidden="true">${escapeHtml(initials(settings.displayName||user.displayName||user.email))}</div><div><p class="q-eyebrow">Your Qelly account</p><h2>${esc(settings.displayName||user.displayName,escapeHtml)}</h2><p>${esc(user.email,escapeHtml)}</p></div></div><div class="q-v6-identity-tags"><span class="q-status q-status--${user.emailConfirmedAt?'live':'warning'}">${user.emailConfirmedAt?'Email verified':'Verify email'}</span><span class="q-status q-status--live">${storageLabel} profile</span><span class="q-status q-status--cached">Research workspace</span></div></section>
      <section class="q-panel q-v6-security-card"><div class="q-panel-head"><div><p class="q-eyebrow">Session health</p><h2>Signed in securely</h2><p>This browser has an active account session.</p></div><span class="q-status q-status--live">Active</span></div><div class="q-v6-security-list"><div class="q-v6-security-row"><span>Sign-in</span><strong>${escapeHtml(method)}</strong></div><div class="q-v6-security-row"><span>Protection</span><strong>${escapeHtml(assurance)}</strong></div><div class="q-v6-security-row"><span>Active until</span><strong>${escapeHtml(date(expiresAt))}</strong></div></div></section>
    </div>
    <div class="q-v6-profile-layout">
      <section class="q-panel q-v6-profile-card"><div class="q-panel-head"><div><p class="q-eyebrow">Personalization</p><h2>Profile preferences</h2><p>Choose how currencies, dates and your identity appear throughout Qelly.</p></div><span class="q-status q-status--${cloudProfile?'live':'cached'}">${storageLabel}</span></div><form id="v6-profile-form" class="q-panel-body q-v6-profile-form">
        <label class="q-setting q-setting--wide"><span>Display name</span><input name="displayName" maxlength="80" required value="${esc(settings.displayName||'',escapeHtml)}" autocomplete="name"></label>
        <label class="q-setting"><span>Base currency</span><select name="baseCurrency">${['USD','INR','EUR','GBP','SGD','AED','JPY'].map((currency)=>`<option value="${currency}" ${currency===settings.baseCurrency?'selected':''}>${currency}</option>`).join('')}</select></label>
        <label class="q-setting"><span>Timezone</span><input name="timezone" maxlength="64" required value="${esc(settings.timezone||'UTC',escapeHtml)}" placeholder="Asia/Kolkata" autocomplete="off"></label>
        <label class="q-v6-cloud-toggle q-setting--wide" data-cloud-sync-state="${cloudSyncAvailable?'available':'unavailable'}"><input type="checkbox" name="cloudSyncOptIn" ${settings.cloudSyncOptIn&&cloudSyncAvailable?'checked':''} ${cloudSyncAvailable?'':'disabled'}><span><strong>Sync across devices</strong><small>${escapeHtml(cloudSyncCopy)}</small></span></label>
        <div class="q-v6-profile-actions"><button type="button" class="q-button q-button--secondary" data-reset-profile>Reset</button><button type="submit" class="q-button q-button--primary">Save changes</button></div>
      </form></section>
      <aside class="q-panel q-v6-workspace-card"><div class="q-panel-head"><div><p class="q-eyebrow">Private workspace</p><h2>${esc(workspace.name||'My Qelly Workspace',escapeHtml)}</h2><p>Your saved profile and supported research items are scoped to this workspace.</p></div><span class="q-status q-status--live">Protected</span></div><div class="q-panel-body q-v6-workspace-summary"><div><span>Profile storage</span><strong>${storageLabel}</strong></div><div><span>Device sync</span><strong>${cloudSyncAvailable?(settings.cloudSyncOptIn?'On':'Off'):'Not available'}</strong></div><div><span>Privacy</span><strong>Workspace protected</strong></div><div><span>Last profile change</span><strong>${escapeHtml(date(settings.updatedAt))}</strong></div></div></aside>
    </div>
    <div class="q-two-column q-v6-account-lower">
      <section class="q-panel"><div class="q-panel-head"><div><p class="q-eyebrow">Current browser session</p><h2>Session controls</h2><p>This page shows this browser only; it is not a complete multi-device session inventory.</p></div><span class="q-status q-status--${current?'live':'cached'}">${current?'Current':'Checking'}</span></div><div class="q-panel-body"><div class="q-v6-security-list">${current?`<div class="q-v6-security-row"><span>Browser</span><strong>Current signed-in browser</strong></div><div class="q-v6-security-row"><span>Sign-in method</span><strong>${escapeHtml(authenticationMethodLabel(current.authenticationMethod))}</strong></div><div class="q-v6-security-row"><span>Session expiry</span><strong>${escapeHtml(date(current.expiresAt))}</strong></div>`:'<div class="q-empty-state"><strong>Session details are refreshing</strong><p>You can continue using Qelly or refresh this session.</p></div>'}</div><div class="q-v6-account-actions"><button class="q-button q-button--secondary" data-refresh>Refresh this session</button><a class="q-button q-button--secondary" href="#/account-recovery">Account recovery</a><button class="q-button q-button--primary" data-logout>Sign out this browser</button></div></div></section>
      <section class="q-panel"><div class="q-panel-head"><div><p class="q-eyebrow">Account protection</p><h2>Security tools</h2><p>Clear controls for what is available today and what is coming next.</p></div><span class="q-status q-status--live">Protected</span></div><div class="q-panel-body q-v6-capability-grid"><article class="q-v6-capability-card"><div class="q-v6-capability-icon">01</div><strong>Password recovery</strong><small>Request a secure recovery email whenever you need it.</small><span class="q-status q-status--live">Available</span></article><article class="q-v6-capability-card"><div class="q-v6-capability-icon">02</div><strong>Multi-factor authentication</strong><small>An additional sign-in verification option is on the roadmap.</small><span class="q-status q-status--cached">Coming soon</span></article><article class="q-v6-capability-card"><div class="q-v6-capability-icon">03</div><strong>Other devices</strong><small>Reviewing and signing out other devices is being prepared.</small><span class="q-status q-status--cached">Coming soon</span></article><article class="q-v6-capability-card"><div class="q-v6-capability-icon">04</div><strong>Profile protection</strong><small>Your account controls who can access this profile and workspace.</small><span class="q-status q-status--live">Active</span></article></div></section>
    </div>
  </section>`;

  const form=main.querySelector('#v6-profile-form');
  const save=async()=>{const data=new FormData(form);const payload={displayName:String(data.get('displayName')||''),baseCurrency:String(data.get('baseCurrency')||'USD'),timezone:String(data.get('timezone')||'UTC')};if(cloudSyncAvailable)payload.cloudSyncOptIn=Boolean(form.elements.cloudSyncOptIn.checked);try{await api('/api/v1/profile',{method:'PATCH',body:JSON.stringify(payload)});toast('Profile preferences saved',{tone:'success'});await onAuthenticated('account-session');}catch(error){toast(error.message,{tone:'danger'});}};
  form.addEventListener('submit',(event)=>{event.preventDefault();void save();});
  main.querySelectorAll('[data-save-profile]').forEach((button)=>button.addEventListener('click',()=>void save()));
  main.querySelector('[data-reset-profile]')?.addEventListener('click',()=>form.reset());
  main.querySelectorAll('[data-logout]').forEach((button)=>button.addEventListener('click',async()=>{try{await api('/api/v1/auth/logout',{method:'POST',body:'{}'});toast('Signed out from this browser',{tone:'success'});await onLoggedOut();}catch(error){toast(error.message,{tone:'danger'});}}));
  main.querySelectorAll('[data-refresh]').forEach((button)=>button.addEventListener('click',async()=>{try{await api('/api/v1/auth/refresh',{method:'POST',body:'{}'});toast('Current browser session refreshed',{tone:'success'});await onAuthenticated('account-session');}catch(error){toast(error.message,{tone:'danger'});}}));
}
