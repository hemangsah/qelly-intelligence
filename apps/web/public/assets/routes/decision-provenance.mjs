import {renderDecisionProvenGraph} from './decision-proven-graph.mjs';

// Compatibility route: historical #/decision-provenance links now resolve to the
// authoritative live Decision Intelligence workspace.
export async function renderDecisionProvenance(main,deps){
  return renderDecisionProvenGraph(main,deps);
}
