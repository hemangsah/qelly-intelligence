export async function renderPasskeyCenter(main,{pageHead,navigate}){
  main.innerHTML=`<section class="q-page">
    ${pageHead('Capability boundary','Passkey Center','Passkeys are not enabled in this production release. Qelly will not register, authenticate, list or revoke WebAuthn credentials until the complete server ceremony is implemented and independently accepted.')}
    <section class="q-panel">
      <div class="q-panel-head"><div><p class="q-eyebrow">Current release state</p><h2>Passkeys are unavailable</h2><p>The previous interface described a WebAuthn capability that was not backed by accepted production API routes. That control has been disabled rather than simulated.</p></div><span class="q-status q-status--warning">Unavailable</span></div>
      <div class="q-panel-body q-stack">
        <div class="q-empty-state"><h3>No passkey operation will be attempted</h3><p>Email and password remain the only declared authentication method for this release. Browser WebAuthn support alone does not make Qelly passkeys operational.</p></div>
        <ul>
          <li>No registration challenge is requested.</li>
          <li>No authentication challenge is requested.</li>
          <li>No credential list or revocation endpoint is called.</li>
          <li>Private authenticator keys are never requested by this disabled surface.</li>
        </ul>
        <div class="q-actions"><button class="q-button q-button--primary" type="button" data-account>Return to account</button><button class="q-button q-button--ghost" type="button" data-market>Return to markets</button></div>
      </div>
    </section>
  </section>`;
  main.querySelector('[data-account]')?.addEventListener('click',()=>navigate('account-session'));
  main.querySelector('[data-market]')?.addEventListener('click',()=>navigate('market'));
}
