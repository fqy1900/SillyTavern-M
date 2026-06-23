const fs = require('fs');
const path = require('path');

// 读取 chat.html
const htmlPath = path.join(process.cwd(), '..', 'public', 'chat.html');
const html = fs.readFileSync(htmlPath, 'utf-8');

// 检查从 #bg_tabs 到 #sheld 之间是否有未闭合的标签
const bgTabsIdx = html.indexOf('id="bg_tabs"');
const sheldIdx = html.indexOf('id="sheld"');

console.log(`#bg_tabs 在位置: ${bgTabsIdx}`);
console.log(`#sheld 在位置: ${sheldIdx}`);
console.log(`两者距离: ${sheldIdx - bgTabsIdx} 字节`);

// 在 #bg_tabs 和 #sheld 之间检查关键结构
// 检查是否有 drawer 相关的闭合问题
// drawer-content, drawer, closedDrawer 这些都是潜在的问题点

// 检查从 #bg_tabs 闭合位置 (530881) 到 #sheld (726052) 之间
// 寻找关键的抽屉结构

// 1. 找所有的 drawer 相关的 div id
const drawerRegex = /id="([^"]*(?:drawer|button|settings|Backgrounds)[^"]*)"/gi;
let match;
const drawerIds = [];
while ((match = drawerRegex.exec(html)) !== null) {
    drawerIds.push({ id: match[1], pos: match.index });
}

console.log('\n=== Drawer 相关的元素 ID ===');
for (const d of drawerIds) {
    console.log(`${d.pos}: ${d.id}`);
}

// 2. 检查 #backgrounds-button 到 #extensions-settings-button 之间的结构
const bgButtonIdx = html.indexOf('id="backgrounds-button"');
const extSettingsButtonIdx = html.indexOf('id="extensions-settings-button"');
console.log(`\n#backgrounds-button: ${bgButtonIdx}`);
console.log(`#extensions-settings-button: ${extSettingsButtonIdx}`);

// 3. 检查 #bg_tabs 结束后，是否有额外的未闭合 <div 或缺失的 </div>
// 方法：计算从 #bg_tabs 开始位置到结尾的标签平衡
const startCheckPos = html.lastIndexOf('<div', bgTabsIdx - 1);
const endCheckPos = sheldIdx;
const section = html.substring(startCheckPos, endCheckPos);
const openCount = (section.match(/<div/gi) || []).length;
const closeCount = (section.match(/<\/div>/gi) || []).length;
console.log(`\n从 #bg_tabs 到 #sheld 之间:`);
console.log(`<div 数量: ${openCount}`);
console.log(`</div> 数量: ${closeCount}`);
console.log(`不平衡: ${openCount - closeCount}`);

// 4. 同样检查从 body 开始到 sheld 的平衡
const bodyIdx = html.indexOf('<body');
console.log(`\n从 <body> 到 #sheld 之间:`);
const section2 = html.substring(bodyIdx, sheldIdx);
const openCount2 = (section2.match(/<div/gi) || []).length;
const closeCount2 = (section2.match(/<\/div>/gi) || []).length;
console.log(`<div 数量: ${openCount2}`);
console.log(`</div> 数量: ${closeCount2}`);
console.log(`不平衡: ${openCount2 - closeCount2}`);
