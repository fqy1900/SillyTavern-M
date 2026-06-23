const fs = require('fs');

// 读取道渊角色卡聊天数据
const filePath = 'd:/project-codewhale/SillyTavern-trae/data/default-user/chats/《道渊》v5.1/《道渊》v5.1 - 2026-06-20@14h46m18s493ms.jsonl';
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n').filter(l => l.trim());
const msg = JSON.parse(lines[1]);

// 获取第一个 swipe（完整 HTML 代码块）
const fullHtmlBlock = msg.swipes[0];
console.log('=== 道渊角色卡 swipe[0] 分析 ===');
console.log('总长度:', fullHtmlBlock.length);

// 检查是否是 ```html 代码块
const htmlBlockMatch = fullHtmlBlock.match(/^\s*```html\s*\r?\n([\s\S]*?)\r?\n```\s*$/i);
console.log('是 ```html 代码块:', !!htmlBlockMatch);

if (!htmlBlockMatch) {
    console.log('WARN: 不是标准 ```html 代码块格式');
    process.exit(1);
}

let rawHtml = htmlBlockMatch[1];

// 移除 <html>/<head>/<body> 包装（同 app-main.js 逻辑）
rawHtml = rawHtml
    .replace(/^[\s]*<html[^>]*>[\s\S]*?<head[^>]*>[\s\S]*?<\/head>[\s\S]*?<body[^>]*>/ims, '')
    .replace(/<\/body>[\s\S]*?<\/html>[\s]*$/ims, '')
    .trim();

console.log('去除包装后长度:', rawHtml.length);

