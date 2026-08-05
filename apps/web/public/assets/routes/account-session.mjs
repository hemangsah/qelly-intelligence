const esc=(value,escapeHtml)=>escapeHtml(value??'—');

export async function renderAccountSession(main,{api,pageHead,escapeHtml,toast,onLoggedOut,onAuthenticated}){
  const [status,sessions]=await Promise.all([
    api('/api/v1/auth/status'),
    api('/api/v1/sessions').catch(()=>({scope:'current-session-only',items:[]}))
  ]);
  const context=status.context;
  const current=sessions.items?.find(item=>item.current)||sessions.items?.[0]||null;
  main.innerHTML=`<section class="q-page">
    ${pageHead('Account security','Account and current session','Inspect the authenticated identity, active workspace and this browser session. Passkeys, multi-device session inventory, persistent jobs and worker notifications are not available in this release.',`<button class="q-button q-button--secondary" data-refresh>Refresh this session</button><button class="q-button q-button--primary" data-logout>Sign out this browser</button>`)}
    <div class="q-kpi-grid">
      <article class="q-kpi"><div class="q-kpi-label">Identity mode</div><div class="q-kpi-value q-kpi-value--text">${esc(context?.mode,escapeHtml)}</div><div class="q-kpi-meta"><span>HttpOnly cookie session</span><span class="q-status q-status--live">active</span></div></article>
      <article class="q-kpi"><div class="q-kpi-label">Workspace</div><div class="q-kpi-value q-kpi-value--text">${esc(context?.workspace?.name,escapeHtml)}</div><div class="q-kpi-meta"><span>${esc(context?.workspace?.workspaceId,escapeHtml)}</span><span class="q-status q-status--cached">current</span></div></article>
      <article class="q-kpi"><div class="q-kpi-label">Email identity</div><div class="q-kpi-value q-kpi-value--text">${esc(context?.user?.email,escapeHtml)}</div><div class="q-kpi-meta"><span>${context?.user?.emailConfirmedAt?'Confirmed':'Confirmation not recorded'}</span><span class="q-status q-status--${context?.user?.emailConfirmedAt?'live':'warning'}">${context?.user?.emailConfirmedAt?'verified':'pending'}</span></div></article>
      <article class="q-kpi"><div class="q-kpi-label">Assurance</div><div class="q-kpi-value q-kpi-value--text">${esc(context?.session?.assurance,escapeHtml)}</div><div class="q-kpi-meta"><span>Email and password</span><span class="q-status q-status--cached">declared method</span></div></article>
    </div>
    <div class="q-two-column">
      <section class="q-panel"><div class="q-panel-head"><div><h2>Current browser session</h2><p>This is a summary of the session used by the current browser. It is not a complete multi-device session inventory.</p></div><span class="q-status q-status--cached">${current?'1':'0'}</span></div><div class="q-panel-body q-stack">${current?`<div class="q-record-row"><span><strong>${esc(current.authenticationMethod,escapeHtml)}</strong><small>${esc(current.sessionId,escapeHtml)} · expires ${new Date(current.expiresAt).toLocaleString()}</small></span><span class="q-status q-status--live">current</span></div>`:'<div class="q-empty-state"><h3>Session details unavailable</h3><p>Qelly could not retrieve the current browser-session summary.</p></div>'}</div></section>
      <section class="q-panel"><div class="q-panel-head"><div><h2>Capability boundaries</h2><p>Unavailable controls are declared here rather than presented as operational systems.</p></div><span class="q-status q-status--warning">limited release</span></div><div class="q-panel-body"><ul><li>Passkey registration and authentication are disabled.</li><li>Multi-device session listing and remote revocation are not implemented.</li><li>Persistent background jobs are not implemented.</li><li>Worker-delivered production notifications are not implemented.</li><li>Signing out affects this browser session; it is not a global-device logout.</li></ul></div></section>
    </div>
  </section>`;
  main.querySelector('[data-logout]').addEventListener('click',async()=>{
    try{
      await api('/api/v1/auth/logout',{method:'POST',body:'{}'});
      toast('Signed out from this browser',{tone:'success'});
      await onLoggedOut();
    }catch(error){toast(error.message,{tone:'danger'});}
  });
  main.querySelector('[data-refresh]').addEventListener('click',async()=>{
    try{
      await api('/api/v1/auth/refresh',{method:'POST',body:'{}'});
      toast('Current browser session refreshed',{tone:'success'});
      await onAuthenticated('account-session');
    }catch(error){toast(error.message,{tone:'danger'});}
  });
}
