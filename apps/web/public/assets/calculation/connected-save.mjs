import {saveCalculation} from './persistence.mjs';
import {cloudStatus,pushLocalToCloud} from '../qelly-cloud-sync.mjs';

const summarizeTransfer=(transfer)=>{
  if(!transfer)return {state:'LOCAL',message:'Saved in this browser.'};
  if(transfer.conflicts?.length)return {state:'CONFLICT',message:`Saved locally. ${transfer.conflicts.length} cloud conflict${transfer.conflicts.length===1?'':'s'} require review; nothing was silently overwritten.`};
  if(transfer.offline||transfer.remaining>0)return {state:'QUEUED',message:`Saved locally and queued for cloud synchronization${transfer.offline?' while offline':''}.`};
  if(transfer.failedBatches?.length)return {state:'LOCAL',message:'Saved locally. Cloud synchronization did not complete; the safe local record remains available.'};
  if(Number(transfer.flushed)>0)return {state:'CLOUD',message:'Saved locally and synchronized to the authenticated cloud workspace.'};
  return {state:'LOCAL',message:'Saved in this browser; no cloud transfer was required.'};
};

export async function syncSavedCalculationIfOptedIn({api,item}={}){
  if(typeof api!=='function'||!item)return {item,cloud:null,state:'LOCAL',message:'Saved in this browser.'};
  let status;
  try{status=await cloudStatus(api);}catch(error){return {item,cloud:null,state:'LOCAL',message:`Saved locally. Cloud status is unavailable: ${error.message}`};}
  if(!status.authenticated)return {item,cloud:status,state:'LOCAL',message:'Saved locally. Sign in before using cloud synchronization.'};
  if(!status.optIn)return {item,cloud:status,state:'LOCAL',message:'Saved locally. Cloud synchronization is currently opted out.'};
  try{
    const transfer=await pushLocalToCloud(api,[item]);
    return {item,cloud:status,transfer,...summarizeTransfer(transfer)};
  }catch(error){
    return {item,cloud:status,state:'LOCAL',message:`Saved locally. Cloud synchronization could not start: ${error.message}`};
  }
}

export async function saveConnectedCalculation({api,name,result,notes='',tags=[],favorite=false}={}){
  const item=saveCalculation({name,result,notes,tags,favorite});
  return syncSavedCalculationIfOptedIn({api,item});
}

export const __connectedSaveTest=Object.freeze({summarizeTransfer});
