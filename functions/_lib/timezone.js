export const TIMEZONE_PATTERN=/^[A-Za-z0-9_+\-/]{1,64}$/;

const TIMEZONE_ALIASES=Object.freeze({
  'Asia/Calcutta':'Asia/Kolkata'
});

export const canonicalTimezone=(value)=>{
  const timezone=String(value??'').trim();
  return TIMEZONE_ALIASES[timezone]??timezone;
};

export const recognizedTimezone=(value)=>{
  const timezone=canonicalTimezone(value);
  if(!TIMEZONE_PATTERN.test(timezone))return false;
  try{
    new Intl.DateTimeFormat('en-US',{timeZone:timezone}).format(new Date());
    return true;
  }catch{
    return false;
  }
};

export const __timezoneTest=Object.freeze({TIMEZONE_ALIASES});
