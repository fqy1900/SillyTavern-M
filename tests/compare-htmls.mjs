import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

(async () => {
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const browser = await chromium.launch({
        executablePath: chromePath,
        headless: true,
    });

    // 测试 1: chat.html
    const page1 = await browser.newPage();
    console.log('测试 1: 打开 chat.html...');
    await page1.goto('http://127.0.0.1:8000/chat.html', { waitUntil: 'networkidle', timeout: 60000 });
    await page1.waitForTimeout(10000);
    const result1 = await page1.evaluate(() => ({
        sheldCount: document.querySelectorAll('#sheld').length,
        chatCount: document.querySelectorAll('#chat').length,
        messageTemplateCount: document.querySelectorAll('#message_template').length,
    }));
    console.log('chat.html:', result1);

    // 测试 2: index.html
    const page2 = await browser.newPage();
    console.log('测试 2: 打开 index.html...');
    await page2.goto('http://127.0.0.1:8000/index.html', { waitUntil: 'networkidle', timeout: 60000 });
    await page2.waitForTimeout(10000);
    const result2 = await page2.evaluate(() => ({
        sheldCount: document.querySelectorAll('#sheld').length,
        chatCount: document.querySelectorAll('#chat').length,
        messageTemplateCount: document.querySelectorAll('#message_template').length,
    }));
    console.log('index.html:', result2);

    console.log('\n总结:');
    console.log('chat.html - sheld:', result1.sheldCount, 'chat:', result1.chatCount);
    console.log('index.html - sheld:', result2.sheldCount, 'chat:', result2.chatCount);

    // 如果 chat.html 有重复 sheld，让我看看是否是 chat.html 注入的脚本造成的
    if (result1.sheldCount > 1) {
        console.log('\n发现 chat.html 有重复 sheld!');
        console.log('检查 chat.html 中额外添加的脚本是否是罪魁祸首...');

        const ctxScriptCheck = await page1.evaluate(() => {
            // 检查 chat.html 的内联脚本
            const inlineScripts = Array.from(document.querySelectorAll('script:not([src])')).map(s => s.textContent.substring(0, 300));
            const hasChatHtmlScript = inlineScripts.some(s => s.includes('chat-html') || s.includes('自动角色'));
            return {
                inlineScriptCount: inlineScripts.length,
                hasChatHtmlScript,
                firstInlineScriptPreview: inlineScripts.filter(s => s.length > 100)[0] || '(none)',
            };
        });
        console.log('脚本分析:', ctxScriptCheck);
    }

    await browser.close();
})();
