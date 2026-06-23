const fs = require('fs');

const filePath = 'd:/project-codewhale/SillyTavern-trae/data/default-user/chats/《道渊》v5.1/《道渊》v5.1 - 2026-06-20@14h46m18s493ms.jsonl';
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n').filter(l => l.trim());
const msg = JSON.parse(lines[1]);

const fullHtmlBlock = msg.swipes[0];

console.log('=== 原始 HTML 前 3000 字符 ===');
console.log(fullHtmlBlock.substring(0, 3000));

console.log('\n\n=== HTML 结构分析 ===');
console.log('包含 <html>:', fullHtmlBlock.includes('<html'));
console.log('包含 <head>:', fullHtmlBlock.includes('<head'));
console.log('包含 <body>:', fullHtmlBlock.includes('<body'));
console.log('包含 <style>:', /<\s*style/i.test(fullHtmlBlock));
console.log('包含 <link>:', /<\s*link/i.test(fullHtmlBlock));
console.log('包含 <script>:', /<\s*script/i.test(fullHtmlBlock));

// 检查完整 HTML 的结构
const htmlBlockMatch = fullHtmlBlock.match(/^\s*```html\s*\r?\n([\s\S]*?)\r?\n```\s*$/i);
if (htmlBlockMatch) {
    const innerHtml = htmlBlockMatch[1];
    console.log('\n\n=== 完整 HTML 的 4000-8000 字符 ===');
    console.log(innerHtml.substring(4000, 8000));
    
    console.log('\n\n=== 完整 HTML 的 8000-12000 字符 ===');
    console.log(innerHtml.substring(8000, 12000));
    
    console.log('\n\n=== 完整 HTML 的 12000-18650 字符 ===');
    console.log(innerHtml.substring(12000));
}
