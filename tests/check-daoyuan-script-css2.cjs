const fs = require('fs');

// 读取道渊角色卡聊天数据
const filePath = 'd:/project-codewhale/SillyTavern-trae/data/default-user/chats/《道渊》v5.1/《道渊》v5.1 - 2026-06-20@14h46m18s493ms.jsonl';
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n').filter(l => l.trim());
const msg = JSON.parse(lines[1]);

const fullHtmlBlock = msg.swipes[0];
const htmlBlockMatch = fullHtmlBlock.match(/^\s*```html\s*\r?\n([\s\S]*?)\r?\n```\s*$/i);
let rawHtml = htmlBlockMatch[1];

// 提取脚本内容
const scriptTagRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gims;
let scripts = [];
rawHtml.replace(scriptTagRegex, (_, attrs, scriptContent) => {
    scripts.push(scriptContent.trim());
    return '';
});

const allScript = scripts.join('\n');
console.log('脚本总长度:', allScript.length);

// 查看脚本后半部分
console.log('\n\n=== 脚本 4000-6859 字符 ===');
console.log(allScript.substring(4000));

// 检查是否有动态创建 style 或 CSS 的代码
console.log('\n\n=== CSS 动态注入检查 ===');
const checkPatterns = [
    'createElement.*style',
    '.appendChild.*style',
    'document\.head',
    'textContent.*=',
    'style\.inner',
    'insertRule',
    'CSSStyle',
    'background',
    'border-radius',
    'rgba',
    'gradient',
    'padding',
    'font-size',
    'font-family',
    'color',
    'conic',
    'shadow',
    '@keyframes',
    'keyframes',
    'transform',
    'rotate',
];

checkPatterns.forEach(pattern => {
    const regex = new RegExp(pattern, 'gi');
    const matches = allScript.match(regex);
    if (matches) {
        console.log(`  ${pattern}: ${matches.length} 次`);
    }
});

// 检查是否有将 CSS 字符串写入页面的逻辑
console.log('\n\n=== 检查是否有 CSS 字符串常量 ===');
// 查找长字符串中包含的 CSS 语法
const cssLike = allScript.match(/['"][^{}]*\{[^}]*\}[^{]*['"]/g);
if (cssLike) {
    console.log('找到 CSS 样式字符串:', cssLike.length);
    cssLike.slice(0, 10).forEach((c, i) => {
        console.log(`  [${i}] ${c.substring(0, 150)}`);
    });
}

// 检查是否有 `const css = ` 或类似的定义
console.log('\n\n=== 查找 CSS 变量定义 ===');
const varPatterns = allScript.match(/(?:const|let|var)\s+\w*(?:css|style|CSS|STYLE)\w*\s*=\s*[`'"]/gi);
if (varPatterns) {
    console.log('CSS 变量定义模式:', varPatterns);
}

// 检查是否有 document.head / document.body 操作
console.log('\n\n=== 查找 document.head / document.body 操作 ===');
const headOps = allScript.match(/document\.(?:head|body)[^;\n]*/gi);
if (headOps) {
    headOps.slice(0, 10).forEach((op, i) => {
        console.log(`  [${i}] ${op.substring(0, 100)}`);
    });
}
