import { chromium } from 'playwright';

(async () => {
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const browser = await chromium.launch({
        executablePath: chromePath,
        headless: true,
    });

    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ 'Cache-Control': 'no-cache' });

    // 监控所有请求中的 chat.html 请求
    const chatHtmlRequests = [];
    page.on('request', (req) => {
        const url = req.url();
        if (url.includes('chat.html')) {
            chatHtmlRequests.push({
                url: url,
                method: req.method(),
                resourceType: req.resourceType(),
                headers: JSON.stringify(req.headers()).substring(0, 200),
            });
        }
    });

    console.log('打开 chat.html...');
    await page.goto('http://127.0.0.1:8000/chat.html', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(15000);

    // 检查 chat.html 请求
    console.log('\n=== chat.html 请求：');
    chatHtmlRequests.forEach((req, i) => {
        console.log(`[${i}] ${req.method} ${req.url} (${req.resourceType})`);
    });

    // 检查是否有 AJAX 请求获取 chat.html
    const result = await page.evaluate(() => {
        // 关键：检查 jQuery UI tabs 是否因为 href 属性问题发起了 AJAX 请求
        // 如果 href="#bg_global_tab" 中的 #bg_global_tab 在文档中找不到，
        // 或者 jQuery UI tabs 误认为需要远程加载内容，就会发起 AJAX 请求

        const uiId4 = document.getElementById('ui-id-4');
        const bgGlobalTab = document.getElementById('bg_global_tab');

        return {
            ui_id_4_innerHTML_preview: uiId4 ? uiId4.innerHTML.substring(0, 200) : null,
            bg_global_tab_in_dom: !!bgGlobalTab,
            bg_global_tab_in_bg_tabs: bgGlobalTab && bgGlobalTab.closest('#bg_tabs') !== null,
            bg_global_tab_children_count: bgGlobalTab ? bgGlobalTab.children.length : 0,

            // 关键：检查 #bg_global_tab 是否在初始化时被正确找到
            bg_global_tab_display: bgGlobalTab ? window.getComputedStyle(bgGlobalTab).display : null,
            bg_tabs_has_4_children: document.getElementById('bg_tabs').children.length,

            // 检查是否有重复的 bg_global_tab（在 ui-id-4 内）
            bg_global_tab_count: document.querySelectorAll('#bg_global_tab').length,
            second_bg_global_tab_parent: document.querySelectorAll('#bg_global_tab')[1] ?
                document.querySelectorAll('#bg_global_tab')[1].parentElement.id : 'NONE',
        };
    });

    console.log('\n=== 关键分析：');
    console.log(JSON.stringify(result, null, 2));

    // 现在，让我测试真正的修复方案
    console.log('\n=== 测试真正的修复方案 ===');
    console.log('方案：确保 #bg_tabs 内只有 <ul> 和对应的 tab panel，没有其他 div');

    // 在页面上应用修复
    const fixResult = await page.evaluate(() => {
        // 清理重复的元素
        const bgTabs = document.getElementById('bg_tabs');
        const uiId4 = document.getElementById('ui-id-4');
        const uiId6 = document.getElementById('ui-id-6');
        const secondSheld = document.querySelectorAll('#sheld')[1];
        const secondChat = document.querySelectorAll('#chat')[1];

        // 检查 chatElement 是否指向正确的元素
        console.log('（在浏览器中）清理前：');
        console.log('  #chat 元素数量：', document.querySelectorAll('#chat').length);
        console.log('  chatElement：', window.$('#chat').length ? '找到' : '未找到');
        console.log('  chatElement 第一个孩子：', window.$('#chat')[0] && window.$('#chat')[0].children[0] ? window.$('#chat')[0].children[0].className : '无');

        // 清理重复的元素
        if (uiId4) uiId4.remove();
        if (uiId6) uiId6.remove();

        console.log('\n（在浏览器中）清理后：');
        console.log('  #chat 元素数量：', document.querySelectorAll('#chat').length);
        console.log('  chatElement：', window.$('#chat').length ? '找到' : '未找到');
        console.log('  chatElement 是否可见：', window.$('#chat')[0] ? (() => {
            const r = window.$('#chat')[0].getBoundingClientRect();
            return r.width > 0 && r.height > 0 ? '可见' : '不可见';
        })() : '未知');

        // 检查 chatElement 现在是否指向正确的元素
        const chatEl = window.$('#chat')[0];
        return {
            chat_element_found: !!chatEl,
            chat_element_first_child: chatEl && chatEl.children[0] ? chatEl.children[0].className : '无',
            chat_element_visible: chatEl ? (() => {
                const r = chatEl.getBoundingClientRect();
                return r.width > 0 && r.height > 0;
            })() : false,
            total_chat_elements: document.querySelectorAll('#chat').length,
        };
    });

    console.log('\n清理结果：');
    console.log(JSON.stringify(fixResult, null, 2));

    await browser.close();
})();
