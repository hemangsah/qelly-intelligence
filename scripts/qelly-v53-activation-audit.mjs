import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ACTUAL_RUNTIME_ATTRIBUTE='data-ui-lock-v53';
export const LEGACY_V53_ATTRIBUTE='data-ui-lock-v5-3';
export const POSTMERGE_ATTRIBUTE='data-v53-postmerge-convergence';

const here=path.dirname(fileURLToPath(import.meta.url));
export const defaultRepositoryRoot=path.resolve(here,'..');

const files={
  runtime:'apps/web/public/assets/qelly-ui-lock-v5-3.mjs',
  base:'apps/web/public/assets/qelly-ui-lock-v5-3.css',
  refinement:'apps/web/public/assets/qelly-v53-visible-refinement.css',
  convergence:'apps/web/public/assets/qelly-post-v53-convergence.css'
};

const escapeRegex=(value)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const count=(text,needle)=>(text.match(new RegExp(escapeRegex(needle),'g'))||[]).length;

function selectorsForAttribute(css,attribute,value='active'){
  const marker=`[${attribute}="${value}"]`;
  const blocks=[];
  for(const part of css.split('}')){
    const open=part.lastIndexOf('{');
    if(open===-1)continue;
    const selector=part.slice(0,open).trim().split(/\n(?=[^\s])/).at(-1)?.trim()||'';
    if(selector.includes(marker))blocks.push(selector.replace(/\s+/g,' '));
  }
  return blocks;
}

function hasGlobalActualActivation(selectors){
  return selectors.some((selector)=>
    /\bbody\b|\.q-global-strip|\.q-command-bar|\.q-rail\b|#main\b|\.q-panel\b|\.q-context-drawer|\.q-compare-tray/.test(selector)
  );
}

export async function buildV53ActivationAudit(repositoryRoot=defaultRepositoryRoot){
  const load=(relative)=>readFile(path.join(repositoryRoot,relative),'utf8');
  const [runtime,base,refinement,convergence]=await Promise.all(Object.values(files).map(load));

  const baseLegacySelectors=selectorsForAttribute(base,LEGACY_V53_ATTRIBUTE);
  const baseActualSelectors=selectorsForAttribute(base,ACTUAL_RUNTIME_ATTRIBUTE);
  const refinementLegacySelectors=selectorsForAttribute(refinement,LEGACY_V53_ATTRIBUTE);
  const convergenceSelectors=selectorsForAttribute(convergence,POSTMERGE_ATTRIBUTE,'wave1');

  const runtimeWrites={
    actual:/dataset\.uiLockV53\s*=\s*['"]active['"]/.test(runtime),
    legacy:/dataset\.uiLockV5_3|setAttribute\(\s*['"]data-ui-lock-v5-3['"]/.test(runtime),
    postmerge:/dataset\.v53PostmergeConvergence\s*=\s*['"]wave1['"]/.test(runtime)
  };

  const inventory={
    base:{
      file:files.base,
      legacyAttributeOccurrences:count(base,`${LEGACY_V53_ATTRIBUTE}="active"`),
      actualAttributeOccurrences:count(base,`${ACTUAL_RUNTIME_ATTRIBUTE}="active"`),
      legacySelectorBlocks:baseLegacySelectors.length,
      actualSelectorBlocks:baseActualSelectors.length,
      actualSelectors:baseActualSelectors
    },
    visibleRefinement:{
      file:files.refinement,
      legacyAttributeOccurrences:count(refinement,`${LEGACY_V53_ATTRIBUTE}="active"`),
      legacySelectorBlocks:refinementLegacySelectors.length
    },
    postmergeConvergence:{
      file:files.convergence,
      attributeOccurrences:count(convergence,`${POSTMERGE_ATTRIBUTE}="wave1"`),
      selectorBlocks:convergenceSelectors.length
    }
  };

  const protectedLegacySurfaceNeedles=[
    '.q-global-strip','.q-command-bar','.q-rail','#main','.q-page-head','.q-panel','.q-kpi',
    '.q-context-drawer','.q-compare-tray','.q-live-chart-shell','.q-ti-controls'
  ];
  const legacySurfaceCoverage=Object.fromEntries(protectedLegacySurfaceNeedles.map((needle)=>[
    needle,baseLegacySelectors.some((selector)=>selector.includes(needle))
  ]));

  const actualExceptionIsTimeSeriesOnly=baseActualSelectors.length>0&&
    baseActualSelectors.every((selector)=>selector.includes('#series-grid .q-grid-scroll'));

  return {
    schemaVersion:1,
    contract:{
      runtimeAttribute:ACTUAL_RUNTIME_ATTRIBUTE,
      legacyCssAttribute:LEGACY_V53_ATTRIBUTE,
      postmergeAttribute:POSTMERGE_ATTRIBUTE,
      runtimeWrites
    },
    inventory,
    findings:{
      baseLegacyLayerDormant:runtimeWrites.actual&&!runtimeWrites.legacy&&baseLegacySelectors.length>0,
      visibleRefinementDormant:runtimeWrites.actual&&!runtimeWrites.legacy&&refinementLegacySelectors.length>0,
      postmergeConvergenceActive:runtimeWrites.postmerge&&convergenceSelectors.length>0,
      routeScopedActualExceptionPresent:baseActualSelectors.length>0,
      actualExceptionIsTimeSeriesOnly,
      globalActualActivationPresent:hasGlobalActualActivation(baseActualSelectors),
      legacySurfaceCoverage
    },
    decision:{
      globalActivation:'hold',
      reason:'The runtime/CSS activation contract is mismatched across broad shell and product selectors. Preserve the current pixels until computed-style and full-screen convergence evidence explicitly approves a migration.'
    }
  };
}

if(path.resolve(process.argv[1]||'')===fileURLToPath(import.meta.url)){
  const report=await buildV53ActivationAudit();
  process.stdout.write(`${JSON.stringify(report,null,2)}\n`);
}
