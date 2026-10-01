/* Wave CO: parser-time canonical header identity. No DOM swap or delayed styling. */
(()=>{
  const root=document.documentElement;
  const header=document.querySelector('.q-product-header[data-qelly-current-shell="true"]');
  if(!header)return;
  const route=String(root.dataset.prepaintRoute||'').slice(0,80);
  const contexts=window.__QELLY_PREPAINT_ROUTE_CONTEXTS__;
  if(!contexts||!Object.prototype.hasOwnProperty.call(contexts,route))return;
  const context=contexts[route];
  if(!context||typeof context!=='object')return;
  const title=context.shortTitle;
  const category=context.categoryLabel;
  if(typeof title!=='string'||title.length<1||title.length>120
    ||typeof category!=='string'||category.length<1||category.length>80)return;
  const titleNode=header.querySelector('[data-q-product-page-title]');
  const categoryNode=header.querySelector('[data-q-product-category-label]');
  if(!titleNode||!categoryNode)return;
  titleNode.textContent=title;
  categoryNode.textContent=category;
  root.dataset.prepaintHeader='canonical';
})();
