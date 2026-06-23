import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

(async () => {
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const browser = await chromium.launch({
        executablePath: chromePath,
        headless: true,
    });

    const page = await browser.newPage();
    console.log('打开 chat.html...');
    await page.goto('http://127.0.0.1:8000/chat.html', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(10000);

    const result = await page.evaluate(() => {
        // 关键检查：bg_global_tab 和 bg_chat_tab 的实际父元素和内容
        const bgGlobalTab = document.querySelector('#bg_global_tab');
        const bgChatTab = document.querySelector('#bg_chat_tab');

        // 检查这两个元素是否在 #bg_tabs 内部
        const bgTabs = document.querySelector('#bg_tabs');

        return {
            bg_tabs_html_length: bgTabs ? bgTabs.innerHTML.length : null,
            bg_tabs_children_count: bgTabs ? bgTabs.children.length : null,
            bg_tabs_child_ids: bgTabs ? Array.from(bgTabs.children).map(c => c.tagName + (c.id ? '#' + c.id : '') + ' class=' + String(c.className).substring(0, 50)) : null,

            bg_global_tab_exists: !!bgGlobalTab,
            bg_global_tab_parent_id: bgGlobalTab && bgGlobalTab.parentElement ? bgGlobalTab.parentElement.id : null,
            bg_global_tab_html_length: bgGlobalTab ? bgGlobalTab.innerHTML.length : null,
            bg_global_tab_preview: bgGlobalTab ? bgGlobalTab.innerHTML.substring(0, 200) : null,

            bg_chat_tab_exists: !!bgChatTab,
            bg_chat_tab_parent_id: bgChatTab && bgChatTab.parentElement ? bgChatTab.parentElement.id : null,
            bg_chat_tab_html_length: bgChatTab ? bgChatTab.innerHTML.length : null,
            bg_chat_tab_preview: bgChatTab ? bgChatTab.innerHTML.substring(0, 200) : null,

            // 检查是否有多个 bg_global_tab 或 bg_chat_tab
            bg_global_tab_count: document.querySelectorAll('#bg_global_tab').length,
            bg_chat_tab_count: document.querySelectorAll('#bg_chat_tab').length,

            // 检查第一个 sheld 的父链
            first_sheld_parent_chain: (function() {
                const sheld = document.querySelectorAll('#sheld')[0];
                if (!sheld) return null;
                const chain = [];
                let el = sheld;
                for (let i = 0; i < 5 && el; i++) {
                    chain.push({ tag: el.tagName, id: el.id, class: String(el.className).substring(0, 50) });
                    el = el.parentElement;
                }
                return chain;
            })(),

            // 检查第二个 sheld 的父链
            second_sheld_parent_chain: (function() {
                const sheld = document.querySelectorAll('#sheld')[1];
                if (!sheld) return null;
                const chain = [];
                let el = sheld;
                for (let i = 0; i < 5 && el; i++) {
                    chain.push({ tag: el.tagName, id: el.id, class: String(el.className).substring(0, 50) });
                    el = el.parentElement;
                }
                return chain;
            })(),

            // 关键：检查 jquery chatElement 初始化时指向哪个 #chat
            jquery_chat_element_position: (function() {
                // 模块加载时 $('#chat') 返回的是第一个匹配的元素
                // 但我们需要知道 script.js 是在 DOM 什么时候加载的
                // 让我们简单测试：第一个 #chat 是否是 visible 的
                const allChats = document.querySelectorAll('#chat');
                return Array.from(allChats).map((el, i) => {
                    const rect = el.getBoundingClientRect();
                    const computed = window.getComputedStyle(el);
                    return {
                        index: i,
                        parent_id: el.parentElement ? el.parentElement.id : null,
                        visible: computed.display !== 'none' && computed.visibility !== 'hidden' && rect.width > 0 && rect.height > 0,
                        display: computed.display,
                        visibility: computed.visibility,
                        rect_width: rect.width,
                        rect_height: rect.height,
                        child_count: el.children.length,
                        has_mes: el.querySelector('.mes') !== null,
                    };
                });
            })(),
        };
    });

    console.log('综合分析结果:');
    console.log(JSON.stringify(result, null, 2));

    const outputFile = path.join(process.cwd(), 'final-analysis.json');
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log('\n已保存到', outputFile);

    await browser.close();
})();
