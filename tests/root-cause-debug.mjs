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

    // 1. 检查 jQuery UI tabs 的初始化代码
    const initCode = await page.evaluate(() => {
        // 检查 #bg_tabs 的 HTML 结构是否有问题
        const bgTabs = document.getElementById('bg_tabs');
        if (!bgTabs) return { error: '#bg_tabs not found' };

        // 关键检查：jQuery UI tabs 在查找 tab 链接时，
        // 它查找的是 #bg_tabs > ul > li > a。
        // 但也许 #bg_tabs 的某些结构导致了问题。

        const ul = bgTabs.querySelector('ul');
        const ulContent = ul ? ul.innerHTML.substring(0, 300) : null;

        return {
            bg_tabs_innerHTML_preview: bgTabs.innerHTML.substring(0, 500),
            ul_content: ulContent,
            bg_tabs_tagName: bgTabs.tagName,
            bg_tabs_parent_id: bgTabs.parentElement ? bgTabs.parentElement.id : null,
        };
    });

    console.log('=== #bg_tabs 结构预览：');
    console.log(JSON.stringify(initCode, null, 2));

    // 2. 检查 jQuery UI tabs 初始化时的 AJAX 请求
    console.log('\n=== 检查 jQuery UI tabs AJAX 请求来源：');
    const requestSource = await page.evaluate(() => {
        // 关键：jQuery UI tabs 在处理 #bg_tabs 时，可能因为某些原因
        // 把 #bg_global_tab 和 #bg_chat_tab 当作了远程内容
        // 或者有其他配置问题

        // 检查 ul > li > a 中的 href 是否有问题
        const links = document.querySelectorAll('#bg_tabs > ul > li > a');
        return Array.from(links).map((a, i) => ({
            index: i,
            href: a.getAttribute('href'),
            text: a.textContent.substring(0, 30),
            outerHTML: a.outerHTML.substring(0, 150),
        }));
    });

    console.log(JSON.stringify(requestSource, null, 2));

    // 3. 等待 tabs 初始化完成后检查状态
    await page.waitForTimeout(15000);

    const afterTabs = await page.evaluate(() => {
        const uiId4 = document.getElementById('ui-id-4');
        const uiId6 = document.getElementById('ui-id-6');
        const bgGlobalTab = document.getElementById('bg_global_tab');
        const bgChatTab = document.getElementById('bg_chat_tab');

        return {
            ui_id_4_exists: !!uiId4,
            ui_id_6_exists: !!uiId6,
            bg_global_tab_exists: !!bgGlobalTab,
            bg_chat_tab_exists: !!bgChatTab,
            ui_id_4_parent: uiId4 ? uiId4.parentElement.id : null,
            bg_global_tab_parent: bgGlobalTab ? bgGlobalTab.parentElement.id : null,
            total_chat_elements: document.querySelectorAll('#chat').length,
        };
    });

    console.log('\n=== Tabs 初始化后关键元素状态：');
    console.log(JSON.stringify(afterTabs, null, 2));

    await browser.close();
})();
