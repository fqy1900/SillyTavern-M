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

    // 监控网络请求
    const requests = [];
    page.on('request', (req) => {
        const url = req.url();
        if (url.includes('bg_global_tab') || url.includes('bg_chat_tab') || url.includes('ui-id')) {
            requests.push(url);
        }
    });

    console.log('打开 chat.html...');
    await page.goto('http://127.0.0.1:8000/chat.html', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(10000);

    const result = await page.evaluate(() => {
        const bgTabs = window.$('#bg_tabs');

        return {
            tabs_found: bgTabs.length,
            tabs_data_ui_tabs: !!bgTabs.data('ui-tabs'),
            // 检查 tab 配置
            tabs_options: bgTabs.data('ui-tabs') ? Object.keys(bgTabs.data('ui-tabs').options || {}) : null,

            // 检查 #bg_global_tab 和 #bg_chat_tab 是否在 #bg_tabs 内部
            bg_global_tab_in_tabs: window.$('#bg_tabs').find('#bg_global_tab').length > 0,
            bg_chat_tab_in_tabs: window.$('#bg_tabs').find('#bg_chat_tab').length > 0,

            // 检查 document 中这些 ID 的数量
            bg_global_tab_count: document.querySelectorAll('#bg_global_tab').length,
            bg_chat_tab_count: document.querySelectorAll('#bg_chat_tab').length,

            // 检查第一个 ui-id-4 面板是否是通过 ajax 加载的
            ui_id_4_content_preview: document.querySelector('#ui-id-4') ? document.querySelector('#ui-id-4').innerHTML.substring(0, 200) : null,

            // 检查 jQuery tabs 是否有 AJAX 调用
            // jQuery UI tabs 会把 href 不是 #id 的当作远程 URL 加载
            tab_anchors: Array.from(document.querySelectorAll('#bg_tabs a')).map(a => ({
                href: a.getAttribute('href'),
                text: a.textContent,
            })),

            // 检查 bg_global_tab 的父元素
            bg_global_tab_parent: document.querySelector('#bg_global_tab') ? document.querySelector('#bg_global_tab').parentElement.id : null,
            bg_chat_tab_parent: document.querySelector('#bg_chat_tab') ? document.querySelector('#bg_chat_tab').parentElement.id : null,
        };
    });

    console.log('Tabs 分析:');
    console.log(JSON.stringify(result, null, 2));
    console.log('\n可疑请求:', requests);

    const outputFile = path.join(process.cwd(), 'tabs-analysis-debug.json');
    fs.writeFileSync(outputFile, JSON.stringify({result, requests}, null, 2));
    console.log('\n已保存到', outputFile);

    await browser.close();
})();
