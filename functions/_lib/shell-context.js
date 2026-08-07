export const REQUIRED_EVIDENCE_FIELDS=Object.freeze([
  'source',
  'observedAt',
  'ingestedAt',
  'freshness',
  'confidence',
  'coverage',
  'method',
  'assumptions',
  'contradictions',
  'limitations',
  'version',
  'auditId'
]);

const textOr=(value,fallback)=>{
  const text=String(value??'').trim();
  return text||fallback;
};

export function buildShellContext(qelly={},runtime={}){
  const profile=qelly.profile??{};
  const workspace=qelly.workspace??{};
  const session=qelly.session??{};
  return Object.freeze({
    schemaVersion:1,
    workspace:Object.freeze({
      workspaceId:workspace.workspaceId??null,
      name:textOr(workspace.name,'Qelly Workspace')
    }),
    defaults:Object.freeze({
      timezone:textOr(profile.timezone,'UTC'),
      baseCurrency:textOr(profile.base_currency,'USD').toUpperCase()
    }),
    system:Object.freeze({
      environment:textOr(runtime.environment,'unresolved'),
      releaseSha:textOr(runtime.releaseSha,'unresolved'),
      authentication:'authenticated',
      assurance:textOr(session.assurance,'unknown'),
      sessionExpiresAt:session.expiresAt??null,
      providerRuntime:runtime.capabilities?.liveProviders===true?'configured-rights-gated':'disabled',
      cloudSync:runtime.capabilities?.cloudSync===true?'configured':'disabled'
    }),
    evidencePolicy:Object.freeze({
      requiredFields:REQUIRED_EVIDENCE_FIELDS,
      contradictionsFirstClass:true,
      missingEvidence:'preserve-missing',
      confidenceRequires:Object.freeze(['coverage','method','contradictions','version'])
    }),
    safety:Object.freeze({
      readOnly:true,
      tradeExecution:false,
      custody:false,
      transfers:false,
      secretsSerialized:false
    })
  });
}
