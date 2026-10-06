// Missing evidence must never become a numeric zero through Number(null).
export const isFiniteDecisionEvidence=value=>(typeof value==='number'||(typeof value==='string'&&value.trim()!==''))&&Number.isFinite(Number(value));
export const formatDecisionProbability=value=>isFiniteDecisionEvidence(value)?(Number(value)*100).toFixed(1)+'%':'UNCALIBRATED';
