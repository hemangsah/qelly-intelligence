const recoveryMessage=(error)=>{
  if(error?.status===429)return'Too many recovery emails were requested. Wait before trying again.';
  if(!navigator.onLine)return'You are offline. Reconnect before requesting recovery.';
  return'Qelly could not send the recovery email. Try again shortly.';
};

export async function renderAuthRecovery(main,{api,toast,navigate}){
let emailDelivery=false;
try{emailDelivery=(await api('/api/v1/config'))?.auth?.emailDeliveryAvailable===true;}catch{}
if(!emailDelivery){
  main.innerHTML=`<section class="q-auth-page" data-production-auth="unavailable"><div class="q-auth-hero"><div><p class="q-eyebrow">Account recovery</p><h1>Password recovery is not available yet.</h1><p>If you can access your password, return to sign in. Markets, research and calculation tools remain available without an account.</p></div></div><div class="q-auth-card"><div><p class="q-eyebrow">Existing member</p><h2>Return to sign in</h2><p class="q-muted-copy">No recovery request has been sent and no account information has changed.</p></div><div class="q-auth-footer"><button class="q-button q-button--primary" type="button" data-login>Return to sign in</button><button class="q-button q-button--ghost" type="button" data-home>Return home</button></div></div></section>`;
  main.querySelector('[data-login]').addEventListener('click',()=>navigate('auth-login'));
  main.querySelector('[data-home]').addEventListener('click',()=>navigate('market'));
  return;
}
  main.innerHTML=`<section class="q-auth-page" data-production-auth="true">
    <div class="q-auth-hero"><div><p class="q-eyebrow">Account recovery</p><h1>Reset your Qelly password.</h1><p>Enter your account email. If it is registered, Qelly will send a single-use recovery link to the allowlisted public callback.</p></div><div class="q-auth-proof-grid"><article><strong>Private</strong><span>Generic response</span></article><article><strong>Single use</strong><span>Expiring recovery link</span></article><article><strong>Protected</strong><span>Sessions revoked after reset</span></article></div></div>
    <div class="q-auth-card"><div><p class="q-eyebrow">Forgot password?</p><h2>Send a recovery link</h2><p class="q-muted-copy">For privacy, the response will not reveal whether an email is registered.</p></div>
      <form class="q-auth-form" data-request novalidate><label>Email<input name="email" type="email" inputmode="email" autocomplete="username" required placeholder="you@example.com" aria-describedby="recovery-status"></label><button class="q-button q-button--primary" data-recovery-submit>Send recovery link</button><p id="recovery-status" class="q-form-error" role="alert" aria-live="polite" data-request-status></p></form>
      <div class="q-auth-footer"><span>Remembered your password?</span><button class="q-button q-button--ghost" type="button" data-login>Sign in</button><button class="q-button q-button--ghost" type="button" data-home>Return home</button></div>
    </div>
  </section>`;
  main.querySelector('[data-login]').addEventListener('click',()=>navigate('auth-login'));
  main.querySelector('[data-home]').addEventListener('click',()=>navigate('market'));
  const form=main.querySelector('[data-request]'),status=main.querySelector('[data-request-status]');
  form.addEventListener('submit',async(event)=>{
    event.preventDefault();status.textContent='';if(!form.reportValidity())return;
    const button=main.querySelector('[data-recovery-submit]');button.disabled=true;button.textContent='Sending…';form.setAttribute('aria-busy','true');
    try{const email=new FormData(form).get('email');await api('/api/v1/auth/recovery/request',{method:'POST',body:JSON.stringify({email}),skipCsrf:true});form.innerHTML=`<div class="q-auth-confirmation" role="status"><strong>Check your email</strong><p>If an account exists for that address, a recovery link has been sent. Open it on this device to choose a new password.</p></div><button class="q-button q-button--primary" type="button" data-recovery-login>Return to sign in</button>`;form.querySelector('[data-recovery-login]').addEventListener('click',()=>navigate('auth-login'));toast('Recovery request accepted',{tone:'success'});}
    catch(error){status.textContent=recoveryMessage(error);toast(status.textContent,{tone:'danger'});button.disabled=false;button.textContent='Send recovery link';form.removeAttribute('aria-busy');}
  });
}
