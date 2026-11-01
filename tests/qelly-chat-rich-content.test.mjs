import test from 'node:test';
import assert from 'node:assert/strict';
import {renderChatResponseContent as render} from '../apps/web/public/assets/ai/qelly-chat.mjs';

test('plain paragraphs preserve line breaks, amounts and escaped text',()=>{
  assert.equal(render('Realized: -12.50\nEquity: 0\n\n<unknown> & "quoted"'),'<p>Realized: -12.50<br>Equity: 0</p><p>&lt;unknown&gt; &amp; &quot;quoted&quot;</p>');
});
test('heading markers preserve C# and remove only separated closing markers',()=>{
  assert.equal(render('# C#'),'<h3>C#</h3>');assert.equal(render('### Title ###'),'<h3>Title</h3>');assert.equal(render('# C# ###'),'<h3>C#</h3>');
});
test('long heading whitespace uses the bounded linear heading path',()=>{
  const text='# a'+' '.repeat(32000)+'b';assert.equal(render(text),'<h3>a'+' '.repeat(32000)+'b</h3>');
});
test('fenced code stays inert and preserves exact literal content',()=>{
  const code='<script>attack()</script>\n<img src=x onerror=attack()>\nconst x = "a|b";';
  const html=render('```javascript\n'+code+'\n```');
  assert.ok(html.startsWith('<div class="q-ai-rich-code" role="region" tabindex="0" aria-label="Response code block"><pre><code>'));assert.ok(html.includes('&lt;script&gt;attack()&lt;/script&gt;'));assert.ok(html.includes('&lt;img src=x onerror=attack()&gt;'));assert.ok(!html.includes('<script'));assert.ok(!html.includes('<img'));
});
test('unclosed code fence retains every following line as escaped code',()=>{
  assert.equal(render('~~~\n0\n<tail>'),'<div class="q-ai-rich-code" role="region" tabindex="0" aria-label="Response code block"><pre><code>0\n&lt;tail&gt;</code></pre></div>');
});
test('table has explicit column headers and a keyboard scroll region',()=>{
  const html=render('| Measure | Example |\n| --- | ---: |\n| Realized | -12.50 |\n| Equity | 0 |');
  assert.ok(html.startsWith('<div class="q-ai-rich-table" role="region" aria-label="Response table" tabindex="0">'));assert.equal((html.match(/<th scope="col">/g)||[]).length,2);assert.equal((html.match(/<td>/g)||[]).length,4);assert.ok(html.includes('<td>-12.50</td>'));assert.ok(html.includes('<td>0</td>'));
});
test('pipe syntax handles escaped text while keeping code backslashes literal',()=>{
  const html=render('| Expression | Result |\n| --- | --- |\n| `a\\|b` | a\\|b |');
  assert.ok(html.includes('<td><code>a\\|b</code></td><td>a|b</td>'));
});
test('multi-backtick literal code is not split into additional columns',()=>{
  const html=render('| Expression | Result |\n| --- | --- |\n| ``a`|b`` | unchanged |');assert.equal((html.match(/<td>/g)||[]).length,2);assert.ok(html.includes('unchanged'));
});
test('a malformed table row is retained as text rather than silently dropped',()=>{
  const html=render('| One | Two |\n| --- | --- |\n| 0 | -1 |\n| too | many | cells |');assert.ok(html.includes('<td>0</td><td>-1</td>'));assert.ok(html.includes('<p>| too | many | cells |</p>'));
});
test('ordered list markers keep original numbers including gaps',()=>{
  assert.equal(render('7. First\n9. Second'),'<ol start="7"><li value="7">First</li><li value="9">Second</li></ol>');
});
test('unordered lists and limited emphasis do not allow raw HTML',()=>{
  const html=render('- **<img src=x>**\n- `<script>`');assert.ok(html.includes('<strong>&lt;img src=x&gt;</strong>'));assert.ok(html.includes('<code>&lt;script&gt;</code>'));assert.ok(!html.includes('<img'));assert.ok(!html.includes('<script'));
});
test('Markdown links and images remain inert literal text',()=>{
  const html=render('[click](javascript:attack())\n![image](https://example.com/tracker)\n<svg onload=attack()>');
  for(const tag of ['<a ','<img','<svg','<iframe','<style','<script'])assert.ok(!html.includes(tag));assert.ok(html.includes('javascript:attack()'));assert.ok(html.includes('https://example.com/tracker'));
});
test('hostile markup is escaped in headings and table cells',()=>{
  const html=render('# <img src=x>\n\n| <script> | <a href=x> |\n| --- | --- |\n| <iframe> | </td><script> |');
  for(const tag of ['<img','<script','<iframe','<a '])assert.ok(!html.includes(tag));assert.ok(html.includes('&lt;/td&gt;&lt;script&gt;'));
});
test('oversize character fallback preserves all text without parsing or truncation',()=>{
  const text='<head>'+'x'.repeat(64001)+'<tail>';const html=render(text);assert.ok(html.startsWith('<p class="q-ai-rich-plain">'));assert.ok(html.endsWith('&lt;tail&gt;</p>'));assert.equal((html.match(/x/g)||[]).length,64001);assert.ok(!html.includes('<head>'));
});
test('oversize line fallback preserves all 801 lines',()=>{
  const text=Array.from({length:801},(_,i)=>String(i)).join('\n');assert.equal(render(text),'<p class="q-ai-rich-plain">'+text+'</p>');
});
test('oversize table fallback preserves all 101 rows and separators',()=>{
  const text='| A | B |\n| --- | --- |\n'+Array.from({length:101},(_,i)=>'| '+i+' | '+(-i)+' |').join('\n');assert.equal(render(text),'<p class="q-ai-rich-plain">'+text+'</p>');
});
test('tables wider than sixteen columns use complete plain text fallback',()=>{
  const line='| '+Array.from({length:17},(_,i)=>String(i)).join(' | ')+' |',separator='| '+Array(17).fill('---').join(' | ')+' |';assert.equal(render(line+'\n'+separator),'<p class="q-ai-rich-plain">'+line+'\n'+separator+'</p>');
});
test('a table with sixteen columns remains supported',()=>{
  const line='| '+Array.from({length:16},(_,i)=>String(i)).join(' | ')+' |',separator='| '+Array(16).fill('---').join(' | ')+' |';assert.equal((render(line+'\n'+separator).match(/<th scope="col">/g)||[]).length,16);
});
test('CRLF is normalized without changing values',()=>{
  assert.equal(render('0\r\n-12.50\r\n\r\nEnd'),'<p>0<br>-12.50</p><p>End</p>');
});
test('empty answers do not invent response content',()=>{
  assert.equal(render(''),'');assert.equal(render(null),'');assert.equal(render('\n \n'),'');
});
