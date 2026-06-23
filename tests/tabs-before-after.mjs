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

    // 在页面加载时，在 jQuery UI tabs 初始化之前就捕获 DOM 状态
    // 我们通过 CDPSession 注入早期的 console.log 来跟踪

    console.log('打开 chat.html...');

    // 第一步：加载页面，等待 DOM ready，但在 jQuery UI tabs 运行之前就中断
    await page.goto('http://127.0.0.1:8000/chat.html', { waitUntil: 'domcontentloaded', timeout: 60000 });

    // 在 DOM ready 之后，立即检查状态
    const beforeTabsResult = await page.evaluate(() => {
        return {
            bg_tabs_children_count: document.querySelector('#bg_tabs') ? document.querySelector('#bg_tabs').children.length : null,
            bg_tabs_children: document.querySelector('#bg_tabs') ? Array.from(document.querySelector('#bg_tabs').children).map(c => c.tagName + (c.id ? '#' + c.id : '')).slice(0, 10) : null,
            bg_global_tab_count: document.querySelectorAll('#bg_global_tab').length,
            bg_chat_tab_count: document.querySelectorAll('#bg_chat_tab').length,
            sheld_count: document.querySelectorAll('#sheld').length,
            chat_count: document.querySelectorAll('#chat').length,
            bg_tabs_html_length: document.querySelector('#bg_tabs') ? document.querySelector('#bg_tabs').innerHTML.length : null,
        };
    });

    console.log('\n=== DOM ready 时 (jQuery UI tabs 可能还没初始化) ===');
    console.log(JSON.stringify(beforeTabsResult, null, 2));

    // 等待 10 秒，让 jQuery UI tabs 初始化完成
    await page.waitForTimeout(10000);

    const afterTabsResult = await page.evaluate(() => {
        return {
            bg_tabs_children_count: document.querySelector('#bg_tabs').children.length,
            bg_tabs_children: Array.from(document.querySelector('#bg_tabs').children).map(c => c.tagName + (c.id ? '#' + c.id : '')),
            bg_tabs_html_length: document.querySelector('#bg_tabs').innerHTML.length,
            bg_global_tab_count: document.querySelectorAll('#bg_global_tab').length,
            bg_chat_tab_count: document.querySelectorAll('#bg_chat_tab').length,
            sheld_count: document.querySelectorAll('#sheld').length,
            chat_count: document.querySelectorAll('#chat').length,
        };
    });

    console.log('\n=== jQuery UI tabs 初始化完成后 ===');
    console.log(JSON.stringify(afterTabsResult, null, 2));

    // 关键检查：第二个 #bg_global_tab 的位置（如果有的话）
    const extraTabResult = await page.evaluate(() => {
        const allBgGlobalTabs = document.querySelectorAll('#bg_global_tab');
        const result = [];
        for (let i = 0; i < allBgGlobalTabs.length; i++) {
            const el = allBgGlobalTabs[i];
            let parent = el.parentElement;
            const parentChain = [];
            for (let j = 0; j < 5 && parent; j++) {
                parentChain.push(parent.tagName + (parent.id ? '#' + parent.id : ''));
                parent = parent.parentElement;
            }
            result.push({
                index: i,
                parent_chain: parentChain,
                html_length: el.innerHTML.length,
                in_bg_tabs: el.parentElement && el.parentElement.id === 'bg_tabs',
            });
        }

        // 同样检查 #bg_chat_tab
        const allBgChatTabs = document.querySelectorAll('#bg_chat_tab');
        const chatTabResult = [];
        for (let i = 0; i < allBgChatTabs.length; i++) {
            const el = allBgChatTabs[i];
            let parent = el.parentElement;
            const parentChain = [];
            for (let j = 0; j < 5 && parent; j++) {
                parentChain.push(parent.tagName + (parent.id ? '#' + parent.id : ''));
                parent = parent.parentElement;
            }
            chatTabResult.push({
                index: i,
                parent_chain: parentChain,
                html_length: el.innerHTML.length,
                in_bg_tabs: el.parentElement && el.parentElement.id === 'bg_tabs',
            });
        }

        return { bg_global_tabs: result, bg_chat_tabs: chatTabResult };
    });

    console.log('\n=== bg_global_tab 和 bg_chat_tab 详细位置 ===');
    console.log(JSON.stringify(extraTabResult, null, 2));

    const outputFile = path.join(process.cwd(), 'tabs-before-after.json');
    fs.writeFileSync(outputFile, JSON.stringify({ beforeTabsResult, afterTabsResult, extraTabResult }, null, 2));
    console.log('\n已保存到', outputFile);

    await browser.close();
})();
