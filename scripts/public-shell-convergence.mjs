const CURRENT_HEADER=`
<header class="q-product-header" data-qelly-current-shell="true" aria-label="Qelly product navigation">
  <a class="q-product-brand" href="#/market" aria-label="Qelly Intelligence home"><span class="q-product-brand__mark"><img src="./assets/brand/qelly-symbol.svg" width="28" height="28" alt=""></span><span><strong>Qelly</strong><small>Market intelligence</small></span></a>
  <button class="q-product-menu" type="button" aria-expanded="false" aria-controls="q-product-navigation"><span aria-hidden="true">☰</span><span>Menu</span></button>
  <nav id="q-product-navigation" class="q-product-nav" aria-label="Primary"><a href="#/decision-provenance" data-product-route="decision-provenance">Decision</a><a href="#/news-research" data-product-route="news-research">Qelly Chat</a><a href="#/market" data-product-route="market">Markets</a><a href="#/research-workspace" data-product-route="research-workspace">Research</a><a href="#/calculator-center" data-product-route="calculator-center">Tools</a></nav>
  <form class="q-product-search" role="search"><label class="q-visually-hidden" for="q-product-search-input">Search Qelly</label><input id="q-product-search-input" name="q" type="search" autocomplete="off" placeholder="Search Qelly"><button type="submit" aria-label="Search Qelly"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path></svg><span class="q-visually-hidden">Search</span></button></form>
  <div class="q-product-actions"><button class="q-product-system" type="button" data-product-route="status" aria-label="Open system status"><span class="q-product-system__dot" data-state="live"></span><span>Data status</span></button><button class="q-product-system" type="button" data-v8-appearance="true" aria-label="Switch to light appearance"><span aria-hidden="true">◐</span><span>Light</span></button><button class="q-product-ai" type="button" data-v8-qelly-ai="true" data-qelly-chat-open="true" aria-label="Open Qelly AI assistant and Qelly Chat intelligence workspace" aria-haspopup="dialog"><span aria-hidden="true">✦</span><span>Qelly Chat</span></button><a class="q-product-account" href="#/auth-login" aria-label="Sign in to Qelly"><span aria-hidden="true">●</span><span>Sign in</span></a></div>
</header>
<div data-qelly-legacy-bindings="true" hidden aria-hidden="true">
  <div id="macro-strip"></div><div id="workspace-switcher"></div>
  <button id="rail-toggle" type="button" aria-expanded="false"></button>
  <button id="command-button" type="button"></button>
  <select id="state-selector"><option value="default">Default</option><option value="loading">Loading</option><option value="empty">Empty</option><option value="partial">Partial</option><option value="error">Error</option><option value="offline">Offline</option><option value="stale">Stale</option><option value="delayed">Delayed</option></select>
  <select id="global-theme-selector"><option value="burgundy-command">Burgundy</option><option value="porcelain-burgundy">Porcelain</option><option value="burgundy-night">Night</option><option value="graphite-terminal">Graphite</option><option value="midnight-research">Midnight</option><option value="high-contrast">High contrast</option></select>
  <button id="notification-button" type="button"></button><button id="theme-shortcut" type="button"></button>
  <nav id="persona-ribbon"></nav><div id="context-shelf"></div>
</div>
`;

const STATIC_COMPAT_STYLES=[
  ['qelly-v53-visible-refinement.css','data-qelly-v53-refinement="active"'],
  ['qelly-post-v53-convergence.css','data-qelly-v53-postmerge="wave1"'],
  ['qelly-v53-active-shell-convergence.css','data-qelly-v53-active-shell="wave1"'],
  ['qelly-v53-production-shell-convergence.css','data-qelly-v53-production-shell="wave1"'],
  ['qelly-v53-production-shell-status.css','data-qelly-v53-production-status="wave1"'],
  ['qelly-v53-market-command-workspace.css','data-qelly-v53-market-command="wave2"'],
  ['qelly-v53-market-command-workspace-correction.css','data-qelly-v53-market-command-correction="wave2"'],
  ['qelly-v53-research-evidence-workspace.css','data-qelly-v53-research-evidence="wave3"'],
  ['qelly-v53-family-harmonization.css','data-qelly-v53-family-harmonization="active"']
];

