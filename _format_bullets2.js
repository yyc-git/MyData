const fs = require('fs');

const karmaDir = 'D:/Github/MyData/karma';
const files = fs.readdirSync(karmaDir).filter(f => f.endsWith('.md'));

files.forEach(f => {
  let content = fs.readFileSync(`${karmaDir}/${f}`, 'utf8');
  
  // Add space after - at line start (markdown bullet requires space)
  content = content.replace(/^-(\S)/gm, '- $1');
  
  // Handle "回来的路上被感动了..." paragraph split
  // Split at "感恩~" followed by "估计是因为" (common pattern)
  content = content.replace(/(感恩~)估计是因为/g, '$1\n估计是因为');
  
  // Similarly handle any "感恩~\n\n" that shouldn't be double newline
  // Clean up
  content = content.replace(/\n{4,}/g, '\n\n\n');
  content = content.trim();
  
  fs.writeFileSync(`${karmaDir}/${f}`, content, 'utf8');
  console.log(`${f}: ${content.length} bytes`);
});

console.log('\n=== 2024年1月 (check fixed) ===');
const c = fs.readFileSync(`${karmaDir}/2024年1月我的观察报告.md`, 'utf8');
const idx = c.indexOf('ty分享宽恕');
console.log(c.substring(Math.max(0,idx-30), Math.min(c.length, idx+80)));
const idx2 = c.indexOf('回来的路上');
if (idx2 >= 0) console.log('\n' + c.substring(idx2, idx2+150));

console.log('\n=== 2024年2月 (check fixed) ===');
const c2 = fs.readFileSync(`${karmaDir}/2024年2月我的观察报告.md`, 'utf8');
const idx3 = c2.indexOf('fcy分享');
console.log(c2.substring(Math.max(0,idx3-30), Math.min(c2.length, idx3+80)));
const idx4 = c2.indexOf('超能力梦');
console.log(c2.substring(Math.max(0,idx4-30), Math.min(c2.length, idx4+80)));
