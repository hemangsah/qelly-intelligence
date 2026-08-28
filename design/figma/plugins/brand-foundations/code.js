const burgundy={r:0.435,g:0.094,b:0.22};
const nearBlack={r:0.09,g:0.067,b:0.086};
const porcelain={r:0.973,g:0.961,b:0.949};
function rect(name,x,y,w,h,fill,radius=0){const n=figma.createRectangle();n.name=name;n.x=x;n.y=y;n.resize(w,h);n.fills=[{type:'SOLID',color:fill}];n.cornerRadius=radius;return n}
function text(name,value,x,y,size,color){const n=figma.createText();n.name=name;n.characters=value;n.x=x;n.y=y;n.fontSize=size;n.fills=[{type:'SOLID',color}];return n}
async function run(){
  await figma.loadFontAsync({family:'IBM Plex Sans',style:'Regular'});
  const pages=['Brand Foundations','Logo Geometry','Primary Lockups','Light Dark Variants','Monochrome','Small Sizes','Favicon and PWA','Opening Motion','Homepage Hero','App Shell','Authentication','Loading and Empty States','Theme Compatibility','Mobile','Accessibility','Handoff'];
  for(const title of pages){
    const page=figma.createPage();page.name=title;figma.currentPage=page;
    const frame=figma.createFrame();frame.name=`${title} / Master`;frame.resize(1440,1024);frame.fills=[{type:'SOLID',color:title.includes('Light')?porcelain:nearBlack}];
    frame.appendChild(text('Section title',title,80,70,42,title.includes('Light')?nearBlack:porcelain));
    frame.appendChild(text('Foundation note','Generator-derived editable brand foundation · IBM Plex interface lock preserved',80,130,18,title.includes('Light')?nearBlack:porcelain));
    const mark=figma.createEllipse();mark.name='Qelly Q ring';mark.x=90;mark.y=220;mark.resize(220,220);mark.fills=[];mark.strokes=[{type:'SOLID',color:burgundy}];mark.strokeWeight=28;frame.appendChild(mark);
    const tail=rect('Q tail',250,390,95,28,burgundy,14);tail.rotation=45;frame.appendChild(tail);
    frame.appendChild(text('Vector handoff','Use repository SVG components as canonical production assets.',390,270,28,title.includes('Light')?nearBlack:porcelain));
  }
  figma.notify('Qelly brand foundation pages created');
  figma.closePlugin();
}
run();
