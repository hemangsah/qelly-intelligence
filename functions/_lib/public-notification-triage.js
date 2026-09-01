const TYPES=Object.freeze([
  Object.freeze({id:'alert_trigger',label:'Alert trigger',purpose:'Review a condition-qualified signal after delivery.'}),
  Object.freeze({id:'event_reminder',label:'Event reminder',purpose:'Review a time-bound catalyst or preparation task.'}),
  Object.freeze({id:'evidence_update',label:'Evidence update',purpose:'Review material changes to a sourced evidence set.'}),
  Object.freeze({id:'workflow_assignment',label:'Workflow assignment',purpose:'Accept or redirect a named research responsibility.'}),
  Object.freeze({id:'provider_incident',label:'Provider incident',purpose:'Assess a data, permission or delivery degradation.'})
]);
const SEVERITIES=Object.freeze([
  Object.freeze({id:'information',label:'Information',slaMinutes:1440,lane:'Research queue'}),
  Object.freeze({id:'attention',label:'Attention',slaMinutes:240,lane:'Same-session review'}),
  Object.freeze({id:'critical',label:'Critical',slaMinutes:30,lane:'Immediate escalation'})
]);
const CHANNELS=Object.freeze([
  Object.freeze({id:'in_app',label:'In-app inbox'}),
  Object.freeze({id:'email',label:'Email'}),
  Object.freeze({id:'webhook',label:'Webhook'}),
  Object.freeze({id:'push',label:'Push notification'})
]);
const SOURCE_ROUTES=Object.freeze([
  Object.freeze({id:'alert-center',label:'Alert Rules',job:'A condition qualified for human review.'}),
  Object.freeze({id:'event-calendar',label:'Event Calendar',job:'A monitored catalyst reached its review window.'}),
  Object.freeze({id:'research-workspace',label:'Research Workspace',job:'Evidence or an assignment changed.'}),
  Object.freeze({id:'delivery-operations',label:'Provider Operations',job:'A provider or delivery incident needs triage.'}),
  Object.freeze({id:'decision-provenance',label:'Decision Provenance',job:'A decision record requires acknowledgement.'})
]);
const clean=(value,max=500)=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const integer=(value,fallback,min,max)=>{const parsed=Number.parseInt(String(value??''),10);return Number.isFinite(parsed)?Math.min(max,Math.max(min,parsed)):fallback;};
const instant=(value)=>{const normalized=clean(value,40);if(!normalized)return null;const parsed=Date.parse(normalized);return Number.isFinite(parsed)?new Date(parsed).toISOString():null;};
const select=(value,items,fallback)=>items.some((item)=>item.id===value)?value:fallback;
const fingerprint=(value)=>{let hash=2166136261;for(const char of String(value||'')){hash^=char.codePointAt(0);hash=Math.imul(hash,16777619);}return `fnv1a-${(hash>>>0).toString(16).padStart(8,'0')}`;};

function triageState({complete,severity,overdue,duplicateCount}){
  if(!complete)return 'blocked';
  if(severity==='critical'&&overdue)return 'escalate-now';
  if(overdue)return 'review-now';
  if(duplicateCount>=3)return 'review-cluster';
  if(severity==='critical')return 'priority-review';
  if(severity==='attention')return 'same-session-review';
  return 'standard-queue';
}

