/**
 * 发布 P11-P31 到知乎专栏
 * CDP WebSocket 控制 Chrome -> 粘贴 HTML 到 Draft.js 编辑器
 * 修复：Target.activateTarget + Page.bringToFront + window.focus 确保 clipboard focus
 */
const WS = require('ws');
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const CDP_WS = 'ws://127.0.0.1:9222/devtools/browser';
const BLOG_DIR = 'D:/Github/MyData/blog';
const TARGET_URL = 'https://zhuanlan.zhihu.com/write';

var gId = 100;
function nid() { return gId++; }

function cdp(ws, id, method, params, sid) {
  const msg = { id, method, params };
  if (sid) msg.sessionId = sid;
  ws.send(JSON.stringify(msg));
}

function waitResp(ws, tid, timeout) {
  return new Promise(function(resolve) {
    var timer = setTimeout(function() { ws.removeListener('message', handler); resolve(null); }, timeout || 20000);
    function handler(d) {
      try {
        var m = JSON.parse(d.toString());
        if (m.id === tid) { clearTimeout(timer); ws.removeListener('message', handler); resolve(m); }
      } catch(e) {}
    }
    ws.on('message', handler);
  });
}

function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

async function execInPage(ws, sessId, expr, timeout) {
  var id = nid();
  cdp(ws, id, 'Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sessId);
  var r = await waitResp(ws, id, timeout || 15000);
  return r && r.result && r.result.result && r.result.result.value;
}

async function mouseClickAt(ws, sessId, x, y) {
  var id1 = nid();
  cdp(ws, id1, 'Input.dispatchMouseEvent', { type: 'mousePressed', x: x, y: y, button: 'left', clickCount: 1 }, sessId);
  await waitResp(ws, id1, 3000);
  var id2 = nid();
  cdp(ws, id2, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x: x, y: y, button: 'left', clickCount: 1 }, sessId);
  await waitResp(ws, id2, 3000);
}

