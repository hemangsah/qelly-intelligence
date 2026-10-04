import {crc32,deflateRawSync} from 'node:zlib';
// Synthetic static Deals data. Node's independent CRC implementation is used
// rather than importing the application's checksum helper into its fixtures.
export const sheet='<worksheet><sheetData><row><c t="inlineStr"><is><t>Deal</t></is></c><c t="inlineStr"><is><t>Type</t></is></c><c t="inlineStr"><is><t>Direction</t></is></c><c t="inlineStr"><is><t>Profit</t></is></c></row><row><c t="inlineStr"><is><t>1</t></is></c><c t="inlineStr"><is><t>buy</t></is></c><c t="inlineStr"><is><t>out</t></is></c><c><v>10</v></c></row></sheetData></worksheet>';
export const sheetName='xl/worksheets/sheet1.xml';
export function zipFixture(entries=[[sheetName,sheet]],{deflate=false,descriptor=false,signed=true,comment=''}={}){
 const local=[],central=[];let offset=0;
 for(const [name,text] of entries){
  const filename=Buffer.from(name),raw=Buffer.from(text),packed=deflate?deflateRawSync(raw):raw,crc=crc32(raw),flags=descriptor?8:0;
  const l=Buffer.alloc(30),c=Buffer.alloc(46);
  l.writeUInt32LE(0x04034b50,0);l.writeUInt16LE(20,4);l.writeUInt16LE(flags,6);l.writeUInt16LE(deflate?8:0,8);l.writeUInt16LE(filename.length,26);
  if(!descriptor){l.writeUInt32LE(crc,14);l.writeUInt32LE(packed.length,18);l.writeUInt32LE(raw.length,22);}
  const d=Buffer.alloc(descriptor?(signed?16:12):0);
  if(descriptor){const begin=signed?4:0;if(signed)d.writeUInt32LE(0x08074b50,0);d.writeUInt32LE(crc,begin);d.writeUInt32LE(packed.length,begin+4);d.writeUInt32LE(raw.length,begin+8);}
  local.push(l,filename,packed,d);
  c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(flags,8);c.writeUInt16LE(deflate?8:0,10);c.writeUInt32LE(crc,16);c.writeUInt32LE(packed.length,20);c.writeUInt32LE(raw.length,24);c.writeUInt16LE(filename.length,28);c.writeUInt32LE(offset,42);
  central.push(c,filename);offset+=l.length+filename.length+packed.length+d.length;
 }
 const directory=Buffer.concat(central),tail=Buffer.alloc(22),note=Buffer.from(comment);
 tail.writeUInt32LE(0x06054b50,0);tail.writeUInt16LE(entries.length,8);tail.writeUInt16LE(entries.length,10);tail.writeUInt32LE(directory.length,12);tail.writeUInt32LE(offset,16);tail.writeUInt16LE(note.length,20);
 return Buffer.concat([...local,directory,tail,note]);
}
export const endOffset=b=>b.length-22;
export const centralOffset=b=>b.readUInt32LE(endOffset(b)+16);
