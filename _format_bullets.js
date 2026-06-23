const fs = require('fs');

const karmaDir = 'D:/Github/MyData/karma';
const files = fs.readdirSync(karmaDir).filter(f => f.endsWith('.md'));

files.forEach(f => {
  let content = fs.readFileSync(`${karmaDir}/${f}`, 'utf8');
  
  // 1. Replace ● with - for markdown bullet lists
  //    Must be ● or ● followed by text, at line start or after newline
  content = content.replace(/●/g, '-');
  
  // 2. Ensure blank line before any # heading (already mostly handled)
  //    Clean up any ## that appears right after content without newline
  content = content.replace(/([^\n])(## )/g, '$1\n\n$2');
  
  // 3. Clean up 4+ consecutive newlines
  content = content.replace(/\n{4,}/g, '\n\n\n');
  
  // 4. Trim trailing whitespace per line
  content = content.split('\n').map(l => l.trim()).join('\n');
  
  // 5. Final collapse
  content = content.replace(/\n{4,}/g, '\n\n\n');
  content = content.trim();
  
  fs.writeFileSync(`${karmaDir}/${f}`, content, 'utf8');
  console.log(`${f}: ${content.length} bytes`);
});

// Show 2024年1月 around the ty/yh section
console.log('\n=== 2024年1月 (ty/yh area) ===');
const c = fs.readFileSync(`${karmaDir}/2024年1月我的观察报告.md`, 'utf8');
console.log(c.substring(0, 1200));

console.log('\n=== Tail (结果: 回来的路上) ===');
const idx = c.indexOf('回来的路上被感动了');
if (idx >= 0) console.log(c.substring(Math.max(0,idx-50), Math.min(c.length, idx+250)));

console.log('\n=== 2024年2月 (first 500) ===');
const c2 = fs.readFileSync(`${karmaDir}/2024年2月我的观察报告.md`, 'utf8');
console.log(c2.substring(0, 500));
