import { chromium } from 'playwright';

(async () => {
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const browser = await chromium.launch({
        executablePath: chromePath,
        headless: true,
    });

    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ 'Cache-Control': 'no-cache' });

    // 监控网络请求
    const xhrRequests = [];
    page.on('request', (req) => {
        const url = req.url();
        if (req.resourceType() === 'xhr' || url.includes('chat.html') || url.includes('/')) {
            if (url.includes('settings') || url.includes('docs.sillytavern')) {
                xhrRequests.push({ url: url.substring(0, 80), method: req.method(), resourceType: req.resourceType() });
            }
        }
    });

    console.log('打开 chat.html...');
    await page.goto('http://127.0.0.1:8000/chat.html', { waitUntil: 'domcontentloaded', timeout: 60000 });

    // 在 tabs 初始化之前检查 DOM 状态
    const beforeResult = await page.evaluate(() => {
        const bgTabs = document.querySelector('#bg_tabs');
        if (!bgTabs) return { error: '#bg_tabs not found' };

        return {
            bg_tabs_children_count: bgTabs.children.length,
            bg_tabs_children: Array.from(bgTabs.children).map(c => c.tagName + (c.id ? '#' + c.id : '') + ' class=' + String(c.className).substring(0, 30)),
            bg_global_tab_html_size: document.querySelector('#bg_global_tab') ? document.querySelector('#bg_global_tab').innerHTML.length : 0,
            bg_chat_tab_html_size: document.querySelector('#bg_chat_tab') ? document.querySelector('#bg_chat_tab').innerHTML.length : 0,
        };
    });

    console.log('=== Tabs 初始化之前：');
    console.log(JSON.stringify(beforeResult, null, 2));

    // 等待 tabs 初始化
    await page.waitForTimeout(15000);

    const afterResult = await page.evaluate(() => {
        const bgTabs = document.querySelector('#bg_tabs');
        if (!bgTabs) return { error: '#bg_tabs not found' };

        return {
            bg_tabs_children_count: bgTabs.children.length,
            bg_tabs_children: Array.from(bgTabs.children).map(c => c.tagName + (c.id ? '#' + c.id : '') + ' class=' + String(c.className).substring(0, 50)),
            ui_id_4_found: document.querySelector('#ui-id-4') !== null,
            ui_id_4_html_size: document.querySelector('#ui-id-4') ? document.querySelector('#ui-id-4').innerHTML.length : 0,
            bg_global_tab_found: document.querySelector('#bg_global_tab') !== null,
            bg_global_tab_html_size: document.querySelector('#bg_global_tab') ? document.querySelector('#bg_global_tab').innerHTML.length : 0,
            chat_count: document.querySelectorAll('#chat').length,
        };
    });

    console.log('\n=== Tabs 初始化之后：');
    console.log(JSON.stringify(afterResult, null, 2));

    console.log('\n=== 监控的 XHR 请求：');
    console.log(JSON.stringify(xhrRequests, null, 2));

    await browser.close();
})();
