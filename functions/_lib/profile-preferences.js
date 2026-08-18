import {HttpError,cleanText} from './runtime.js';
import {canonicalTimezone,recognizedTimezone} from './timezone.js';

export const SUPPORTED_BASE_CURRENCIES=Object.freeze(['USD','INR','EUR','GBP','SGD','AED','JPY']);
const CURRENCY_SET=new Set(SUPPORTED_BASE_CURRENCIES);

export const safeBaseCurrency=(value)=>{
  const currency=cleanText(value||'USD',8).toUpperCase();
  if(!CURRENCY_SET.has(currency))throw new HttpError(400,'base_currency_invalid','Base currency is not supported');
  return currency;
};

export const safeTimezone=(value)=>{
  const timezone=canonicalTimezone(cleanText(value||'UTC',64)||'UTC');
  if(!recognizedTimezone(timezone))throw new HttpError(400,'timezone_invalid','Timezone must be a valid IANA timezone');
  return timezone;
};