// === 1. 提取脚本内容 ===
const extractedScripts = [];
const scriptTagRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gims;
rawHtml = rawHtml.replace(scriptTagRegex, (_, attrs, scriptContent) => {
    const srcMatch = attrs.match(/\bsrc\s*=\s*(["'])(.*?)\1/i);
    const srcAttr = srcMatch ? srcMatch[2] : '';
    extractedScripts.push({ src: srcAttr, text: scriptContent.trim() });
    return '';
});
console.log('\n=== 脚本提取结果 ===');
console.log('提取到脚本数量:', extractedScripts.length);
extractedScripts.forEach((s, i) => {
    console.log(`  [${i}] src=${s.src || '(内联)'}, length=${s.text.length}`);
});

// 检查是否有 switchToSecondGreeting 函数
const allScriptText = extractedScripts.map(s => s.text).join('\n');
console.log('\n包含 switchToSecondGreeting:', allScriptText.includes('switchToSecondGreeting'));
console.log('包含 getChatMessages:', allScriptText.includes('getChatMessages'));
console.log('包含 setChatMessage:', allScriptText.includes('setChatMessage'));

// === 2. 编码 style 标签 ===
// 同 app-main.js 的 encodeStyleTags
const styleRegex = /<style>([\s\S]*?)<\/style>/gims;
const encodedStyles = [];
rawHtml = rawHtml.replace(styleRegex, (_, match) => {
    encodedStyles.push(match);
    return `<custom-style>${encodeURIComponent(match)}</custom-style>`;
});
console.log('\n=== CSS 样式提取结果 ===');
console.log('提取到 style 数量:', encodedStyles.length);

// === 3. 检查 onclick 属性 ===
const onclickMatches = rawHtml.match(/onclick\s*=\s*["']([^"']*)["']/gi);
console.log('\n=== onclick 属性检查 ===');
console.log('onclick 属性数量:', onclickMatches?.length || 0);
if (onclickMatches) {
    onclickMatches.forEach((m, i) => {
        console.log(`  [${i}] ${m.substring(0, 100)}`);
    });
}

// === 4. 检查 CSS 中包含的关键字 ===
console.log('\n=== CSS 内容分析 ===');
let allCss = encodedStyles.join('\n\n');
console.log('CSS 总长度:', allCss.length);
console.log('包含 @keyframes:', allCss.includes('@keyframes'));
console.log('包含 @import:', allCss.includes('@import'));
console.log('包含 @media:', allCss.includes('@media'));
console.log('包含 :root:', allCss.includes(':root'));
console.log('包含 .info-card:', allCss.includes('.info-card'));
console.log('包含 box-shadow:', allCss.includes('box-shadow'));
console.log('包含 border-color:', allCss.includes('border-color'));
console.log('包含 text-shadow:', allCss.includes('text-shadow'));
console.log('包含 background:', allCss.includes('background'));
console.log('包含 transform:', allCss.includes('transform'));
console.log('包含 conic-gradient:', allCss.includes('conic-gradient'));

// === 5. 使用 @adobe/css-tools 解析 CSS（模拟浏览器环境）===
console.log('\n=== 使用 CSS AST 解析测试 ===');
try {
    const css = require('@adobe/css-tools');
    let ast;
    try {
        ast = css.parse(allCss);
        console.log('CSS 解析成功 ✓');
    } catch (e) {
        console.log('CSS 解析失败:', e.message);
    }

    if (ast && ast.stylesheet && ast.stylesheet.rules) {
        // 检查规则类型分布
        const ruleTypes = {};
        ast.stylesheet.rules.forEach(rule => {
            const type = rule.type;
            ruleTypes[type] = (ruleTypes[type] || 0) + 1;
        });
        console.log('规则类型分布:', ruleTypes);

        // 检查选择器
        let selectors = [];
        ast.stylesheet.rules.forEach(rule => {
            if (rule.type === 'rule' && rule.selectors) {
                selectors = selectors.concat(rule.selectors);
            }
        });
        console.log('\n选择器数量:', selectors.length);
        console.log('包含 .info-card:', selectors.some(s => s.includes('info-card')));
        console.log('包含 body:', selectors.some(s => s === 'body'));
        console.log('包含 :root:', selectors.some(s => s === ':root'));
        console.log('包含 h1/h2/h3:', selectors.some(s => /h[1-3]/.test(s)));
        console.log('包含 .journey-link:', selectors.some(s => s.includes('journey-link')));
    }
} catch (e) {
    console.log('@adobe/css-tools 不可用:', e.message);
}

// === 6. 检查 HTML 中的重要元素 ===
console.log('\n=== HTML 元素检查 ===');
console.log('包含 <div class="info-card">:', rawHtml.includes('info-card'));
console.log('包含 journey-container:', rawHtml.includes('journey-container'));
console.log('包含 点击这里:', rawHtml.includes('点击这里'));
console.log('包含 <div class="section">:', rawHtml.includes('section'));

// === 7. 检查 onclick 调用逻辑 ===
console.log('\n=== 脚本中 switchToSecondGreeting 定义 ===');
const funcMatch = allScriptText.match(/function\s+switchToSecondGreeting\s*\([^)]*\)\s*\{([\s\S]*?)\n\s*\}/);
if (funcMatch) {
    console.log('找到函数定义 ✓');
    console.log('函数内容（前300字符）:');
    console.log(funcMatch[1].substring(0, 300));
} else {
    console.log('未找到标准函数定义，可能使用其他方式');
    // 检查是否用 var/const/let 或箭头函数定义
    const arrowMatch = allScriptText.match(/switchToSecondGreeting\s*=\s*(?:async\s+)?\(/);
    console.log('使用箭头函数/赋值:', !!arrowMatch);
    
    // 打印更多脚本上下文
    const idx = allScriptText.indexOf('switchToSecondGreeting');
    if (idx > -1) {
        console.log('\n\'switchToSecondGreeting\' 出现位置的上下文:');
        console.log(allScriptText.substring(Math.max(0, idx - 50), idx + 200));
    }
}

// === 8. 检查 getChatMessages / setChatMessage 调用 ===
console.log('\n=== 脚本中核心 API 调用 ===');
const getCmIdx = allScriptText.indexOf('getChatMessages');
if (getCmIdx > -1) {
    console.log('getChatMessages 调用上下文:');
    console.log(allScriptText.substring(Math.max(0, getCmIdx - 30), getCmIdx + 100));
}
const setCmIdx = allScriptText.indexOf('setChatMessage');
if (setCmIdx > -1) {
    console.log('\nsetChatMessage 调用上下文:');
    console.log(allScriptText.substring(Math.max(0, setCmIdx - 30), setCmIdx + 100));
}
