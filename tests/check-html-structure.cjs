const fs = require('fs');
const path = require('path');

// 读取 chat.html
const htmlPath = path.join(process.cwd(), '..', 'public', 'chat.html');
const html = fs.readFileSync(htmlPath, 'utf-8');

// 分析 HTML 中的关键元素的开始/结束位置
function findElement(html, id) {
    const startPattern = `id="${id}"`;
    const startIdx = html.indexOf(startPattern);
    if (startIdx === -1) return null;

    // 找 <div 开始
    let tagStart = html.lastIndexOf('<', startIdx - 1);
    const tag = html.substring(tagStart, tagStart + 20).split('>')[0] + '>';
    console.log(`\n[id="${id}"]`);
    console.log(`  在 ${startIdx} 位置找到`);
    console.log(`  标签: ${tag}`);

    // 找匹配的闭合标签
    // 简单的基于标签名的深度计数
    let depth = 1;
    let i = startIdx;
    while (i < html.length && depth > 0) {
        const nextOpen = html.indexOf('<div', i + 1);
        const nextClose = html.indexOf('</div>', i + 1);

        if (nextClose === -1) break;
        if (nextOpen !== -1 && nextOpen < nextClose) {
            depth++;
            i = nextOpen + 4;
        } else {
            depth--;
            i = nextClose + 6;
            if (depth === 0) {
                console.log(`  闭合标签在位置 ${i - 6}`);
                console.log(`  元素大小: ${i - 6 - tagStart}`);
                console.log(`  元素包含的内容大小: ${i - 6 - startIdx}`);
                return { start: tagStart, end: i - 6, id };
            }
        }
    }
    console.log('  没有找到匹配的闭合标签!');
    return { start: tagStart, end: null, id };
}

// 检查几个关键元素
const elements = ['bg_tabs', 'Backgrounds', 'backgrounds-button', 'sheld', 'chat', 'message_template'];
for (const id of elements) {
    findElement(html, id);
}

// 额外检查：检查 bg_tabs 之后 2000 字节是否有明显错误
const bgTabsIdx = html.indexOf('id="bg_tabs"');
if (bgTabsIdx !== -1) {
    console.log('\n\n=== bg_tabs 开始位置后的 1000 字节 ===');
    console.log(html.substring(bgTabsIdx, bgTabsIdx + 1000));
}

// 检查：寻找 bg_chat_tab 结束后是否有 </div> 缺失
const bgChatTabIdx = html.indexOf('id="bg_chat_tab"');
if (bgChatTabIdx !== -1) {
    console.log('\n\n=== bg_chat_tab 开始位置后的 2000 字节 ===');
    console.log(html.substring(bgChatTabIdx, bgChatTabIdx + 2000));
}
