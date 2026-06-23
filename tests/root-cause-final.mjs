import { chromium } from 'playwright';

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
        // 找到所有 #chat 元素，并分析它们的状态
        const allChats = document.querySelectorAll('#chat');
        const chatInfo = [];

        for (let i = 0; i < allChats.length; i++) {
            const chat = allChats[i];
            const rect = chat.getBoundingClientRect();
            const computedStyle = window.getComputedStyle(chat);

            // 查找父链
            let parent = chat.parentElement;
            const parentChain = [];
            let depth = 0;
            while (parent && depth < 8) {
                parentChain.push(parent.tagName + (parent.id ? '#' + parent.id : '') + ' class=' + String(parent.className).substring(0, 30));
                parent = parent.parentElement;
                depth++;
            }

            chatInfo.push({
                index: i,
                visible: rect.width > 0 && rect.height > 0 && computedStyle.display !== 'none',
                display: computedStyle.display,
                width: rect.width,
                height: rect.height,
                child_count: chat.children.length,
                has_welcome_panel: chat.querySelector('.welcomePanel') !== null,
                has_mes_elements: chat.querySelectorAll('.mes').length > 0,
                parent_chain: parentChain,
            });
        }

        // 检查 chatElement 变量的值（如果存在于某个 module 中）
        // 由于 ES6 modules，我们无法直接访问它，但我们可以用同样的选择器测试
        const jqueryChat = window.$ && window.$('#chat');
        const jqueryChatInfo = jqueryChat ? {
            length: jqueryChat.length,
            first_element_parent_id: jqueryChat[0] ? (jqueryChat[0].parentElement ? jqueryChat[0].parentElement.id : null) : null,
            first_element_visible: jqueryChat[0] ? (() => {
                const r = jqueryChat[0].getBoundingClientRect();
                const s = window.getComputedStyle(jqueryChat[0]);
                return r.width > 0 && r.height > 0 && s.display !== 'none';
            })() : null,
            first_element_children: jqueryChat[0] ? Array.from(jqueryChat[0].children).map(c => c.tagName + (c.id ? '#' + c.id : '') + ' class=' + String(c.className).substring(0, 30)).slice(0, 5) : null,
        } : null;

        return {
            total_chat_elements: allChats.length,
            chats: chatInfo,
            jquery_chat: jqueryChatInfo,
            total_sheld_elements: document.querySelectorAll('#sheld').length,
        };
    });

    console.log('=== chat.html 根因分析结果 ===');
    console.log(JSON.stringify(result, null, 2));

    await browser.close();
})();
