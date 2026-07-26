import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRuntime } from '../src/server/runtime.mjs';
import { initializeProductionFoundation } from '../src/production/production-foundation.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');const runtimeDir=process.env.QELLY_RUNTIME_DIR??path.join(root,'runtime');
const runtime=createRuntime({runtimeDir,packageDir:path.join(root,'packages')});await runtime.schemaRegistry.init();await initializeProductionFoundation(runtime,{runtimeDir});
if(!runtime.productionAuthService)throw new Error('Production foundation unavailable');
const email=process.env.QELLY_SEED_EMAIL??'admin@qelly.local';const password=process.env.QELLY_SEED_PASSWORD;
if(!password)throw new Error('QELLY_SEED_PASSWORD is required and is never stored in source');
const fakeRequest={headers:{'user-agent':'qelly-seed-runner'},socket:{remoteAddress:'127.0.0.1'}};
const result=await runtime.productionAuthService.register({email,password,displayName:process.env.QELLY_SEED_NAME??'Qelly Administrator',organizationName:process.env.QELLY_SEED_ORGANIZATION??'Qelly Labs',workspaceName:process.env.QELLY_SEED_WORKSPACE??'Institutional Research',locale:'en-US',timezone:'UTC',baseCurrency:'USD'},fakeRequest,'seed-production');
console.log(JSON.stringify({ok:true,userId:result.context.user.userId,organizationId:result.context.organization.organizationId,workspaceId:result.context.workspace.workspaceId},null,2));runtime.productionRepository.close?.();
