import { chromium } from 'playwright';

(async () => {
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const browser = await chromium.launch({
        executablePath: chromePath,
        headless: true,
    });

    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ 'Cache-Control': 'no-cache' });

    // 监控所有 xhr 请求
    const xhrUrls = [];
    page.on('request', (req) => {
        if (req.resourceType() === 'xhr') {
            xhrUrls.push(req.url());
        }
    });

    console.log('打开 chat.html...');
    await page.goto('http://127.0.0.1:8000/chat.html', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(15000);

    const result = await page.evaluate(() => {
        // 找出所有 tab panel 的 id 和内容
        const bgTabs = document.querySelector('#bg_tabs');
        const tabPanels = bgTabs ? bgTabs.querySelectorAll('[role="tabpanel"]') : [];

        const panelInfo = [];
        tabPanels.forEach((panel, i) => {
            panelInfo.push({
                index: i,
                id: panel.id,
                class: panel.className.substring(0, 60),
                innerHTML_length: panel.innerHTML.length,
                has_title_tag: panel.querySelector('title') !== null,
                has_sheld: panel.querySelector('#sheld') !== null,
                has_chat: panel.querySelector('#chat') !== null,
            });
        });

        // 检查 #ui-id-4 的来源
        const uiId4 = document.querySelector('#ui-id-4');
        const uiId4Info = uiId4 ? {
            id: uiId4.id,
            first_child_tag: uiId4.children[0] ? uiId4.children[0].tagName : null,
            first_10_children_ids: Array.from(uiId4.children).slice(0, 10).map(c => c.id || c.tagName),
            innerHTML_preview: uiId4.innerHTML.substring(0, 300),
        } : null;

        return {
            tab_panel_count: tabPanels.length,
            panels: panelInfo,
            ui_id_4: uiId4Info,

            // 关键：检查 bg_tabs 中的所有 panel 元素
            bg_tabs_all_divs_with_id: Array.from(document.querySelectorAll('#bg_tabs [id]')).slice(0, 10).map(el => ({
                id: el.id,
                class: el.className.substring(0, 40),
            })),
        };
    });

    console.log('=== Tab panel 详情：');
    console.log(JSON.stringify(result, null, 2));

    console.log('\n=== XHR 请求 URL：');
    console.log(xhrUrls.filter(url => url.includes('chat.html') || url.length < 50).map(url => url.substring(0, 80)).join('\n'));

    await browser.close();
})();
