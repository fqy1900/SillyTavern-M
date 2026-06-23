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
    await page.waitForTimeout(10000);

    const result = await page.evaluate(() => {
        // 检查 chatElement 在模块初始化时指向哪里
        // chatElement = $('#chat') 是在 script.js 模块顶层执行的
        // 让我们用同样的方式获取它

        const chatAtLoad = document.querySelector('#chat');
        const allChats = Array.from(document.querySelectorAll('#chat')).map((el, i) => ({
            index: i,
            tag: el.tagName,
            parentId: el.parentElement ? el.parentElement.id : null,
            parentClass: el.parentElement ? String(el.parentElement.className).substring(0, 100) : null,
            innerHTML_length: el.innerHTML.length,
            children: Array.from(el.children).slice(0, 3).map(c => c.tagName + (c.id ? '#' + c.id : '') + ' class=' + String(c.className).substring(0, 50)),
        }));

        // 检查 sheld 元素
        const allShelds = Array.from(document.querySelectorAll('#sheld')).map((el, i) => ({
            index: i,
            tag: el.tagName,
            parentId: el.parentElement ? el.parentElement.id : null,
            parentClass: el.parentElement ? String(el.parentElement.className).substring(0, 100) : null,
            childCount: el.children.length,
            children: Array.from(el.children).slice(0, 10).map(c => c.tagName + (c.id ? '#' + c.id : '') + ' class=' + String(c.className).substring(0, 100)),
        }));

        // 关键测试：用 jQuery $('#chat') 获取的元素 vs 用 document.querySelector('#chat') 获取的元素
        const jqueryChat = window.$('#chat');
        const jqueryFirstEl = jqueryChat[0];
        const jqueryChatInfo = {
            length: jqueryChat.length,
            firstElementId: jqueryFirstEl ? jqueryFirstEl.id : null,
            firstElementParentId: jqueryFirstEl && jqueryFirstEl.parentElement ? jqueryFirstEl.parentElement.id : null,
            firstElementChildren: jqueryFirstEl ? Array.from(jqueryFirstEl.children).map(c => c.tagName + (c.id ? '#' + c.id : '')).slice(0, 5) : null,
            firstElementHtmlLength: jqueryFirstEl ? jqueryFirstEl.innerHTML.length : null,
        };

        // 关键检查：检查第二个 #chat 元素（应该是 sheld 下的）是否就是显示消息的地方
        const secondChat = document.querySelectorAll('#chat')[1];
        const secondChatInfo = secondChat ? {
            id: secondChat.id,
            parentId: secondChat.parentElement.id,
            childCount: secondChat.children.length,
            firstChildId: secondChat.firstElementChild ? secondChat.firstElementChild.id : null,
            innerHTML_length: secondChat.innerHTML.length,
        } : null;

        return {
            allChats,
            allShelds,
            jqueryChat: jqueryChatInfo,
            secondChat: secondChatInfo,
            mesCount: document.querySelectorAll('.mes').length,
        };
    });

    console.log('关键测试结果:');
    console.log(JSON.stringify(result, null, 2));

    const outputFile = path.join(process.cwd(), 'critical-analysis.json');
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log('\n已保存到', outputFile);

    await browser.close();
})();
