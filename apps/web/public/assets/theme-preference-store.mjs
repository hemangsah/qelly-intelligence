// Shared authenticated theme preference transport. Never includes calculator
// inputs, outputs, page fragments or chat messages in a preference request.
export function createThemePreferenceStore({apiBase='',staticVisualPreview=false,fetcher=globalThis.fetch}={}){
  const base=String(apiBase).replace(/\/$/,'');
  const url=pathname=>base?new URL(pathname,`${base}/`).toString():pathname;
  let authenticated=false,csrfToken=null,revision=null;
  return {
    get authenticated(){return authenticated;},
    async hydrate(){
      if(staticVisualPreview)return null;
      const configResponse=await fetcher(url('/api/v1/config'),{credentials:'include'});
      if(!configResponse.ok)return null;
      const config=await configResponse.json();
      authenticated=config?.auth?.authenticated===true;csrfToken=config?.csrf?.token??null;
      if(!authenticated)return null;
      const response=await fetcher(url('/api/v1/preferences/layout'),{credentials:'include'});
      if(!response.ok)return null;
      const saved=await response.json();revision=saved?.revision??null;return saved;
    },
    async persist(patch){
      if(!authenticated)return patch;
      const response=await fetcher(url('/api/v1/preferences/layout'),{method:'PUT',credentials:'include',headers:{'Content-Type':'application/json','X-Qelly-CSRF':csrfToken??'',...(revision!=null?{'If-Match-Revision':String(revision)}:{})},body:JSON.stringify(patch)});
      if(!response.ok)throw new Error((await response.json().catch(()=>null))?.error?.message??`Preference save failed (${response.status})`);
      const saved=await response.json();revision=saved?.revision??revision;return saved;
    }
  };
}
