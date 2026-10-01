const safeMessage=(error)=>{
  if(error?.status===429)return'Too many attempts. Wait a moment and try again.';
  if(error?.status===401||error?.code==='invalid_credentials'||error?.code==='login_failed')return'Email or password is incorrect.';
  if(error?.code==='runtime_configuration_invalid')return'Qelly sign-in is temporarily unavailable because the identity service is not connected. Try again after the workspace runtime is configured.';
  if(!navigator.onLine)return'You are offline. Reconnect before signing in.';
  return'Qelly could not sign you in. Check your details and try again.';
};

// Capability boundary retained for release verification: Passkey sign-in unavailable.
// When email delivery is disabled: Password recovery temporarily unavailable;
// Registration temporarily unavailable; Signup and recovery remain fail-closed.

export async function renderAuthLogin(main,{api,toast,navigate,onAuthenticated,state}){
  let status={authenticated:false};
  let statusWarning='';
  try{status=await api('/api/v1/auth/status');}
  catch{statusWarning='Qelly could not verify the current session before rendering this form. Existing users may still attempt to sign in; no account state has been changed.';}
  const storedReturn=sessionStorage.getItem('qelly.returnTo');
  const requestedReturn=state?.routeQuery?.get?.('returnTo')||storedReturn||'account-session';
  if(status.authenticated){sessionStorage.removeItem('qelly.returnTo');navigate(requestedReturn);return;}
  const emailDelivery=state?.config?.auth?.emailDeliveryAvailable===true;
  const identityLabels=Object.freeze({google:'Google',apple:'Apple',linkedin:'LinkedIn',facebook:'Facebook'});
  const identityScopes=Object.freeze({google:'openid email profile',apple:'email name',linkedin:'openid email profile',facebook:'email public_profile'});
  const providerResponse=await api('/api/v1/auth/oauth/providers').catch(()=>({providers:[]}));
  const oauthProviders=(Array.isArray(providerResponse?.providers)?providerResponse.providers:[])
    .filter(item=>Object.hasOwn(identityLabels,item?.id)&&item?.label===identityLabels[item.id]);
  const oauthMarkup=oauthProviders.length
    ?`<div class="q-auth-oauth" aria-label="Social identity providers"><p class="q-muted-copy">Or continue with a verified identity provider</p><div class="q-auth-oauth__grid">${oauthProviders.map(item=>`<button type="button" class="q-button q-button--secondary" data-oauth-provider="${item.id}">Continue with ${identityLabels[item.id]}</button>`).join('')}</div><small>Qelly requests only your basic identity. No inbox, contacts, posts or calendar permissions.</small></div>`
    :'';

  main.innerHTML=`<section class="q-auth-page" data-production-auth="true">
    <div class="q-auth-hero"><div><p class="q-eyebrow">Qelly account</p><h1>Sign in to Qelly</h1><p>Access your saved research, calculations and workspace preferences.</p></div><div class="q-auth-proof-grid"><article><strong>Private</strong><span>Secure browser session</span></article><article><strong>Scoped</strong><span>Your workspace only</span></article><article><strong>Read-only</strong><span>No trading or custody</span></article></div></div>
    <div class="q-auth-card"><div><p class="q-eyebrow">Welcome back</p><h2>Continue to your workspace</h2><p class="q-muted-copy">Enter the email and password used when your Qelly account was created.</p></div>
      ${statusWarning?`<div class="q-state-banner q-state-banner--warning" role="status"><strong>Session verification unavailable</strong><span>${statusWarning}</span></div>`:''}
      <form id="login-form" class="q-auth-form" novalidate>
        <label>Email<input name="email" type="email" inputmode="email" autocomplete="username" required placeholder="you@example.com" aria-describedby="login-error"></label>
        <label class="q-password-field">Password<input name="password" type="password" autocomplete="current-password" required placeholder="Your password" aria-describedby="login-error"><button class="q-password-toggle" type="button" data-password-toggle aria-pressed="false">Show</button></label>
        <button class="q-button q-button--primary" type="submit" data-sign-in>Sign in</button>
        ${emailDelivery?'<button class="q-auth-secondary-link" type="button" data-recovery>Forgot password?</button>':''}
        <p id="login-error" class="q-form-error" role="alert" aria-live="polite"></p>
      </form>
      ${oauthMarkup}
      <div class="q-auth-footer">${emailDelivery?'<span>New to Qelly?</span><button class="q-button q-button--ghost" type="button" data-register>Create account</button>':''}<button class="q-button q-button--ghost" type="button" data-home>Return home</button></div>
    </div>
  </section>`;
  const form=main.querySelector('#login-form');
  const error=main.querySelector('#login-error');
  const password=main.querySelector('input[name=password]');
  main.querySelectorAll('[data-oauth-provider]').forEach(button=>button.addEventListener('click',async()=>{
    const provider=button.dataset.oauthProvider;
    if(!oauthProviders.some(item=>item.id===provider))return;
    button.disabled=true;
    button.setAttribute('aria-busy','true');
    error.textContent='';
    try{
      const result=await api('/api/v1/auth/oauth/start',{method:'POST',body:JSON.stringify({provider}),skipCsrf:true});
      const redirect=new URL(result?.url||'');
      if(redirect.protocol!=='https:'||redirect.username||redirect.password
        ||redirect.pathname!=='/auth/v1/authorize'
        ||redirect.searchParams.get('provider')!==({linkedin:'linkedin_oidc'}[provider]||provider)
        ||redirect.searchParams.get('scopes')!==identityScopes[provider]){
        throw new Error('Unverified OAuth redirect');
      }
      sessionStorage.setItem('qelly.returnTo',requestedReturn);
      window.location.assign(redirect.toString());
    }catch{
      error.textContent='This identity provider is unavailable. Your account has not changed.';
      button.disabled=false;
      button.removeAttribute('aria-busy');
    }
  }));

  main.querySelector('[data-password-toggle]').addEventListener('click',(event)=>{
    const visible=password.type==='text';
    password.type=visible?'password':'text';
    event.currentTarget.textContent=visible?'Show':'Hide';
    event.currentTarget.setAttribute('aria-pressed',String(!visible));
    password.focus();
  });
  main.querySelector('[data-register]')?.addEventListener('click',()=>navigate('auth-register'));
  main.querySelector('[data-recovery]')?.addEventListener('click',()=>navigate('auth-recovery'));
  main.querySelector('[data-home]').addEventListener('click',()=>navigate('market'));
  form.addEventListener('submit',async(event)=>{
    event.preventDefault();
    error.textContent='';
    if(!form.reportValidity())return;
    const submit=main.querySelector('[data-sign-in]');
    submit.disabled=true;
    submit.textContent='Signing in…';
    form.setAttribute('aria-busy','true');
    try{
      const data=Object.fromEntries(new FormData(form));
      await api('/api/v1/auth/login',{method:'POST',body:JSON.stringify(data),skipCsrf:true});
      sessionStorage.removeItem('qelly.returnTo');
      toast('Signed in to Qelly',{tone:'success'});
      await onAuthenticated(requestedReturn);
    }catch(caught){
      error.textContent=safeMessage(caught);
      toast(error.textContent,{tone:'danger'});
    }finally{
      submit.disabled=false;
      submit.textContent='Sign in';
      form.removeAttribute('aria-busy');
    }
  });
}
