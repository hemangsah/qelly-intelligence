// Missing evidence must not acquire a value through JavaScript coercion.
// Zero and signed values remain valid statistics; domain rules apply separately.
export function finiteEvidenceValue(value){
  if(typeof value!=='number'&&typeof value!=='string')return null;
  if(typeof value==='string'&&!value.trim())return null;
  const number=Number(value);
  return Number.isFinite(number)?number:null;
}
