const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/test_user_8002/chats/《道渊》v5.1/2026-06-19@17h28m58s889ms_1781861338889.json', 'utf-8'));
const content = data.messages[0].content;

// 查找 switchToSecondGreeting 函数
const switchMatch = content.match(/function\s+switchToSecondGreeting\s*\([\s\S]*?\{[\s\S]*?\n\s*\}/);
if (switchMatch) {
    console.log('=== switchToSecondGreeting 函数 (前1000字符) ===');
    console.log(switchMatch[0].substring(0, 1000));
} else {
    console.log('未找到 switchToSecondGreeting 函数定义');
}

// 查找所有函数定义
console.log('\n=== 脚本中定义的函数 ===');
const funcMatches = content.match(/function\s+\w+\s*\(/g);
if (funcMatches) {
    const uniqueFuncs = [...new Set(funcMatches)];
    console.log('找到的函数:', uniqueFuncs.join(', '));
}

// 分析整个 HTML 结构
console.log('\n=== HTML 结构概览 ===');
const htmlTag = content.match(/<html[^>]*>/);
const headTag = content.match(/<head>[\s\S]*?<\/head>/);
const bodyTag = content.match(/<body>[\s\S]*?<\/body>/);

console.log('HTML 标签:', htmlTag ? '存在' : '不存在');
console.log('Head 标签:', headTag ? `存在 (${headTag[0].length} 字符)` : '不存在');
console.log('Body 标签:', bodyTag ? `存在 (${bodyTag[0].length} 字符)` : '不存在');

// 检查是否有外部脚本引用
const externalScripts = content.match(/<script[^>]+src=[^>]*>/gi);
console.log('\n=== 外部脚本引用 ===');
if (externalScripts) {
    externalScripts.forEach((s, i) => console.log(`外部脚本 ${i}: ${s}`));
} else {
    console.log('没有外部脚本引用（都是内联脚本）');
}
