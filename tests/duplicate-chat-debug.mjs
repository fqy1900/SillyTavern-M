import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

(async () => {
    const outputFile = path.join(process.cwd(), 'duplicate-chat-debug.json');
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const browser = await chromium.launch({
        executablePath: chromePath,
        headless: true,
    });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('打开 chat.html...');

    // 捕获 console 消息
    const logs = [];
    page.on('console', (msg) => {
        logs.push(msg.text());
    });

    await page.goto('http://127.0.0.1:8000/chat.html', { waitUntil: 'networkidle', timeout: 60000 });

    // 在脚本加载前后跟踪 #chat 元素数量
    const result = await page.evaluate(() => {
        const timeline = [];

        // 检查初始状态
        timeline.push({
            step: 'initial',
            chatCount: document.querySelectorAll('#chat').length,
            messageTemplateCount: document.querySelectorAll('#message_template').length,
        });

        // 等待 5 秒
        return new Promise(resolve => {
            setTimeout(() => {
                timeline.push({
                    step: 'after 5s',
                    chatCount: document.querySelectorAll('#chat').length,
                    messageTemplateCount: document.querySelectorAll('#message_template').length,
                });

                // 获取所有 #chat 元素的信息
                const allChatEls = document.querySelectorAll('#chat');
                const chatInfo = Array.from(allChatEls).map((el, i) => ({
                    index: i,
                    tagName: el.tagName,
                    id: el.id,
                    parentTagName: el.parentElement ? el.parentElement.tagName : null,
                    parentId: el.parentElement ? el.parentElement.id : null,
                    parentClass: el.parentElement ? el.parentElement.className.substring(0, 100) : null,
                    childCount: el.children.length,
                    childrenTags: Array.from(el.children).slice(0, 10).map(c => c.tagName + (c.id ? '#' + c.id : '') + (c.className ? '.' + String(c.className).split(' ').slice(0, 2).join('.') : '')),
                    innerHTMLPreview: el.innerHTML.substring(0, 300),
                    hasWelcomePanel: el.querySelector('.welcomePanel') !== null,
                    hasMesChildren: el.querySelectorAll('.mes').length,
                });

                // 检查 script.js 是否被加载两次
                const scriptTags = Array.from(document.querySelectorAll('script'));
                const scriptJsSources = scriptTags.filter(s => s.src && s.src.includes('script.js')).map(s => s.src);

                // 检查 #message_template 重复
                const allTemplateEls = document.querySelectorAll('#message_template');
                const templateInfo = Array.from(allTemplateEls).map((el, i) => ({
                    index: i,
                    parentTag: el.parentElement ? el.parentElement.tagName : null,
                    parentId: el.parentElement ? el.parentElement.id : null,
                    parentClass: el.parentElement ? el.parentElement.className.substring(0, 100) : null,
                }));

                // 检查 ctx.chatElement 和 messageTemplate 的状态
                const ctx = globalThis.SillyTavern.getContext();
                const chatElementInfo = {
                    is_exported_chatElement_defined: typeof ctx.chatElement !== 'undefined',
                };

                // 检查 DOM 中的重要元素
                const sheldCount = document.querySelectorAll('#sheld').length;

                resolve({
                    timeline,
                    chatCount: allChatEls.length,
                    chatInfo,
                    messageTemplateCount: allTemplateEls.length,
                    templateInfo,
                    scriptJsSources,
                    chatElementInfo,
                    sheldCount,
                    // 检查是否是 chat.html 自己的脚本做了什么
                    has_chat_html_script: document.querySelectorAll('script').length,
                });
            }, 5000);
        });
    });

    console.log('重复 #chat 诊断:');
    console.log(JSON.stringify(result, null, 2));
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));

    console.log('\n结果已保存到', outputFile);
    await browser.close();
})();
