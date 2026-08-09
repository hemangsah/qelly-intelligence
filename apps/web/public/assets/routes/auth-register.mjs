const registrationMessage=(error)=>{
  if(error?.status===429)return'Too many confirmation emails were requested. Wait before trying again.';
  if(error?.status===409||error?.code==='user_already_exists')return'An account may already exist for this email. Sign in or recover your password.';
  if(error?.status===400)return'Check the highlighted details and try again.';
  if(!navigator.onLine)return'You are offline. Reconnect before creating an account.';
  return'Qelly could not create the account. Try again shortly.';
};

const browserTimezone=()=>{
  try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';}
  catch{return'UTC';}
};

const suggestedCurrency=()=>{
  const locale=String(navigator.language||'en-US').toUpperCase();
  if(locale.includes('-IN'))return'INR';
  if(locale.includes('-GB'))return'GBP';
  if(locale.includes('-SG'))return'SGD';
  if(locale.includes('-AE'))return'AED';
  if(locale.includes('-JP'))return'JPY';
  if(/-(DE|FR|IT|ES|NL|IE|PT|AT|BE|FI|GR)/.test(locale))return'EUR';
  return'USD';
};

export async function renderAuthRegister(main,{api,toast,navigate,onAuthenticated}){
if(window.__QELLY_CONFIG__?.capabilities?.emailDelivery!==true){
  main.innerHTML=`<section class="q-auth-page" data-production-auth="unavailable"><div class="q-auth-hero"><div><p class="q-eyebrow">Account availability</p><h1>Account creation is temporarily unavailable.</h1><p>Transactional email delivery has not been proven, so Qelly is not accepting registration requests. No account information has been submitted. Public markets and deterministic local tools remain available.</p></div></div><div class="q-auth-card"><div><p class="q-eyebrow">Fail-closed protection</p><h2>Email confirmation is unavailable</h2><p class="q-muted-copy">Registration will reopen only after a dedicated transactional email provider is configured and a production confirmation flow passes.</p></div><div class="q-auth-footer"><button class="q-button q-button--ghost" type="button" data-login>Sign in to an existing account</button><button class="q-button q-button--primary" type="button" data-home>Return home</button></div></div></section>`;
  main.querySelector('[data-login]').addEventListener('click',()=>navigate('auth-login'));
  main.querySelector('[data-home]').addEventListener('click',()=>navigate('market'));
  return;
}
  main.innerHTML=`<section class="q-auth-page" data-production-auth="true">
    <div class="q-auth-hero"><div><p class="q-eyebrow">Create an account</p><h1>Save your Qelly work securely.</h1><p>Create a private workspace for saved calculations, revision history and optional cloud synchronization. Public markets and local tools remain available without registration.</p></div><ol class="q-auth-steps"><li><b>1</b><span>Create account</span></li><li><b>2</b><span>Confirm email</span></li><li><b>3</b><span>Open workspace</span></li></ol></div>
    <div class="q-auth-card"><div><p class="q-eyebrow">Qelly account</p><h2>Get started</h2><p class="q-muted-copy">Use an email you can access. We will send one confirmation link before the account becomes active.</p></div>
      <form id="register-form" class="q-auth-form" novalidate>
        <label>Full name<input name="displayName" required minlength="2" maxlength="80" autocomplete="name" placeholder="Your name"></label>
        <label>Email<input name="email" type="email" inputmode="email" required autocomplete="username" placeholder="you@example.com"></label>
        <label class="q-password-field">Password<input name="password" type="password" required minlength="12" autocomplete="new-password" placeholder="Create a strong password" aria-describedby="password-help register-error"><button class="q-password-toggle" type="button" data-password-toggle aria-pressed="false">Show</button></label>
        <p id="password-help" class="q-muted-copy">Use at least 12 characters with uppercase, lowercase, a number and a symbol.</p>
        <label>Base currency<select name="baseCurrency" required aria-describedby="currency-help"><option value="USD">USD — US Dollar</option><option value="INR">INR — Indian Rupee</option><option value="EUR">EUR — Euro</option><option value="GBP">GBP — Pound Sterling</option><option value="SGD">SGD — Singapore Dollar</option><option value="AED">AED — UAE Dirham</option><option value="JPY">JPY — Japanese Yen</option></select></label>
        <p id="currency-help" class="q-muted-copy">Used for workspace display only. It does not enable trading, custody or currency conversion.</p>
        <input name="organizationName" type="hidden" value="Personal Qelly">
        <input name="workspaceName" type="hidden" value="My Qelly Workspace">
        <input name="timezone" type="hidden" value="UTC">
        <label class="q-auth-consent"><input name="accepted" type="checkbox" required><span>I agree to the <a href="./legal/terms.html" target="_blank" rel="noopener">Terms</a> and acknowledge the <a href="./legal/privacy.html" target="_blank" rel="noopener">Privacy notice</a>.</span></label>
        <button class="q-button q-button--primary" type="submit" data-create>Create account</button>
        <p id="register-error" class="q-form-error" role="alert" aria-live="polite"></p>
      </form>
      <div class="q-auth-footer"><span>Already have an account?</span><button class="q-button q-button--ghost" type="button" data-login>Sign in</button><button class="q-button q-button--ghost" type="button" data-home>Return home</button></div>
    </div>
  </section>`;
  const form=main.querySelector('#register-form'),error=main.querySelector('#register-error'),password=form.elements.password;
  form.elements.timezone.value=browserTimezone();
  form.elements.baseCurrency.value=suggestedCurrency();
  main.querySelector('[data-login]').addEventListener('click',()=>navigate('auth-login'));
  main.querySelector('[data-home]').addEventListener('click',()=>navigate('market'));
  main.querySelector('[data-password-toggle]').addEventListener('click',(event)=>{const visible=password.type==='text';password.type=visible?'password':'text';event.currentTarget.textContent=visible?'Show':'Hide';event.currentTarget.setAttribute('aria-pressed',String(!visible));password.focus();});
  form.addEventListener('submit',async(event)=>{
    event.preventDefault();error.textContent='';if(!form.reportValidity())return;
    const submit=main.querySelector('[data-create]');submit.disabled=true;submit.textContent='Creating account…';form.setAttribute('aria-busy','true');
    try{
      const data=Object.fromEntries(new FormData(form));delete data.accepted;
      data.timezone=browserTimezone();
      const result=await api('/api/v1/auth/register',{method:'POST',body:JSON.stringify(data),skipCsrf:true});
      if(result.verificationRequired){
        form.innerHTML=`<div class="q-auth-confirmation" role="status"><strong>Check your email</strong><p>We sent a confirmation link to the address you entered. Open it on this device to activate your account, then return to Qelly and sign in.</p></div><button class="q-button q-button--primary" type="button" data-confirm-login>Continue to sign in</button>`;
        form.querySelector('[data-confirm-login]').addEventListener('click',()=>navigate('auth-login'));
        toast('Confirmation email sent',{tone:'success'});return;
      }
      toast('Qelly account created',{tone:'success'});await onAuthenticated('account-session');
    }catch(caught){error.textContent=registrationMessage(caught);toast(error.textContent,{tone:'danger'});submit.disabled=false;submit.textContent='Create account';form.removeAttribute('aria-busy');}
  });
}
