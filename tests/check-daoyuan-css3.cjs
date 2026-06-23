const fs = require('fs');

// 读取道渊角色卡聊天数据
const filePath = 'd:/project-codewhale/SillyTavern-trae/data/default-user/chats/《道渊》v5.1/《道渊》v5.1 - 2026-06-20@14h46m18s493ms.jsonl';
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n').filter(l => l.trim());
const msg = JSON.parse(lines[1]);

const fullHtmlBlock = msg.swipes[0];

// 先不做任何处理，直接查看开头部分
console.log('=== 原始 HTML 前 3000 字符 ===');
console.log(fullHtmlBlock.substring(0, 3000));

console.log('\n\n=== 查找所有 style 相关标签（含变体）===');
const styleVariants = [
    /<style[^>]*>/gi,
    /<style>/gi,
    /<\/style>/gi,
    /style\s*=/gi,
    /Style\s*=/gi,
    /STYLE\s*=/gi,
    /<link[^>]*stylesheet[^>]*>/gi,
];

styleVariants.forEach((re, i) => {
    const matches = fullHtmlBlock.match(re);
    if (matches) {
        console.log(`  模式 ${i}: 找到 ${matches.length} 个匹配`);
        matches.slice(0, 5).forEach(m => console.log(`    ${m.substring(0, 100)}`);
    }
});

// 检查完整 HTML 结构
console.log('\n\n=== HTML 结构分析 ===');
console.log('包含 <html>:', fullHtmlBlock.includes('<html'));
console.log('包含 <head>:', fullHtmlBlock.includes('<head'));
console.log('包含 <body>:', fullHtmlBlock.includes('<body'));
console.log('包含 <style>:', /<\s*style/i.test(fullHtmlBlock));
console.log('包含 <link>:', /<\s*link/i.test(fullHtmlBlock));
console.log('包含 <script>:', /<\s*script/i.test(fullHtmlBlock));

// 尝试用更宽松的正则匹配 style 标签
console.log('\n\n=== 更宽松的 style 标签匹配 ===');
const looseStyleRegex = /<\s*style[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi;
const looseMatches = fullHtmlBlock.match(looseStyleRegex);
console.log('匹配数量:', looseMatches?.length || 0);
if (looseMatches) {
    looseMatches.forEach((m, i) => {
        console.log(`  [${i}] 长度: ${m.length}, 开头: ${m.substring(0, 80).replace(/\n/g, '\\n')}`);
    });
}

// 检查整个 rawHtml 内容，看看是否有 style 标签在某些地方
const htmlBlockMatch = fullHtmlBlock.match(/^\s*```html\s*\r?\n([\s\S]*?)\r?\n```\s*$/i);
if (htmlBlockMatch) {
    const innerHtml = htmlBlockMatch[1];
    console.log('\n\n=== HTML 内部内容分析 ===');
    
    // 查找 head 标签内容
    const headMatch = innerHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    if (headMatch) {
        console.log('找到 <head> 标签，内容长度:', headMatch[1].length);
        console.log('head 内容（前 2000 字符）:');
        console.log(headMatch[1].substring(0, 2000));
    } else {
        console.log('未找到 <head> 标签');
        // 直接查找 style 标签
        const anyStyleMatch = innerHtml.match(/<\s*style[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi);
        console.log('直接 style 标签匹配:', anyStyleMatch?.length || 0);
        if (anyStyleMatch) {
            anyStyleMatch.slice(0, 3).forEach((s, i) => {
                console.log(`  [${i}] 长度: ${s.length}`);
                console.log(`    ${s.substring(0, 200).replace(/\n/g, '\\n')}`);
            });
        }
    }
    
    // 检查完整 HTML 的结构
    console.log('\n\n=== 完整 HTML 的 5000-6000 字符 ===');
    console.log(innerHtml.substring(5000, 6000));
}
