export const QELLY_VERIFY_METHODOLOGY_VERSION='qelly-verify-methodology/1.0.0';
export const QELLY_VERIFY_REPORT_SCHEMA='qelly.strategy-evidence-report/1.0.0';
export const QELLY_VERIFY_ENGINE_VERSION='qelly-verify-local-engine/1.1.0';

const freeze=value=>Object.freeze(value);
const item=(id,label,state,description,limitations=[])=>freeze({id,label,state,description,limitations:freeze(limitations)});

export const QELLY_VERIFY_METHODOLOGY=freeze({
  version:QELLY_VERIFY_METHODOLOGY_VERSION,
  title:'Qelly Verify Evidence Methodology',
  purpose:'Convert an uploaded trade history into a reproducible local evidence package without fabricating market context, execution assumptions or predictive certainty.',
  governingPrinciples:freeze([
    'Evidence before prediction: computed observations are separated from heuristic scores and unassessed claims.',
    'Deterministic calculations: identical normalized input and engine version produce identical numerical analysis.',
    'Constrained allocation: Kelly-derived values are research ranges, never an automatic full-Kelly recommendation.',
    'Explicit incompleteness: unsupported tests are labelled NOT ASSESSED rather than inferred.',
    'Local data boundary: the prototype processes files in the browser and does not upload trade rows.'
  ]),
  evidenceClasses:freeze([
    item('computed','COMPUTED','computed','Directly calculated from valid uploaded trade rows.'),
    item('heuristic','HEURISTIC','heuristic','A transparent bounded score assembled from computed inputs; it is not a calibrated probability.'),
    item('not-assessed','NOT ASSESSED','not-assessed','The uploaded evidence is insufficient for a defensible conclusion.'),
    item('boundary','BOUNDARY','boundary','A product, legal or methodological limit that constrains interpretation.')
  ]),
  modules:freeze([
    item('data-validation','Data validation','computed','Normalizes headers, identifies a numeric P&L field, rejects invalid rows and records mapped fields.',[
      'The prototype does not independently verify broker authenticity, timestamp integrity or duplicate trades.',
      'A valid row is syntactically usable; validity does not prove economic correctness.'
    ]),
    item('performance','Performance evidence','computed','Calculates wins, losses, net P&L, expectancy, profit factor, payoff ratio and outcome dispersion.',[
      'P&L units are inherited from the file and are not converted into account returns unless the source provides a defensible denominator.',
      'Historical performance does not imply future performance.'
    ]),
    item('risk','Observed risk evidence','computed','Calculates path-dependent maximum drawdown, longest losing streak and outcome concentration.',[
      'Observed drawdown is sample-specific and is not a maximum future-loss estimate.',
      'Tail risk outside the uploaded sample is not observable.'
    ]),
    item('internal-stability','Internal stability','heuristic','Compares first-half and second-half expectancy and combines sample sufficiency, concentration and streak evidence into a robustness heuristic.',[
      'A chronological half-split is not walk-forward validation.',
      'The score is an interpretable prototype heuristic, not a statistical confidence level.'
    ]),
    item('sequence-stress','Deterministic sequence stress','computed','Reorders the same outcomes through a seeded 500-iteration shuffle and reports median and 95th-percentile path risk.',[
      'This preserves the uploaded return distribution and does not model regime change, autocorrelation, slippage or new losses.',
      'It is sequence-order stress, not a complete Monte Carlo market model.'
    ]),
    item('allocation','Constrained Kelly research range','heuristic','Derives raw Kelly from historical win rate and payoff, then exposes 10%–25% fractional ranges with a 5% hard cap.',[
      'The result is not personalized position sizing.',
      'Correlation, liquidity, portfolio constraints and estimation error are not fully modelled.'
    ])
  ]),
  notAssessed:freeze([
    item('out-of-sample','Out-of-sample performance','not-assessed','Requires a separately identified holdout dataset.'),
    item('walk-forward','Walk-forward validation','not-assessed','Requires multiple chronological train/test windows and strategy re-estimation rules.'),
    item('parameter-sensitivity','Parameter sensitivity','not-assessed','Requires parameter sets and comparable backtest results.'),
    item('regime-dependency','Regime dependency','not-assessed','Requires point-in-time market-regime labels or independently sourced context.'),
    item('transaction-cost','Transaction-cost sensitivity','not-assessed','Requires explicit spread, commission, slippage and financing assumptions.'),
    item('execution-sensitivity','Execution sensitivity','not-assessed','Requires expected-versus-realized fills, latency and rejection evidence.'),
    item('portfolio-context','Portfolio interaction','not-assessed','Requires simultaneous strategy returns, correlations, constraints and capital state.'),
    item('live-degradation','Live degradation','not-assessed','Requires versioned live observations after deployment.')
  ]),
  scoreDisclosure:freeze({
    strategyQuality:'Weighted heuristic: expectancy 30%, profit factor 25%, observed drawdown 20%, half-sample consistency 15%, sample sufficiency 10%.',
    robustness:'Weighted heuristic: sample sufficiency 35%, half-sample consistency 30%, outcome concentration 20%, losing-streak resilience 15%.',
    overfittingRisk:'Inverse evidence heuristic derived from robustness, quality and concentration. It is a warning index, not an estimated probability of overfitting.'
  }),
  reproducibility:freeze({
    input:'Normalized UTF-8 file text is fingerprinted with SHA-256 when Web Crypto is available; a labelled deterministic fallback is used otherwise.',
    engine:'Every export records report schema, methodology version, engine version and generation time.',
    randomness:'Sequence stress uses a deterministic seed derived from uploaded P&L values.',
    interpretation:'Numerical reproducibility does not establish external validity.'
  })
});

export function methodologyById(id){
  return [...QELLY_VERIFY_METHODOLOGY.modules,...QELLY_VERIFY_METHODOLOGY.notAssessed].find(entry=>entry.id===id)||null;
}
