import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const sql=await readFile(new URL('../supabase/migrations/20261003065000_qelly_private_avatar_storage_v1.sql',import.meta.url),'utf8');
test('private avatar bucket has an immutable security baseline and limited formats',()=>{
 assert.match(sql,/insert into storage\.buckets \(id,name,public,file_size_limit,allowed_mime_types\)/i);
 assert.match(sql,/'qelly-private-avatars','qelly-private-avatars',false,\s*2097152/i);
 assert.match(sql,/array\['image\/jpeg','image\/png','image\/webp'\]::text\[\]/);
 assert.match(sql,/on conflict \(id\) do update set\s+public=false,\s+file_size_limit=2097152/i);
 assert.doesNotMatch(sql,/image\/svg\+xml|application\/pdf|public=true|service_role|create signed url/i);
});
test('authenticated own-identity RLS strictly constrains every avatar Storage operation',()=>{
 assert.match(sql,/alter table storage\.objects enable row level security/i);
 const policies=['read','create','update','delete'];
 for(const policy of policies){
   const declaration='create policy qelly_private_avatar_own_'+policy;
   assert.ok(sql.includes(declaration),declaration);
 }
 assert.equal((sql.match(/on storage\.objects for (?:select|insert|update|delete) to authenticated/g)||[]).length,4);
 assert.equal((sql.match(/bucket_id='qelly-private-avatars'/g)||[]).length,5);
 assert.equal((sql.match(/owner_id=\(select auth\.uid\(\)\)::text/g)||[]).length,5);
 assert.equal((sql.match(/\(storage\.foldername\(name\)\)\[1\]=\(select auth\.uid\(\)\)::text/g)||[]).length,5);
 assert.equal((sql.match(/array_length\(storage\.foldername\(name\),1\)=1/g)||[]).length,5);
 assert.equal((sql.match(/storage\.filename\(name\) ~ '\^avatar\\\.\(jpg\|png\|webp\)\$'/g)||[]).length,5);
 assert.match(sql,/create policy qelly_private_avatar_own_update[\s\S]*?using \([\s\S]*?\)\s*with check \(/i);
 assert.doesNotMatch(sql,/to anon|to public|using\s*\(\s*true\s*\)|with check\s*\(\s*true\s*\)|disable row level security/i);
});
test('storage foundation cannot silently enable a UI or persist uploaded MT5 data',async()=>{
 const ui=await readFile(new URL('../apps/web/public/assets/routes/account-session.mjs',import.meta.url),'utf8');
 assert.match(ui,/avatarSupported=profileCapabilities\.avatarStorage==='private-rls'/);
 assert.match(ui,/avatarEditorMarkup=avatarSupported\?/);
 assert.match(ui,/if\(avatarSupported\)installPrivateAvatarControls/);
 assert.doesNotMatch(sql,/mt5-report|qelly_private_mt5_reports|create policy.+mt5/i);
 assert.match(sql,/Foundation only/);
});
