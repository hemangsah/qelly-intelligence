const MACHINE_TOLERANCE_MULTIPLIER=64;

const invalidCovarianceResult=(result)=>({
  ...result,
  outputs:null,
  outputUnits:{},
  confidence:'invalid',
  status:'validation_error',
  warnings:[],
  validationErrors:[{
    code:'invalid_covariance_matrix',
    message:'covarianceMatrix produces a materially negative portfolio variance and cannot represent the requested portfolio risk consistently',
    field:'covarianceMatrix'
  }]
});

const absoluteContributionScale=(matrix,weights)=>{
  if(!Array.isArray(matrix)||!Array.isArray(weights)||matrix.length!==weights.length)return 1;
  let scale=0;
  for(let i=0;i<weights.length;i++){
    if(!Array.isArray(matrix[i])||matrix[i].length!==weights.length)return 1;
    for(let j=0;j<weights.length;j++){
      const covariance=Number(matrix[i][j]);
      if(!Number.isFinite(covariance))return 1;
      scale+=Math.abs(weights[i]*weights[j]*covariance);
    }
  }
  return Math.max(1,scale);
};

export function correctPortfolioVarianceResult(formulaId,result){
  if(formulaId!=='portfolio-volatility'||result?.status!=='success'||!result.outputs)return result;
  const variance=Number(result.outputs.portfolioVariance);
  if(!Number.isFinite(variance)||variance>=0)return result;

  const matrix=result.normalizedInputs?.covarianceMatrix;
  const weights=result.outputs.normalizedWeights;
  const tolerance=MACHINE_TOLERANCE_MULTIPLIER*Number.EPSILON*absoluteContributionScale(matrix,weights);
  if(variance < -tolerance)return invalidCovarianceResult(result);

  return {
    ...result,
    outputs:{...result.outputs,portfolioVariance:0,portfolioVolatility:0}
  };
}
