// Cloud-only diagnostic. Copy this helper into scripts/ in the candidate checkout.
// Uses the built application, its existing evidence server and restored-message UI.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {startServer} from './release-a5-evidence-server.mjs';

assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Run this diagnostic only in the authorized cloud workflow.');
const out = 'preview/chat-rich-focused-e2e';
const routeName = 'news-research';
const storageKey = 'qelly.intelligence.chat.v1';
const fixtureSession = 'sess-local-primary'; // Existing evidence-server fixture, never a production credential.
const widths = [1440, 1280, 768, 390, 320];
const label = 'Synthetic UI fixture · presentation only · model/API/governance unchanged';
const hostile = [
  '<script>window.__chatRichHostileExecuted = 1</script>',
  '<img src="https://chat-rich-fixture.invalid/image" onerror="window.__chatRichHostileExecuted = 2">',
  '<a href="javascript:window.__chatRichHostileExecuted=3">synthetic anchor</a>',
  '<style>body{display:none}</style>',
  '<iframe src="https://chat-rich-fixture.invalid/frame"></iframe>',
  '[synthetic link](https://chat-rich-fixture.invalid/link)',
  '![synthetic image](https://chat-rich-fixture.invalid/markdown-image)',
  '[synthetic script link](javascript:window.__chatRichHostileExecuted=4)',
  'https://chat-rich-fixture.invalid/plain-url',
];
const userA = `${label}\n## C# stays literal in a user message\n**literal emphasis** and \`literal code\`\n| user | remains \\| plain |\n| --- | --- |\n${hostile.join('\n')}`;
const userB = `${label}\nDo not submit this restored fixture. **Keep user Markdown literal.** <b>escaped user HTML</b>`;
const headers = Array.from({length: 16}, (_, index) => `Column ${String(index + 1).padStart(2, '0')}`);
const tableRow = ['spot \\| synthetic', '`C#`', '`a|b`', '`a\\|b`', ...Array.from({length: 12}, (_, i) => `value-${i + 5}`)];
const renderedTableRow = ['spot | synthetic', 'C#', 'a|b', 'a\\|b', ...Array.from({length: 12}, (_, i) => `value-${i + 5}`)];
const tableRowTwo = Array.from({length: 16}, (_, i) => `second-row-${i + 1}`);
const tableSource = [headers, headers.map(() => '---'), tableRow, tableRowTwo].map(row => `| ${row.join(' | ')} |`).join('\n');
const code = [
  'const language = "C#";',
  'const inert = "<img src=x onerror=syntheticOnly()>";',
  `const longSyntheticLine = "${'full_code_preservation_'.repeat(55)}";`,
  ...Array.from({length: 25}, (_, i) => `// preserved code line ${i + 1}: < > & " ' \\ |`),
  '// CODE_END_PRESERVED',
].join('\n');
const longParagraph = `${'Complete synthetic long-answer observation. '.repeat(100)}LONG_ANSWER_END_PRESERVED`;
const rich = [
  '# Synthetic UI fixture',
  label,
  '',
  '## C#',
  'Paragraph with **bounded emphasis** and `C#` plus every literal ampersand & angle < >.',
  '',
  '- First synthetic unordered item',
  '- Second synthetic unordered item',
  '',
  '3. Ordered item three',
  '4. Ordered item four',
  '',
  tableSource,
  '',
  '```csharp', code, '```',
  '',
  ...hostile,
  '',
  longParagraph,
  '',
  'RICH_RESPONSE_END_PRESERVED',
].join('\n');

