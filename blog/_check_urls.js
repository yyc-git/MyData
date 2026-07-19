/**
 * 检查每个 Zhihu URL 对应哪篇文章
 */
const WS = require('ws');

const CDP_WS = 'ws://127.0.0.1:9222/devtools/browser';

// URLs that need identification (from CDP targets, minus ones I already mapped)
// Known: P0: 2058225344528790549
// Unknown: the rest
var allUrls = [
  'https://zhuanlan.zhihu.com/p/2013905103757779977',
  'https://zhuanlan.zhihu.com/p/2056377667528799139',
  'https://zhuanlan.zhihu.com/p/1952644366784004254',
  'https://zhuanlan.zhihu.com/p/2058224068533532598',
  'https://zhuanlan.zhihu.com/p/2058223674403059536',
];

var gId = 500;
function nid() { return gId++; }
function cdp(ws, id, method, params, sid) { const msg = { id, method, params }; if (sid) msg.sessionId = sid; ws.send(JSON.stringify(msg)); }
function waitResp(ws, tid, timeout) { return new Promise(function(r) { var t = setTimeout(function() { ws.removeListener('message', h); r(null); }, timeout || 20000); function h(d) { try { var m = JSON.parse(d.toString()); if (m.id === tid) { clearTimeout(t); ws.removeListener('message', h); r(m); } } catch(e) {} } ws.on('message', h); }); }
function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }
async function exec(ws, s, expr, t) { var id = nid(); cdp(ws, id, 'Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, s); var r = await waitResp(ws, id, t || 15000); return r && r.result && r.result.result && r.result.result.value; }

async function checkUrl(ws, url) {
  var id = nid(); cdp(ws, id, 'Target.createTarget', { url: url });
  var cr = await waitResp(ws, id, 15000);
  if (!cr || !cr.result) { console.log('FAIL:', url); return; }
  var tid = cr.result.targetId;
  var idAtt = nid(); cdp(ws, idAtt, 'Target.attachToTarget', { targetId: tid, flatten: true });
  var ar = await waitResp(ws, idAtt, 10000);
  if (!ar || !ar.result) { console.log('FAIL attach:', url); return; }
  var s = ar.result.sessionId;
  await sleep(5000);

  var title = await exec(ws, s, 'document.title', 5000);
  console.log(url.substring(30) + ' => ' + (title || '?'));

  // Detach
  var idD = nid(); cdp(ws, idD, 'Target.detachFromTarget', { targetId: tid }); await waitResp(ws, idD, 3000);
}

async function main() {
  var ws = new WS(CDP_WS);
  await new Promise(function(res, rej) { ws.on('open', res); ws.on('error', rej); setTimeout(function() { rej(new Error('timeout')); }, 15000); });
  console.log('Connected\n');

  for (var i = 0; i < allUrls.length; i++) {
    await checkUrl(ws, allUrls[i]);
    await sleep(2000);
  }
  ws.close();
}

main().catch(function(e) { console.error('Error:', e); process.exit(1); });
