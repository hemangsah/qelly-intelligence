import {productCategories} from './route-registry.mjs';
const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function publicCalculatorNavigation(){
  return `<nav class="q-cn-global-categories" aria-label="Qelly product categories">${productCategories.map(category=>`<details><summary>${esc(category.label)}</summary><div>${category.routes.filter(route=>!route.hidden).map(route=>`<a href="/#/${esc(route.route)}">${esc(route.shortTitle)}</a>`).join('')}${category.id==='tools'?'<a href="/calculators/" aria-current="page">Public calculator library</a>':''}</div></details>`).join('')}</nav>`;
}
