import crypto from 'node:crypto';
import { AtomicJsonStore } from '../platform/json-store.mjs';
import { instrumentSeed } from './instrument-seed.mjs';

const normalize = (value) => String(value ?? '').trim().toLowerCase();

export class InstrumentStore {
  constructor({ filePath, auditLedger }) {
    this.store = new AtomicJsonStore(filePath, instrumentSeed);
    this.auditLedger = auditLedger;
  }

  async summary() {
    const data = await this.store.read();
    const byAssetClass = Object.entries(data.instruments.reduce((acc,item)=>{acc[item.assetClass]=(acc[item.assetClass]??0)+1;return acc;},{})).map(([assetClass,count])=>({assetClass,count}));
    return { revision:data.revision,systemOfRecord:data.systemOfRecord,productionReferenceData:data.productionReferenceData,instruments:data.instruments.length,venues:data.venues.length,currencies:data.currencies.length,calendars:data.calendars.length,byAssetClass,lastChange:data.changeHistory.at(-1)??null };
  }

  async search({ q='', assetClass=null, status=null, limit=50, cursor=0 } = {}) {
    const data=await this.store.read(); const needle=normalize(q);
    const rows=data.instruments.filter((item)=>{
      if(assetClass&&item.assetClass!==assetClass)return false;
      if(status&&item.status!==status)return false;
      if(!needle)return true;
      const hay=[item.canonicalId,item.name,item.shortName,item.primarySymbol,item.assetClass,item.jurisdiction,item.sector,item.industry,...item.symbols.map((s)=>s.symbol),...item.identifiers.map((i)=>i.value)].join(' ').toLowerCase();
      return hay.includes(needle);
    }).sort((a,b)=>a.canonicalId.localeCompare(b.canonicalId));
    const start=Math.max(0,Number(cursor)||0); const size=Math.max(1,Math.min(Number(limit)||50,100));
    return {items:rows.slice(start,start+size),total:rows.length,nextCursor:start+size<rows.length?String(start+size):null,revision:data.revision,systemOfRecord:data.systemOfRecord};
  }

  async get(canonicalId) {
    const data=await this.store.read();
    const instrument=data.instruments.find((item)=>item.canonicalId===canonicalId);
    if(!instrument)throw Object.assign(new Error('Canonical instrument not found'),{status:404,code:'instrument_not_found'});
    return {...instrument,venueDetails:data.venues.filter((venue)=>instrument.venueIds.includes(venue.venueId)),calendar:data.calendars.find((calendar)=>calendar.calendarId===instrument.calendarId)??null,revision:data.revision};
  }

  async relationships(canonicalId) {
    const data=await this.store.read(); const source=data.instruments.find((item)=>item.canonicalId===canonicalId);
    if(!source)throw Object.assign(new Error('Canonical instrument not found'),{status:404,code:'instrument_not_found'});
    const outgoing=source.relationships.map((relationship)=>({...relationship,direction:'outgoing',target:data.instruments.find((item)=>item.canonicalId===relationship.targetCanonicalId)??null}));
    const incoming=data.instruments.flatMap((item)=>item.relationships.filter((relationship)=>relationship.targetCanonicalId===canonicalId).map((relationship)=>({...relationship,direction:'incoming',sourceCanonicalId:item.canonicalId,source:item})));
    return {canonicalId,outgoing,incoming,total:outgoing.length+incoming.length,revision:data.revision};
  }

  async resolve(input={}) {
    const data=await this.store.read(); const terms=[input.canonicalId,input.symbol,input.identifier,input.name].filter(Boolean).map(normalize);
    if(!terms.length)throw Object.assign(new Error('At least one identifier is required'),{status:400,code:'request_invalid'});
    const candidates=[];
    for(const item of data.instruments){
      let score=0; const reasons=[];
      for(const term of terms){
        if(normalize(item.canonicalId)===term){score+=100;reasons.push('canonical-id-exact');}
        if(normalize(item.primarySymbol)===term){score+=80;reasons.push('primary-symbol-exact');}
        if(item.symbols.some((symbol)=>normalize(symbol.symbol)===term)){score+=70;reasons.push('symbol-history-exact');}
        if(item.identifiers.some((identifier)=>normalize(identifier.value)===term)){score+=90;reasons.push('identifier-exact');}
        if(normalize(item.name)===term){score+=60;reasons.push('name-exact');}
        else if(normalize(item.name).includes(term)){score+=20;reasons.push('name-partial');}
      }
      if(input.assetClass&&item.assetClass===input.assetClass){score+=10;reasons.push('asset-class-match');}
      if(input.venueId&&item.venueIds.includes(input.venueId)){score+=10;reasons.push('venue-match');}
      if(score>0)candidates.push({canonicalId:item.canonicalId,name:item.name,primarySymbol:item.primarySymbol,assetClass:item.assetClass,score,reasons:[...new Set(reasons)],confidence:Number(Math.min(0.999,score/120).toFixed(3))});
    }
    candidates.sort((a,b)=>b.score-a.score||a.canonicalId.localeCompare(b.canonicalId));
    const conflict=candidates.length>1&&candidates[0].score===candidates[1].score;
    return {input,candidates:candidates.slice(0,10),resolved:!conflict&&candidates[0]?.confidence>=0.6?candidates[0]:null,requiresReview:conflict||!candidates[0]||candidates[0].confidence<0.6,revision:data.revision};
  }

