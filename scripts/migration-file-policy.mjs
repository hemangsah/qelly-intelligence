const FORWARD_MIGRATION=/^\d+[A-Za-z0-9_.-]*\.sql$/;
const REVERSE_MIGRATION_SUFFIX=/\.(?:down|rollback|undo)\.sql$/i;

export const isForwardMigrationFile=(name)=>{
  if(typeof name!=='string'||name.length===0||name.includes('/')||name.includes('\\'))return false;
  return FORWARD_MIGRATION.test(name)&&!REVERSE_MIGRATION_SUFFIX.test(name);
};

export const selectForwardMigrationFiles=(names)=>[...names]
  .filter(isForwardMigrationFile)
  .sort();
