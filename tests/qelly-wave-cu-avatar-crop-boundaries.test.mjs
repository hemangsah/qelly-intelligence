import test from 'node:test';
import assert from 'node:assert/strict';
import {avatarSourceDimensions,calculateAvatarCrop} from '../apps/web/public/assets/qelly-profile-avatar.mjs';
import {__profileRouteTest} from '../functions/api/v1/profile.js';

const png=(width,height)=>{const bytes=Buffer.alloc(33);Buffer.from([137,80,78,71,13,10,26,10]).copy(bytes);bytes.write('IHDR',12);bytes.writeUInt32BE(width,16);bytes.writeUInt32BE(height,20);return bytes;};
test('avatar capability requires a strict server-side attestation and defaults unavailable',()=>{
 const context={user:{userId:'test'},workspace:{},session:{}};
 for(const flag of [undefined,false,'true',1])assert.equal(__profileRouteTest.profilePayload(context,undefined,undefined,undefined,flag).capabilities.avatarStorage,'unavailable');
 assert.equal(__profileRouteTest.profilePayload(context,undefined,undefined,undefined,true).capabilities.avatarStorage,'private-rls');
});
test('source headers reject oversized pixels and MIME spoofing before image decode',()=>{
 assert.deepEqual(avatarSourceDimensions(png(640,480),'image/png'),{width:640,height:480});
 for(const bytes of [png(100000,100000),png(8192,8192),png(0,10),Buffer.from('<svg width="9999999"></svg>')])assert.throws(()=>avatarSourceDimensions(bytes,'image/png'),RangeError);
 assert.throws(()=>avatarSourceDimensions(png(64,64),'image/jpeg'),RangeError);
 assert.throws(()=>avatarSourceDimensions(png(64,64),'image/svg+xml'),RangeError);
 assert.throws(()=>avatarSourceDimensions(new Uint8Array(6*1024*1024),'image/png'),RangeError);
});
test('JPEG frame bounds and truncated segment lengths fail closed',()=>{
 const bytes=Buffer.alloc(24);bytes[0]=255;bytes[1]=216;bytes[2]=255;bytes[3]=192;bytes.writeUInt16BE(8,4);bytes[6]=8;bytes.writeUInt16BE(600,7);bytes.writeUInt16BE(800,9);
 assert.deepEqual(avatarSourceDimensions(bytes,'image/jpeg'),{width:800,height:600});
 bytes.writeUInt16BE(65535,4);assert.throws(()=>avatarSourceDimensions(bytes,'image/jpeg'),RangeError);
});
test('WebP bounds reject animation and oversized canvas before decoding',()=>{
 const bytes=Buffer.alloc(30);bytes.write('RIFF');bytes.write('WEBP',8);bytes.write('VP8X',12);bytes[24]=255;bytes[27]=255;
 assert.deepEqual(avatarSourceDimensions(bytes,'image/webp'),{width:256,height:256});
 bytes[20]=2;assert.throws(()=>avatarSourceDimensions(bytes,'image/webp'),RangeError);
 bytes[20]=0;bytes[26]=255;assert.throws(()=>avatarSourceDimensions(bytes,'image/webp'),RangeError);
});
test('crop position stays inside the image at zoom and extreme pan boundaries',()=>{
 const crop=calculateAvatarCrop(640,480,2,9999,-9999);
 assert.ok(crop.x<=0&&crop.y<=0&&crop.x+crop.width>=256&&crop.y+crop.height>=256);
 for(const args of [[640,480,NaN],[640,480,1,NaN],[640,480,1,0,Infinity],[640,480,0.99],[640,480,2.51]])assert.throws(()=>calculateAvatarCrop(...args),RangeError);
});
