const fs = require('fs');

// 读取道渊角色卡聊天数据
const filePath = 'd:/project-codewhale/SillyTavern-trae/data/default-user/chats/《道渊》v5.1/《道渊》v5.1 - 2026-06-20@14h46m18s493ms.jsonl';
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n').filter(l => l.trim());
const msg = JSON.parse(lines[1]);

const fullHtmlBlock = msg.swipes[0];
const htmlBlockMatch = fullHtmlBlock.match(/^\s*```html\s*\r?\n([\s\S]*?)\r?\n```\s*$/i);
let rawHtml = htmlBlockMatch[1];

// 去除 <html>/<head>/<body> 包装
rawHtml = rawHtml
    .replace(/^[\s]*<html[^>]*>[\s\S]*?<head[^>]*>[\s\S]*?<\/head>[\s\S]*?<body[^>]*>/ims, '')
    .replace(/<\/body>[\s\S]*?<\/html>[\s]*$/ims, '')
    .trim();

// 提取脚本内容
const scriptTagRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gims;
let scripts = [];
rawHtml.replace(scriptTagRegex, (_, attrs, scriptContent) => {
    scripts.push(scriptContent.trim());
    return '';
});

console.log('=== 脚本总长度:', scripts.reduce((sum, s) => sum + s.length, 0));

// 检查脚本中是否有 CSS 注入逻辑
const allScript = scripts.join('\n');

console.log('\n=== CSS 注入关键词搜索 ===');
const cssKeywords = [
    'createElement.*style', '.style\s*=', 'innerHTML.*style',
    'documentElement.*style', 'body.*style', 'insertRule',
    'addRule', 'appendChild.*style', 'CSS', 'stylesheet',
    '\.info-card', 'background', 'border', 'box-shadow', 'conic-gradient',
    '@keyframes', 'CSS', 'textContent',
    'document.*style', 'style\.textContent', 'class.*style'
];

cssKeywords.forEach(kw => {
    const regex = new RegExp(kw, 'gi');
    const matches = allScript.match(regex);
    if (matches) {
        console.log(`  ${kw}: 出现 ${matches.length} 次`);
    }
});

// 检查是否有 document.createElement('style') 或 CSS 字符串注入
console.log('\n=== 查找动态 CSS 创建 ===');
const cssCreatePatterns = [
    /document\.createElement\(['"]style['"]/gi,
    /\.style\s*\./gi,
    /\.textContent\s*=.*\{/gi,
    /innerText\s*=.*\{/gi,
    /cssText/gi,
    /\.sheet/gi,
    /insertRule/gi,
];

cssCreatePatterns.forEach((pattern, i) => {
    const matches = allScript.match(pattern);
    if (matches) {
        console.log(`  模式 ${i}: 找到 ${matches.length} 个匹配:`, matches.slice(0, 5));
    }
});

// 打印脚本中与样式相关的部分
console.log('\n=== 查找包含 CSS 的代码片段 ===');
const cssLines = allScript.split('\n').filter(line => {
    const lower = line.toLowerCase();
    return lower.includes('rgba(') || 
           lower.includes('gradient') ||
           lower.includes('.info-card') || 
           lower.includes('box-shadow') ||
           lower.includes('border') ||
           lower.includes('text-shadow') ||
           lower.includes('keyframes') ||
           lower.includes('createelement') ||
           (lower.includes('style') && lower.includes('='));
});
console.log(`找到 ${cssLines.length} 行相关代码:`);
cssLines.slice(0, 30).forEach((line, i) => {
    console.log(`  [${i}] ${line.substring(0, 150)}`);
});

// 查看完整脚本的前 5000 字符，理解其结构
console.log('\n\n=== 完整脚本前 5000 字符 ===');
console.log(allScript.substring(0, 5000));
