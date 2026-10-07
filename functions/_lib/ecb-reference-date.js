export const ecbReferenceDate=value=>{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const date=new Date(value+'T00:00:00.000Z');
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value?value:null;
};
// The ECB daily XML declares a reference date, not an exact UTC publication time.
// Apply this to older cache payloads too, so a previously appended clock is removed.
export const withEcbReferenceDate=payload=>({...payload,observationTime:null,observedAt:null,observationDate:ecbReferenceDate(payload?.data?.date),observationTimePrecision:'date',observationTimeBoundary:'ECB reference date only; exact publication time is unavailable.'});