export function buildPublicNotificationTriage(input={}){
  const typeId=select(clean(input.type,40),TYPES,'alert_trigger');
  const severityId=select(clean(input.severity,30),SEVERITIES,'attention');
  const channelId=select(clean(input.channel,30),CHANNELS,'in_app');
  const sourceRouteId=select(clean(input.sourceRoute,50),SOURCE_ROUTES,'alert-center');
  const type=TYPES.find((item)=>item.id===typeId);
  const severity=SEVERITIES.find((item)=>item.id===severityId);
  const channel=CHANNELS.find((item)=>item.id===channelId);
  const sourceRoute=SOURCE_ROUTES.find((item)=>item.id===sourceRouteId);
  const createdAt=instant(input.createdAt),reviewedAt=instant(input.reviewedAt);
  const ageMinutes=createdAt&&reviewedAt?Number(((Date.parse(reviewedAt)-Date.parse(createdAt))/60000).toFixed(2)):null;
  const temporalOrder=ageMinutes!=null&&ageMinutes>=0;
  const overdue=temporalOrder&&ageMinutes>severity.slaMinutes;
  const duplicateCount=integer(input.duplicateCount,0,0,999);
  const declaration={
    notificationId:clean(input.notificationId,100),title:clean(input.title,140),summary:clean(input.summary,500),deliveryReceipt:clean(input.deliveryReceipt,140),
    createdAt,reviewedAt,dedupeKey:clean(input.dedupeKey,140),duplicateCount,owner:clean(input.owner,100),reviewer:clean(input.reviewer,100),
    reviewQuestion:clean(input.reviewQuestion,420),responsePlan:clean(input.responsePlan,420),escalationCondition:clean(input.escalationCondition,420),acknowledgementNote:clean(input.acknowledgementNote,420)
  };
  const identityReady=Boolean(declaration.notificationId&&declaration.title);
  const deliveryReady=Boolean(channel&&declaration.deliveryReceipt);
  const freshnessReady=Boolean(temporalOrder);
  const contentReady=Boolean(declaration.summary&&declaration.reviewQuestion);
  const noiseReady=Boolean(declaration.dedupeKey);
  const ownershipReady=Boolean(declaration.owner&&declaration.reviewer);
  const responseReady=Boolean(declaration.responsePlan&&declaration.escalationCondition&&declaration.acknowledgementNote);
  const gates=[
    {id:'identity',label:'Notification identity',state:identityReady?'ready':'blocked',purpose:'Bind the item to one stable receipt and concise title.',detail:identityReady?`${declaration.notificationId} · ${declaration.title}`:'Declare the notification ID and title.'},
    {id:'origin',label:'Origin contract',state:sourceRoute?'ready':'blocked',purpose:'Name the Qelly workflow that created the review obligation.',detail:`${sourceRoute.label} · ${sourceRoute.job}`},
    {id:'delivery',label:'Delivery evidence',state:deliveryReady?'ready':'blocked',purpose:'Require a declared channel receipt without claiming Qelly verified transmission.',detail:deliveryReady?`${channel.label} · ${declaration.deliveryReceipt}`:'Declare the delivery receipt.'},
    {id:'freshness',label:'Review timing',state:freshnessReady?'ready':'blocked',purpose:'Calculate age and SLA state from declared delivery and review timestamps.',detail:ageMinutes==null?'Declare delivery and review timestamps.':!temporalOrder?'Review cannot occur before delivery.':`${ageMinutes} minutes elapsed · ${severity.slaMinutes} minute policy`},
    {id:'content',label:'Decision context',state:contentReady?'ready':'blocked',purpose:'Explain what changed and the exact human question it opens.',detail:contentReady?'Summary and review question declared.':'Declare the summary and review question.'},
    {id:'noise',label:'Noise control',state:noiseReady?'ready':'blocked',purpose:'Group repeated deliveries under one deduplication key.',detail:noiseReady?`${declaration.dedupeKey} · ${duplicateCount} duplicate(s)`:'Declare a deduplication key.'},
    {id:'ownership',label:'Accountability',state:ownershipReady?'ready':'blocked',purpose:'Name the queue owner and human reviewer.',detail:ownershipReady?`${declaration.owner} owns · ${declaration.reviewer} reviews`:'Declare an owner and reviewer.'},
    {id:'response',label:'Response contract',state:responseReady?'ready':'blocked',purpose:'Declare the response, escalation condition and acknowledgement record.',detail:responseReady?'Response, escalation and acknowledgement declared.':'Complete the response contract.'}
  ];
  const readyGates=gates.filter((item)=>item.state==='ready').length;
  const complete=gates.every((item)=>item.state==='ready');
  const lane=triageState({complete,severity:severityId,overdue,duplicateCount});
  const integrity=fingerprint([typeId,severityId,channelId,sourceRouteId,...Object.values(declaration)].join('|'));
  const receipt={state:complete?'ready':'draft',triageId:complete?`NTF-${typeId.split('_')[0].toUpperCase()}-${integrity.slice(-8)}`:null,fingerprint:integrity,persisted:false,sourceVerified:false,deliveryVerified:false,readStateMutated:false};
  return {
    version:'governed-notification-triage-v2',state:complete?'triage-ready':'triage-setup-ready',
    job:'Turn one declared delivery receipt into a prioritized, deduplicated and accountable human review—without inventing an inbox, transmission proof or read-state mutation.',
    types:TYPES,severities:SEVERITIES,channels:CHANNELS,sourceRoutes:SOURCE_ROUTES,type,severity,channel,sourceRoute,declaration,gates,receipt,
    triage:{state:lane,ageMinutes,overdue,slaMinutes:severity.slaMinutes,lane:severity.lane,duplicateCount,humanReviewRequired:complete,automaticActionTaken:false},
    readiness:{readyGates,totalGates:gates.length,triageReady:complete,state:complete?'ready-for-human-review':'blocked-missing-triage-fields'},
    coverage:{connectedInbox:false,persistedNotifications:0,unreadNotifications:0,deliveryReceiptsVerified:0,reason:'No approved public inbox, notification store or delivery provider is connected. This workspace evaluates one user-declared receipt deterministically and does not list, create, mark, send or persist notifications.'},
    protocol:[
      {step:'01',label:'Receive',job:'Identify one delivered item and its originating Qelly workflow.'},
      {step:'02',label:'Prove',job:'Declare the channel receipt and review timestamps.'},
      {step:'03',label:'Prioritize',job:'Apply severity, age and response-time policy.'},
      {step:'04',label:'Deduplicate',job:'Group repeated items without silently discarding evidence.'},
      {step:'05',label:'Acknowledge',job:'Record the human interpretation and response plan.'},
      {step:'06',label:'Escalate',job:'Carry material items to the named reviewer and decision record.'}
    ],
    handoffs:[
      {route:'alert-center',label:'Alert Rules',job:'Define the measurable condition before a notification exists.'},
      {route:'notification-schedules',label:'Notification Schedules',job:'Define when a digest should run, separately from triage.'},
      {route:'delivery-operations',label:'Provider Operations',job:'Inspect channel authorization, attempts and external receipt evidence.'},
      {route:'decision-provenance',label:'Decision Provenance',job:'Record the accountable human response to a material notification.'}
    ],
    boundaries:{fixtureNotifications:false,userDeclaredReceipt:true,connectedInbox:false,persistence:false,readMutation:false,sourceVerified:false,deliveryVerified:false,emailSent:false,pushSent:false,webhookSent:false,recommendation:false,execution:false}
  };
}

export const __test=Object.freeze({TYPES,SEVERITIES,CHANNELS,SOURCE_ROUTES,clean,integer,instant,select,fingerprint,triageState});
