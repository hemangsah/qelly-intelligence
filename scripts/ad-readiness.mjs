const CLIENT_PATTERN=/^ca-pub-\d{16}$/;
const SLOT_PATTERN=/^\d{5,20}$/;
const GOOGLE_SELLER_CERT='f08c47fec0942fa0';

export const AD_PLACEMENTS=Object.freeze({
  'market-intelligence-inline':'QELLY_PUBLIC_AD_SLOT_MARKET',
  'decision-intelligence-inline':'QELLY_PUBLIC_AD_SLOT_DECISION',
  'research-inline':'QELLY_PUBLIC_AD_SLOT_RESEARCH',
  'calculator-side':'QELLY_PUBLIC_AD_SLOT_CALCULATOR'
});

export function buildPublicAdConfig(environment={},options={}){
  const staticVisualPreview=options.staticVisualPreview===true;
  const githubPagesMirror=options.githubPagesMirror===true;
  const client=String(environment.QELLY_PUBLIC_AD_CLIENT??'').trim();
  const slots=Object.fromEntries(Object.entries(AD_PLACEMENTS).map(([placement,key])=>[placement,String(environment[key]??'').trim()]));
  const configuredSlots=Object.entries(slots).filter(([,id])=>Boolean(id));
  if(client&&!CLIENT_PATTERN.test(client))throw new Error('QELLY_PUBLIC_AD_CLIENT must be a valid public AdSense client ID');
  for(const [placement,id] of configuredSlots)if(!SLOT_PATTERN.test(id))throw new Error(`Ad slot ${placement} must be a numeric public slot ID`);
  if(configuredSlots.length&&!client)throw new Error('Configured ad slots require QELLY_PUBLIC_AD_CLIENT');
  const configured=!staticVisualPreview&&!githubPagesMirror&&Boolean(client&&configuredSlots.length);
  return Object.freeze({
    configured,
    client:configured?client:'',
    slots:Object.freeze(configured?slots:{}),
    configuredPlacements:configured?configuredSlots.map(([placement])=>placement):Object.freeze([])
  });
}

const addDirectiveSources=(headers,directive,sources)=>{
  const pattern=new RegExp(`(${directive}\\s+[^;\\n]+)`);
  const match=String(headers).match(pattern);
  if(!match)throw new Error(`Missing CSP directive ${directive}`);
  let value=match[1];
  for(const source of sources)if(!value.includes(source))value+=` ${source}`;
  return String(headers).replace(match[1],value);
};

export function enableAdNetworkCsp(headers){
  let next=String(headers);
  next=addDirectiveSources(next,'script-src',['https://pagead2.googlesyndication.com']);
  next=addDirectiveSources(next,'img-src',['https://pagead2.googlesyndication.com','https://googleads.g.doubleclick.net','https://www.google.com']);
  next=addDirectiveSources(next,'connect-src',['https://pagead2.googlesyndication.com','https://googleads.g.doubleclick.net']);
  next=addDirectiveSources(next,'frame-src',['https://googleads.g.doubleclick.net','https://tpc.googlesyndication.com','https://*.googlesyndication.com']);
  return next;
}

export function adsTxtFor(config){
  if(!config?.configured)return null;
  const client=String(config.client||'');
  if(!CLIENT_PATTERN.test(client))throw new Error('Cannot generate ads.txt without a valid approved client');
  const publisherId=client.replace(/^ca-/,'');
  return `google.com, ${publisherId}, DIRECT, ${GOOGLE_SELLER_CERT}\n`;
}

export const __test=Object.freeze({CLIENT_PATTERN,SLOT_PATTERN,GOOGLE_SELLER_CERT,addDirectiveSources});
