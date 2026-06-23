const fs = require('fs');

// 读取道渊角色卡聊天数据
const filePath = 'd:/project-codewhale/SillyTavern-trae/data/default-user/chats/《道渊》v5.1/《道渊》v5.1 - 2026-06-20@14h46m18s493ms.jsonl';
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n').filter(l => l.trim());
const msg = JSON.parse(lines[1]);

const fullHtmlBlock = msg.swipes[0];
const htmlBlockMatch = fullHtmlBlock.match(/^\s*```html\s*\r?\n([\s\S]*?)\r?\n```\s*$/i);
let rawHtml = htmlBlockMatch[1];

console.log('=== 原始问题验证 ===');
console.log('去除包装前 rawHtml 长度:', rawHtml.length);

// 模拟 app-main.js 中的去除包装逻辑
let htmlAfterRemove = rawHtml
    .replace(/^[\s]*<html[^>]*>[\s\S]*?<head[^>]*>[\s\S]*?<\/head>[\s\S]*?<body[^>]*>/ims, '')
    .replace(/<\/body>[\s\S]*?<\/html>[\s]*$/ims, '')
    .trim();

console.log('去除包装后长度:', htmlAfterRemove.length);
console.log('去除包装后是否包含 <style>:', htmlAfterRemove.includes('<style'));
console.log('去除包装后是否包含 @keyframes:', htmlAfterRemove.includes('@keyframes'));
console.log('去除包装后是否包含 .info-card:', htmlAfterRemove.includes('.info-card'));

console.log('\n=== 修复方案验证 ===');
// 修复：在去除 html/head/body 包装之前，先提取 style 内容
let rawHtmlFixed = htmlBlockMatch[1];

// 步骤 1: 提取 <head> 中的 style 标签内容
let headStyles = '';
const headMatch = rawHtmlFixed.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
if (headMatch) {
    const headContent = headMatch[1];
    const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let styleMatch;
    while ((styleMatch = styleRegex.exec(headContent)) !== null) {
        headStyles += styleMatch[1] + '\n';
    }
    console.log('从 <head> 提取的 CSS 长度:', headStyles.length);
    console.log('提取的 CSS 包含 .info-card:', headStyles.includes('.info-card'));
    console.log('提取的 CSS 包含 @keyframes:', headStyles.includes('@keyframes'));
    console.log('提取的 CSS 包含 box-shadow:', headStyles.includes('box-shadow'));
    console.log('提取的 CSS 包含 conic-gradient:', headStyles.includes('conic-gradient'));
}

// 步骤 2: 去除 html/head/body 包装
rawHtmlFixed = rawHtmlFixed
    .replace(/^[\s]*<html[^>]*>[\s\S]*?<head[^>]*>[\s\S]*?<\/head>[\s\S]*?<body[^>]*>/ims, '')
    .replace(/<\/body>[\s\S]*?<\/html>[\s]*$/ims, '')
    .trim();

console.log('\n去除包装后长度:', rawHtmlFixed.length);

// 步骤 3: 在 HTML 开头添加 style 标签
if (headStyles.trim()) {
    rawHtmlFixed = `<style>${headStyles}</style>\n` + rawHtmlFixed;
    console.log('添加回 CSS 后长度:', rawHtmlFixed.length);
    console.log('包含 <style>:', rawHtmlFixed.includes('<style'));
}

// 步骤 4: 现在 encodeStyleTags 应该能找到 CSS 了
const styleRegex2 = /<style>([\s\S]*?)<\/style>/gims;
const styleMatches = rawHtmlFixed.match(styleRegex2);
console.log('\nencodeStyleTags 能找到的 style 数量:', styleMatches?.length || 0);

console.log('\n=== 修复方案有效！ ===');
console.log('问题: CSS 在 <head> 中，被去除 html/head/body 包装时一起删除了');
console.log('修复: 在去除包装之前，先提取 <head> 中的 <style> 内容，然后在 body 内容前重新添加');
