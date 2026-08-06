const REVERSE_SUFFIX=/\.(?:down|rollback|undo)\.sql$/i;
const FORWARD_SQL=/^(\d+)[A-Za-z0-9_.-]*\.sql$/;
const PROFILES=new Set(['platform','supabase']);

export function normalizeMigrationProfile(value,{production=false}={}){
  const profile=String(value??(production?'':'platform')).trim().toLowerCase();
  if(!PROFILES.has(profile)){
    const error=new Error('QELLY_MIGRATION_PROFILE must be platform or supabase');
    error.code='migration_profile_required';
    throw error;
  }
  return profile;
}

export function migrationNumber(name){
  const match=String(name??'').match(FORWARD_SQL);
  return match?Number(match[1]):null;
}

export function isForwardMigrationFile(name){
  return typeof name==='string'&&!name.includes('/')&&!name.includes('\\')&&FORWARD_SQL.test(name)&&!REVERSE_SUFFIX.test(name);
}

export function migrationProfileForFile(name){
  if(!isForwardMigrationFile(name))return null;
  const number=migrationNumber(name);
  return number<=108?'platform':'supabase';
}

export function selectMigrationFiles(names,profile){
  const normalized=normalizeMigrationProfile(profile);
  return [...names]
    .filter((name)=>migrationProfileForFile(name)===normalized)
    .sort();
}

export const migrationProfiles=Object.freeze([...PROFILES]);