const escaped=(value)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const moduleTag=(file)=>new RegExp('\\s*<script\\s+type="module"\\s+src="\\./assets/'+escaped(file)+'"></script>\\s*','g');
const classicTag=(file)=>new RegExp('\\s*<script\\s+src="\\./assets/'+escaped(file)+'"></script>\\s*','g');

export function convergePublicRuntimeHtml(source){
  let html=String(source);
  const shellPattern=/<header class="q-global-strip"[\s\S]*?<div id="context-shelf" class="q-context-shelf"><\/div>\s*/;
  if(!shellPattern.test(html)&&!html.includes('data-qelly-current-shell="true"'))throw new Error('Legacy Qelly shell prefix was not found for convergence');
  if(shellPattern.test(html))html=html.replace(shellPattern,CURRENT_HEADER+'\n');

  const legacyReadyGate='html[data-app-ready="false"] .q-app{visibility:hidden;opacity:0;pointer-events:none}';
  const currentReadyGate='html[data-app-ready="false"] .q-app{visibility:visible;opacity:1;pointer-events:auto}html[data-app-ready="false"] #main{visibility:hidden;min-height:calc(100vh - 64px);pointer-events:none}html[data-app-ready="false"] [data-qelly-legacy-bindings="true"]{display:none!important}';
  if(html.includes(legacyReadyGate))html=html.replace(legacyReadyGate,currentReadyGate);
  else if(!html.includes('html[data-app-ready="false"] #main{visibility:hidden'))throw new Error('Legacy app-ready paint gate was not found for convergence');

  const styleAnchor='  <link rel="stylesheet" href="./assets/qelly-production-shell.css">';
  if(!html.includes(styleAnchor))throw new Error('Canonical production shell stylesheet anchor missing');
  const staticStyles=STATIC_COMPAT_STYLES.filter(([file])=>!html.includes('./assets/'+file)).map(([file,attr])=>'  <link rel="stylesheet" href="./assets/'+file+'" '+attr+'>').join('\n');
  if(staticStyles)html=html.replace(styleAnchor,staticStyles+'\n'+styleAnchor);

  for(const file of ['qelly-worldclass-uiux.mjs','qelly-ui-lock-v5.mjs'])html=html.replace(moduleTag(file),'\n');
  html=html.replace(classicTag('qelly-sovereign-motion.js'),'\n');

  const early=['qelly-ui-lock-v5-3.mjs','qelly-production-shell.mjs'];
  for(const file of early)html=html.replace(moduleTag(file),'\n');
  const ready='  <script type="module" src="./assets/qelly-app-ready.mjs"></script>';
  if(!html.includes(ready))throw new Error('Qelly app-ready anchor missing for shell convergence');
  const earlyScripts=early.map(file=>'  <script type="module" src="./assets/'+file+'"></script>').join('\n');
  html=html.replace(ready,earlyScripts+'\n'+ready);

  return html;
}

export function publicShellConvergenceInventory(source){
  const html=String(source);
  return Object.freeze({
    currentShell:(html.match(/data-qelly-current-shell="true"/g)||[]).length,
    legacyCommandBars:(html.match(/class="q-command-bar"/g)||[]).length,
    legacyWorldclassScripts:(html.match(/qelly-worldclass-uiux\.mjs/g)||[]).length,
    legacyMotionScripts:(html.match(/qelly-sovereign-motion\.js/g)||[]).length,
    v5RuntimeScripts:(html.match(/qelly-ui-lock-v5\.mjs/g)||[]).length,
    v53RuntimeScripts:(html.match(/qelly-ui-lock-v5-3\.mjs/g)||[]).length,
    productionShellScripts:(html.match(/qelly-production-shell\.mjs/g)||[]).length,
    staticCompatStyles:STATIC_COMPAT_STYLES.filter(([file])=>html.includes('./assets/'+file)).length
  });
}