async function pressKey(ws, sessId, keyCode, mods) {
  mods = mods || 0;
  var id1 = nid();
  cdp(ws, id1, 'Input.dispatchKeyEvent', { type: 'rawKeyDown', windowsVirtualKeyCode: keyCode, modifiers: mods }, sessId);
  await waitResp(ws, id1, 2000);
  var id2 = nid();
  cdp(ws, id2, 'Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: keyCode, modifiers: mods }, sessId);
  await waitResp(ws, id2, 2000);
}

// Chinese numeral
var dig = ['零','一','二','三','四','五','六','七','八','九'];
function cnum(n) {
  if (n === 0) return '零';
  if (n === 10) return '十';
  if (n < 10) return dig[n];
  if (n < 20) return '十' + (n > 10 ? dig[n-10] : '');
  if (n === 20) return '二十';
  if (n < 30) return '二十' + (n > 20 ? dig[n-20] : '');
  if (n === 30) return '三十';
  if (n < 40) return '三十' + (n > 30 ? dig[n-30] : '');
  return '' + n;
}

async function createTargetAndPrep(ws) {
  // 1) Create target
  var id1 = nid();
  cdp(ws, id1, 'Target.createTarget', { url: TARGET_URL });
  var createResp = await waitResp(ws, id1, 15000);
  if (!createResp || !createResp.result) throw new Error('createTarget failed');
  var targetId = createResp.result.targetId;

  // 2) Activate (bring tab to foreground)
  var idAct = nid();
  cdp(ws, idAct, 'Target.activateTarget', { targetId });
  await waitResp(ws, idAct, 5000);

  // 3) Attach
  var id2 = nid();
  cdp(ws, id2, 'Target.attachToTarget', { targetId, flatten: true });
  var attachResp = await waitResp(ws, id2, 10000);
  if (!attachResp || !attachResp.result) throw new Error('attach failed');
  var sessId = attachResp.result.sessionId;

  // 4) Bring to front
  var idF = nid();
  cdp(ws, idF, 'Page.bringToFront', {}, sessId);
  await waitResp(ws, idF, 5000);

  return { targetId, sessId };
}

async function setTitle(ws, sessId, title) {
  return await execInPage(ws, sessId, `
    (() => {
      var ta = document.querySelector('textarea');
      if (!ta) return false;
      var setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      setter.call(ta, ` + JSON.stringify(title) + `);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()
  `, 5000);
}

async function pasteHtml(ws, sessId, targetId, html) {
  // Step A: Click editor to get focus + gesture
  var editorPos = await execInPage(ws, sessId, `
    (() => {
      var sels = ['[contenteditable="true"]','[role="textbox"]','.DraftEditor-editorContainer','[data-lexical-editor]','.public-DraftEditor-content','div[contenteditable]'];
      for (var i = 0; i < sels.length; i++) {
        var el = document.querySelector(sels[i]);
        if (el) { var r = el.getBoundingClientRect(); return { x: Math.round(r.x + r.width/2), y: Math.round(r.y + 100) }; }
      }
      return { x: Math.round(window.innerWidth/2), y: 300 };
    })()
  `, 5000);

  if (editorPos) {
    await mouseClickAt(ws, sessId, editorPos.x, editorPos.y);
    await sleep(1500);
  }

  // Step B: Focus page + editor
  await execInPage(ws, sessId, 'try { window.focus(); } catch(e){}', 3000);
  await sleep(500);

  // Step C: Try clipboard write with retries
  for (var retry = 0; retry < 5; retry++) {
    var r = await execInPage(ws, sessId, `
      (async () => {
        try {
          // Click again for transient activation
          var el = document.querySelector('[contenteditable="true"]') || document.querySelector('[role="textbox"]') ||
                    document.querySelector('.DraftEditor-editorContainer') || document.querySelector('div[contenteditable]');
          if (el) { el.focus(); el.click(); }
          var blob = new Blob([` + JSON.stringify(html) + `], { type: 'text/html' });
          await navigator.clipboard.write([new ClipboardItem({ 'text/html': blob })]);
          return true;
        } catch(e) { return 'ERR: ' + e.message; }
      })()
    `, 10000);

    if (r === true) {
      // Ctrl+V paste
      await sleep(500);
      await pressKey(ws, sessId, 0x56, 2); // Ctrl+V
      await sleep(5000);
      return true;
    }

    console.log('  clip retry ' + (retry + 1) + ': ' + (r || 'unknown'));
    await sleep(3000);
  }

  return false;
}

async function clickPublishBtn(ws, sessId) {
  for (var r = 0; r < 8; r++) {
    var btnText = await execInPage(ws, sessId, `
      (() => {
        var btns = document.querySelectorAll('button');
        for (var i = 0; i < btns.length; i++) {
          var t = btns[i].textContent.trim();
          if (t === '` + '\u53D1\u5E03' + `' || t === '` + '\u66F4\u65B0' + `') return t;
        }
        return null;
      })()
    `, 5000);

    if (!btnText) {
      await sleep(3000);
      continue;
    }

    // Get button position
    var pos = await execInPage(ws, sessId, `
      (() => {
        var btns = document.querySelectorAll('button');
        for (var i = 0; i < btns.length; i++) {
          if (btns[i].textContent.trim() === '` + btnText + `') {
            var r = btns[i].getBoundingClientRect();
            return { x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) };
          }
        }
        return null;
      })()
    `, 5000);

    if (pos) {
      await mouseClickAt(ws, sessId, pos.x, pos.y);
      await sleep(12000);
      return btnText;
    }
  }
  return null;
}

async function publishOne(idx, total, filePath) {
  var md = fs.readFileSync(filePath, 'utf-8');
  md = md.replace(/^\uFEFF/, '');
  var m = md.match(/^#\s+(.+)/m);
  var rawTitle = m ? m[1].trim() : path.basename(filePath, '.md');
  var title = '\u7CFB\u5217\uFF1A' + rawTitle;

  var body = md.replace(/^---[\s\S]*?---\n/m, '').trim();
  body = body.replace(/### \uD83D\uDCDA \u7CFB\u5217\u7D22\u5F15[\s\S]*?(?=\n---|\n##|$)/, '').trim();
  var html = marked.parse(body);

  console.log('\n[' + idx + '/' + total + '] ' + rawTitle);

  var r = await createTargetAndPrep(ws);
  var targetId = r.targetId;
  var sessId = r.sessId;

  await sleep(8000);

  // Title
  if (!await setTitle(ws, sessId, title)) {
    console.log('  FAIL title');
    return;
  }
  console.log('  title OK');

  // Content
  await sleep(2000);
  if (!await pasteHtml(ws, sessId, targetId, html)) {
    console.log('  FAIL paste');
    return;
  }
  console.log('  pasted OK');

  // Publish
  await sleep(3000);
  var btn = await clickPublishBtn(ws, sessId);
  if (!btn) {
    console.log('  FAIL no publish btn');
    return;
  }
  console.log('  clicked "' + btn + '"');

  // Check result
  var url = await execInPage(ws, sessId, 'window.location.href', 5000);
  console.log('  url: ' + (url ? url.substring(0, 90) : '?'));

  if (url && url.indexOf('/edit') >= 0) {
    console.log('  edit mode, click again');
    await sleep(3000);
    var btn2 = await clickPublishBtn(ws, sessId);
    console.log('  clicked "' + (btn2 || '?') + '"');
  }

  console.log('  \u2705 ' + new Date().toLocaleTimeString('zh-CN', {hour12:false}));
}

async function main() {
  var allFiles = fs.readdirSync(BLOG_DIR).filter(function(f) {
    return f.indexOf('.md') > 0 && f.indexOf('\u591A\u4EBA\u6E38\u620F') > 0;
  });

  var files = [];
  for (var i = 11; i <= 31; i++) {
    var prefix = 'Vibe Coding \u591A\u4EBA\u6E38\u620F\uFF08' + cnum(i) + '\uFF09';
    var match = allFiles.find(function(f) { return f.indexOf(prefix) === 0; });
    if (match) files.push(match);
    else console.log('MISSING P' + i);
  }

  console.log('Articles: ' + files.length + ' (P11-P31)\n');

  ws = new WS(CDP_WS);
  await new Promise(function(res, rej) {
    ws.on('open', res);
    ws.on('error', rej);
    setTimeout(function() { rej(new Error('WS timeout')); }, 15000);
  });
  console.log('Connected\n');

  for (var i = 0; i < files.length; i++) {
    await publishOne(i + 1, files.length, path.join(BLOG_DIR, files[i]));
    if (i < files.length - 1) {
      console.log('\n--- delay 8s ---');
      await sleep(8000);
    }
  }

  console.log('\nAll done!');
  ws.close();
}

var ws;
main().catch(function(e) { console.error('FATAL:', e); if (ws) ws.close(); process.exit(1); });
