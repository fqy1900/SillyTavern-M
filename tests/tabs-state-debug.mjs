import { chromium } from 'playwright';

(async () => {
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const browser = await chromium.launch({
        executablePath: chromePath,
        headless: true,
    });

    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ 'Cache-Control': 'no-cache' });

    console.log('打开 chat.html...');
    await page.goto('http://127.0.0.1:8000/chat.html', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(15000);

    const result = await page.evaluate(() => {
        // 检查 jQuery UI tabs 的配置
        // 看看是否有什么特殊的配置导致了问题

        const bgTabs = document.getElementById('bg_tabs');
        const bgGlobalTab = document.getElementById('bg_global_tab');
        const bgChatTab = document.getElementById('bg_chat_tab');

        // 检查 jQuery UI tabs 的 data
        let tabsData = null;
        try {
            tabsData = window.$('#bg_tabs').tabs('option');
        } catch (e) {
            // 可能不支持直接获取所有选项
        }

        // 检查 tab panel 的 role 属性
        const tabPanels = document.querySelectorAll('#bg_tabs [role="tabpanel"]');
        const panelInfo = Array.from(tabPanels).map((panel, i) => ({
            index: i,
            id: panel.id,
            class: panel.className.substring(0, 60),
            aria_labelledby: panel.getAttribute('aria-labelledby'),
            display: panel.style.display,
            parent_id: panel.parentElement ? panel.parentElement.id : null,
            innerHTML_length: panel.innerHTML.length,
        }));

        // 检查 jQuery UI tabs 的事件处理
        // 关键：检查 tab 链接是否正确地指向 panel
        const tabLinks = document.querySelectorAll('#bg_tabs [role="tab"]');
        const linkInfo = Array.from(tabLinks).map((link, i) => ({
            index: i,
            href: link.getAttribute('href'),
            aria_controls: link.getAttribute('aria-controls'),
            id: link.id,
        }));

        return {
            bg_tabs_class: bgTabs ? bgTabs.className.substring(0, 60) : null,
            bg_global_tab_class: bgGlobalTab ? bgGlobalTab.className.substring(0, 60) : null,
            bg_chat_tab_class: bgChatTab ? bgChatTab.className.substring(0, 60) : null,
            bg_global_tab_has_role: bgGlobalTab ? bgGlobalTab.getAttribute('role') : null,
            bg_chat_tab_has_role: bgChatTab ? bgChatTab.getAttribute('role') : null,
            tab_panels: panelInfo,
            tab_links: linkInfo,
            tabs_options: tabsData ? Object.keys(tabsData) : null,
        };
    });

    console.log('=== jQuery UI tabs 状态分析：');
    console.log(JSON.stringify(result, null, 2));

    await browser.close();
})();
