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
    console.log('打开 chat.html 并追踪...');
    await page.goto('http://127.0.0.1:8000/chat.html', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(8000);

    const result = await page.evaluate(() => {
        // 检查 ui-id-4 元素的内容
        const ui4 = document.querySelector('#ui-id-4');
        const ui4Content = ui4 ? ui4.innerHTML.substring(0, 2000) : null;
        const ui4Children = ui4 ? Array.from(ui4.children).map(c => c.tagName + '#' + c.id + ' class=' + c.className.substring(0, 50)) : null;

        // 检查 jQuery UI 是否创建了面板
        const allUiPanels = Array.from(document.querySelectorAll('.ui-tabs-panel')).map((el, i) => ({
            index: i,
            id: el.id,
            class: el.className.substring(0, 100),
            childCount: el.children.length,
            hasSheld: !!el.querySelector('#sheld'),
            innerHTML_preview: el.innerHTML.substring(0, 300),
        }));

        // 检查 bg_tabs 的子元素
        const bgTabs = document.querySelector('#bg_tabs');
        const bgTabsChildren = bgTabs ? Array.from(bgTabs.children).map(c => ({
            tag: c.tagName,
            id: c.id,
            className: String(c.className).substring(0, 100),
            innerHTML_length: c.innerHTML.length,
            innerHTML_preview: c.innerHTML.substring(0, 200),
        })) : null;

        // 关键：检查 bg_tabs 下是否真的有 sheld
        const firstSheld = document.querySelectorAll('#sheld')[0];
        const secondSheld = document.querySelectorAll('#sheld')[1];
        const firstChat = document.querySelectorAll('#chat')[0];
        const secondChat = document.querySelectorAll('#chat')[1];

        return {
            ui4: {
                exists: !!ui4,
                children: ui4Children,
                innerHTML_preview: ui4Content,
            },
            allUiPanels,
            bgTabsChildren,
            firstSheldParent: firstSheld ? firstSheld.parentElement.id : null,
            secondSheldParent: secondSheld ? secondSheld.parentElement.tagName : null,
            firstChat_parent: firstChat ? firstChat.parentElement.id : null,
            secondChat_parent: secondChat ? secondChat.parentElement.tagName : null,
        };
    });

    console.log(JSON.stringify(result, null, 2));
    const outputFile = path.join(process.cwd(), 'sheld-ui-tabs-debug.json');
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log('\n已保存到', outputFile);

    await browser.close();
})();
