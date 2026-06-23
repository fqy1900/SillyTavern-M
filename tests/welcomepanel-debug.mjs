import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

(async () => {
    const outputFile = path.join(process.cwd(), 'welcomepanel-debug.json');
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const browser = await chromium.launch({
        executablePath: chromePath,
        headless: true,
    });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('打开 chat.html...');
    await page.goto('http://127.0.0.1:8000/chat.html', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(15000);

    // 选择角色卡
    await page.evaluate(async () => {
        const ctx = globalThis.SillyTavern.getContext();
        if (typeof ctx.selectCharacterById === 'function') {
            await ctx.selectCharacterById(0);
            await new Promise(r => setTimeout(r, 3000));
        }
    });

    const result = await page.evaluate(() => {
        const chatEl = document.querySelector('#chat');
        const welcomePanel = chatEl ? chatEl.querySelector('.welcomePanel') : null;

        // 检查 welcomePanel 内部的结构
        const welcomePanelContent = welcomePanel ? {
            totalChildren: welcomePanel.children.length,
            childrenTags: Array.from(welcomePanel.children).slice(0, 20).map(c => c.tagName + (c.id ? '#' + c.id : '') + (c.className ? '.' + c.className.split(' ').slice(0, 2).join('.') : '')),
            // 检查 welcomePanel 内部是否有 .mes 元素
            has_mes_inside: welcomePanel.querySelectorAll('.mes').length,
            innerHTML_preview: welcomePanel.innerHTML.substring(0, 2000),
        } : null;

        // 检查 chatElement（通过从 st-context.js 导出的）
        // 关键：直接访问模块级的 chatElement
        // 因为 chatElement 是 script.js 的 export const
        // 我们无法直接访问，但可以从 DOM 中找到是否有重复 #chat 元素
        const allChatIdElements = document.querySelectorAll('#chat');
        const allMesCountInChat = chatEl ? chatEl.querySelectorAll('.mes').length : 0;

        // 检查 #chat 下所有直接子元素
        const chatDirectChildren = chatEl ? Array.from(chatEl.children).map((c, i) => ({
            idx: i,
            tag: c.tagName,
            id: c.id,
            className: c.className.substring(0, 100),
            innerHTML_length: c.innerHTML.length,
            innerText_preview: c.innerText.substring(0, 200),
            has_mes_children: c.querySelectorAll('.mes').length,
        })) : [];

        // 关键点：测试 chatElement jQuery 对象是否指向正确元素
        const jqueryTest = {
            jquery_chat_count: window.$('#chat').length,
            jquery_chat_first_tag: window.$('#chat')[0] ? window.$('#chat')[0].tagName : null,
            jquery_chat_first_html: window.$('#chat')[0] ? window.$('#chat')[0].outerHTML.substring(0, 500) : null,
            jquery_chat_children: window.$('#chat').children().length,
            jquery_chat_find_mes: window.$('#chat').find('.mes').length,
        };

        return {
            allChatIdElements: allChatIdElements.length,
            welcomePanel: welcomePanelContent,
            chatDirectChildren,
            allMesCountInChat,
            jqueryTest,
        };
    });

    console.log('welcomePanel 内部分析:');
    console.log(JSON.stringify(result, null, 2));
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));

    console.log('\n结果已保存到', outputFile);
    await browser.close();
})();