  async recordSymbolChange({canonicalId,newSymbol,venueId,validFrom,actorId,correlationId,tenantId,workspaceId}) {
    if(!/^[A-Z0-9._/-]{1,24}$/.test(newSymbol??''))throw Object.assign(new Error('New symbol format is invalid'),{status:400,code:'request_invalid'});
    let result;
    await this.store.update((data)=>{
      const instrument=data.instruments.find((item)=>item.canonicalId===canonicalId);
      if(!instrument)throw Object.assign(new Error('Canonical instrument not found'),{status:404,code:'instrument_not_found'});
      const current=instrument.symbols.find((item)=>item.validTo==null&&item.venueId===venueId);
      if(current&&current.symbol===newSymbol)throw Object.assign(new Error('Symbol is already current'),{status:409,code:'symbol_unchanged'});
      const start=validFrom??new Date().toISOString().slice(0,10);
      if(current)current.validTo=new Date(new Date(start).getTime()-86400000).toISOString().slice(0,10);
      instrument.symbols.push({symbol:newSymbol,venueId,validFrom:start,validTo:null}); instrument.primarySymbol=newSymbol; instrument.updatedAt=new Date().toISOString();
      data.revision+=1; result={canonicalId,previousSymbol:current?.symbol??null,newSymbol,venueId,validFrom:start,revision:data.revision};
      data.changeHistory.push({changeId:crypto.randomUUID(),revision:data.revision,changedAt:new Date().toISOString(),actorId,type:'symbol.changed',details:result});
      return data;
    });
    await this.auditLedger.append({eventType:'symbol.changed.v1',correlationId,actor:{type:'user',id:actorId},tenantId,workspaceId,details:result});
    return result;
  }

  async addRelationship({canonicalId,type,targetCanonicalId,validFrom,actorId,correlationId,tenantId,workspaceId}) {
    const allowed=new Set(['underlying','wrapped','tokenized','constituent','tracks-index','issuer','derivative-of','pair-base','pair-quote','share-class']);
    if(!allowed.has(type))throw Object.assign(new Error('Relationship type is not governed'),{status:400,code:'request_invalid'});
    let result;
    await this.store.update((data)=>{
      const source=data.instruments.find((item)=>item.canonicalId===canonicalId); const target=data.instruments.find((item)=>item.canonicalId===targetCanonicalId);
      if(!source||!target)throw Object.assign(new Error('Source or target instrument not found'),{status:404,code:'instrument_not_found'});
      if(source.relationships.some((item)=>item.type===type&&item.targetCanonicalId===targetCanonicalId&&item.validTo==null))throw Object.assign(new Error('Active relationship already exists'),{status:409,code:'relationship_exists'});
      const relationship={relationshipId:crypto.randomUUID(),type,targetCanonicalId,validFrom:validFrom??new Date().toISOString().slice(0,10),validTo:null,source:'Qelly governed local mutation'};
      source.relationships.push(relationship); source.updatedAt=new Date().toISOString(); data.revision+=1; result={canonicalId,...relationship,revision:data.revision};
      data.changeHistory.push({changeId:crypto.randomUUID(),revision:data.revision,changedAt:new Date().toISOString(),actorId,type:'relationship.created',details:result});
      return data;
    });
    await this.auditLedger.append({eventType:'relationship.created.v1',correlationId,actor:{type:'user',id:actorId},tenantId,workspaceId,details:result});
    return result;
  }
}
