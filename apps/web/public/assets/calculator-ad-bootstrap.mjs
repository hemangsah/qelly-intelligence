import {mountAdSlots} from './qelly-ad-slot.mjs';

const start=()=>mountAdSlots(document);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
