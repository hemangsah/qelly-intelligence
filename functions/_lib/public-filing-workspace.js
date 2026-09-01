const ISSUERS=Object.freeze([
  Object.freeze({id:'QI-EQUITY-AAPL',symbol:'AAPL',name:'Apple Inc.',filingAuthority:'SEC EDGAR',framework:'US GAAP'}),
  Object.freeze({id:'QI-EQUITY-MSFT',symbol:'MSFT',name:'Microsoft Corporation',filingAuthority:'SEC EDGAR',framework:'US GAAP'}),
  Object.freeze({id:'QI-EQUITY-NVDA',symbol:'NVDA',name:'NVIDIA Corporation',filingAuthority:'SEC EDGAR',framework:'US GAAP'})
]);
const FORMS=Object.freeze([
  Object.freeze({id:'10-K',label:'Annual report · 10-K',purpose:'Establish the annual business, risk, accounting and audited-statement record.',sections:['Business','Risk factors','Selected financial data','MD&A','Financial statements','Controls and procedures']}),
  Object.freeze({id:'10-Q',label:'Quarterly report · 10-Q',purpose:'Inspect interim statements, period changes, liquidity and updated risks.',sections:['Financial statements','MD&A','Market risk','Controls and procedures','Risk factors']}),
  Object.freeze({id:'8-K',label:'Current report · 8-K',purpose:'Anchor a material dated event to its exact item and exhibits.',sections:['Item 1 · Registrant business','Item 2 · Financial information','Item 5 · Governance','Item 7 · Regulation FD','Item 8 · Other events','Item 9 · Financial statements and exhibits']}),
  Object.freeze({id:'20-F',label:'Foreign annual report · 20-F',purpose:'Inspect a foreign private issuer annual disclosure under its stated framework.',sections:['Identity','Key information','Company information','Operating and financial review','Financial statements','Controls']})
]);
const EVIDENCE_ROLES=Object.freeze([
  Object.freeze({id:'direct',label:'Direct support',purpose:'The cited disclosure directly states the bounded claim.'}),
  Object.freeze({id:'context',label:'Context',purpose:'The disclosure supplies background but does not prove the full claim.'}),
  Object.freeze({id:'counter',label:'Counter-evidence',purpose:'The disclosure weakens, qualifies or contradicts the claim.'}),
  Object.freeze({id:'definition',label:'Accounting definition',purpose:'The disclosure defines a metric, perimeter or accounting treatment.'})
]);
const text=(value,max=500)=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const date=(value)=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''))?String(value):null;
const choice=(value,catalog,fallback)=>catalog.some((item)=>item.id===value)?value:fallback;
const officialUrl=(value)=>{try{const url=new URL(String(value||''));return url.protocol==='https:'&&(url.hostname==='sec.gov'||url.hostname==='www.sec.gov')?url.href:null;}catch{return null;}};
const fingerprint=(value)=>{let hash=2166136261;for(const char of String(value||'')){hash^=char.codePointAt(0);hash=Math.imul(hash,16777619);}return `fnv1a-${(hash>>>0).toString(16).padStart(8,'0')}`;};

