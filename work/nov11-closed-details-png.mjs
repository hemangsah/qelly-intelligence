import assert from 'node:assert/strict';
import {inflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';

const signature=Buffer.from([137,80,78,71,13,10,26,10]);
const table=Uint32Array.from({length:256},(_,n)=>{for(let bit=0;bit<8;bit++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
const crc32=bytes=>{let value=0xffffffff;for(const byte of bytes)value=table[(value^byte)&255]^(value>>>8);return(value^0xffffffff)>>>0;};
const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};

// Decode the noninterlaced 8-bit RGB/RGBA PNG format produced by Chromium.
// All chunks are CRC-checked; zlib validates the compressed stream and Adler checksum.
// Every scanline is fully unfiltered, rather than trusting its signature or IHDR.
export function validateClosedDetailsPng(bytes,expected){
 assert.ok(Buffer.isBuffer(bytes));assert.ok(bytes.length>=57);assert.ok(bytes.subarray(0,8).equals(signature));
 let offset=8,header=null,ended=false,idatStarted=false,idatEnded=false;const compressed=[];
 while(offset<bytes.length){
  assert.ok(offset+12<=bytes.length,'Truncated PNG chunk header');const length=bytes.readUInt32BE(offset);assert.ok(length<=bytes.length-offset-12,'Truncated PNG chunk');
  const type=bytes.toString('ascii',offset+4,offset+8),data=bytes.subarray(offset+8,offset+8+length);assert.match(type,/^[A-Za-z]{4}$/);assert.equal(crc32(bytes.subarray(offset+4,offset+8+length)),bytes.readUInt32BE(offset+8+length),'PNG chunk CRC '+type);
  if(!header){
   assert.equal(type,'IHDR');assert.equal(length,13);const width=data.readUInt32BE(0),height=data.readUInt32BE(4),depth=data[8],colorType=data[9];
   assert.equal(width,expected.width);assert.equal(height,expected.height);assert.ok(width>0&&height>0&&width*height<=100000000);assert.equal(depth,8);assert.ok(colorType===2||colorType===6,'Unsupported Chromium PNG color type');assert.equal(data[10],0);assert.equal(data[11],0);assert.equal(data[12],0,'Interlaced PNG is outside the screenshot contract');header={width,height,colorType,channels:colorType===2?3:4};
  }else if(type==='IHDR')assert.fail('Repeated PNG header');
  else if(type==='IDAT'){assert.equal(idatEnded,false,'Noncontiguous PNG image data');idatStarted=true;compressed.push(data);}
  else if(type==='IEND'){assert.equal(length,0);assert.equal(idatStarted,true);ended=true;offset+=12;assert.equal(offset,bytes.length,'Trailing PNG bytes');break;}
  else{
   if(idatStarted)idatEnded=true;assert.ok(type[0]===type[0].toLowerCase(),'Unsupported critical PNG chunk '+type);assert.ok(!['acTL','fcTL','fdAT'].includes(type),'Animated PNG is outside the screenshot contract');
  }
  offset+=length+12;
 }
 assert.ok(header&&ended&&compressed.length>0,'Incomplete PNG');const stride=header.width*header.channels,expectedBytes=(stride+1)*header.height;
 const input=Buffer.concat(compressed),inflated=inflateSync(input,{maxOutputLength:expectedBytes+1,info:true});assert.equal(inflated.engine.bytesWritten,input.length,'Trailing compressed PNG bytes');const decoded=inflated.buffer;assert.equal(decoded.length,expectedBytes,'Wrong PNG scanline byte count');
 let previous=Buffer.alloc(stride),row=Buffer.alloc(stride),cursor=0;const pixels=createHash('sha256');
 for(let y=0;y<header.height;y++){
  const filter=decoded[cursor++];assert.ok(filter<=4,'Invalid PNG scanline filter');
  for(let x=0;x<stride;x++){const raw=decoded[cursor++],left=x>=header.channels?row[x-header.channels]:0,up=previous[x],upperLeft=x>=header.channels?previous[x-header.channels]:0;row[x]=(raw+(filter===0?0:filter===1?left:filter===2?up:filter===3?Math.floor((left+up)/2):paeth(left,up,upperLeft)))&255;}
  pixels.update(row);[row,previous]=[previous,row];
 }
 assert.equal(cursor,decoded.length);return{width:header.width,height:header.height,colorType:header.colorType,channels:header.channels,chunksCrcVerified:true,pixelsDecoded:true,pixelSha256:pixels.digest('hex')};
}
