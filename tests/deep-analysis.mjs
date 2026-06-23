
import { chromium } from 'playwright';

(async () => {
    console.log('=== 深度 DOM 分析测试 ===\n');

    const browser = await chromium.launch({
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        headless: true
    });

    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:8000/chat.html');
    await page.waitForTimeout(15000);

    // 分析所有 #chat 元素的位置
    console.log('[1] 所有 #chat 元素的位置:');
    const chatInfo = await page.evaluate(() => {
        const chats = document.querySelectorAll('#chat');
        const result = [];
        chats.forEach((chat, idx) => {
            let path = [];
            let node = chat;
            while (node && node.nodeType === 1) {
                path.unshift(node.tagName.toLowerCase() + (node.id ? '#' + node.id : '') + (node.className ? '.' + node.className.split(' ').slice(0, 2).join('.') : ''));
                node = node.parentElement;
            }
            result.push({
                index: idx,
                path: path.join(' > '),
                mesCount: chat.querySelectorAll('.mes').length,
                visible: getComputedStyle(chat).visibility !== 'hidden' && getComputedStyle(chat).display !== 'none'
            });
        });
        return result;
    });
    chatInfo.forEach(info => {
        console.log(`  [${info.index}] ${info.path}`);
        console.log(`       .mes 数量: ${info.mesCount}, 可见: ${info.visible}`);
    });

    console.log('\n[2] 所有 #sheld 元素的位置:');
    const sheldInfo = await page.evaluate(() => {
        const shelds = document.querySelectorAll('#sheld');
        const result = [];
        shelds.forEach((el, idx) => {
            let path = [];
            let node = el;
            while (node && node.nodeType === 1) {
                path.unshift(node.tagName.toLowerCase() + (node.id ? '#' + node.id : '') + (node.className ? '.' + node.className.split(' ').slice(0, 2).join('.') : ''));
                node = node.parentElement;
            }
            result.push({
                index: idx,
                path: path.join(' > ')
            });
        });
        return result;
    });
    sheldInfo.forEach(info => {
        console.log(`  [${info.index}] ${info.path}`);
    });

    console.log('\n[3] 所有 #bg_tabs 元素的位置:');
    const bgTabsInfo = await page.evaluate(() => {
        const elements = document.querySelectorAll('#bg_tabs');
        const result = [];
        elements.forEach((el, idx) => {
            let path = [];
            let node = el;
            while (node && node.nodeType === 1) {
                path.unshift(node.tagName.toLowerCase() + (node.id ? '#' + node.id : '') + (node.className ? '.' + node.className.split(' ').slice(0, 2).join('.') : ''));
                node = node.parentElement;
            }
            result.push({
                index: idx,
                path: path.join(' > '),
                children: Array.from(el.children).map((c, i) => `${i}: ${c.tagName.toLowerCase()}${c.id ? '#' + c.id : ''}`)
            });
        });
        return result;
    });
    bgTabsInfo.forEach(info => {
        console.log(`  [${info.index}] ${info.path}`);
        console.log(`       子元素: ${info.children.join(', ')}`);
    });

    console.log('\n[4] 检查 ui-id-* 元素:');
    const uiIdInfo = await page.evaluate(() => {
        const elements = document.querySelectorAll('[id^="ui-id-"]');
        const result = [];
        elements.forEach((el, idx) => {
            let path = [];
            let node = el;
            while (node && node.nodeType === 1) {
                path.unshift(node.tagName.toLowerCase() + (node.id ? '#' + node.id : '') + (node.className ? '.' + node.className.split(' ').slice(0, 2).join('.') : ''));
                node = node.parentElement;
            }
            result.push({
                index: idx,
                id: el.id,
                path: path.join(' > '),
                hasChat: el.querySelector('#chat') ? 'YES' : 'no',
                hasSheld: el.querySelector('#sheld') ? 'YES' : 'no',
                textLength: el.textContent?.length || 0
            });
        });
        return result;
    });
    uiIdInfo.forEach(info => {
        console.log(`  [${info.index}] ${info.id}`);
        console.log(`       路径: ${info.path}`);
        console.log(`       包含 #chat: ${info.hasChat}, 包含 #sheld: ${info.hasSheld}, 文本长度: ${info.textLength}`);
    });

    await browser.close();
    console.log('\n测试完成');
})();
