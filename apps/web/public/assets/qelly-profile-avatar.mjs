/* Wave CU: opt-in browser-side crop of a private avatar.
 * All original image bytes stay in this browser. Only a new 256px PNG is sent
 * to the authenticated QELLY first-party avatar endpoint after Save is pressed. */
export const AVATAR_SOURCE_LIMIT=5*1024*1024;
export const AVATAR_RESULT_LIMIT=2*1024*1024;
export const AVATAR_CROP_SIZE=256;
const TYPES=new Set(['image/jpeg','image/png','image/webp']);
export const calculateAvatarCrop=(width,height,zoom=1,panX=0,panY=0)=>{
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1||width>8192||height>8192||
    width*height>24_000_000||!Number.isFinite(zoom)||zoom<1||zoom>2.5)throw new RangeError('Image dimensions or zoom exceed avatar limits');
 const factor=Math.max(AVATAR_CROP_SIZE/width,AVATAR_CROP_SIZE/height)*zoom;
 const scaledWidth=width*factor,scaledHeight=height*factor;
 const maxX=Math.max(0,(scaledWidth-AVATAR_CROP_SIZE)/2),maxY=Math.max(0,(scaledHeight-AVATAR_CROP_SIZE)/2);
 const x=Math.max(-maxX,Math.min(maxX,panX)),y=Math.max(-maxY,Math.min(maxY,panY));
 return {width:scaledWidth,height:scaledHeight,x:(AVATAR_CROP_SIZE-scaledWidth)/2+x,y:(AVATAR_CROP_SIZE-scaledHeight)/2+y,panX:x,panY:y};
};
const blobToDataUrl=async(blob)=>{
 const bytes=new Uint8Array(await blob.arrayBuffer()),parts=[];
 for(let offset=0;offset<bytes.length;offset+=8192)parts.push(String.fromCharCode(...bytes.subarray(offset,offset+8192)));
 return 'data:image/png;base64,'+btoa(parts.join(''));
};
export function installPrivateAvatarControls({main,api,toast}){
 const widget=main?.querySelector('[data-avatar-widget]');
 if(!widget)return ()=>{};
 globalThis.__qellyAvatarCleanup?.();
 const input=widget.querySelector('[data-avatar-file]');
 const canvas=widget.querySelector('[data-avatar-canvas]');
 const editor=widget.querySelector('[data-avatar-editor]');
 const zoomSlider=widget.querySelector('[data-avatar-zoom]');
 const save=widget.querySelector('[data-avatar-save]');
 const cancel=widget.querySelector('[data-avatar-cancel]');
 const remove=widget.querySelector('[data-avatar-remove]');
 const status=widget.querySelector('[data-avatar-status]');
 const image=main.querySelector('[data-avatar-image]');
 const initials=main.querySelector('[data-avatar-initials]');
 const controller=new AbortController();
 let bitmap=null,photoUrl=null,panX=0,panY=0,zoom=1,drag=null,busy=false,disposed=false;
 const setStatus=(value)=>{if(!disposed)status.textContent=value;};
 const setBusy=(value)=>{
  busy=value;for(const control of [save,remove,input,zoomSlider])control.disabled=value;
 };
 const releasePhoto=()=>{
  if(photoUrl){URL.revokeObjectURL(photoUrl);photoUrl=null;}
  image.hidden=true;image.removeAttribute('src');initials.hidden=false;remove.hidden=true;
 };
 const closeEditor=()=>{
  if(bitmap){bitmap.close?.();bitmap=null;}
  editor.hidden=true;input.value='';drag=null;panX=0;panY=0;zoom=1;zoomSlider.value='1';
 };
 const paint=()=>{
  if(!bitmap||disposed)return;
  const crop=calculateAvatarCrop(bitmap.width,bitmap.height,zoom,panX,panY);
  panX=crop.panX;panY=crop.panY;
  const context=canvas.getContext('2d',{alpha:true});
  context.clearRect(0,0,AVATAR_CROP_SIZE,AVATAR_CROP_SIZE);
  context.drawImage(bitmap,crop.x,crop.y,crop.width,crop.height);
 };
 const refresh=async()=>{
  const response=await fetch('/api/v1/profile/avatar',{credentials:'include',cache:'no-store',signal:controller.signal});
  if(disposed)return;
  if(response.status===204){releasePhoto();setStatus('No profile photo saved.');return;}
  if(!response.ok)throw new Error('Private photo storage is unavailable ('+response.status+').');
  if((response.headers.get('content-type')||'').split(';')[0].trim()!=='image/png')throw new Error('Private photo could not be verified.');
  const blob=await response.blob();
  if(disposed)return;
  if(blob.size>AVATAR_RESULT_LIMIT)throw new Error('Stored photo exceeds the permitted limit.');
  releasePhoto();
  photoUrl=URL.createObjectURL(blob);image.src=photoUrl;image.hidden=false;initials.hidden=true;remove.hidden=false;
  setStatus('Your private profile photo is saved.');
 };
 const select=async()=>{
  const file=input.files?.[0];if(!file)return;
  if(!TYPES.has(file.type)||file.size<1||file.size>AVATAR_SOURCE_LIMIT){
   closeEditor();setStatus('Choose a JPEG, PNG or WebP image smaller than 5 MiB.');return;
  }
  try{
   const next=await createImageBitmap(file,{imageOrientation:'from-image'});
   if(disposed){next.close?.();return;}
   if(bitmap)bitmap.close?.();
   bitmap=next;zoom=1;panX=0;panY=0;zoomSlider.value='1';
   editor.hidden=false;paint();
   setStatus('Drag the image or use the arrow keys to position the square crop. Adjust Zoom, then save.');
  }catch{closeEditor();setStatus('This image cannot be decoded safely. Please choose another image.');}
 };
 input.addEventListener('change',()=>{void select();});
 zoomSlider.addEventListener('input',()=>{zoom=Number(zoomSlider.value);paint();});
 canvas.addEventListener('pointerdown',event=>{
  if(!bitmap||busy)return;
  drag={x:event.clientX,y:event.clientY};
  canvas.setPointerCapture?.(event.pointerId);event.preventDefault();
 });
 canvas.addEventListener('pointermove',event=>{
  if(!drag||!bitmap||busy)return;
  const rect=canvas.getBoundingClientRect(),factor=AVATAR_CROP_SIZE/Math.max(1,rect.width);
  panX+=(event.clientX-drag.x)*factor;panY+=(event.clientY-drag.y)*factor;
  drag={x:event.clientX,y:event.clientY};paint();
 });
 for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>{drag=null;});
 canvas.addEventListener('keydown',event=>{
  if(!bitmap||busy||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
  event.preventDefault();const step=event.shiftKey?20:5;
  if(event.key==='ArrowLeft')panX-=step;
  if(event.key==='ArrowRight')panX+=step;
  if(event.key==='ArrowUp')panY-=step;
  if(event.key==='ArrowDown')panY+=step;
  paint();
 });
 cancel.addEventListener('click',()=>{closeEditor();setStatus('Crop discarded.');});
 save.addEventListener('click',async()=>{
  if(!bitmap||busy||disposed)return;
  setBusy(true);setStatus('Saving your private cropped image…');
  try{
   const blob=await new Promise((resolve,reject)=>canvas.toBlob(result=>result?resolve(result):reject(new Error('Unable to encode PNG.')),'image/png'));
   if(blob.type!=='image/png'||blob.size>AVATAR_RESULT_LIMIT)throw new Error('Cropped PNG must be smaller than 2 MiB.');
   await api('/api/v1/profile/avatar',{method:'POST',body:JSON.stringify({pngDataUrl:await blobToDataUrl(blob)})});
   if(disposed)return;
   closeEditor();await refresh();toast?.('Private profile photo saved',{tone:'success'});
  }catch(error){if(!disposed){setStatus(error.message||'Could not save private photo.');toast?.('Photo upload failed',{tone:'danger'});}}
  finally{if(!disposed)setBusy(false);}
 });
 remove.addEventListener('click',async()=>{
  if(busy||disposed)return;
  setBusy(true);setStatus('Removing your private photo…');
  try{
   await api('/api/v1/profile/avatar',{method:'DELETE',body:'{}'});
   if(disposed)return;
   closeEditor();releasePhoto();setStatus('Private profile photo removed.');toast?.('Profile photo removed',{tone:'success'});
  }catch(error){if(!disposed)setStatus(error.message||'Could not remove private photo.');}
  finally{if(!disposed)setBusy(false);}
 });
 const cleanup=()=>{
  if(disposed)return;disposed=true;controller.abort();closeEditor();releasePhoto();
  window.removeEventListener('hashchange',onRouteChange);
  if(globalThis.__qellyAvatarCleanup===cleanup)globalThis.__qellyAvatarCleanup=null;
 };
 const onRouteChange=()=>{if(!location.hash.startsWith('#/account-session'))cleanup();};
 globalThis.__qellyAvatarCleanup=cleanup;
 window.addEventListener('hashchange',onRouteChange);
 void refresh().catch(error=>{if(!disposed&&error?.name!=='AbortError')setStatus(error.message||'Private photo is unavailable.');});
 return cleanup;
}
