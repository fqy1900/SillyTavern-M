import { chromium } from 'playwright';

(async () => {
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const browser = await chromium.launch({
        executablePath: chromePath,
        headless: true,
    });

    const page = await browser.newPage();

    // 禁用缓存
    await page.setExtraHTTPHeaders({ 'Cache-Control': 'no-cache' });

    console.log('打开 chat.html（禁用缓存）...');
    await page.goto('http://127.0.0.1:8000/chat.html', { waitUntil: 'domcontentloaded', timeout: 60000 });

    const beforeResult = await page.evaluate(() => {
        const bgTabs = document.querySelector('#bg_tabs');
        return {
            bg_tabs_child_count: bgTabs ? bgTabs.children.length,
            bg_tabs_children: bgTabs ? Array.from(bgTabs.children).map(c => c.tagName + '#' + c.id).slice(0, 6) : [],
            bg_tabs_html_size: bgTabs ? bgTabs.innerHTML.length,
            bg_global_tab_position: document.querySelector('#bg_global_tab') ? document.querySelector('#bg_global_tab').getBoundingClientRect() : null,
        };
    });

    console.log('=== DOM 加载后（tabs 初始化前）:');
    console.log(JSON.stringify(beforeResult, null, 2));

    await page.waitForTimeout(15000);

    const afterResult = await page.evaluate(() => {
        const bgTabs = document.querySelector('#bg_tabs');
        const uiId4 = document.querySelector('#ui-id-4');
        const uiId6 = document.querySelector('#ui-id-6');
        const allBGTab = document.querySelector('#bg_global_tab');

        return {
            bg_tabs_child_count: bgTabs ? bgTabs.children.length,
            bg_tabs_children: bgTabs ? Array.from(bgTabs.children).map(c => c.tagName + '#' + c.id).slice(0, 8) : [],
            bg_tabs_html_size: bgTabs ? bgTabs.innerHTML.length,
            ui_id_4_size: uiId4 ? uiId4.innerHTML.length : 0,
            ui_id_4_parent_id: uiId4 ? uiId4.parentElement ? uiId4.parentElement.id : null : null,
            ui_id_6_size: uiId6 ? uiId6.innerHTML.length : 0,
            bg_global_tab_parent: allBGTab ? allBGTab.parentElement.id : null,

            // 关键：检查 jQuery UI tabs 是否有 data-ui-tabs
            has_data_ui_tabs: bgTabs ? !!window.$(bgTabs).data('ui-tabs') : false,

            // 检查 ui-id-4 第一个孩子是什么
            ui_id_4_first_3_children: uiId4 ? Array.from(uiId4.children).slice(0, 3).map(c => c.tagName + '#' + c.id) : null,

            // 检查 ui-id-4 是否是原来的 #bg_global_tab 被重命名了
            bg_global_tab_has_ui_id_attr: allBGTab ? allBGTab.getAttribute('id') : null,
        };
    });

    console.log('\n=== jQuery UI tabs 初始化后：');
    console.log(JSON.stringify(afterResult, null, 2));

    // 关键测试：手动在浏览器中测试 tabs() 调用
    const testResult = await page.evaluate(() => {
        // 找到 #bg_tabs，手动测试 tabs 行为
        // 检查原始的 tab <li><a href="#bg_global_tab"> 和 <a href="#bg_chat_tab"</a>
        const bgGlobalTabLink = document.querySelector('#bg_tabs a[href="#bg_global_tab"]');
        const bgChatTabLink = document.querySelector('#bg_tabs a[href="#bg_chat_tab"]');

        return {
            bg_global_tab_link_found: !!bgGlobalTabLink,
            bg_chat_tab_link_found: !!bgChatTabLink,
            bg_global_tab_link_parent: bgGlobalTabLink ? bgGlobalTabLink.parentElement.tagName + '#' + bgGlobalTabLink.parentElement.id : null,

            // 检查这些链接是否被 jQuery UI tabs 识别
            bg_global_tab_link_has_ui_tabs_attr: bgGlobalTabLink ? bgGlobalTabLink.getAttribute('role') : null,
            bg_global_tab_link_has_ui_id: bgGlobalTabLink ? !!document.querySelector('#ui-id-4') : true,

            // 检查 #bg_global_tab 的位置（是否被移动到 #bg_tabs 外部）
            bg_global_tab_position: (() => {
                const el = document.querySelector('#bg_global_tab');
                if (!el) return 'not found';
                let parent = el.parentElement;
                const chain = [];
                while (parent) {
                    chain.push(parent.tagName + '#' + parent.id);
                    parent = parent.parentElement;
                }
                return chain;
            })(),
        };
    });

    console.log('\n=== Tab 链接分析：');
    console.log(JSON.stringify(testResult, null, 2));

    await browser.close();
})();
