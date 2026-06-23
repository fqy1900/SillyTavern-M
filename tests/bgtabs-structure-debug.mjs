import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

(async () => {
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const browser = await chromium.launch({
        executablePath: chromePath,
        headless: true,
    });

    const page = await browser.newPage();
    console.log('打开 chat.html...');
    await page.goto('http://127.0.0.1:8000/chat.html', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(8000);

    const result = await page.evaluate(() => {
        const bgTabs = document.querySelector('#bg_tabs');
        if (!bgTabs) return { error: 'bg_tabs not found' };

        // 检查 bg_tabs 的所有直接子元素
        const directChildren = Array.from(bgTabs.children).map((c, i) => ({
            index: i,
            tag: c.tagName,
            id: c.id,
            className: String(c.className).substring(0, 200),
            innerHTML_length: c.innerHTML.length,
        }));

        // 检查 bg_tabs 中的链接 (a 标签有 href=#...)
        const links = Array.from(bgTabs.querySelectorAll('a[href^="#"]')).map(a => ({
            href: a.getAttribute('href'),
            text: a.textContent.substring(0, 50),
            parentId: a.parentElement ? a.parentElement.id : null,
        }));

        // 检查 bg_tabs 中是否有错误的面板 ID
        const bgTabsHTML = bgTabs.innerHTML.substring(0, 500);

        // 检查 ui-id-4 的父元素是否真的是 bg_tabs
        const ui4 = document.querySelector('#ui-id-4');
        const ui4Info = ui4 ? {
            parentId: ui4.parentElement.id,
            parentTag: ui4.parentElement.tagName,
            innerHTML_length: ui4.innerHTML.length,
            first_child_tag: ui4.firstElementChild ? ui4.firstElementChild.tagName : null,
            first_child_id: ui4.firstElementChild ? ui4.firstElementChild.id : null,
        } : null;

        return {
            bgTabsChildren: directChildren,
            tabsLinks: links,
            bgTabsHTML_preview: bgTabsHTML,
            ui4Info,
        };
    });

    console.log(JSON.stringify(result, null, 2));
    const outputFile = path.join(process.cwd(), 'bgtabs-structure-debug.json');
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log('\n已保存到', outputFile);

    await browser.close();
})();