export function buildPublicFilingWorkspace(requestedIssuer='QI-EQUITY-AAPL',input={}){
  const selected=ISSUERS.find((item)=>item.id===requestedIssuer||item.symbol===String(requestedIssuer||'').toUpperCase())||ISSUERS[0];
  const formId=choice(text(input.form,10).toUpperCase(),FORMS,'10-K');
  const evidenceRole=choice(text(input.evidenceRole,20),EVIDENCE_ROLES,'direct');
  const declaration={
    form:formId,filingDate:date(input.filingDate),periodEnd:date(input.periodEnd),officialDocumentUrl:officialUrl(input.officialDocumentUrl),
    section:text(input.section,120),locator:text(input.locator,180),claim:text(input.claim,420),excerpt:text(input.excerpt,1200),evidenceRole
  };
  const required={officialDocumentUrl:Boolean(declaration.officialDocumentUrl),filingDate:Boolean(declaration.filingDate),periodEnd:Boolean(declaration.periodEnd),section:Boolean(declaration.section),locator:Boolean(declaration.locator),claim:Boolean(declaration.claim),excerpt:declaration.excerpt.length>=20};
  const complete=Object.values(required).every(Boolean);
  const canonical=[selected.id,declaration.form,declaration.filingDate||'',declaration.periodEnd||'',declaration.officialDocumentUrl||'',declaration.section,declaration.locator,declaration.claim,declaration.excerpt,declaration.evidenceRole].join('|');
  const citation={state:complete?'ready':'draft',citationId:complete?`${selected.symbol}-${declaration.form}-${fingerprint(canonical).slice(-8)}`:null,fingerprint:fingerprint(canonical),sourceAuthority:selected.filingAuthority,...declaration,verbatim:Boolean(declaration.excerpt),userDeclared:true,originalDocumentStored:false};
  const gates=[
    {id:'identity',label:'Issuer identity',state:'ready',purpose:'Prevent filing attribution to the wrong legal issuer.',detail:`${selected.id} · ${selected.name}`},
    {id:'official-source',label:'Official document',state:required.officialDocumentUrl?'ready':'blocked',purpose:'Require an HTTPS sec.gov source instead of a copied summary.',detail:required.officialDocumentUrl?declaration.officialDocumentUrl:'Paste the exact official SEC document URL.'},
    {id:'filing-date',label:'Filed date',state:required.filingDate?'ready':'blocked',purpose:'Separate filing publication from reporting period.',detail:declaration.filingDate||'Declare YYYY-MM-DD filed date.'},
    {id:'period',label:'Reporting period',state:required.periodEnd?'ready':'blocked',purpose:'Align the disclosure with financial and decision horizons.',detail:declaration.periodEnd||'Declare YYYY-MM-DD period end.'},
    {id:'locator',label:'Section and locator',state:required.section&&required.locator?'ready':'blocked',purpose:'Make the citation reconstructable inside the document.',detail:required.section&&required.locator?`${declaration.section} · ${declaration.locator}`:'Name the section and an exact page, item, heading or paragraph locator.'},
    {id:'claim',label:'Bounded claim',state:required.claim?'ready':'blocked',purpose:'State exactly what the citation is being asked to support.',detail:declaration.claim||'Write one falsifiable claim.'},
    {id:'excerpt',label:'Verbatim excerpt',state:required.excerpt?'ready':'blocked',purpose:'Preserve the relevant language for reviewer comparison.',detail:required.excerpt?`${declaration.excerpt.length} characters declared verbatim.`:'Provide at least 20 characters copied from the official document.'}
  ];
  const readyGates=gates.filter((item)=>item.state==='ready').length;
  return {
    version:'governed-filing-workspace-v2',state:complete?'citation-ready':'source-registration-ready',
    job:'Turn one official issuer disclosure into a reconstructable claim-level citation while preserving form, period, locator, evidence role and source boundaries.',
    issuers:ISSUERS,selected,forms:FORMS,evidenceRoles:EVIDENCE_ROLES,declaration,citation,required,
    coverage:{documents:0,sections:0,citations:complete?1:0,originalDocumentsStored:0,liveIngestion:false,reason:'No production regulatory-document feed or original filing corpus is connected. User-declared citation registration remains available.'},
    gates,readiness:{readyGates,totalGates:gates.length,citationReady:complete,state:complete?'ready-for-review':'blocked-missing-citation-fields'},
    reviewProtocol:[
      {step:'01',label:'Identify',job:'Resolve the legal issuer, filing authority, form, filed date and reporting period.'},
      {step:'02',label:'Locate',job:'Record the exact item, section, heading, page or paragraph inside the official document.'},
      {step:'03',label:'Extract',job:'Preserve only the relevant verbatim excerpt without expanding the claim beyond its language.'},
      {step:'04',label:'Classify',job:'Mark direct support, context, counter-evidence or accounting definition.'},
      {step:'05',label:'Challenge',job:'Compare prior-period language, exhibits, definitions and omitted qualifiers.'},
      {step:'06',label:'Provenance',job:'Send the citation fingerprint and bounded claim to the decision record.'}
    ],
    changeReview:[
      {label:'Language change',question:'What wording was added, removed or narrowed versus the comparable prior filing?'},
      {label:'Definition change',question:'Did management change a metric, segment, perimeter or non-GAAP reconciliation?'},
      {label:'Estimate change',question:'Did a forward-looking statement change horizon, range, confidence or conditions?'},
      {label:'Risk change',question:'Is a previously hypothetical risk now described as occurring or material?'},
      {label:'Exhibit dependency',question:'Does the claim depend on an exhibit, table, footnote or incorporated document?'}
    ],
    handoffs:[
      {route:'fundamentals-estimates',label:'Fundamentals & Estimates',job:'Use cited definitions and periods in the operating model.'},
      {route:'news-research',label:'Qelly Chat & Research',job:'Investigate context, counter-evidence and external developments.'},
      {route:'decision-provenance',label:'Decision Provenance',job:'Attach the citation receipt to a human decision and invalidation rule.'}
    ],
    boundaries:{officialDocumentFetched:false,originalDocumentStored:false,fixtureContent:false,summaryGenerated:false,userDeclaredCitation:true,cryptographicHash:false,fabricatedFallback:false,recommendation:false,execution:false,persistence:false}
  };
}

export const __test=Object.freeze({ISSUERS,FORMS,EVIDENCE_ROLES,text,date,choice,officialUrl,fingerprint});
