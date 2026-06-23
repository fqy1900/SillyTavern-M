import { chromium } from 'playwright';

(async () => {
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const browser = await chromium.launch({
        executablePath: chromePath,
        headless: true,
    });

    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ 'Cache-Control': 'no-cache' });

    console.log('打开 chat.html (在加载完成时检查)...');
    await page.goto('http://127.0.0.1:8000/chat.html', { waitUntil: 'domcontentloaded', timeout: 60000 });

    const checkResult = await page.evaluate(() => {
        const bgTabs = document.getElementById('bg_tabs');
        if (!bgTabs) return { error: '#bg_tabs not found' };

        // 检查 #bg_tabs 中的所有 <a> 标签
        const allAnchors = bgTabs.querySelectorAll('a');
        const anchorInfo = Array.from(allAnchors).map((a, i) => ({
            index: i,
            tag: a.tagName,
            href: a.getAttribute('href'),
            parent_tag: a.parentElement.tagName,
            parent_id: a.parentElement.id || null,
            parent_class: String(a.parentElement.className).substring(0, 40),
        }));

        // 检查 heading-controls 中的具体内容
        const headingControls = bgTabs.querySelector('.heading-controls');
        const headingControlsInfo = headingControls ? {
            innerHTML_length: headingControls.innerHTML.length,
            innerHTML_preview: headingControls.innerHTML.substring(0, 500),
            child_count: headingControls.children.length,
            children: Array.from(headingControls.children).slice(0, 10).map(c => c.tagName + (c.id ? '#' + c.id : '') + ' class=' + String(c.className).substring(0, 30)),
        } : null;

        // 关键检查：检查 heading-controls 的所有子元素中是否有 href
        const allElementsInHeadingControls = headingControls ? Array.from(headingControls.querySelectorAll('*')) : [];
        const elementsWithHref = [];
        allElementsInHeadingControls.forEach((el, i) => {
            const href = el.getAttribute && el.getAttribute('href');
            if (href) {
                elementsWithHref.push({
                    index: i,
                    tag: el.tagName,
                    href: href.substring(0, 50),
                    parent_id: el.parentElement ? el.parentElement.id : null,
                });
            }
        });

        return {
            all_anchors_in_bg_tabs: anchorInfo,
            heading_controls: headingControlsInfo,
            elements_with_href_in_heading_controls: elementsWithHref,
            total_anchors: allAnchors.length,
        };
    });

    console.log('=== #bg_tabs 结构分析：');
    console.log(JSON.stringify(checkResult, null, 2));

    // 等待 jQuery UI tabs 初始化完成
    await page.waitForTimeout(15000);

    const afterResult = await page.evaluate(() => {
        // 检查 #bg_tabs 中的 tab 链接（带有 role="tab"）
        const roleTabs = document.querySelectorAll('#bg_tabs [role="tab"]');
        const roleTabInfo = Array.from(roleTabs).map((tab, i) => ({
            index: i,
            tag: tab.tagName,
            href: tab.getAttribute('href'),
            aria_controls: tab.getAttribute('aria-controls'),
            parent_tag: tab.parentElement.tagName,
            text: tab.textContent.substring(0, 30),
        }));

        // 检查 #ui-id-4
        const uiId4 = document.getElementById('ui-id-4');
        const uiId4Info = uiId4 ? {
            innerHTML_preview: uiId4.innerHTML.substring(0, 300),
            children_count: uiId4.children.length,
            has_title_tag: uiId4.querySelector('title') !== null,
            has_sheld: uiId4.querySelector('#sheld') !== null,
            has_chat: uiId4.querySelector('#chat') !== null,
        } : null;

        return {
            role_tabs: roleTabInfo,
            ui_id_4: uiId4Info,
        };
    });

    console.log('\n=== 初始化后 tab 链接分析：');
    console.log(JSON.stringify(afterResult, null, 2));

    await browser.close();
})();
