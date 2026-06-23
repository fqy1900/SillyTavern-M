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
        // 关键检查：jQuery UI tabs 在 #bg_tabs > ul 中查找 tab 链接
        const ul = document.querySelector('#bg_tabs > ul');
        if (!ul) return { error: '没有找到 ul' };

        // 检查 ul 内的所有 <a> 标签
        const allLinks = ul.querySelectorAll('a');
        const linkDetails = [];
        allLinks.forEach((a, i) => {
            linkDetails.push({
                index: i,
                href: a.getAttribute('href'),
                text: a.textContent.substring(0, 30),
                parent_tag: a.parentElement.tagName,
                role: a.getAttribute('role'),
            });
        });

        // 检查 ul 的所有子元素
        const allChildren = [];
        Array.from(ul.children).forEach((child, i) => {
            allChildren.push({
                index: i,
                tag: child.tagName,
                class: child.className.substring(0, 50),
                has_a_tag: child.querySelector('a') !== null,
                innerHTML_length: child.innerHTML.length,
            });
        });

        return {
            ul_children_count: ul.children.length,
            all_ul_children: allChildren,
            all_links_in_ul: linkDetails,
        };
    });

    console.log('=== #bg_tabs > ul 结构分析：');
    console.log(JSON.stringify(result, null, 2));

    // 还需要检查 jQuery UI tabs 是如何解析 tab panel 的
    const result2 = await page.evaluate(() => {
        // jQuery UI tabs 的查找逻辑：
        // 1. 对于每个 <a href="#xxx"> 在 ul 中
        // 2. 查找 document.getElementById('xxx')
        // 3. 这个元素应该是 tab panel

        // 让我们模拟这个过程
        const ul = document.querySelector('#bg_tabs > ul');
        if (!ul) return { error: '没有找到 ul' };

        const links = ul.querySelectorAll('a');
        const linkInfo = [];
        links.forEach((a, i) => {
            const href = a.getAttribute('href');
            if (href && href.startsWith('#')) {
                const panelId = href.substring(1);
                const panel = document.getElementById(panelId);
                linkInfo.push({
                    index: i,
                    href: href,
                    panel_id: panelId,
                    panel_found: !!panel,
                    panel_in_bg_tabs: panel && panel.closest('#bg_tabs') !== null,
                    panel_class: panel ? panel.className.substring(0, 60) : null,
                    panel_content_size: panel ? panel.innerHTML.length : 0,
                });
            } else {
                linkInfo.push({
                    index: i,
                    href: href,
                    note: '不是 anchor 链接，可能会触发 AJAX',
                });
            }
        });

        // 检查是否有额外的链接在 bg_tabs 中
        const allLinksInBgTabs = document.querySelectorAll('#bg_tabs a');
        const bgTabsLinkSummary = [];
        allLinksInBgTabs.forEach((a, i) => {
            bgTabsLinkSummary.push({
                index: i,
                href: a.getAttribute('href'),
                parent_in_ul: a.closest('ul') !== null,
                text: a.textContent.substring(0, 20),
            });
        });

        return {
            tab_links_analysis: linkInfo,
            all_links_in_bg_tabs: bgTabsLinkSummary.slice(0, 10),
            total_links_in_bg_tabs: allLinksInBgTabs.length,
        };
    });

    console.log('\n=== Tab links 详情分析：');
    console.log(JSON.stringify(result2, null, 2));

    await browser.close();
})();
