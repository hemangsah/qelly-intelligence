import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { deflateSync } from 'node:zlib';

const root=process.cwd();
const publicDir=path.join(root,'apps/web/public');
const iconDir=path.join(publicDir,'icons');
const socialDir=path.join(publicDir,'social');
await mkdir(iconDir,{recursive:true});
await mkdir(socialDir,{recursive:true});

const palette={burgundy:[111,24,56,255],deep:[50,10,28,255],porcelain:[248,245,241,255],trajectory:[29,25,28,255],green:[41,166,99,255],red:[211,65,77,255],transparent:[0,0,0,0]};

function image(width,height,background=palette.transparent){
  const png={width,height,data:Buffer.alloc(width*height*4)};
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)setPixel(png,x,y,background);
  return png;
}
function setPixel(png,x,y,color){
  if(x<0||y<0||x>=png.width||y>=png.height)return;
  const i=(y*png.width+x)*4;png.data[i]=color[0];png.data[i+1]=color[1];png.data[i+2]=color[2];png.data[i+3]=color[3];
}
function circle(png,cx,cy,r,color,inner=0){
  const r2=r*r, inner2=inner*inner;
  for(let y=Math.floor(cy-r);y<=Math.ceil(cy+r);y++)for(let x=Math.floor(cx-r);x<=Math.ceil(cx+r);x++){
    const d=(x-cx)*(x-cx)+(y-cy)*(y-cy);if(d<=r2&&d>=inner2)setPixel(png,x,y,color);
  }
}
function line(png,x0,y0,x1,y1,width,color){
  const steps=Math.max(Math.abs(x1-x0),Math.abs(y1-y0),1);
  for(let i=0;i<=steps;i++){const t=i/steps;circle(png,x0+(x1-x0)*t,y0+(y1-y0)*t,width/2,color);}
}
function symbol(png,{cx=png.width/2,cy=png.height/2,scale=Math.min(png.width,png.height),background=false}={}){
  const ringR=scale*.27, stroke=Math.max(2,scale*.075);
  circle(png,cx,cy,ringR,palette.burgundy,Math.max(0,ringR-stroke));
  line(png,cx+ringR*.38,cy+ringR*.42,cx+ringR*.95,cy+ringR*.98,stroke*.78,palette.burgundy);
  line(png,cx-ringR*.92,cy+ringR*.46,cx+ringR*.90,cy-ringR*.58,Math.max(1,stroke*.17),background?palette.porcelain:palette.trajectory);
  circle(png,cx-ringR*.72,cy+ringR*.34,Math.max(2,stroke*.28),palette.green);
  circle(png,cx+ringR*.70,cy-ringR*.47,Math.max(2,stroke*.28),palette.red);
}

const glyphs={
 Q:['01110','10001','10001','10101','10011','01111','00001'],
 E:['11111','10000','10000','11110','10000','10000','11111'],
 L:['10000','10000','10000','10000','10000','10000','11111'],
 Y:['10001','10001','01010','00100','00100','00100','00100'],
 I:['11111','00100','00100','00100','00100','00100','11111'],
 N:['10001','11001','11001','10101','10011','10011','10001'],
 T:['11111','00100','00100','00100','00100','00100','00100'],
 G:['01110','10001','10000','10111','10001','10001','01110'],
 C:['01110','10001','10000','10000','10000','10001','01110']
};
function bitmapText(png,text,x,y,scale,color,spacing=2){
  let cursor=x;
  for(const ch of text){
    if(ch===' '){cursor+=scale*4;continue;}
    const rows=glyphs[ch]??glyphs.I;
    for(let yy=0;yy<rows.length;yy++)for(let xx=0;xx<rows[yy].length;xx++)if(rows[yy][xx]==='1'){
      for(let py=0;py<scale;py++)for(let px=0;px<scale;px++)setPixel(png,cursor+xx*scale+px,y+yy*scale+py,color);
    }
    cursor+=(5+spacing)*scale;
  }
}

const crcTable=(()=>{const table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0;}return table;})();
function crc32(buffer){let c=0xffffffff;for(const byte of buffer)c=crcTable[(c^byte)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function chunk(type,data){const name=Buffer.from(type,'ascii');const out=Buffer.alloc(12+data.length);out.writeUInt32BE(data.length,0);name.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc32(Buffer.concat([name,data])),8+data.length);return out;}
function encodePng(png){const signature=Buffer.from([137,80,78,71,13,10,26,10]);const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(png.width,0);ihdr.writeUInt32BE(png.height,4);ihdr[8]=8;ihdr[9]=6;ihdr[10]=0;ihdr[11]=0;ihdr[12]=0;const rowBytes=png.width*4;const raw=Buffer.alloc((rowBytes+1)*png.height);for(let y=0;y<png.height;y++){raw[y*(rowBytes+1)]=0;png.data.copy(raw,y*(rowBytes+1)+1,y*rowBytes,(y+1)*rowBytes);}return Buffer.concat([signature,chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);}
async function savePng(file,png){await writeFile(file,encodePng(png));}

for(const size of [16,32,48,64,192,512]){
  const png=image(size,size,size<=64?palette.transparent:palette.porcelain);
  symbol(png,{scale:size*.9,background:false});
  await savePng(path.join(iconDir,`qelly-${size}.png`),png);
}
const apple=image(180,180,palette.porcelain);symbol(apple,{scale:154});await savePng(path.join(publicDir,'apple-touch-icon.png'),apple);
const maskable=image(512,512,palette.porcelain);symbol(maskable,{scale:330});await savePng(path.join(iconDir,'qelly-maskable-512.png'),maskable);

const social=image(1200,630,palette.porcelain);
symbol(social,{cx:250,cy:315,scale:430});
bitmapText(social,'QELLY',505,190,18,palette.burgundy,1);
bitmapText(social,'INTELLIGENCE',510,360,7,palette.trajectory,1);
await savePng(path.join(socialDir,'qelly-social-preview.png'),social);

function icoEntry(png){return encodePng(png);}
const icoSizes=[16,32,48,64];
const icoPngs=[];
for(const size of icoSizes){const png=image(size,size,palette.transparent);symbol(png,{scale:size*.9});icoPngs.push({size,bytes:icoEntry(png)});}
const count=icoPngs.length, header=Buffer.alloc(6+count*16);header.writeUInt16LE(0,0);header.writeUInt16LE(1,2);header.writeUInt16LE(count,4);
let offset=header.length;
icoPngs.forEach(({size,bytes},index)=>{const at=6+index*16;header[at]=size===256?0:size;header[at+1]=size===256?0:size;header[at+2]=0;header[at+3]=0;header.writeUInt16LE(1,at+4);header.writeUInt16LE(32,at+6);header.writeUInt32LE(bytes.length,at+8);header.writeUInt32LE(offset,at+12);offset+=bytes.length;});
await writeFile(path.join(publicDir,'favicon.ico'),Buffer.concat([header,...icoPngs.map((item)=>item.bytes)]));
console.log(JSON.stringify({result:'generated',icons:[...icoSizes,180,192,512],social:[1200,630]},null,2));
