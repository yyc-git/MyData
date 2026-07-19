/**
 * 批量发布 P4-P31 到知乎专栏
 * CDP WebSocket 控制已登录 Chrome -> 逐篇粘贴发布
 */
const WS = require('ws');
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const CDP_WS = 'ws://127.0.0.1:9222/devtools/browser';
const BLOG_DIR = 'D:/Github/MyData/blog';
const TARGET_URL = 'https://zhuanlan.zhihu.com/write';
const DELAY_MS = 8000;

let gId = 1;
function nextId() { return gId++; }

function cdp(ws, id, method, params, sid) {
  const msg = { id, method, params };
  if (sid) msg.sessionId = sid;
  ws.send(JSON.stringify(msg));
}

function waitResp(ws, tid, timeout) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => { ws.removeListener('message', handler); resolve(null); }, timeout || 20000);
    const handler = (d) => {
      try {
        const m = JSON.parse(d.toString());
        if (m.id === tid) { clearTimeout(timer); ws.removeListener('message', handler); resolve(m); }
      } catch(e) {}
    };
    ws.on('message', handler);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function execInPage(ws, sessId, expr, timeout) {
  const id = nextId();
  cdp(ws, id, 'Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sessId);
  const r = await waitResp(ws, id, timeout || 15000);
  return r && r.result && r.result.result && r.result.result.value;
}

async function createAndAttach(ws) {
  const id1 = nextId();
  cdp(ws, id1, 'Target.createTarget', { url: TARGET_URL });
  const createResp = await waitResp(ws, id1, 15000);
  if (!createResp || !createResp.result) throw new Error('createTarget failed');
  const targetId = createResp.result.targetId;

  // Bring target to front for focus
  var idAct = nextId();
  cdp(ws, idAct, 'Target.activateTarget', { targetId });
  await waitResp(ws, idAct, 5000);

  const id2 = nextId();
  cdp(ws, id2, 'Target.attachToTarget', { targetId, flatten: true });
  const attachResp = await waitResp(ws, id2, 10000);
  if (!attachResp || !attachResp.result) throw new Error('attach failed');
  var sessId = attachResp.result.sessionId;

  // Focus page
  var idF = nextId();
  cdp(ws, idF, 'Page.bringToFront', {}, sessId);
  await waitResp(ws, idF, 5000);

  return { targetId, sessId };
}

async function detach(ws, targetId) {
  const id = nextId();
  cdp(ws, id, 'Target.detachFromTarget', { targetId });
  await waitResp(ws, id, 3000);
}

async function findBtnAndClick(ws, sessId, btnText) {
  const pos = await execInPage(ws, sessId, `
    (() => {
      var btns = document.querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) {
        var t = btns[i].textContent.trim();
        if (t === '` + btnText + `') {
          var r = btns[i].getBoundingClientRect();
          return { x: r.x + r.width/2, y: r.y + r.height/2 };
        }
      }
      return null;
    })()
  `, 5000);
  if (!pos) return false;
  var id1 = nextId();
  cdp(ws, id1, 'Input.dispatchMouseEvent', { type: 'mousePressed', x: pos.x, y: pos.y, button: 'left', clickCount: 1 }, sessId);
  await waitResp(ws, id1, 5000);
  var id2 = nextId();
  cdp(ws, id2, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x: pos.x, y: pos.y, button: 'left', clickCount: 1 }, sessId);
  await waitResp(ws, id2, 5000);
  return true;
}

async function sendKey(ws, sessId, keyCode, mods) {
  mods = mods || 0;
  var id1 = nextId();
  cdp(ws, id1, 'Input.dispatchKeyEvent', { type: 'rawKeyDown', windowsVirtualKeyCode: keyCode, modifiers: mods }, sessId);
  await waitResp(ws, id1, 3000);
  var id2 = nextId();
  cdp(ws, id2, 'Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: keyCode, modifiers: mods }, sessId);
  await waitResp(ws, id2, 3000);
}

async function mouseClick(ws, sessId, x, y) {
  var id1 = nextId();
  cdp(ws, id1, 'Input.dispatchMouseEvent', { type: 'mousePressed', x: x, y: y, button: 'left', clickCount: 1 }, sessId);
  await waitResp(ws, id1, 3000);
  var id2 = nextId();
  cdp(ws, id2, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x: x, y: y, button: 'left', clickCount: 1 }, sessId);
  await waitResp(ws, id2, 3000);
}

