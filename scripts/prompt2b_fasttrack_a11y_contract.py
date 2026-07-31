ROUTES = {
    'auth-login': ('auth-login', False), 'auth-register': ('auth-register', False), 'auth-recovery': ('auth-recovery', False),
    'account-session': ('account-session', True), 'onboarding': ('onboarding', True), 'discovery-hub': ('discovery-hub', True),
    'live-markets': ('live-markets', True), 'identity-access': ('identity-access', True), 'security-evidence': ('security-evidence', True),
    'security-setup': ('security-setup', True), 'secure-import-vault': ('secure-import-vault', True), 'passkey-center': ('passkey-center', True),
    'account-recovery': ('account-recovery', True), 'delivery-operations': ('delivery-operations', True), 'platform-readiness': ('platform-readiness', True),
    'secret-rotation': ('secret-rotation', True), 'quarantine-review': ('quarantine-review', True), 'staging-assurance': ('staging-assurance', True),
    'calculator-center': ('calculator-center', False), 'india-finance': ('india-finance', False), 'indicator-library': ('indicator-library', False),
    'formula-library': ('formula-library', False), 'saved-calculations': ('saved-calculations', False),
    'formula-detail': ('formula-detail/fresh-present-value', False), 'indicator-detail': ('indicator-detail/fresh-price-momentum', False),
    'calculator-detail': ('calculator-detail/fresh-present-value', False), 'saved-calculation-detail': ('saved-calculation-detail/prompt2b-review-saved', False)
}
VIEWPORTS = [('desktop', {'width': 1440, 'height': 1000}), ('mobile', {'width': 390, 'height': 844})]
EXPECTED_CHECKS = 2

launcher = r'''
import { startServer } from './src/server/server.mjs';
const environment={...process.env,NODE_ENV:'test',QELLY_PRODUCTION_FOUNDATION_ENABLED:'true',QELLY_PRODUCTION_IDENTITY_ENABLED:'true',QELLY_DEVELOPMENT_IDENTITY_ENABLED:'false',QELLY_DATABASE_MODE:'sqlite',QELLY_JOB_QUEUE_MODE:'database',QELLY_SESSION_SECRET:'prompt2b-a11y-session-secret-0000000000001',QELLY_PASSWORD_PEPPER:'prompt2b-a11y-pepper',QELLY_SECRET_KEYRING_JSON:JSON.stringify({old:'old-secret-material-abcdefghijklmnopqrstuvwxyz',active:'active-secret-material-abcdefghijklmnopqrstuvwxyz'}),QELLY_SECRET_ACTIVE_KEY_ID:'active'};
const x=await startServer({port:0,runtimePath:process.argv[1],environment});
console.log(JSON.stringify({host:x.host,port:x.port}));
process.on('SIGTERM',()=>x.server.close(()=>process.exit(0)));setInterval(()=>{},1000);
'''
EVALUATE = r'''() => {
 const visible=el=>!!(el.offsetWidth||el.offsetHeight||el.getClientRects().length);
 const controls=[...document.querySelectorAll('button,input,select,textarea,a[href]')].filter(visible);
 const named=el=>Boolean((el.getAttribute('aria-label')||el.getAttribute('title')||(el.textContent||'').trim()||(el.labels&&[...el.labels].some(l=>(l.textContent||'').trim()))));
 const ids=[...document.querySelectorAll('[id]')].map(x=>x.id);
 return {lang:document.documentElement.lang,title:document.title,skipLink:!!document.querySelector('a.skip-link[href="#main"]'),mainCount:document.querySelectorAll('main#main').length,h1Count:document.querySelectorAll('main#main h1').length,unlabeled:controls.filter(x=>!named(x)).map(x=>({tag:x.tagName,id:x.id||null})).slice(0,10),missingAlt:[...document.querySelectorAll('img:not([alt])')].length,positiveTabindex:[...document.querySelectorAll('[tabindex]')].filter(x=>Number(x.getAttribute('tabindex'))>0).length,duplicateIds:[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))],overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,controls:controls.length,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,fontStatus:document.fonts.status};
}'''
SAVED_SEED = {'schemaVersion':2,'items':[{'id':'prompt2b-review-saved','name':'Prompt 2B Review Present Value','savedAt':'2026-07-30T00:00:00.000Z','updatedAt':'2026-07-30T00:05:00.000Z','schemaVersion':2,'version':2,'formulaVersion':'2.0.0','indicatorVersion':None,'indiaRuleVersion':None,'effectiveDate':'2026-07-30','result':{'status':'success','formulaId':'fresh-present-value','formulaVersion':'2.0.0','outputs':{'value':100},'truthState':'FRESH_REIMPLEMENTATION_2026'},'notes':'Accessibility review seed','tags':['prompt2b','a11y'],'favorite':True,'revisions':[{'revisionId':'a11y-r1','version':1,'createdAt':'2026-07-30T00:00:00.000Z','restoredFrom':None,'name':'Prompt 2B Review Present Value','result':{'status':'success','formulaId':'fresh-present-value','formulaVersion':'2.0.0','outputs':{'value':100}},'notes':'Baseline','tags':['prompt2b'],'favorite':False,'formulaVersion':'2.0.0','indicatorVersion':None,'indiaRuleVersion':None,'effectiveDate':'2026-07-30'},{'revisionId':'a11y-r2','version':2,'createdAt':'2026-07-30T00:05:00.000Z','restoredFrom':None,'name':'Prompt 2B Review Present Value','result':{'status':'success','formulaId':'fresh-present-value','formulaVersion':'2.0.0','outputs':{'value':100}},'notes':'Accessibility review seed','tags':['prompt2b','a11y'],'favorite':True,'formulaVersion':'2.0.0','indicatorVersion':None,'indiaRuleVersion':None,'effectiveDate':'2026-07-30'}]}]}
