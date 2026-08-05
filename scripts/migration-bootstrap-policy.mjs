const normalizeManagedObjects=(value)=>Array.isArray(value)
  ?value.filter((entry)=>entry&&typeof entry==='object').map((entry)=>({
    kind:String(entry.kind||'object'),
    identity:String(entry.identity||'unknown')
  }))
  :[];

export const migrationBootstrapState=(row={})=>{
  const historyTable=typeof row.history_table==='string'&&row.history_table.length>0
    ?row.history_table
    :null;
  const managedObjects=normalizeManagedObjects(row.managed_objects);
  return Object.freeze({
    historyTable,
    managedObjects:Object.freeze(managedObjects),
    bootstrapConflict:historyTable===null&&managedObjects.length>0
  });
};

export const assertSafeMigrationBootstrap=(state)=>{
  if(!state?.bootstrapConflict)return state;
  const sample=state.managedObjects
    .slice(0,12)
    .map((entry)=>`${entry.kind}:${entry.identity}`)
    .join(', ');
  const error=new Error(
    `Migration history is missing while existing Qelly schema objects were detected${sample?`: ${sample}`:''}. Refusing to replay migrations; establish a reviewed baseline first.`
  );
  error.code='migration_history_bootstrap_required';
  error.details={
    historyTable:null,
    managedObjectCount:state.managedObjects.length,
    managedObjects:state.managedObjects.slice(0,12)
  };
  throw error;
};
