export class SecretRotationService{
  constructor({repository,secretProtector,auditLedger}={}){this.repository=repository;this.secretProtector=secretProtector;this.auditLedger=auditLedger;}
  async status(){
    const protector=this.secretProtector?.status?.()??{mode:this.secretProtector?.mode??'unavailable',activeKeyId:null,keyIds:[],keyCount:0,envelopeVersion:'v1',rotationSupported:false,keyMaterialExposed:false};
    const factors=await this.repository.listMfaFactors();
    const distribution={};for(const factor of factors){const keyId=this.secretProtector?.keyIdOf?.(factor.secret)??(String(factor.secret).startsWith('qelly:v1:')?'legacy-v1':'plaintext-or-unknown');distribution[keyId]=(distribution[keyId]??0)+1;}
    return {protector,protectedRecordCount:factors.length,envelopeDistribution:distribution,rewrapRequired:Boolean(protector.activeKeyId&&Object.entries(distribution).some(([keyId,count])=>count>0&&keyId!==protector.activeKeyId)),truthBoundary:'Key material is configured server-side only. The browser can request rewrapping to an already-configured active key, but cannot provide or retrieve key material.'};
  }
  async rewrapMfaSecrets({actor,tenantId,workspaceId,correlationId}={}){
    if(!this.secretProtector?.rewrap||!this.secretProtector?.status?.().rotationSupported)throw Object.assign(new Error('Versioned key rotation is not configured'),{status:409,code:'secret_rotation_not_configured'});
    const factors=await this.repository.listMfaFactors();let rotated=0,unchanged=0,failed=0;const failures=[];
    for(const factor of factors){
      const purpose=`mfa:${factor.user_id}`;const keyId=this.secretProtector.keyIdOf(factor.secret);
      if(keyId===this.secretProtector.activeKeyId){unchanged+=1;continue;}
      try{const next=this.secretProtector.rewrap(factor.secret,{purpose});await this.repository.updateMfaSecret(factor.user_id,next);rotated+=1;}catch(error){failed+=1;failures.push({userId:factor.user_id,code:error.code??'rewrap_failed'});}
    }
    const result={activeKeyId:this.secretProtector.activeKeyId,total:factors.length,rotated,unchanged,failed,failures};
    await this.auditLedger?.append({eventType:'security.secret-protection.rewrapped.v1',correlationId,actor:{type:'user',id:actor},tenantId,workspaceId,outcome:failed?'partial':'success',details:{activeKeyId:result.activeKeyId,total:result.total,rotated,unchanged,failed}});
    return result;
  }
}
