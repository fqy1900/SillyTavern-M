import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

(async () => {
    const outputFile = path.join(process.cwd(), 'duplicate-chat-debug-v2.json');
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const browser = await chromium.launch({
        executablePath: chromePath,
        headless: true,
    });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('打开 chat.html...');

    await page.goto('http://127.0.0.1:8000/chat.html', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(8000);

    const result = await page.evaluate(() => {
        const allChatEls = document.querySelectorAll('#chat');
        const allTemplateEls = document.querySelectorAll('#message_template');
        const allSheldEls = document.querySelectorAll('#sheld');

        const chatInfo = Array.from(allChatEls).map((el, i) => ({
            index: i,
            parentTag: el.parentElement ? el.parentElement.tagName : null,
            parentId: el.parentElement ? el.parentElement.id : null,
            parentClass: el.parentElement ? String(el.parentElement.className).substring(0, 100) : null,
            childCount: el.children.length,
            firstFewChildren: Array.from(el.children).slice(0, 5).map(c => c.tagName + (c.id ? '#' + c.id : '') + ' class=' + String(c.className).substring(0, 50)),
            hasWelcomePanel: !!el.querySelector('.welcomePanel'),
            hasMesChildren: el.querySelectorAll('.mes').length,
            outerHTML_preview: el.outerHTML.substring(0, 500),
        }));

        const sheldInfo = Array.from(allSheldEls).map((el, i) => ({
            index: i,
            childCount: el.children.length,
            firstFewChildren: Array.from(el.children).slice(0, 10).map(c => c.tagName + (c.id ? '#' + c.id : '') + ' class=' + String(c.className).substring(0, 50)),
        }));

        const sheldChild = document.querySelector('#sheld');
        const sheldInnerHTML = sheldChild ? sheldChild.innerHTML.substring(0, 2000) : null;

        return {
            chatCount: allChatEls.length,
            chatInfo,
            templateCount: allTemplateEls.length,
            sheldCount: allSheldEls.length,
            sheldInfo,
            sheldInnerHTML_preview: sheldInnerHTML,
        };
    });

    console.log('结果:');
    console.log(JSON.stringify(result, null, 2));
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log('\n已保存到', outputFile);
    await browser.close();
})();
