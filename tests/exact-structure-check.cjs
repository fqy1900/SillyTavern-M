const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// 读取 chat.html
const htmlPath = path.join(process.cwd(), '..', 'public', 'chat.html');
const html = fs.readFileSync(htmlPath, 'utf-8');

// 1. 精确找到 #bg_tabs 开始和结束位置
const bgTabsStart = html.indexOf('id="bg_tabs"');
console.log('=== #bg_tabs 精确结构分析 ===');
console.log('#bg_tabs 在位置:', bgTabsStart);

// 2. 打印 #bg_tabs 开始前后 200 字节（精确到标签）
const divTagStart = html.lastIndexOf('<div', bgTabsStart - 1);
console.log('\n=== #bg_tabs 开始标签（前 200 字节到后 800 字节）===');
console.log(html.substring(divTagStart - 200, divTagStart + 800));

// 3. 用 JSDOM 精确解析 #bg_tabs 的内部结构
const dom = new JSDOM(html);
const document = dom.window.document;

const bgTabs = document.querySelector('#bg_tabs');
console.log('\n=== JSDOM 解析结果：#bg_tabs 内部结构 ===');
if (bgTabs) {
    console.log('直接子元素数量:', bgTabs.children.length);
    Array.from(bgTabs.children).forEach((child, index) => {
        console.log(`\n  [${index}] ${child.tagName}${child.id ? '#' + child.id : ''}`);
        console.log(`      class: ${child.className}`);
        console.log(`      children: ${child.children.length}`);
        console.log(`      innerHTML length: ${child.innerHTML.length}`);
        console.log(`      first 200 bytes: ${child.innerHTML.substring(0, 200).replace(/\s+/g, ' ')}`);
    });

    // 检查是否有 <a> 链接在 #bg_tabs 中
    const links = Array.from(bgTabs.querySelectorAll('a'));
    console.log('\n=== #bg_tabs 内的 <a> 链接 ===');
    links.forEach((link, i) => {
        console.log(`  [${i}] href="${link.getAttribute('href')}" text="${link.textContent.substring(0, 30)}"`);
    });

    // 检查这些链接对应的目标元素
    console.log('\n=== 链接目标元素检查 ===');
    links.forEach((link, i) => {
        const href = link.getAttribute('href');
        if (href && href.startsWith('#')) {
            const targetId = href.substring(1);
            const target = document.getElementById(targetId);
            if (target) {
                console.log(`  [${i}] Target #${targetId}:`);
                console.log(`        tag: ${target.tagName}`);
                console.log(`        parent: ${target.parentElement.tagName}${target.parentElement.id ? '#' + target.parentElement.id : ''}`);
                console.log(`        in #bg_tabs: ${target.closest('#bg_tabs') !== null}`);
                console.log(`        innerHTML length: ${target.innerHTML.length}`);
            } else {
                console.log(`  [${i}] Target #${targetId}: NOT FOUND!`);
            }
        }
    });
}

// 4. 关键测试：检查 #bg_global_tab 和 #bg_chat_tab 是否真的是 #bg_tabs 的直接子元素
const bgGlobalTab = document.querySelector('#bg_tabs > #bg_global_tab');
const bgChatTab = document.querySelector('#bg_tabs > #bg_chat_tab');

console.log('\n=== 关键：panel 是否为 #bg_tabs 的直接子元素？===');
console.log('#bg_tabs > #bg_global_tab 存在:', bgGlobalTab !== null);
console.log('#bg_tabs > #bg_chat_tab 存在:', bgChatTab !== null);

// 5. 检查 #bg_tabs 结束位置（精确的 </div>）
function findMatchingClose(html, openIdx) {
    const openTagStart = html.lastIndexOf('<', openIdx - 1);
    // 查找对应的 </div>
    let depth = 1;
    let pos = openTagStart + 1;
    while (pos < html.length && depth > 0) {
        const nextOpen = html.indexOf('<div', pos);
        const nextClose = html.indexOf('</div>', pos);
        if (nextClose === -1) break;

        if (nextOpen !== -1 && nextOpen < nextClose) {
            depth++;
            pos = nextOpen + 4;
        } else {
            depth--;
            pos = nextClose + 6;
            if (depth === 0) {
                return nextClose;
            }
        }
    }
    return -1;
}

const closePos = findMatchingClose(html, bgTabsStart);
console.log('\n=== #bg_tabs 的闭合位置 ===');
console.log('闭合 </div> 在位置:', closePos);
if (closePos > 0) {
    console.log('\n=== #bg_tabs 闭合标签前 200 字节（查看最后内容）===');
    console.log(html.substring(closePos - 200, closePos + 20));
}

// 6. 最关键：检查 #bg_tabs 内部是否有未闭合的 div 导致错误嵌套
console.log('\n=== 检查 #bg_tabs 内部 div 标签平衡 ===');
const bgTabsContent = html.substring(divTagStart, closePos);
const openDivs = bgTabsContent.match(/<div\b/gi) || [];
const closeDivs = bgTabsContent.match(/<\/div>/gi) || [];
console.log(`<div 标签: ${openDivs.length}`);
console.log(`</div> 标签: ${closeDivs.length}`);
console.log(`不平衡: ${openDivs.length - closeDivs.length}`);

// 7. 检查 #bg_global_tab 和 #bg_chat_tab 是否在 #bg_tabs 内部
const bgGlobalTabPos = html.indexOf('id="bg_global_tab"');
const bgChatTabPos = html.indexOf('id="bg_chat_tab"');
console.log(`\n#bg_global_tab 在位置: ${bgGlobalTabPos}`);
console.log(`#bg_chat_tab 在位置: ${bgChatTabPos}`);
console.log(`是否在 #bg_tabs 内部 (${divTagStart} ~ ${closePos}):`);
console.log(`  bg_global_tab: ${bgGlobalTabPos > divTagStart && bgGlobalTabPos < closePos}`);
console.log(`  bg_chat_tab: ${bgChatTabPos > divTagStart && bgChatTabPos < closePos}`);
