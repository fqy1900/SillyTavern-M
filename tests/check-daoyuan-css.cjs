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

console.log('=== 前 2000 字符 ===');
console.log(rawHtml.substring(0, 2000));

console.log('\n\n=== 查找 style 相关标签 ===');
// 检查所有 style 变体
const styleVariants = rawHtml.match(/<style[^>]*>[\s\S]*?<\/style>/gi);
console.log('标准 <style> 标签数量:', styleVariants?.length || 0);
if (styleVariants) {
    styleVariants.forEach((s, i) => {
        console.log(`\n  [${i}] 长度: ${s.length}, 开头: ${s.substring(0, 100).replace(/\n/g, '\\n')}`);
    });
}

// 检查是否有其他方式的 CSS
console.log('\n\n=== 查找 <link rel="stylesheet"> ===');
const linkMatches = rawHtml.match(/<link[^>]*>/gi);
console.log('link 标签数量:', linkMatches?.length || 0);
if (linkMatches) linkMatches.forEach((l, i) => console.log(`  [${i}] ${l.substring(0, 150)}`));

// 查找 style 属性
console.log('\n\n=== 查找 inline style 属性 ===');
const inlineStyleMatches = rawHtml.match(/style\s*=\s*["'][^"']*["']/gi);
console.log('inline style 属性数量:', inlineStyleMatches?.length || 0);
if (inlineStyleMatches && inlineStyleMatches.length < 20) {
    inlineStyleMatches.forEach((s, i) => console.log(`  [${i}] ${s.substring(0, 100)}`));
}

// 查找 @import 
console.log('\n\n=== 查找 @import ===');
const importCount = (rawHtml.match(/@import/gi) || []).length;
console.log('@import 数量:', importCount);

// 查找 <style type="text/css">
const styleTypeMatches = rawHtml.match(/<style\s+type\s*=\s*["']text\/css["'][^>]*>/gi);
console.log('\n=== 查找 <style type="text/css"> ===');
console.log('数量:', styleTypeMatches?.length || 0);

// 打印完整的第一个 3000 字符，看看 style 是怎么写的
console.log('\n\n=== 完整 HTML 前 3000 字符（含换行）===');
console.log(rawHtml.substring(0, 3000));
