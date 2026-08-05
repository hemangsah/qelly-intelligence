export const INDIA_RULE_REGISTRY=Object.freeze({
  schemaVersion:1,
  jurisdiction:'IN',
  retrievalDate:'2026-07-29',
  truthBoundary:'Only effective-dated entries marked VERIFIED may be used automatically. All other statutory or provider-specific rates require user input and are reported unavailable.',
  rules:[
    {ruleId:'india-tax-framework',name:'India income-tax framework',effectiveFrom:'2025-04-01',effectiveTo:null,status:'UNAVAILABLE_PENDING_PRIMARY_SOURCE_REVERIFICATION',sourceAuthority:'Income Tax Department / Union Budget',sourceUrl:'https://www.incometax.gov.in/',automaticRateUse:false},
    {ruleId:'india-statutory-trading-costs',name:'STT/CTT/GST/SEBI/stamp/exchange charge framework',effectiveFrom:'2026-07-29',effectiveTo:null,status:'USER_ENTERED_ONLY',sourceAuthority:'Government of India, SEBI and applicable exchange circulars',sourceUrl:'https://www.sebi.gov.in/',automaticRateUse:false},
    {ruleId:'india-government-schemes',name:'PPF/EPF/NPS/NSC/SSY/SCSS rule framework',effectiveFrom:'2026-07-29',effectiveTo:null,status:'UNAVAILABLE_PENDING_SCHEME_SPECIFIC_PRIMARY_SOURCE_REVERIFICATION',sourceAuthority:'Applicable Government of India authority',sourceUrl:'https://www.india.gov.in/',automaticRateUse:false}
  ]
});
export function selectIndiaRule(ruleId,effectiveDate=new Date().toISOString().slice(0,10)){
  const rule=INDIA_RULE_REGISTRY.rules.find(item=>item.ruleId===ruleId&&item.effectiveFrom<=effectiveDate&&(!item.effectiveTo||item.effectiveTo>=effectiveDate));
  if(!rule)return {ruleId,effectiveDate,status:'UNAVAILABLE',message:'No effective-dated rule is registered for this date.'};
  return {...rule,effectiveDate,available:rule.status==='VERIFIED'&&rule.automaticRateUse===true};
}
export function calculateCustomIndiaCharges({turnover=0,brokerage=0,exchangeCharges=0,stt=0,ctt=0,sebiCharges=0,stampDuty=0,dpCharges=0,gstRatePercent=18,otherCharges=0}={}){
  const n=(value,name)=>{const number=Number(value);if(!Number.isFinite(number)||number<0)throw new Error(`${name} must be a non-negative number`);return number;};
  const base=n(brokerage,'brokerage')+n(exchangeCharges,'exchangeCharges')+n(sebiCharges,'sebiCharges');
  const gst=base*n(gstRatePercent,'gstRatePercent')/100;
  const statutory=n(stt,'stt')+n(ctt,'ctt')+n(stampDuty,'stampDuty');
  const total=base+gst+statutory+n(dpCharges,'dpCharges')+n(otherCharges,'otherCharges');
  return {turnover:n(turnover,'turnover'),brokerage:n(brokerage,'brokerage'),exchangeCharges:n(exchangeCharges,'exchangeCharges'),stt:n(stt,'stt'),ctt:n(ctt,'ctt'),sebiCharges:n(sebiCharges,'sebiCharges'),stampDuty:n(stampDuty,'stampDuty'),dpCharges:n(dpCharges,'dpCharges'),gst,total,truthState:'USER_ENTERED_CUSTOM_RATES',warning:'No broker or statutory rate is assumed universally. Verify current official and provider-specific schedules.'};
}