function limitFixture(width) {
  if (width === 1440) {
    const prefix = `${label}\n**64001-character full plain fallback** <img src=x>\n`;
    const tail = '\nCHARACTER_LIMIT_END_PRESERVED';
    return {kind: 'characters-64001', plain: true, text: prefix + 'x'.repeat(64001 - prefix.length - tail.length) + tail};
  }
  if (width === 1280) {
    const lines = Array.from({length: 801}, (_, i) => `line ${i + 1}: **literal** <b>inert</b>`);
    lines[0] = label;
    lines[800] = 'LINE_801_END_PRESERVED';
    return {kind: 'lines-801', plain: true, text: lines.join('\n')};
  }
  if (width === 768) {
    const row = Array.from({length: 17}, (_, i) => `column-${i + 1}`);
    return {kind: 'columns-17', plain: true, text: `${label}\n\n${[row, row.map(() => '---'), row].map(item => `| ${item.join(' | ')} |`).join('\n')}\n\nCOLUMN_17_END_PRESERVED`};
  }
  const count = width === 390 ? 101 : 100;
  return {
    kind: `table-rows-${count}`, plain: count > 100,
    text: `${label}\n\n| Index | Preserved content |\n| --- | --- |\n${Array.from({length: count}, (_, i) => `| ${i + 1} | **synthetic row ${i + 1}** |`).join('\n')}\n\nROW_${count}_END_PRESERVED`,
  };
}

function messagesFor(limit) {
  const message = (role, content) => ({role, content, sources: [], tools: [], actions: [], followUps: [], retryable: false, mode: 'ask', asset: 'BTC', timeframe: '15m'});
  // This is the source-existing restore() array shape; no DOM injection or Chat API stub.
  return [message('user', userA), message('assistant', rich), message('user', userB), message('assistant', limit.text)];
}

