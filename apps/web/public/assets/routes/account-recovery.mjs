export async function renderAccountRecovery(main,{pageHead}){
 main.innerHTML=`<section class="q-page" data-capability-state="UNAVAILABLE" data-capability="mfa-recovery">
  ${pageHead('Recovery assurance boundary','Account Recovery Controls','Production password recovery remains available through the authenticated email recovery flow. TOTP recovery-code consumption and regeneration are not enabled in the canonical Cloudflare runtime.')}
  <div class="q-two-column">
   <section class="q-panel">
    <div class="q-panel-head"><div><h2>Supported recovery path</h2><p>Use Qelly password recovery when access to the account password is lost. The flow is backed by the canonical authentication runtime and does not expose provider tokens to browser code.</p></div><span class="q-status q-status--live">AVAILABLE</span></div>
    <div class="q-panel-body q-stack">
     <div class="q-record-row"><span><strong>Email recovery request</strong><small>Canonical Cloudflare / Supabase authentication flow.</small></span><span class="q-status q-status--live">SUPPORTED</span></div>
     <div class="q-record-row"><span><strong>Password reset</strong><small>Requires an accepted recovery session and supported server-side reset flow.</small></span><span class="q-status q-status--live">SUPPORTED</span></div>
     <div class="q-record-row"><span><strong>Session revocation after reset</strong><small>Handled by the production recovery reset endpoint.</small></span><span class="q-status q-status--cached">GOVERNED</span></div>
    </div>
   </section>
   <section class="q-panel" data-provenance="canonical-capability-boundary">
    <div class="q-panel-head"><div><h2>MFA recovery codes</h2><p>The earlier local-runtime controls are not production evidence. No recovery code will be accepted, regenerated or displayed by this route.</p></div><span class="q-status q-status--unavailable">UNAVAILABLE</span></div>
    <div class="q-panel-body q-stack">
     <div class="q-record-row"><span><strong>Consume recovery code</strong><small>No canonical Cloudflare endpoint.</small></span><span class="q-status q-status--unavailable">UNAVAILABLE</span></div>
     <div class="q-record-row"><span><strong>Regenerate recovery set</strong><small>No canonical TOTP verification/recovery-code ceremony.</small></span><span class="q-status q-status--unavailable">UNAVAILABLE</span></div>
     <div class="q-empty-state"><h3>Fail-closed identity boundary</h3><p>Qelly will not simulate recovery-code validation or imply that codes are hashed/stored when the canonical runtime does not own that implementation.</p></div>
    </div>
   </section>
  </div>
 </section>`;
}
