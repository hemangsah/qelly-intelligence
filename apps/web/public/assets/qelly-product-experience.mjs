const root=document.documentElement;
const header=()=>document.querySelector('header.q-product-header');
let frame=0;

function updateScrollState(){
  frame=0;
  header()?.classList.toggle('is-scrolled',window.scrollY>8);
}

function requestScrollUpdate(){
  if(frame)return;
  frame=requestAnimationFrame(updateScrollState);
}

root.dataset.productExperience='ready';
window.addEventListener('scroll',requestScrollUpdate,{passive:true});
window.addEventListener('hashchange',()=>requestAnimationFrame(updateScrollState));
updateScrollState();
