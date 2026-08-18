import {createAuthenticatedBootstrapFetch} from './authenticated-bootstrap.mjs';

const configuredApiBase=String(window.__QELLY_CONFIG__?.apiBaseUrl||'').trim();
const baseUrl=configuredApiBase?new URL(configuredApiBase,window.location.href).toString():window.location.origin;
const wrappedFetch=createAuthenticatedBootstrapFetch({fetchImpl:window.fetch.bind(window),baseUrl,ttlMs:5000});
window.fetch=wrappedFetch;
window.addEventListener('pageshow',(event)=>{if(event.persisted)wrappedFetch.invalidateBootstrap();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')wrappedFetch.invalidateBootstrap();});
