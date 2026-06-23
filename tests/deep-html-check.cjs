const fs = require('fs');
const path = require('path');

// 读取 chat.html
const htmlPath = path.join(process.cwd(), '..', 'public', 'chat.html');
const html = fs.readFileSync(htmlPath, 'utf-8');

// 找 #bg_tabs 的闭合 </div> 位置
// 方法：检查从 #bg_tabs 开始，逐步计算 div 的深度
function findDivClose(html, startPos) {
    // 找 "<div" 在 startPos 位置
    const divStart = html.lastIndexOf('<div', startPos - 1);
    console.log(`<div 在 ${divStart} 位置开始`);

    // 现在计算 div 的嵌套深度
    let depth = 1;
    let pos = divStart + 4;
    let openCount = 1;
    let closeCount = 0;

    while (pos < html.length && depth > 0) {
        const nextOpen = html.indexOf('<div', pos);
        const nextClose = html.indexOf('</div>', pos);

        if (nextClose === -1) break;

        if (nextOpen !== -1 && nextOpen < nextClose) {
            // 先遇到 <div
            // 检查是不是自闭合的 <div/> (不可能，但以防万一)
            depth++;
            openCount++;
            pos = nextOpen + 4;
        } else {
            depth--;
            closeCount++;
            pos = nextClose + 6;
            if (depth === 0) {
                return { closePos: pos - 6, openCount, closeCount };
            }
        }
    }
    return { closePos: null, openCount, closeCount };
}

const bgTabsIdx = html.indexOf('id="bg_tabs"');
console.log('#bg_tabs 在位置:', bgTabsIdx);
const result = findDivClose(html, bgTabsIdx);
console.log(`#bg_tabs 闭合位置: ${result.closePos}`);
console.log(`内部 <div> 数量: ${result.openCount - 1}`);
console.log(`内部 </div> 数量: ${result.closeCount - 1}`);
console.log(`#bg_tabs 总大小: ${result.closePos ? result.closePos - html.lastIndexOf('<div', bgTabsIdx - 1) : 'N/A'}`);

// 检查 #bg_tabs 闭合位置后 500 字节
if (result.closePos) {
    console.log('\n=== #bg_tabs 闭合位置后 500 字节 ===');
    console.log(html.substring(result.closePos, result.closePos + 500));
}

// 现在让我们看看 #Backgrounds 的闭合位置
const backgroundsIdx = html.indexOf('id="Backgrounds"');
console.log('\n\n#Backgrounds 在位置:', backgroundsIdx);
const bgResult = findDivClose(html, backgroundsIdx);
console.log(`#Backgrounds 闭合位置: ${bgResult.closePos}`);
console.log(`#Backgrounds 大小: ${bgResult.closePos ? bgResult.closePos - html.lastIndexOf('<div', backgroundsIdx - 1) : 'N/A'}`);

// 检查 #Backgrounds 内部是否包含 sheld (sheld 在 726052 位置)
console.log('\n#sheld 在位置: 726052');
console.log(`#Backgrounds 闭合位置 (${bgResult.closePos}) 是否在 #sheld 之后? ${bgResult.closePos > 726052}`);

// 问题找到了！让我们检查 #Backgrounds 是否包含了 #sheld
console.log('\n=== 检查 #Backgrounds 的 725000-732000 位置 ===');
if (bgResult.closePos && bgResult.closePos > 726052) {
    console.log('**警告：#Backgrounds 的闭合位置在 #sheld 位置之后！');
    console.log('**这意味着 #Backgrounds 错误地包含了 #sheld');
}
