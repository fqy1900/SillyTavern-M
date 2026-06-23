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
    await page.goto('http://127.0.0.1:8000/chat.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(15000);

    const result = await page.evaluate(() => {
        const bgTabs = document.querySelector('#bg_tabs');
        const uiId4 = document.querySelector('#ui-id-4');
        const bgGlobalTab = document.querySelector('#bg_global_tab');
        const bgChatTab = document.querySelector('#bg_chat_tab');
        const allChatEls = document.querySelectorAll('#chat');
        const allSheldEls = document.querySelectorAll('#sheld');

        return {
            bg_tabs_children_count: bgTabs ? bgTabs.children.length : 0,
            bg_tabs_children_ids: bgTabs ? Array.from(bgTabs.children).map(c => c.tagName + '#' + c.id + ' class=' + String(c.className).substring(0, 30)) : [],
            ui_id_4_exists: !!uiId4,
            ui_id_4_content_size: uiId4 ? uiId4.innerHTML.length : 0,
            ui_id_4_first_child: uiId4 && uiId4.children[0] ? uiId4.children[0].tagName + '#' + uiId4.children[0].id : null,
            ui_id_4_inner_html_preview: uiId4 ? uiId4.innerHTML.substring(0, 200) : null,
            bg_global_tab_in_bg_tabs: bgTabs && bgGlobalTab && bgTabs.contains(bgGlobalTab),
            bg_chat_tab_in_bg_tabs: bgTabs && bgChatTab && bgTabs.contains(bgChatTab),
            chat_elements_count: allChatEls.length,
            sheld_elements_count: allSheldEls.length,
            chat_element_0_parent: allChatEls[0] && allChatEls[0].parentElement ? allChatEls[0].parentElement.id : null,
            chat_element_1_parent: allChatEls[1] && allChatEls[1].parentElement ? allChatEls[1].parentElement.id : null,

            // 关键：检查 tabs 是否通过网络请求获取了内容
            // ui-id-4 含了整个 HTML，说明 jQuery UI tabs 可能通过 URL 请求了 #bg_global_tab 的内容
            // 让我们检查 #bg_global_tab 的原始结构是否正确
            bg_global_tab_has_content: bgGlobalTab ? bgGlobalTab.innerHTML.length : 0,
            bg_global_tab_preview: bgGlobalTab ? bgGlobalTab.innerHTML.substring(0, 200) : null,
        };
    });

    console.log('=== 结果:');
    console.log(JSON.stringify(result, null, 2));

    // 检查 tabs 调用前后
    const result2 = await page.evaluate(() => {
        // 关键洞察：jQuery UI tabs 的工作流程
        // 1. 查找 #bg_tabs 中所有 <a href="#panel-id">
        // 2. 查找 document.getElementById('panel-id') 作为 tab panel
        // 3. 如果找不到 panel，可能有异常行为

        // 让我们手动检查 #bg_global_tab 本身是否有问题
        const bgGlobalTab = document.getElementById('bg_global_tab');
        const bgChatTab = document.getElementById('bg_chat_tab');
        const bgTabs = document.getElementById('bg_tabs');

        return {
            bg_global_tab_id: bgGlobalTab ? bgGlobalTab.id : 'NOT FOUND',
            bg_global_tab_in_bg_tabs: bgGlobalTab && bgTabs && bgTabs.contains(bgGlobalTab),
            bg_global_tab_parent_id: bgGlobalTab && bgGlobalTab.parentElement ? bgGlobalTab.parentElement.id : null,
            bg_chat_tab_parent_id: bgChatTab && bgChatTab.parentElement ? bgChatTab.parentElement.id : null,

            // 检查 #ui-id-4 的内容是否有完整的 #sheld 和 #chat
            ui_id_4_has_sheld: document.querySelector('#ui-id-4 #sheld') !== null,
            ui_id_4_has_chat: document.querySelector('#ui-id-4 #chat') !== null,

            // 检查第二个 #sheld 的位置
            second_sheld_parent_chain: (() => {
                const allShelds = document.querySelectorAll('#sheld');
                if (allShelds.length < 2) return '只有一个 sheld';
                let parent = allShelds[0].parentElement;
                const chain = [];
                while (parent) {
                    chain.push(parent.tagName + '#' + parent.id);
                    parent = parent.parentElement;
                }
                return chain.slice(0, 10);
            })(),
        };
    });

    console.log('\n=== 更深层次分析：');
    console.log(JSON.stringify(result2, null, 2));

    await browser.close();
})();
