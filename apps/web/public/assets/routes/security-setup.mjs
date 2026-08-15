export async function renderSecuritySetup(main,{pageHead}){
 main.innerHTML=`<section class="q-page" data-capability-state="UNAVAILABLE" data-capability="mfa">
  ${pageHead('Identity assurance boundary','Authenticator MFA','TOTP enrollment and recovery-code management are not enabled in the canonical Cloudflare runtime. Qelly will not present local-only identity controls as production capabilities.')}
  <section class="q-panel" data-provenance="canonical-capability-boundary">
   <div class="q-panel-head"><div><p class="q-eyebrow">Current production state</p><h2>Authenticator MFA is unavailable</h2><p>The previous interface called local-runtime MFA endpoints that Cloudflare does not own. Those controls are retired until the complete enrollment, confirmation, recovery, revocation and audit ceremony is implemented and accepted.</p></div><span class="q-status q-status--unavailable">UNAVAILABLE</span></div>
   <div class="q-panel-body q-stack">
    <div class="q-record-row"><span><strong>Canonical runtime</strong><small>Cloudflare Pages Functions</small></span><span class="q-status q-status--cached">SOURCE OF TRUTH</span></div>
    <div class="q-record-row"><span><strong>Current authentication</strong><small>Email/password session and supported recovery flow</small></span><span class="q-status q-status--live">AVAILABLE</span></div>
    <div class="q-record-row"><span><strong>TOTP enrollment</strong><small>No production challenge/secret confirmation endpoint is active.</small></span><span class="q-status q-status--unavailable">UNAVAILABLE</span></div>
    <div class="q-record-row"><span><strong>Recovery codes</strong><small>No production generation, hashing, consumption or regeneration ceremony is active.</small></span><span class="q-status q-status--unavailable">UNAVAILABLE</span></div>
    <div class="q-record-row"><span><strong>Financial authority</strong><small>Identity assurance never authorizes trading, custody, transfers, wallet signing or money movement.</small></span><span class="q-status q-status--cached">NONE</span></div>
    <div class="q-empty-state"><h3>No MFA operation will be attempted</h3><p>This route intentionally performs no MFA API calls. Browser capability or local-server code is not sufficient evidence that production MFA exists.</p></div>
   </div>
  </section>
 </section>`;
}
