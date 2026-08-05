const registrationMessage=(error)=>{
  if(error?.status===429)return'Too many confirmation emails were requested. Wait before trying again.';
  if(error?.status===409||error?.code==='user_already_exists')return'An account may already exist for this email. Sign in or recover your password.';
  if(error?.status===400)return'Check the highlighted details and try again.';
  if(!navigator.onLine)return'You are offline. Reconnect before creating an account.';
  return'Qelly could not create the account. Try again shortly.';
};

export async function renderAuthRegister(main,{api,toast,navigate,onAuthenticated}){
  main.innerHTML=`<section class="q-auth-page" data-production-auth="true">
    <div class="q-auth-hero"><div><p class="q-eyebrow">Create an account</p><h1>Save your Qelly work securely.</h1><p>Create a private workspace for saved calculations, revision history and optional cloud synchronization. Public markets and local tools remain available without registration.</p></div><ol class="q-auth-steps"><li><b>1</b><span>Create account</span></li><li><b>2</b><span>Confirm email</span></li><li><b>3</b><span>Open workspace</span></li></ol></div>
    <div class="q-auth-card"><div><p class="q-eyebrow">Qelly account</p><h2>Get started</h2><p class="q-muted-copy">Use an email you can access. We will send one confirmation link before the account becomes active.</p></div>
      <form id="register-form" class="q-auth-form" novalidate>
        <label>Full name<input name="displayName" required minlength="2" maxlength="80" autocomplete="name" placeholder="Your name"></label>
        <label>Email<input name="email" type="email" inputmode="email" required autocomplete="username" placeholder="you@example.com"></label>
        <label class="q-password-field">Password<input name="password" type="password" required minlength="12" autocomplete="new-password" placeholder="Create a strong password" aria-describedby="password-help register-error"><button class="q-password-toggle" type="button" data-password-toggle aria-pressed="false">Show</button></label>
        <p id="password-help" class="q-muted-copy">Use at least 12 characters with uppercase, lowercase, a number and a symbol.</p>
        <input name="organizationName" type="hidden" value="Personal Qelly">
        <input name="workspaceName" type="hidden" value="My Qelly Workspace">
        <input name="baseCurrency" type="hidden" value="USD">
        <input name="timezone" type="hidden" value="Asia/Kolkata">
        <label class="q-auth-consent"><input name="accepted" type="checkbox" required><span>I agree to the <a href="./legal/terms.html" target="_blank" rel="noopener">Terms</a> and acknowledge the <a href="./legal/privacy.html" target="_blank" rel="noopener">Privacy notice</a>.</span></label>
        <button class="q-button q-button--primary" type="submit" data-create>Create account</button>
        <p id="register-error" class="q-form-error" role="alert" aria-live="polite"></p>
      </form>
      <div class="q-auth-footer"><span>Already have an account?</span><button class="q-button q-button--ghost" type="button" data-login>Sign in</button><button class="q-button q-button--ghost" type="button" data-home>Return home</button></div>
    </div>
  </section>`;
  const form=main.querySelector('#register-form'),error=main.querySelector('#register-error'),password=form.elements.password;
  main.querySelector('[data-login]').addEventListener('click',()=>navigate('auth-login'));
  main.querySelector('[data-home]').addEventListener('click',()=>navigate('market'));
  main.querySelector('[data-password-toggle]').addEventListener('click',(event)=>{const visible=password.type==='text';password.type=visible?'password':'text';event.currentTarget.textContent=visible?'Show':'Hide';event.currentTarget.setAttribute('aria-pressed',String(!visible));password.focus();});
  form.addEventListener('submit',async(event)=>{
    event.preventDefault();error.textContent='';if(!form.reportValidity())return;
    const submit=main.querySelector('[data-create]');submit.disabled=true;submit.textContent='Creating account…';form.setAttribute('aria-busy','true');
    try{
      const data=Object.fromEntries(new FormData(form));delete data.accepted;
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
