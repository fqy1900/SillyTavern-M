const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// 读取 chat.html
const htmlPath = path.join(process.cwd(), '..', 'public', 'chat.html');
const html = fs.readFileSync(htmlPath, 'utf-8');

// 使用 JSDOM 解析
const dom = new JSDOM(html);
const document = dom.window.document;

console.log('=== 静态 HTML 解析结果 (JSDOM) ===');
console.log('#bg_tabs 孩子数量:', document.querySelector('#bg_tabs') ? document.querySelector('#bg_tabs').children.length : 'NOT FOUND');
console.log('#bg_tabs 孩子:', document.querySelector('#bg_tabs') ? Array.from(document.querySelector('#bg_tabs').children).map(c => c.tagName + (c.id ? '#' + c.id : '')).slice(0, 10) : []);

console.log('\n#bg_global_tab 数量:', document.querySelectorAll('#bg_global_tab').length);
console.log('#bg_chat_tab 数量:', document.querySelectorAll('#bg_chat_tab').length);
console.log('#sheld 数量:', document.querySelectorAll('#sheld').length);
console.log('#chat 数量:', document.querySelectorAll('#chat').length);

// 检查 #bg_tabs 的 HTML 大小
const bgTabs = document.querySelector('#bg_tabs');
if (bgTabs) {
    console.log('\n#bg_tabs innerHTML 大小:', bgTabs.innerHTML.length);
    console.log('#bg_tabs 位置 (getBoundingClientRect):', bgTabs.getBoundingClientRect ? 'YES' : 'NO');
}

// 检查第二个 #bg_global_tab 如果存在
const allBgGlobalTabs = document.querySelectorAll('#bg_global_tab');
if (allBgGlobalTabs.length > 1) {
    console.log('\n=== 发现多个 #bg_global_tab ===');
    allBgGlobalTabs.forEach((el, i) => {
        let parent = el.parentElement;
        const parentChain = [];
        for (let j = 0; j < 5 && parent; j++) {
            parentChain.push(parent.tagName + (parent.id ? '#' + parent.id : ''));
            parent = parent.parentElement;
        }
        console.log(`Index ${i}: parentChain =`, parentChain);
        console.log(`  innerHTML length: ${el.innerHTML.length}`);
        console.log(`  Preview: ${el.innerHTML.substring(0, 100)}`);
    });
}

// 检查 #sheld 是否在 #bg_tabs 内部
const sheld = document.querySelector('#sheld');
if (sheld) {
    let parent = sheld.parentElement;
    const parentChain = [];
    let inBgTabs = false;
    while (parent) {
        if (parent.id === 'bg_tabs') {
            inBgTabs = true;
            break;
        }
        parentChain.push(parent.tagName + (parent.id ? '#' + parent.id : ''));
        parent = parent.parentElement;
    }
    console.log('\n=== #sheld 结构 ===');
    console.log('是否在 #bg_tabs 内:', inBgTabs);
    if (!inBgTabs) {
        console.log('父链:', parentChain);
    }
}
