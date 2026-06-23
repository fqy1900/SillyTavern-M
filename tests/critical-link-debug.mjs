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

    // 在 jQuery UI tabs 初始化之前，检查 #bg_tabs 内的所有 <a> 链接
    const result = await page.evaluate(() => {
        const bgTabs = document.querySelector('#bg_tabs');
        if (!bgTabs) return { error: '#bg_tabs not found' };

        // 查找所有 <a> 标签
        const allLinks = bgTabs.querySelectorAll('a');
        const ulLinks = bgTabs.querySelectorAll('ul > li > a');

        // 不在 ul 内的链接
        const nonUlLinks = [];
        allLinks.forEach((a, i) => {
            const inUl = a.closest('ul') !== null;
            const href = a.getAttribute('href');
            if (!inUl) {
                nonUlLinks.push({
                    index: i,
                    href: href,
                    text: a.textContent.substring(0, 30),
                    parent_id: a.parentElement ? a.parentElement.id : null,
                    parent_class: a.parentElement ? String(a.parentElement.className).substring(0, 30) : null,
                });
            }
        });

        // 检查 #bg_global_tab 和 #bg_chat_tab 中是否有 <a> 标签
        const bgGlobalTabLinks = document.querySelectorAll('#bg_global_tab a');
        const bgChatTabLinks = document.querySelectorAll('#bg_chat_tab a');

        return {
            all_links_count: allLinks.length,
            ul_links_count: ulLinks.length,
            non_ul_links_count: nonUlLinks.length,
            non_ul_links: nonUlLinks.slice(0, 10),
            bg_global_tab_links: Array.from(bgGlobalTabLinks).slice(0, 5).map(a => ({
                href: a.getAttribute('href'),
                text: a.textContent.substring(0, 30),
            })),
            bg_chat_tab_links: Array.from(bgChatTabLinks).slice(0, 5).map(a => ({
                href: a.getAttribute('href'),
                text: a.textContent.substring(0, 30),
            })),
        };
    });

    console.log('=== 关键分析：#bg_tabs 中链接的结构：');
    console.log(JSON.stringify(result, null, 2));

    await browser.close();
})();
