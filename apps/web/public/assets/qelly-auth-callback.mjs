const root=document.getElementById('qelly-auth-callback');
const setState=(title,message,tone='working')=>{root.dataset.state=tone;root.querySelector('h1').textContent=title;root.querySelector('p').textContent=message;};
const api=async(path,options={})=>{const response=await fetch(path,{credentials:'include',headers:{'Content-Type':'application/json',...(options.headers||{})},...options});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.error?.message||body.error||`Request failed (${response.status})`);return body;};
const query=new URLSearchParams(location.search);
const flow=query.get('flow')||'signup';
const code=query.get('code');
const state=query.get('state');
const nonce=query.get('nonce');
const errorDescription=query.get('error_description')||query.get('error');
const clearSensitiveUrl=()=>history.replaceState({},document.title,location.pathname);
const redirect=(route,delay=900)=>setTimeout(()=>location.replace(`/#/${route}`),delay);

async function start(){
  clearSensitiveUrl();
  if(errorDescription){setState('Authentication could not be completed',errorDescription,'error');return;}
  if(!code||!state||!nonce){setState('Authentication callback is incomplete','The verification link did not include a usable one-time authorization code. Request a new link from Qelly.','error');return;}
  try{
    const sessionResult=await api('/api/v1/auth/callback',{method:'POST',body:JSON.stringify({code,state,nonce,flow})});
    const csrf=sessionResult.csrf?.token||'';
    if(flow==='recovery'){
      setState('Recovery session verified','Enter a new strong password to finish recovery.','ready');
      const form=document.getElementById('recovery-form');
      form.hidden=false;
      form.addEventListener('submit',async event=>{
        event.preventDefault();
        const button=form.querySelector('button');
        button.disabled=true;
        try{
          const newPassword=new FormData(form).get('newPassword');
          await api('/api/v1/auth/recovery/reset',{method:'POST',headers:{'X-Qelly-CSRF':csrf},body:JSON.stringify({newPassword})});
          setState('Password updated','Your recovery transaction was consumed and existing sessions were revoked.','success');
          form.hidden=true;
          redirect('auth-login',1200);
        }catch(error){
          setState('Password reset failed',error.message,'error');
          button.disabled=false;
        }
      });
      return;
    }
    setState('Email verified','Your Supabase identity and Qelly workspace are ready.','success');
    redirect('account-session');
  }catch(error){
    setState('Authentication could not be completed',error.message,'error');
  }
}

start();