async function publishOne(ws, idx, total, filePath) {
  var md = fs.readFileSync(filePath, 'utf-8');
  md = md.replace(/^\uFEFF/, '');
  var titleMatch = md.match(/^#\s+(.+)/m);
  var rawTitle = titleMatch ? titleMatch[1].trim() : path.basename(filePath, '.md');
  var title = '\u7CFB\u5217\uFF1A' + rawTitle;  // 系列：

  var body = md.replace(/^---[\s\S]*?---\n/m, '').trim();
  body = body.replace(/### \uD83D\uDCDA \u7CFB\u5217\u7D22\u5F15[\s\S]*?(?=\n---|\n##|$)/, '').trim();
  var html = marked.parse(body);

  console.log('\n[' + idx + '/' + total + '] ' + rawTitle);

  var result = await createAndAttach(ws);
  var targetId = result.targetId;
  var sessId = result.sessId;

  // Wait for page load
  await sleep(8000);

  // 1) Set title
  var titleOk = await execInPage(ws, sessId, `
    (() => {
      var ta = document.querySelector('textarea[placeholder*="` + '\u6807\u9898' + `"]');
      if (!ta) return false;
      var setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      setter.call(ta, ` + JSON.stringify(title) + `);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()
  `, 5000);

  if (!titleOk) {
    console.log('  \u274C title failed');
    await detach(ws, targetId);
    return false;
  }
  console.log('  \u2705 title');

  // 2) Click editor
  await sleep(2000);
  var editorCenter = await execInPage(ws, sessId, `
    (() => {
      var sels = ['[data-lexical-editor]','[contenteditable="true"]','.DraftEditor-editorContainer','[role="textbox"]','.public-DraftEditor-content'];
      for (var i = 0; i < sels.length; i++) {
        var el = document.querySelector(sels[i]);
        if (el) { var r = el.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + 200 }; }
      }
      return { x: window.innerWidth/2, y: 350 };
    })()
  `, 5000);

  if (editorCenter) {
    await mouseClick(ws, sessId, editorCenter.x, editorCenter.y);
    await sleep(500);
    await sendKey(ws, sessId, 0x41, 2); // Ctrl+A
    await sleep(500);
  }

  // 3) Clipboard + paste
  var pasted = false;
  for (var r = 0; r < 3 && !pasted; r++) {
    var clipOk = await execInPage(ws, sessId, `
      (async () => {
        try {
          var blob = new Blob([` + JSON.stringify(html) + `], { type: 'text/html' });
          await navigator.clipboard.write([new ClipboardItem({ 'text/html': blob })]);
          return true;
        } catch(e) { return e.message; }
      })()
    `, 10000);

    if (clipOk === true) {
      await sleep(1000);
      await sendKey(ws, sessId, 0x56, 2); // Ctrl+V
      await sleep(4000);
      pasted = true;
    } else {
      console.log('  clip retry: ' + (clipOk || 'unknown'));
      await sleep(3000);
    }
  }
  if (!pasted) {
    console.log('  \u274C paste failed');
    await detach(ws, targetId);
    return false;
  }
  console.log('  \u2705 pasted');

  // 4) Publish
  await sleep(3000);
  var btnText = null;
  for (var r = 0; r < 5; r++) {
    btnText = await execInPage(ws, sessId, `
      (() => {
        var btns = document.querySelectorAll('button');
        for (var i = 0; i < btns.length; i++) {
          var t = btns[i].textContent.trim();
          if (t === '` + '\u53D1\u5E03' + `' || t === '` + '\u66F4\u65B0' + `') return t;
        }
        return null;
      })()
    `, 5000);
    if (btnText) break;
    console.log('  waiting for publish btn...');
    await sleep(3000);
  }
  if (!btnText) {
    console.log('  \u274C no publish btn');
    await detach(ws, targetId);
    return false;
  }
  console.log('  clicking "' + btnText + '"');
  await findBtnAndClick(ws, sessId, btnText);
  await sleep(12000);

  var url = await execInPage(ws, sessId, 'window.location.href', 5000);
  console.log('  url: ' + (url ? url.substring(0, 80) : '?'));
  if (url && url.indexOf('/edit') >= 0) {
    console.log('  edit mode, click again');
    await sleep(2000);
    await findBtnAndClick(ws, sessId, btnText);
    await sleep(12000);
  }

  console.log('  DONE ' + new Date().toLocaleTimeString('zh-CN', {hour12:false}));
  await detach(ws, targetId);
  return true;
}

// Chinese numeral mapping
var chn = ['零','一','二','三','四','五','六','七','八','九'];
function toChn(n) {
  if (n === 0) return '零';
  if (n === 10) return '十';
  if (n < 10) return chn[n];
  if (n < 20) return '十' + (n > 10 ? chn[n-10] : '');
  if (n === 20) return '二十';
  if (n < 30) return '二十' + (n > 20 ? chn[n-20] : '');
  if (n === 30) return '三十';
  if (n < 40) return '三十' + (n > 30 ? chn[n-30] : '');
  return '' + n;
}

async function main() {
  var allFiles = fs.readdirSync(BLOG_DIR).filter(function(f) {
    return f.indexOf('.md') > 0 && f.indexOf('\u591A\u4EBA\u6E38\u620F') > 0;
  });

  var files = [];
  for (var i = 4; i <= 31; i++) {
    var prefix = 'Vibe Coding \u591A\u4EBA\u6E38\u620F\uFF08' + toChn(i) + '\uFF09';
    var match = null;
    for (var j = 0; j < allFiles.length; j++) {
      if (allFiles[j].indexOf(prefix) === 0) { match = allFiles[j]; break; }
    }
    if (match) files.push(match);
    else console.log('WARN: missing P' + i);
  }

  console.log('Found ' + files.length + ' articles\n');

  var ws = new WS(CDP_WS);
  await new Promise(function(res, rej) {
    ws.on('open', res);
    ws.on('error', rej);
    setTimeout(function() { rej(new Error('WS timeout')); }, 15000);
  });
  console.log('WebSocket connected\n');

  var success = 0;
  for (var i = 0; i < files.length; i++) {
    var fp = path.join(BLOG_DIR, files[i]);
    var ok = await publishOne(ws, i + 1, files.length, fp);
    if (ok) success++;
    if (i < files.length - 1) {
      console.log('\nWaiting ' + (DELAY_MS/1000) + 's...');
      await sleep(DELAY_MS);
    }
  }
  console.log('\nDone: ' + success + '/' + files.length);
  ws.close();
}

main().catch(function(e) { console.error('Error:', e); process.exit(1); });
