const root=document.getElementById('qelly-auth-callback');
const setState=(title,message,tone='working')=>{root.dataset.state=tone;root.querySelector('h1').textContent=title;root.querySelector('p').textContent=message;};
const api=async(path,options={})=>{const response=await fetch(path,{credentials:'include',headers:{'Content-Type':'application/json',...(options.headers||{})},...options});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.error?.message||body.error||`Request failed (${response.status})`);return body;};
const hash=new URLSearchParams(location.hash.replace(/^#/,''));
const query=new URLSearchParams(location.search);
const flow=hash.get('type')||query.get('flow')||'signup';
const accessToken=hash.get('access_token');
const refreshToken=hash.get('refresh_token');
const expiresIn=Number(hash.get('expires_in')||3600);
const errorDescription=hash.get('error_description')||query.get('error_description');
const clearSensitiveUrl=()=>history.replaceState({},document.title,location.pathname+(query.toString()?`?${query}`:''));
const redirect=(route,delay=900)=>setTimeout(()=>location.replace(`/#/${route}`),delay);
async function start(){
  if(errorDescription){setState('Authentication could not be completed',errorDescription,'error');return;}
  if(!accessToken||!refreshToken){setState('Authentication callback is incomplete','The verification link did not include a usable Supabase session. Request a new link from Qelly.','error');return;}
  try{
    const sessionResult=await api('/api/v1/auth/session',{method:'POST',body:JSON.stringify({accessToken,refreshToken,expiresIn,type:flow})});
    const csrf=sessionResult.csrf?.token||'';
    clearSensitiveUrl();
    if(flow==='recovery'){
      setState('Recovery session verified','Enter a new strong password to finish recovery.','ready');
      const form=document.getElementById('recovery-form');form.hidden=false;
      form.addEventListener('submit',async event=>{event.preventDefault();const button=form.querySelector('button');button.disabled=true;try{const newPassword=new FormData(form).get('newPassword');await api('/api/v1/auth/recovery/reset',{method:'POST',headers:{'X-Qelly-CSRF':csrf},body:JSON.stringify({newPassword})});setState('Password updated','Your recovery session was consumed and existing sessions were revoked.','success');form.hidden=true;redirect('auth-login',1200);}catch(error){setState('Password reset failed',error.message,'error');button.disabled=false;}});
      return;
    }
    setState('Email verified','Your Supabase identity and Qelly workspace are ready.','success');redirect('account-session');
  }catch(error){clearSensitiveUrl();setState('Authentication could not be completed',error.message,'error');}
}
start();
