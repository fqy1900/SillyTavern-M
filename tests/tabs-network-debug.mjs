import { chromium } from 'playwright';

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
        if (url.includes('bg_global_tab') || url.includes('bg_chat_tab') || url.includes('tabs') || url.includes('/')) {
            requests.push({ url, method: req.method(), resourceType: req.resourceType() });
        }
    });

    await page.setExtraHTTPHeaders({ 'Cache-Control': 'no-cache' });
    console.log('打开 chat.html...');
    await page.goto('http://127.0.0.1:8000/chat.html', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(15000);

    const result = await page.evaluate(() => {
        // 手动测试 jQuery UI tabs 的行为
        // 检查 tab 链接的 role 属性
        const tabLinks = document.querySelectorAll('#bg_tabs a');
        const linkInfo = [];
        tabLinks.forEach((a, i) => {
            linkInfo.push({
                index: i,
                href: a.getAttribute('href'),
                role: a.getAttribute('role'),
                text: a.textContent.substring(0, 30),
            });
        });

        // 手动检查：直接检查 jQuery UI tabs 的初始化结果
        // jQuery UI tabs 会给 panel 元素加 role="tabpanel"
        const panelElements = document.querySelectorAll('#bg_tabs [role="tabpanel"]');
        const panelInfo = [];
        panelElements.forEach((panel, i) => {
            panelInfo.push({
                index: i,
                id: panel.id,
                class: panel.className.substring(0, 50),
                innerHTML_length: panel.innerHTML.length,
            });
        });

        // 检查 ui-id-4 的内容来源
        const uiId4 = document.querySelector('#ui-id-4');

        return {
            tab_links: linkInfo.slice(0, 5),
            tab_panels: panelInfo,
            ui_id_4_first_5_children: uiId4 ? Array.from(uiId4.children).slice(0, 5).map(c => c.tagName + '#' + c.id) : null,
            ui_id_4_children_count: uiId4 ? uiId4.children.length : 0,

            // 关键：检查 ui-id-4 内是否有完整的 HTML 文档结构
            ui_id_4_has_title: uiId4 ? uiId4.querySelector('title') !== null : false,
            ui_id_4_has_sheld: uiId4 ? uiId4.querySelector('#sheld') !== null : false,
            ui_id_4_has_chat: uiId4 ? uiId4.querySelector('#chat') !== null : false,
        };
    });

    console.log('=== Tab 链接和 panel 分析：');
    console.log(JSON.stringify(result, null, 2));

    // 现在让我看看网络请求
    console.log('\n=== 网络请求（与 bg tab 相关）：');
    console.log(JSON.stringify(requests, null, 2));

    await browser.close();
})();
