// ECB rates describe one daily reference observation. Retrieval is not observation.
const validDay=value=>{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const time=new Date(value+'T00:00:00.000Z');
 return Number.isNaN(time.getTime())||time.toISOString().slice(0,10)!==value?null:value;
};
export function ecbReferenceDay(source){
 const reported=[source?.observationDate,source?.data?.date].filter(value=>value!=null&&value!=='');
 const days=reported.map(validDay);
 if(!days.length||days.some(day=>!day)||new Set(days).size!==1)return null;
 return days[0];
}
export const ecbReferenceCaption=source=>ecbReferenceDay(source)?'Reference date '+ecbReferenceDay(source)+' · daily':'Reference date not supplied';
export function ecbReferenceRates(source){
 const rates=source?.data?.rates;
 if(!rates||typeof rates!=='object'||Array.isArray(rates))return [];
 return ['USD','INR','GBP','JPY','CHF','CNY','CAD','AUD','SGD','AED'].filter(code=>{
  const value=rates[code];return (typeof value==='number'||typeof value==='string'&&value.trim()!=='')&&Number.isFinite(Number(value))&&Number(value)>0;
 }).map(code=>[code,Number(rates[code])]);
}
