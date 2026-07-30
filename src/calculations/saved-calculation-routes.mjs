const savedPath=/^\/api\/v1\/calculations\/saved\/([^/]+)$/;
const revisionsPath=/^\/api\/v1\/calculations\/saved\/([^/]+)\/revisions$/;
const duplicatePath=/^\/api\/v1\/calculations\/saved\/([^/]+)\/duplicate$/;
const restorePath=/^\/api\/v1\/calculations\/saved\/([^/]+)\/restore$/;
const decode=match=>decodeURIComponent(match[1]);
const boolean=value=>value==null?null:['true','1','yes'].includes(String(value).toLowerCase());

export async function handleSavedCalculationRequest({request,response,url,id,runtime,sid,json,bodyJson,scopedContext,idempotent}){
  const pathname=url.pathname;
  if(request.method==='GET'&&pathname==='/api/v1/calculations/saved'){
    const {scope}=await scopedContext(runtime,sid,'workspace:read');
    const items=await runtime.savedCalculationStore.list({...scope,query:url.searchParams.get('q')??'',tag:url.searchParams.get('tag'),favorite:boolean(url.searchParams.get('favorite')),sort:url.searchParams.get('sort')??'updated-desc'});
    json(response,200,{items,persistence:{mode:'local-runtime-file',productionCloudConnected:false,schemaVersion:2,revisionHistory:true}},id);return true;
  }
  if(request.method==='POST'&&pathname==='/api/v1/calculations/saved'){
    const body=await bodyJson(request,1_000_000);runtime.schemaRegistry.validate('saved-calculation-input',body,{status:400,code:'request_schema_invalid'});const {scope}=await scopedContext(runtime,sid,'workspace:write');
    const result=await idempotent(runtime,request,body,()=>runtime.savedCalculationStore.save({...scope,name:body.name,result:body.result,notes:body.notes,tags:body.tags,favorite:body.favorite,correlationId:id}));json(response,201,result,id);return true;
  }
  let match=pathname.match(revisionsPath);
  if(match&&request.method==='GET'){
    const {scope}=await scopedContext(runtime,sid,'workspace:read');json(response,200,await runtime.savedCalculationStore.revisions({...scope,id:decode(match)}),id);return true;
  }
  match=pathname.match(duplicatePath);
  if(match&&request.method==='POST'){
    const body=await bodyJson(request,64_000);const {scope}=await scopedContext(runtime,sid,'workspace:write');const savedId=decode(match);
    const result=await idempotent(runtime,request,{savedId,...body},()=>runtime.savedCalculationStore.duplicate({...scope,id:savedId,name:body.name,correlationId:id}));json(response,201,result,id);return true;
  }
  match=pathname.match(restorePath);
  if(match&&request.method==='POST'){
    const body=await bodyJson(request,64_000);runtime.schemaRegistry.validate('saved-calculation-restore',body,{status:400,code:'request_schema_invalid'});const {scope}=await scopedContext(runtime,sid,'workspace:write');const savedId=decode(match);
    const result=await idempotent(runtime,request,{savedId,...body},()=>runtime.savedCalculationStore.restore({...scope,id:savedId,revisionId:body.revisionId,correlationId:id}));json(response,200,result,id);return true;
  }
  match=pathname.match(savedPath);
  if(match&&request.method==='GET'){
    const {scope}=await scopedContext(runtime,sid,'workspace:read');json(response,200,await runtime.savedCalculationStore.get({...scope,id:decode(match)}),id);return true;
  }
  if(match&&request.method==='PATCH'){
    const body=await bodyJson(request,1_000_000);runtime.schemaRegistry.validate('saved-calculation-update',body,{status:400,code:'request_schema_invalid'});const {scope}=await scopedContext(runtime,sid,'workspace:write');const savedId=decode(match);
    const result=await idempotent(runtime,request,{savedId,...body},()=>runtime.savedCalculationStore.update({...scope,id:savedId,...body,correlationId:id}));json(response,200,result,id);return true;
  }
  if(match&&request.method==='DELETE'){
    const {scope}=await scopedContext(runtime,sid,'workspace:write');const savedId=decode(match);const result=await idempotent(runtime,request,{savedId},()=>runtime.savedCalculationStore.remove({...scope,id:savedId,correlationId:id}));json(response,200,result,id);return true;
  }
  return false;
}
