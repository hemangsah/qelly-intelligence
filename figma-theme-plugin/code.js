const THEMES=['Sovereign Obsidian','Porcelain Signal','Crimson Vector','Obsidian Strike','White Heat','Ember Protocol','Arctic Quant','Emerald Conviction','Cobalt Circuit','Violet Oracle','Gold Dominion','Monochrome Ledger','Signal Access'];
const APPEARANCES=['Dark','Light','OLED','High Contrast','System','Scheduled'];
const PERSONAS=['Scalper Velocity','Investor Compound','Aggressive Alpha','Quant Operator','Research Oracle','Signal Access'];
const PERSONA_MINDSETS={
  'Scalper Velocity':['Precision Pulse','Rapid Tape','Microstructure Focus','Velocity Grid'],
  'Investor Compound':['Foundation','Long Horizon','Compounding Calm','Preservation First'],
  'Aggressive Alpha':['Focused Edge','Tactical Surge','Conviction Strike','Redline Apex'],
  'Quant Operator':['Model Discipline','Signal Lab','Vector Engine','Statistical Focus'],
  'Research Oracle':['Thesis Mode','Evidence Depth','Contradiction Review','Oracle Synthesis'],
  'Signal Access':['Clear Focus','Calm Reading','High Contrast','Reduced Complexity']
};
const ALPHA_LEVELS=['Focused Edge','Tactical Surge','Conviction Strike','Redline Apex'];
const ALPHA_PACKS=['Crimson Vector','Obsidian Strike','White Heat','Ember Protocol','Apex Monochrome','Scarlet Circuit'];
const COLLECTIONS=['Appearance','Semantic Surfaces','Semantic Text','Semantic Interaction','Market Semantics','Chart Semantics','Table Semantics','Overlay Semantics','Persona','Mindset','Aggressive Alpha Intensity','Aggressive Alpha Packs','Accessibility','Responsive'];
const PAGES=['00 Theme Intelligence Overview','01 Appearance Modes','02 Curated Themes','03 Persona Mindsets','04 Aggressive Alpha Levels','05 Aggressive Alpha Packs','06 Theme Studio Desktop','07 Theme Studio Mobile','08 Theme Gallery','09 Charts and Tables','10 Overlays and Portals','11 Accessibility','12 Responsive Matrix','13 Persistence','14 Theme Comparison','15 Approval Handoff'];
const PALETTES={dark:{canvas:'#070507',surface:'#0d0a0c',panel:'#171319',text:'#f5f1f3',muted:'#a89ca3',accent:'#8e1d4b'},light:{canvas:'#f8f5f2',surface:'#ffffff',panel:'#f0ebe8',text:'#191417',muted:'#6d6167',accent:'#7a163e'},oled:{canvas:'#000000',surface:'#050405',panel:'#0a0809',text:'#ffffff',muted:'#b7adb2',accent:'#a82558'},contrast:{canvas:'#000000',surface:'#000000',panel:'#111111',text:'#ffffff',muted:'#e8e8e8',accent:'#ff4f91'}};
let ACTIVE_FONT_FAMILY='IBM Plex Sans';
async function loadFont(){try{for(const style of ['Regular','Medium','SemiBold'])await figma.loadFontAsync({family:'IBM Plex Sans',style});}catch{ACTIVE_FONT_FAMILY='Inter';await figma.loadFontAsync({family:'Inter',style:'Regular'});}}
function text(parent,value,size=14,weight='Regular'){const node=figma.createText();node.fontName={family:ACTIVE_FONT_FAMILY,style:ACTIVE_FONT_FAMILY==='IBM Plex Sans'?weight:'Regular'};node.characters=value;node.fontSize=size;node.fills=[{type:'SOLID',color:{r:1,g:1,b:1}}];parent.appendChild(node);return node;}
function frame(name,width=1440,height=960){const node=figma.createFrame();node.name=name;node.resize(width,height);node.layoutMode='VERTICAL';node.itemSpacing=18;node.paddingLeft=node.paddingRight=32;node.paddingTop=node.paddingBottom=28;node.fills=[{type:'SOLID',color:{r:.027,g:.02,b:.027}}];node.setPluginData('qellyThemeIntelligence','true');return node;}
function collection(name){const c=figma.variables.createVariableCollection(`Qelly Theme Intelligence / ${name}`);const names=APPEARANCES.slice(0,4);c.renameMode(c.modes[0].modeId,names[0]);for(const mode of names.slice(1))c.addMode(mode);return c;}
function variable(c,name,values){const v=figma.variables.createVariable(name,c,'COLOR');for(const [modeId,value] of c.modes.map((m,i)=>[m.modeId,Object.values(values)[i]??Object.values(values)[0]])){const hex=value.replace('#','');v.setValueForMode(modeId,{r:parseInt(hex.slice(0,2),16)/255,g:parseInt(hex.slice(2,4),16)/255,b:parseInt(hex.slice(4,6),16)/255});}return v;}
function stringVariable(c,name,values){const v=figma.variables.createVariable(name,c,'STRING');for(const [index,mode] of c.modes.entries())v.setValueForMode(mode.modeId,values[index]??values[0]);return v;}
function floatVariable(c,name,values){const v=figma.variables.createVariable(name,c,'FLOAT');for(const [index,mode] of c.modes.entries())v.setValueForMode(mode.modeId,values[index]??values[0]);return v;}
function board(page,title,items){const f=frame(title);page.appendChild(f);text(f,title,32,'SemiBold');text(f,'IBM Plex Sans Variable is permanent. GT Eesti remains inactive pending legal web licence and explicit approval.',13);const row=figma.createFrame();row.layoutMode='HORIZONTAL';row.itemSpacing=12;row.fills=[];f.appendChild(row);for(const item of items){const card=figma.createFrame();card.name=item;card.resize(220,116);card.layoutMode='VERTICAL';card.paddingLeft=card.paddingRight=16;card.paddingTop=card.paddingBottom=14;card.fills=[{type:'SOLID',color:{r:.09,g:.075,b:.085}}];card.cornerRadius=16;row.appendChild(card);text(card,item,15,'Medium');}return f;}
await loadFont();
const collections=COLLECTIONS.map(collection),modes=(key)=>({dark:PALETTES.dark[key],light:PALETTES.light[key],oled:PALETTES.oled[key],contrast:PALETTES.contrast[key]});
for(const [name,key] of [['surface/canvas','canvas'],['surface/base','surface'],['surface/panel','panel']])variable(collections[1],name,modes(key));
for(const [name,key] of [['text/primary','text'],['text/muted','muted']])variable(collections[2],name,modes(key));
variable(collections[3],'interaction/accent',modes('accent'));variable(collections[3],'interaction/focus',modes('text'));
for(const [name,values] of [['market/positive',{dark:'#35C98C',light:'#087A52',oled:'#35C98C',contrast:'#34FF9A'}],['market/negative',{dark:'#FF6678',light:'#C12F45',oled:'#FF6678',contrast:'#FF6173'}],['market/warning',{dark:'#F4B860',light:'#8A5A00',oled:'#F4B860',contrast:'#FFD84A'}]])variable(collections[4],name,values);
for(const name of ['chart/background','chart/grid','chart/crosshair','chart/tooltip'])variable(collections[5],name,name.includes('background')?modes('canvas'):name.includes('grid')?modes('muted'):name.includes('tooltip')?modes('panel'):modes('accent'));
for(const name of ['table/background','table/header','table/row-hover','table/row-selected'])variable(collections[6],name,name.includes('background')?modes('surface'):name.includes('header')?modes('panel'):modes('accent'));
for(const name of ['overlay/dialog','overlay/drawer','overlay/popover','overlay/tooltip','overlay/command','overlay/bottom-sheet'])variable(collections[7],name,modes('panel'));
stringVariable(collections[0],'appearance/mode',APPEARANCES);stringVariable(collections[8],'persona/active',PERSONAS);stringVariable(collections[9],'mindset/active',Object.values(PERSONA_MINDSETS).flat());stringVariable(collections[10],'aggressive-alpha/intensity',ALPHA_LEVELS);stringVariable(collections[11],'aggressive-alpha/pack',ALPHA_PACKS);stringVariable(collections[12],'accessibility/profile',['Standard','Reduced Motion','High Contrast','Color Blind Safe']);floatVariable(collections[13],'responsive/viewport',[360,768,1280,1920]);
for(const [index,name] of PAGES.entries()){const page=figma.createPage();page.name=name;if(index===0)board(page,'Qelly Theme Intelligence',THEMES);else if(index===1)board(page,'Appearance Modes',APPEARANCES);else if(index===2)board(page,'13 Curated Themes',THEMES);else if(index===3)board(page,'6 Personas · 24 Mindsets',Object.entries(PERSONA_MINDSETS).flatMap(([persona,mindsets])=>mindsets.map((mindset)=>`${persona} / ${mindset}`)));else if(index===4)board(page,'Aggressive Alpha Intensity',ALPHA_LEVELS);else if(index===5)board(page,'Aggressive Alpha Visual Packs',ALPHA_PACKS);else board(page,name,['Desktop','Mobile','Dark','Light','OLED','High Contrast']);}
figma.root.setPluginData('fontTarget','IBM Plex Sans Variable · all text and numeric roles');
figma.root.setPluginData('gtEesti','inactive commercial licence gate');
figma.root.setPluginData('themeCollections',String(COLLECTIONS.length));
figma.root.setPluginData('themePages',String(PAGES.length));
figma.root.setPluginData('themeFamilies',THEMES.join(' | '));
figma.root.setPluginData('personaMindsets',JSON.stringify(PERSONA_MINDSETS));
figma.currentPage=figma.root.children.find((page)=>page.name==='00 Theme Intelligence Overview')??figma.root.children[0];
figma.viewport.scrollAndZoomIntoView(figma.currentPage.children);
figma.closePlugin(`Qelly Theme Intelligence generated: ${COLLECTIONS.length} collections, ${PAGES.length} pages, ${THEMES.length} themes, ${Object.values(PERSONA_MINDSETS).flat().length} mindsets.`);
