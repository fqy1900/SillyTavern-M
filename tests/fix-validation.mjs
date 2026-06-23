import { chromium } from 'playwright';

(async () => {
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const browser = await chromium.launch({
        executablePath: chromePath,
        headless: true,
    });

    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ 'Cache-Control': 'no-cache' });

    console.log('=== 修复方案验证测试 ===');
    console.log('\n--- 测试 1：原始 HTML (有问题) ---');
    await page.goto('http://127.0.0.1:8000/chat.html', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(15000);

    const result1 = await page.evaluate(() => {
        const allChats = document.querySelectorAll('#chat');
        const allShelds = document.querySelectorAll('#sheld');
        const chatEl = window.$('#chat');

        return {
            chat_elements_count: allChats.length,
            sheld_elements_count: allShelds.length,
            jquery_chat_length: chatEl.length,
            jquery_chat_first_child: chatEl[0] ? chatEl[0].children[0] ? chatEl[0].children[0].tagName + ' class=' + String(chatEl[0].children[0].className).substring(0, 40) : 'NO_CHILDREN' : 'NO_ELEMENT',
            chat_element_visible: allChats[0] ? (() => {
                const r = allChats[0].getBoundingClientRect();
                return r.width > 0 && r.height > 0;
            })() : false,
            second_chat_visible: allChats[1] ? (() => {
                const r = allChats[1].getBoundingClientRect();
                return r.width > 0 && r.height > 0;
            })() : false,
        };
    });

    console.log('原始 chat.html 结果：');
    console.log(JSON.stringify(result1, null, 2));

    console.log('\n--- 测试 2：模拟修复 (将 heading-controls 移出 #bg_tabs) ---');

    // 在页面上执行修复操作
    const fixResult = await page.evaluate(() => {
        const bgTabs = document.getElementById('bg_tabs');
        const headingControls = bgTabs.querySelector('.heading-controls');

        if (!bgTabs || !headingControls) {
            return { success: false, reason: '元素未找到' };
        }

        // 将 heading-controls 移出 bg_tabs，插入到 bg_tabs 之前
        bgTabs.parentNode.insertBefore(headingControls, bgTabs);

        // 重新初始化 tabs
        // 首先销毁现有 tabs
        try {
            window.$('#bg_tabs').tabs('destroy');
        } catch (e) {
            // 忽略错误
        }

        // 重新初始化 tabs
        window.$('#bg_tabs').tabs();

        // 给点时间让 DOM 稳定
        return { success: true };
    });

    console.log('修复操作结果：', JSON.stringify(fixResult, null, 2));

    await page.waitForTimeout(5000);

    const result2 = await page.evaluate(() => {
        const allChats = document.querySelectorAll('#chat');
        const allShelds = document.querySelectorAll('#sheld');
        const chatEl = window.$('#chat');

        return {
            chat_elements_count: allChats.length,
            sheld_elements_count: allShelds.length,
            jquery_chat_length: chatEl.length,
            jquery_chat_first_child: chatEl[0] ? chatEl[0].children[0] ? chatEl[0].children[0].tagName + ' class=' + String(chatEl[0].children[0].className).substring(0, 40) : 'NO_CHILDREN' : 'NO_ELEMENT',
            chat_element_visible: allChats[0] ? (() => {
                const r = allChats[0].getBoundingClientRect();
                return r.width > 0 && r.height > 0;
            })() : false,
            second_chat_visible: allChats[1] ? (() => {
                const r = allChats[1].getBoundingClientRect();
                return r.width > 0 && r.height > 0;
            })() : false,
            bg_tabs_children: Array.from(document.getElementById('bg_tabs').children).slice(0, 10).map(c => c.tagName + '#' + c.id + ' class=' + String(c.className).substring(0, 40)),
        };
    });

    console.log('\n修复后 chat.html 结果：');
    console.log(JSON.stringify(result2, null, 2));

    await browser.close();

    console.log('\n=== 验证结论 ===');
    if (result1.chat_elements_count === 2 && result2.chat_elements_count === 1) {
        console.log('✓ 修复成功！chat 元素从 2 个变成 1 个');
    } else {
        console.log('✗ 修复未完全解决问题');
    }
})();