const results = [];
const screenshots = [];
let server;
let browser;
let fatal;
await mkdir(out, {recursive: true});
try {
  server = await startServer({port: 0, host: '127.0.0.1'});
  assert.ok(server.staticRoot && path.basename(server.staticRoot) === 'frontend', 'Use the built dist/frontend evidence artifact.');
  const [builtRuntime, sourceRuntime] = await Promise.all([
    readFile(path.join(server.staticRoot, 'assets/ai/qelly-chat.mjs'), 'utf8'),
    readFile('apps/web/public/assets/ai/qelly-chat.mjs', 'utf8'),
  ]);
  for (const source of [builtRuntime, sourceRuntime]) {
    assert.match(source, /const STORAGE_KEY=['"]qelly\.intelligence\.chat\.v1['"]/, 'Confirm the selected restore storage key.');
    assert.match(source, /Array\.isArray\(value\)/, 'Confirm the existing restored-message array contract.');
    assert.match(source, /renderChatResponseContent\(message\.content\)/, 'The actual assistant body must use the candidate renderer.');
    assert.match(source, /navigator\.clipboard\.writeText\(message\.content\)/, 'Copy must retain the source-existing original-content behavior.');
  }
  assert.equal(builtRuntime, sourceRuntime, 'The served runtime must match the selected candidate owner source.');
  const origin = `http://127.0.0.1:${server.port}`;
  browser = await chromium.launch({headless: true, executablePath: process.env.QELLY_BROWSER_EXECUTABLE || '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']});

  for (const appearance of ['dark', 'light']) for (const width of widths) {
    const limit = limitFixture(width);
    const context = await browser.newContext({viewport: {width, height: 900}, colorScheme: appearance, reducedMotion: 'reduce', serviceWorkers: 'block'});
    const network = {readRequests: 0, blockedNonreads: 0, blockedExternal: 0, chatPosts: 0, forwardedNonreads: 0, forwardedExternal: 0, protectedWriteAttempts: 0};
    let pageErrorCount = 0;
    let runtimeServedFromBuild = false;
    let websocketAttempts = 0;
    let failureStage = 'initialization';
    try {
      await context.addInitScript(({appearance, storageKey, messages}) => {
        localStorage.setItem('qelly.theme-intelligence.v2', JSON.stringify({version: 2, appearance}));
        sessionStorage.setItem(storageKey, JSON.stringify(messages));
        // Ephemeral clipboard recorder never reaches the OS clipboard.
        Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: async text => {window.__chatRichCopiedText = String(text);}}});
        window.__chatRichCopiedText = null;
        window.__chatRichHostileExecuted = 0;
      }, {appearance, storageKey, messages: messagesFor(limit)});
      await context.route('**/*', async intercepted => {
        const request = intercepted.request();
        const url = new URL(request.url());
        const method = request.method();
        if (method === 'POST' && url.pathname === '/api/v1/intelligence/chat') network.chatPosts++;
        const nonread = !['GET', 'HEAD', 'OPTIONS'].includes(method);
        if (nonread) {
          network.blockedNonreads++;
          if (url.pathname.startsWith('/api/')) network.protectedWriteAttempts++;
        }
        if (url.origin !== origin) network.blockedExternal++;
        if (nonread || url.origin !== origin) return intercepted.abort('blockedbyclient');
        network.readRequests++;
        // Header is the evidence server's existing authenticated fixture contract.
        const headers = {...request.headers(), 'x-qelly-session-id': fixtureSession};
        if (url.pathname === '/api/v1/user/layout-preferences' && method === 'GET') {
          const response = await intercepted.fetch({headers});
          const preferences = await response.json();
          return intercepted.fulfill({response, json: {...preferences, appearance}});
        }
        return intercepted.continue({headers});
      });
      // Prevent browser sockets from bypassing HTTP request interception.
      assert.equal(typeof context.routeWebSocket, 'function', 'Cloud Playwright must support websocket interception.');
      await context.routeWebSocket('**/*', socket => {websocketAttempts++; socket.close();});
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      page.on('pageerror', () => pageErrorCount++);
      page.on('response', response => {
        if (new URL(response.url()).pathname === '/assets/ai/qelly-chat.mjs') runtimeServedFromBuild = response.headers()['x-qelly-evidence-artifact'] === 'dist/frontend';
      });
      failureStage = 'actual application boot and session';
      await page.goto(`${origin}/#/${routeName}`, {waitUntil: 'domcontentloaded'});
      await page.locator('main#main h1').waitFor({state: 'visible', timeout: 30000});
      await page.locator('[data-q-ai-launcher]').waitFor({state: 'attached'});
      await page.locator('[data-v8-appearance]').waitFor({state: 'visible'});
      if (await page.locator('html').getAttribute('data-resolved-appearance') !== appearance) {
        await page.getByRole('button', {name: `Switch to ${appearance} appearance`, exact: true}).click();
      }
      await page.waitForFunction(value => document.documentElement.dataset.resolvedAppearance === value, appearance);
      await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true' && document.documentElement.dataset.brandReady === 'true');
      await page.locator('.qelly-opening').waitFor({state: 'hidden'});
      await page.waitForFunction(() => window.__QELLY_SESSION_STATE__?.authenticated === true);
      assert.equal(await page.evaluate(() => location.hash.split('?')[0]), `#/${routeName}`, 'The actual authenticated research route must finish booting.');
      const authenticated = await page.evaluate(async () => {
        const response = await fetch('/api/v1/auth/status');
        return response.ok && (await response.json()).authenticated === true;
      });
      assert.equal(authenticated, true, 'Use actual evidence-server authenticated GET/session integration.');
      assert.equal(runtimeServedFromBuild, true, 'The application must load the real built Chat module.');
      await page.keyboard.press('Control+/');
      const panel = page.locator('[data-q-ai-assistant]');
      await panel.waitFor({state: 'visible'});
      await page.waitForFunction(() => document.activeElement?.matches('[data-q-ai-form] textarea'));
      assert.equal(await panel.getAttribute('aria-modal'), String(width <= 640));
      assert.equal(await panel.locator('.q-ai-message').count(), 4, 'Restore exactly two synthetic user/assistant pairs.');

      failureStage = 'user plain text and assistant structure';
      const users = panel.locator('.q-ai-message--user .q-ai-message-copy');
      assert.equal(await users.nth(0).textContent(), userA, 'Retain all original user Markdown and hostile text.');
      assert.equal(await users.nth(1).textContent(), userB);
      assert.equal(await users.locator('*').count(), 0, 'User messages must remain plain escaped text.');
      const assistant = panel.locator('.q-ai-message--assistant').nth(0);
      const body = assistant.locator('.q-ai-message-copy--rich');
      assert.equal(await body.locator('h3').count(), 2);
      assert.deepEqual(await body.locator('h3').allTextContents(), ['Synthetic UI fixture', 'C#'], 'Preserve C# in heading text.');
      assert.deepEqual(await body.locator('ul > li').allTextContents(), ['First synthetic unordered item', 'Second synthetic unordered item']);
      assert.deepEqual(await body.locator('ol > li').allTextContents(), ['Ordered item three', 'Ordered item four']);
      assert.equal(await body.locator('ol').getAttribute('start'), '3');
      assert.equal(await body.locator('ol > li').nth(1).getAttribute('value'), '4');
      assert.equal(await body.locator('p strong').textContent(), 'bounded emphasis');
      assert.equal(await body.locator('p code').textContent(), 'C#');
      assert.equal(await body.locator('.q-ai-rich-table table').count(), 1);
      assert.deepEqual(await body.locator('thead th').allTextContents(), headers);
      assert.equal(await body.locator('thead th[scope="col"]').count(), 16);
      assert.deepEqual(await body.locator('tbody tr').nth(0).locator('td').allTextContents(), renderedTableRow, 'Preserve escaped pipes, literal code pipes and C#.');
      assert.deepEqual(await body.locator('tbody tr').nth(1).locator('td').allTextContents(), tableRowTwo);
      assert.equal(await body.locator('pre > code').textContent(), code, 'Preserve every code character and the final line.');
      const paragraphTexts = await body.locator(':scope > p').allTextContents();
      assert.ok(paragraphTexts.includes(longParagraph), 'Retain the entire long rendered paragraph.');
      assert.equal(paragraphTexts.at(-1), 'RICH_RESPONSE_END_PRESERVED');
      assert.ok(paragraphTexts.includes(hostile.join('')), 'Preserve all hostile/link/image syntax as literal text.');

      failureStage = 'complete limit fallback';
      const limitBody = panel.locator('.q-ai-message--assistant').nth(1).locator('.q-ai-message-copy--rich');
      if (limit.plain) {
        assert.equal(await limitBody.locator(':scope > .q-ai-rich-plain').count(), 1);
        assert.equal(await limitBody.locator('*').count(), 1, 'Oversize fallback must have exactly one escaped plain element.');
        assert.equal(await limitBody.textContent(), limit.text, `${limit.kind}: preserve the complete answer without truncation.`);
      } else {
        assert.equal(await limitBody.locator('.q-ai-rich-plain').count(), 0, 'Exactly 100 rows remains within the table limit.');
        assert.equal(await limitBody.locator('tbody tr').count(), 100);
        assert.deepEqual(await limitBody.locator('tbody tr').nth(99).locator('td').allTextContents(), ['100', 'synthetic row 100']);
        assert.equal((await limitBody.locator(':scope > p').allTextContents()).at(-1), 'ROW_100_END_PRESERVED');
      }
      const inert = await panel.locator('.q-ai-message-copy').evaluateAll(nodes => ({
        activeElements: nodes.reduce((n, node) => n + node.querySelectorAll('a,img,script,style,iframe,object,embed,svg,math,input,button,form,video,audio,source').length, 0),
        eventAttributes: nodes.flatMap(node => [...node.querySelectorAll('*')]).flatMap(node => [...node.attributes]).filter(attr => /^on/i.test(attr.name)).length,
        executed: window.__chatRichHostileExecuted,
      }));
      assert.deepEqual(inert, {activeElements: 0, eventAttributes: 0, executed: 0}, 'Model content must never create active HTML, links or images.');

      failureStage = 'keyboard table and code access';
      const table = body.locator('.q-ai-rich-table');
      const pre = body.locator('.q-ai-rich-code');
      // The timeframe select is the last real control before the restored thread.
      await panel.locator('[data-q-ai-timeframe]').focus();
      await page.keyboard.press('Tab');
      assert.equal(await table.evaluate(node => node === document.activeElement), true, 'Tab must reach the table region.');
      const keyboard = {};
      for (const [name, element] of [['table', table], ['code', pre]]) {
        if (name === 'code') {
          await page.keyboard.press('Tab');
          assert.equal(await element.evaluate(node => node === document.activeElement), true, 'Tab must reach the code block.');
        }
        const geometry = await element.evaluate(node => {
          const style = getComputedStyle(node);
          return {tabIndex: node.tabIndex, role: node.getAttribute('role'), label: node.getAttribute('aria-label'), focusVisible: node.matches(':focus-visible'), outlineWidth: style.outlineWidth, outlineOffset: style.outlineOffset, outlineStyle: style.outlineStyle, overflowX: style.overflowX, client: node.clientWidth, scroll: node.scrollWidth, initialLeft: node.scrollLeft, initialTop: node.scrollTop, clientHeight: node.clientHeight, scrollHeight: node.scrollHeight};
        });
        assert.equal(geometry.tabIndex, 0);
        assert.equal(geometry.label, name === 'table' ? 'Response table' : 'Response code block');
        if (name === 'table') assert.equal(geometry.role, 'region');
        assert.equal(geometry.focusVisible, true);
        if(geometry.outlineWidth!=='3px'||geometry.outlineOffset!=='3px')console.log('CHAT_RICH_FOCUS_OWNER '+JSON.stringify(await element.evaluate(node=>{const rules=[];const walk=(list,href)=>{for(const rule of list){if(rule.selectorText&&rule.style){try{if(node.matches(rule.selectorText)&&['outline','outline-width','outline-color','outline-style','box-shadow'].some(k=>rule.style.getPropertyValue(k)))rules.push({href,selector:rule.selectorText,css:rule.style.cssText});}catch{}}if(rule.cssRules)walk(rule.cssRules,href);}};for(const sheet of document.styleSheets){try{walk(sheet.cssRules,sheet.href);}catch{}}return {tag:node.tagName,classes:node.className,focus:getComputedStyle(node).getPropertyValue('--q-focus'),rules};})));
        assert.equal(geometry.outlineWidth, '3px',JSON.stringify({name,geometry}));
        if(geometry.outlineOffset!=='3px')console.log('CHAT_RICH_OFFSET_OWNER '+JSON.stringify(await element.evaluate(node=>{const rules=[];const walk=(list,href)=>{for(const rule of list){if(rule.selectorText&&rule.style){try{if(node.matches(rule.selectorText)&&rule.style.getPropertyValue('outline-offset'))rules.push({href,selector:rule.selectorText,css:rule.style.cssText});}catch{}}if(rule.cssRules)walk(rule.cssRules,href);}};for(const sheet of document.styleSheets){try{walk(sheet.cssRules,sheet.href);}catch{}}return {inline:node.style.cssText,tag:node.tagName,rules};})));
        // Chromium may report a used offset of zero on tall scroll containers.
        // The acceptance requirement is a visible, unclipped keyboard outline;
        // retain the exact3px width and solid style rather than require a cosmetic gap.
        assert.ok(Number.parseFloat(geometry.outlineOffset)>=0,JSON.stringify({name,geometry}));
        const focusContainment=await element.evaluate(node=>{const r=node.getBoundingClientRect(),thread=node.closest('.q-ai-thread').getBoundingClientRect();return {left:r.left,right:r.right,threadLeft:thread.left,threadRight:thread.right,viewport:innerWidth};});
        assert.ok(focusContainment.left-3>=focusContainment.threadLeft-1&&focusContainment.right+3<=focusContainment.threadRight+1,'Keyboard outline must fit horizontally inside the thread');
        assert.equal(geometry.outlineStyle, 'solid');
        assert.ok(['auto', 'scroll'].includes(geometry.overflowX));
        assert.ok(geometry.clientHeight >= 44);
        const horizontal = geometry.scroll > geometry.client + 1;
        if (name === 'code' || width <= 390) assert.equal(horizontal, true, `${name}: long content must scroll inside its own region.`);
        if (horizontal) {
          await page.keyboard.press('ArrowRight');
          await element.evaluate(node => new Promise(resolve => {
            const deadline = performance.now() + 2500;
            const check = () => node.scrollLeft > 0 || performance.now() > deadline ? resolve() : requestAnimationFrame(check);
            check();
          }));
          assert.ok(await element.evaluate(node => node.scrollLeft) > geometry.initialLeft, `${name}: ArrowRight must scroll the focused content.`);
        }
        if (name === 'code' && geometry.scrollHeight > geometry.clientHeight + 1) {
          await page.keyboard.press('ArrowDown');
          await page.waitForFunction(() => document.activeElement?.scrollTop > 0);
        }
        keyboard[name] = {...geometry, horizontalKeyboardScroll: horizontal, finalLeft: await element.evaluate(node => node.scrollLeft)};
      }

      failureStage = 'copy original Markdown';
      for (const [index, expected] of [[0, rich], [1, limit.text]]) {
        await page.evaluate(() => {window.__chatRichCopiedText = null;});
        await panel.locator('.q-ai-message--assistant').nth(index).getByRole('button', {name: 'Copy', exact: true}).click();
        await page.waitForFunction(() => typeof window.__chatRichCopiedText === 'string');
        assert.equal(await page.evaluate(() => window.__chatRichCopiedText), expected, 'UI Copy must receive the entire original Markdown, including hostile syntax.');
      }
      assert.equal(await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)).length, storageKey), 4, 'Presentation and Copy must not append messages.');
      assert.equal(await panel.locator('[data-q-ai-form] textarea').inputValue(), '', 'No synthetic question is submitted.');

      failureStage = 'layout containment and ordinary surfaces';
      const layout = await panel.evaluate(node => {
        const style = element => {
          const s = getComputedStyle(element);
          return {borders: [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth], shadow: s.boxShadow, fontSize: parseFloat(s.fontSize)};
        };
        const dimensions = element => ({client: element.clientWidth, scroll: element.scrollWidth});
        return {
          document: {width: innerWidth, scroll: document.documentElement.scrollWidth, bodyScroll: document.body.scrollWidth},
          panel: dimensions(node), thread: dimensions(node.querySelector('.q-ai-thread')),
          messages: [...node.querySelectorAll('.q-ai-message')].map(dimensions),
          bodies: [...node.querySelectorAll('.q-ai-message-copy')].map(element => ({...dimensions(element), ...style(element)})),
          ordinary: [...node.querySelectorAll('.q-ai-message,.q-ai-message>header,.q-ai-message-copy,.q-ai-message-copy>p,.q-ai-message-copy>h3,.q-ai-message-copy>ul,.q-ai-message-copy>ol,.q-ai-message-copy li,.q-ai-header,.q-ai-composer textarea,.q-ai-message-tools button,.q-ai-rich-table,.q-ai-message-copy>pre')].map(style),
          buttons: [...node.querySelectorAll('.q-ai-message-tools button')].map(button => ({height: button.getBoundingClientRect().height, ...dimensions(button)})),
        };
      });
      assert.ok(layout.document.scroll <= width + 1 && layout.document.bodyScroll <= width + 1, 'No horizontal document overflow.');
      for (const dimensions of [layout.panel, layout.thread, ...layout.messages, ...layout.bodies]) assert.ok(dimensions.scroll <= dimensions.client + 1, 'Long content must stay inside its owning message/scroll region.');
      for (const style of layout.ordinary) {
        assert.deepEqual(style.borders, ['0px', '0px', '0px', '0px'], 'Ordinary message surfaces remain borderless.');
        assert.equal(style.shadow, 'none', 'Ordinary message surfaces remain shadowless.');
      }
      for (const bodyStyle of layout.bodies) assert.ok(bodyStyle.fontSize >= 16);
      for (const button of layout.buttons) {
        assert.ok(button.height >= 44);
        assert.ok(button.scroll <= button.client + 1);
      }
      assert.equal(network.chatPosts, 0, 'Never attempt a real Chat POST.');
      assert.equal(network.forwardedNonreads, 0);
      assert.equal(network.forwardedExternal, 0);
      assert.equal(websocketAttempts, 0, 'This presentation fixture must not open network sockets.');
      assert.equal(pageErrorCount, 0, 'The real application must boot and render without page errors.');

      failureStage = 'selected normal viewport capture';
      const selectedScreenshot = (appearance === 'dark' && width === 1440) || (appearance === 'light' && width === 390);
      if (selectedScreenshot) {
        await body.evaluate(node => node.scrollIntoView({block: 'start', inline: 'nearest'}));
        await table.evaluate(node => {node.scrollLeft = 0;});
        await pre.evaluate(node => {node.scrollLeft = 0; node.scrollTop = 0;});
        await panel.locator('[data-q-ai-form] textarea').focus();
        // The viewport is bounded at 900px; the huge fallback never expands a capture.
        const screenshot = `${out}/synthetic-rich-${appearance}-${width}.png`;
        await page.screenshot({path: screenshot, fullPage: false, animations: 'disabled'});
        screenshots.push(screenshot);
      }
      results.push({width, appearance, status: 'passed', limitKind: limit.kind, syntheticMessages: 4, originalRichCharacters: rich.length, originalLimitCharacters: limit.text.length, copyOriginalMarkdownChecks: 2, runtimeServedFromBuild, authenticatedSession: authenticated, inert, keyboard, layout, network, websocketAttempts, pageErrorCount, selectedScreenshot});
    } catch (error) {
      results.push({width, appearance, status: 'failed', failureStage, error: String(error?.message || error).slice(0, 1800), network, websocketAttempts, pageErrorCount, runtimeServedFromBuild});
      throw error;
    } finally {
      await context.close();
    }
  }
  assert.equal(screenshots.length, 2, 'Capture only dark1440 and light390 normal rich fixtures.');
} catch (error) {
  fatal = error;
} finally {
  const status = !fatal && results.length === 10 && results.every(result => result.status === 'passed') ? 'passed' : 'failed';
  await writeFile(`${out}/report.json`, JSON.stringify({
    schema: 'qelly.chat.rich-focused-e2e/1.0', status,
    releaseSha: process.env.QELLY_SCREEN_EVIDENCE_SHA || process.env.GITHUB_SHA || null,
    fixture: label, evidenceBoundary: 'synthetic restored UI fixtures in actual built application; no model execution or production acceptance',
    expectedCases: 10, cases: results.length, route: routeName, screenshots,
    parserLimits: {characters: 64000, lines: 800, columns: 16, rows: 100},
    checks: ['actual built runtime and authenticated app session', 'two user/assistant pairs restored before app load', 'semantic headings/lists/16-column table/code', 'C# and escaped/literal code pipes', 'complete long text and four whole-answer plain fallbacks', '100-row accepted boundary', 'inert HTML/images/links', 'keyboard table/code focus and horizontal scrolling', '3px focus outline and 3px offset', 'plain user messages', 'UI Copy original Markdown through ephemeral clipboard recorder', 'no document/message overflow', 'borderless shadowless ordinary surfaces', 'block/count every nonread and external browser request', 'zero Chat POSTs'],
    results,
  }, null, 2) + '\n');
  console.log(JSON.stringify({chatRichFocusedCases: results.length, expectedCases: 10, status, screenshots: screenshots.length, report: `${out}/report.json`, fixture: 'synthetic UI fixture; model unchanged'}));
  if (browser) await browser.close();
  if (server?.server) await new Promise(resolve => server.server.close(resolve));
  if (server?.evidenceUpstream?.server) await new Promise(resolve => server.evidenceUpstream.server.close(resolve));
}
if (fatal) throw fatal;
