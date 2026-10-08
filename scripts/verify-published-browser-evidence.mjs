import {readFile,writeFile,access} from 'node:fs/promises';
import {verifyScreenPackageIntegrity} from './qelly-screen-package-integrity.mjs';
import {validateScreenThemeMatrix} from './qelly-screen-theme-contract.mjs';
import {routeDefinitions} from '../apps/web/public/assets/route-registry.mjs';
const [sha,run,evidenceBase,receiptPath]=process.argv.slice(2);
if(!/^[a-f0-9]{40}$/.test(sha||'')||!/^\d+$/.test(run||'')||!evidenceBase||!receiptPath)throw Error('Exact head, run, downloaded evidence root and receipt path required');
const evidenceLevel=549,pr='549';
const requiredEvidence=['--resource-hints','--public-calculator','--public-theme','--public-shell','--standalone-shell','--calculator-handoff','--auth-callback'];
const market=JSON.parse(await readFile(evidenceBase+'/preview/market-ecb-date-e2e/report.json','utf8'));
if(market.releaseSha!==sha||market.status!=='passed'||market.cases!==4||market.results.length!==4||market.results.some(row=>row.status!=='passed'||row.writes!==0||row.sourceSpecificReferencesVerified!==true||row.networkReferenceDate!=='2026-10-05'||row.intradayTimestampInvented!==false||!row.ecbSourceAttributed||!row.missingObservationsFailClosed))throw Error('Market ECB provenance browser evidence incomplete');
let root=evidenceBase+'/preview/';
try{await access(root+'release-a5-all-screens/checksums.json');}catch{root=evidenceBase+`/qelly-complete-all-screens-${sha}/preview/`;}
const integrity=await verifyScreenPackageIntegrity(root+'release-a5-all-screens',sha);
if(integrity.filesChecked!==303)throw Error('Full current screen checksum census incomplete');
const matrixManifest=JSON.parse(await readFile(root+'release-a5-all-screens/manifest.json','utf8'));
const accessibility=JSON.parse(await readFile(root+'release-a5-all-screens/accessibility-regression.json','utf8'));
if(!validateScreenThemeMatrix(matrixManifest,routeDefinitions).passed||!validateScreenThemeMatrix({...accessibility,renders:accessibility.results,renderCount:accessibility.checks,expectedRenderCount:accessibility.expectedChecks},routeDefinitions).passed)throw Error('Complete screenshot/accessibility matrix incomplete');
const keyboard=JSON.parse(await readFile(root+'chat-keyboard-e2e/report.json','utf8')),calculator=JSON.parse(await readFile(root+'calculator-input-e2e/report.json','utf8'));
for(const [report,count] of [[keyboard,18],[calculator,16]])if(report.releaseSha!==sha||report.cases!==count||report.status!=='passed')throw Error('Interaction report mismatch');
if(keyboard.results.some(row=>row.posts!==0)||calculator.results.some(row=>row.writes!==0))throw Error('Unexpected interaction write');
if(keyboard.results.length!==18||new Set(keyboard.results.map(row=>row.route+'/'+row.width+'/'+row.appearance)).size!==18||keyboard.results.some(row=>![1440,390,320].includes(row.width)||!['dark','light'].includes(row.appearance)||!['mt5-report-analyzer','decision-provenance','news-research'].includes(row.route)||row.newConversationAccessible!==true))throw Error('Expanded Chat matrix incomplete');
let geometryChecks;
if(evidenceLevel>=525){
  if(keyboard.results.some(row=>row.composerGeometryStates!==4))throw Error('Composer geometry states incomplete');
  geometryChecks=keyboard.results.reduce((total,row)=>total+row.composerGeometryStates,0);
}
let identityLinkingCases,messageContainmentChecks;
if(evidenceLevel>=528){
  const identity=JSON.parse(await readFile(root+'identity-linking-e2e/report.json','utf8'));
  if(identity.releaseSha!==sha||identity.status!=='passed'||identity.cases!==12||identity.results.length!==12||identity.results.some(row=>row.passed!==true||row.realIdentityWrites!==0))throw Error('Identity fixture acceptance incomplete or real writes observed');
  identityLinkingCases=12;
}
if(evidenceLevel>=529){
  if(keyboard.results.some(row=>row.messageContainmentChecks!==1))throw Error('Answered-message containment acceptance incomplete');
  messageContainmentChecks=18;
}
let referenceDateCases;
if(evidenceLevel>=531){if(keyboard.results.some(row=>row.referenceDateCases!==1))throw Error('Reference-date citation cases incomplete');referenceDateCases=18;}
let mt5ChartExtremaCases,mt5DuplicateTicketCases;
if(evidenceLevel>=532){const mt5=JSON.parse(await readFile(root+'mt5-upload-e2e/report.json','utf8'));if(mt5.releaseSha!==sha||mt5.status!=='passed'||mt5.fixture!=='synthetic-only'||mt5.results.length!==2||mt5.results.some(row=>row.status!=='passed'||row.chartExtremaCases!==2))throw Error('MT5 extrema upload proof incomplete');if(mt5.results.some(row=>row.duplicateTicketCases!==4))throw Error('Duplicate ticket browser failure evidence incomplete');mt5DuplicateTicketCases=8;mt5ChartExtremaCases=4;}
let converterReferenceDateCases;
if(evidenceLevel>=533){if(calculator.converterReferenceDateCases!==4||calculator.converterReferenceDateResults?.length!==4||calculator.converterReferenceDateResults.some(row=>row.status!=='passed'||row.writes!==0))throw Error('Converter reference-date acceptance incomplete');converterReferenceDateCases=4;}
let decisionInitialLoadingCases;
if(evidenceLevel>=534){const decision=JSON.parse(await readFile(root+'decision-range-e2e/report.json','utf8'));if(decision.frontendHead!==sha||decision.status!=='passed'||decision.results.length!==2||decision.results.some(row=>row.failures.length)||decision.initialLoadingCases!==4||decision.initialLoadingResults.length!==4||decision.initialLoadingResults.some(row=>row.status!=='passed'||row.catalogHeldBeforeDecision!==true))throw Error('Decision initial-loading acceptance incomplete');decisionInitialLoadingCases=4;}
let retailScenarioSummaryChecks;
if(evidenceLevel>=535){const decision=JSON.parse(await readFile(root+'decision-range-e2e/report.json','utf8'));if(decision.results.length!==2||decision.results.some(row=>row.retailScenarioSummaryPassed!==true||!row.retailScenarioText?.includes('Research model share, not a calibrated probability.')))throw Error('Retail scenario boundary acceptance incomplete');retailScenarioSummaryChecks=2;}
let decisionLightPanelContrastCases;
if(evidenceLevel>=535){const decision=JSON.parse(await readFile(root+'decision-range-e2e/report.json','utf8')),light=decision.initialLoadingResults.filter(row=>row.appearance==='light');if(light.length!==2||light.some(row=>row.lightPanelContrast?.length!==5||row.lightPanelContrast.some(panel=>panel.gradient!=='none'||panel.contrast<4.5)))throw Error('Rendered light Decision panel contrast acceptance incomplete');decisionLightPanelContrastCases=2;}
let stylesheetContractCases;
if(evidenceLevel>=537){const manifest=JSON.parse(await readFile(root+'release-a5-all-screens/manifest.json','utf8'));if(manifest.renderCount!==288||manifest.renders?.length!==288||manifest.renders.some(row=>row.stylesheetContract!=='stable'))throw Error('All-route stylesheet identity acceptance incomplete');stylesheetContractCases=288;}
let unobservedScannerSloCases;
if(evidenceLevel>=538){const decision=JSON.parse(await readFile(root+'decision-range-e2e/report.json','utf8'));if(decision.unobservedScannerSloCases!==4||decision.initialLoadingResults.length!==4||decision.initialLoadingResults.some(row=>row.unobservedScannerSlo?.state!=='UNAVAILABLE'||!row.unobservedScannerSlo?.valueText?.startsWith('value unavailable')||!row.unobservedScannerSlo.valueText.includes('n=0/20')))throw Error('Missing scanner measurement acceptance incomplete');unobservedScannerSloCases=4;}
let sloCardReadabilityCases;
if(evidenceLevel>=540){
 const decision=JSON.parse(await readFile(root+'decision-range-e2e/report.json','utf8'));
 if(decision.sloCardReadabilityCases!==4||decision.initialLoadingResults.some(row=>!row.sloCardReadability?.length||row.sloCardReadability.some(card=>card.contentFits!==true||card.textContained!==true)))throw Error('Actual rendered SLO card containment acceptance incomplete');
 sloCardReadabilityCases=4;
}
let macroReferenceDateCases;
if(evidenceLevel>=541){
 const decision=JSON.parse(await readFile(root+'decision-range-e2e/report.json','utf8'));
 if(decision.macroReferenceDateCases!==4||decision.initialLoadingResults.some(row=>row.macroReferenceDate?.date!==row.macroReferenceDate?.fixtureReferenceDate||!row.macroReferenceDate?.boundary?.includes('exact publication time unavailable')))throw Error('Decision date-only reference acceptance incomplete');
 macroReferenceDateCases=4;
}
let stylesheetReadinessCases,resourceHintCases,publicCalculatorValidationCases,publicCalculatorThemeCases,publicCalculatorCloudPreferenceCases,publicCalculatorShellCases;
let standalonePublicShellCases,publicCalculatorHandoffCases,authCallbackAppearanceCases;
if(pr==='542'||requiredEvidence.includes('--resource-hints')){const decision=JSON.parse(await readFile(root+'decision-range-e2e/report.json','utf8'));if(decision.stylesheetReadinessCases!==4||decision.initialLoadingResults.some(row=>row.stylesheetReadyBeforeContent!==true))throw Error('Decision stylesheet readiness evidence incomplete');stylesheetReadinessCases=4;}
if(requiredEvidence.includes('--resource-hints')){const decision=JSON.parse(await readFile(root+'decision-range-e2e/report.json','utf8'));if(decision.resourceHintCases!==4||decision.initialLoadingResults.some(row=>row.resourceHints?.length!==2))throw Error('Decision resource hint evidence incomplete');resourceHintCases=4;}
if(requiredEvidence.includes('--public-calculator')){if(calculator.publicCalculatorValidationCases!==4||calculator.publicCalculatorValidationResults?.length!==4||calculator.publicCalculatorValidationResults.some(row=>row.status!=='passed'||row.writes!==0||row.checks?.length!==5))throw Error('Public calculator validation evidence incomplete');publicCalculatorValidationCases=4;}
if(requiredEvidence.includes('--public-theme')){const rows=calculator.publicCalculatorThemeResults;if(calculator.publicCalculatorThemeCases!==8||rows?.length!==8||new Set(rows.map(row=>[row.surface,row.width,row.appearance].join(':'))).size!==8||rows.some(row=>row.status!=='passed'||row.writes!==0||row.contrast<4.5||!Number.isFinite(row.contrast)||row.persistedAppearance!==(row.appearance==='light'?'dark':'light')))throw Error('Public calculator appearance evidence incomplete');publicCalculatorThemeCases=8;}
if(requiredEvidence.includes('--public-theme')){const rows=calculator.publicCalculatorCloudPreferenceResults;if(calculator.publicCalculatorCloudPreferenceCases!==4||rows?.length!==4||new Set(rows.map(row=>[row.width,row.appearance].join(':'))).size!==4||rows.some(row=>row.status!=='passed'||row.fixtureOnly!==true||row.realWrites!==0||row.successfulPreferenceWrites!==2||row.failedPreferenceWrites!==1||['csrfPreserved','revisionPreserved','calculatorValuesExcluded','failedSaveStayedLocal','explicitRetryRecovered'].some(key=>row[key]!==true)))throw Error('Authenticated preference fixture evidence incomplete');publicCalculatorCloudPreferenceCases=4;}
if(requiredEvidence.includes('--public-shell')){const rows=calculator.publicCalculatorShellResults,expected=new Set(['library','calculator'].flatMap(surface=>[1440,390].flatMap(width=>['dark','light'].map(appearance=>[surface,width,appearance].join(':')))));if(calculator.publicCalculatorShellCases!==8||rows?.length!==8||new Set(rows.map(row=>[row.surface,row.width,row.appearance].join(':'))).size!==8||rows.some(row=>!expected.has([row.surface,row.width,row.appearance].join(':'))||row.status!=='passed'||row.writes!==0||row.categories!==5||['oneSharedAssistant','centered','inputValuesExcluded','keyboardClose','mobileBoundaryRestored'].some(key=>row[key]!==true)))throw Error('Public calculator shared dock/navigation evidence incomplete');publicCalculatorShellCases=8;}
if(requiredEvidence.includes('--standalone-shell')){const rows=calculator.standalonePublicShellResults,paths=['legal/beta.html','legal/privacy.html','legal/risk.html','legal/terms.html','support.html',...['bitcoin-btc','ethereum-eth','solana-sol','xrp','hyperliquid-hype','dogecoin-doge'].map(slug=>`research/assets/${slug}/index.html`)],expected=new Set(paths.flatMap(path=>[1440,390].flatMap(width=>['dark','light'].map(appearance=>[path,width,appearance].join(':')))));if(calculator.standalonePublicShellCases!==44||rows?.length!==44||new Set(rows.map(row=>[row.path,row.width,row.appearance].join(':'))).size!==44||rows.some(row=>!expected.has([row.path,row.width,row.appearance].join(':'))||row.status!=='passed'||row.writes!==0||row.categories!==5||!Number.isFinite(row.contrast)||row.contrast<4.5||['titlePreserved','contextPreserved','privateUrlExcluded','imagesLoaded','mobileBoundaryRestored'].some(key=>row[key]!==true)))throw Error('Standalone public shell evidence incomplete');standalonePublicShellCases=44;}
if(requiredEvidence.includes('--calculator-handoff')){const rows=calculator.publicCalculatorHandoffResults,expected=new Set([1440,390].flatMap(width=>['dark','light'].map(appearance=>[width,appearance].join(':'))));if(calculator.publicCalculatorHandoffCases!==4||rows?.length!==4||new Set(rows.map(row=>[row.width,row.appearance].join(':'))).size!==4||rows.some(row=>!expected.has([row.width,row.appearance].join(':'))||row.status!=='passed'||row.writes!==0||['explicitDraft','receiptVerified','unsentDraftPreserved','zeroPreserved','invalidDisabled'].some(key=>row[key]!==true)))throw Error('Explicit calculator receipt handoff evidence incomplete');publicCalculatorHandoffCases=4;}
if(requiredEvidence.includes('--auth-callback')){const rows=calculator.authCallbackAppearanceResults,expected=new Set([1440,390].flatMap(width=>['dark','light'].map(appearance=>[width,appearance].join(':'))));if(calculator.authCallbackAppearanceCases!==4||rows?.length!==4||new Set(rows.map(row=>[row.width,row.appearance].join(':'))).size!==4||rows.some(row=>!expected.has([row.width,row.appearance].join(':'))||row.status!=='passed'||row.writes!==0||!Number.isFinite(row.contrast)||row.contrast<4.5||['callbackUrlCleared','privateUrlExcluded','noAssistant','incompleteLinkFailClosed','localThemePersistence'].some(key=>row[key]!==true)))throw Error('Isolated authentication callback appearance evidence incomplete');authCallbackAppearanceCases=4;}
const result={stylesheetReadinessCases,resourceHintCases,publicCalculatorValidationCases,publicCalculatorThemeCases,publicCalculatorCloudPreferenceCases,publicCalculatorShellCases,standalonePublicShellCases,publicCalculatorHandoffCases,authCallbackAppearanceCases,macroReferenceDateCases,sloCardReadabilityCases,unobservedScannerSloCases,stylesheetContractCases,retailScenarioSummaryChecks,decisionLightPanelContrastCases,...integrity,browserRun:Number(run),verificationLocation:'Published artifact downloaded and verified on GitHub hosted runner',chatKeyboardCases:18,calculatorInputCases:16,composerGeometryChecks:geometryChecks,marketEcbReferenceCases:4,marketSourceSpecificReferencesVerified:true,identityLinkingCases,messageContainmentChecks,referenceDateCases,mt5ChartExtremaCases,mt5DuplicateTicketCases,converterReferenceDateCases,decisionInitialLoadingCases};
await writeFile(receiptPath,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
