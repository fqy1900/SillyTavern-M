import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

(async () => {
    const outputFile = path.join(process.cwd(), 'structure-debug.json');
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
    console.log('等待完成');

    // 第一步：选择角色卡
    await page.evaluate(async () => {
        const ctx = globalThis.SillyTavern.getContext();
        if (typeof ctx.selectCharacterById === 'function') {
            await ctx.selectCharacterById(0);
            await new Promise(r => setTimeout(r, 3000));
        }
    });

    const result = await page.evaluate(() => {
        const chatEl = document.querySelector('#chat');
        const allChildren = chatEl ? Array.from(chatEl.children) : [];

        // 检查 #chat 的完整结构
        const chatStructure = {
            outerHTML_start: chatEl ? chatEl.outerHTML.substring(0, 1000) : null,
            totalChildren: allChildren.length,
            children: allChildren.map((child, idx) => ({
                idx,
                tagName: child.tagName,
                className: child.className,
                id: child.id,
                hasClass_mes: child.classList.contains('mes'),
                innerText_preview: child.innerText.substring(0, 150),
                innerHTML_length: child.innerHTML.length,
            })),
        };

        // 检查 #chat .mes 元素是否真的在 #chat 里面
        const mesElements = document.querySelectorAll('#chat .mes');
        const mesElementParents = Array.from(mesElements).map((el, idx) => ({
            idx,
            parentTag: el.parentElement ? el.parentElement.tagName : null,
            parentClass: el.parentElement ? el.parentElement.className : null,
            parentId: el.parentElement ? el.parentElement.id : null,
            grandParentTag: el.parentElement && el.parentElement.parentElement ? el.parentElement.parentElement.tagName : null,
            grandParentId: el.parentElement && el.parentElement.parentElement ? el.parentElement.parentElement.id : null,
            is_direct_child_of_chat: el.parentElement === chatEl,
        }));

        // 检查 .mes 在整个 document 中的位置
        const allMes = document.querySelectorAll('.mes');
        const allMesInfo = Array.from(allMes).slice(0, 10).map((el, idx) => {
            let path = '';
            let cur = el;
            for (let i = 0; i < 5 && cur; i++) {
                path = `${cur.tagName}${cur.id ? '#' + cur.id : ''}${cur.className ? '.' + cur.className.split(' ').filter(x => x).slice(0, 2).join('.') : ''} > ${path}`;
                cur = cur.parentElement;
            }
            return { idx, path, innerText: el.innerText.substring(0, 100) };
        });

        // 检查 #chat 的 CSS 样式（可能消息被隐藏了）
        const computedStyle = chatEl ? {
            display: getComputedStyle(chatEl).display,
            visibility: getComputedStyle(chatEl).visibility,
            height: getComputedStyle(chatEl).height,
            width: getComputedStyle(chatEl).width,
            position: getComputedStyle(chatEl).position,
            overflow: getComputedStyle(chatEl).overflow,
        } : null;

        // 检查 .mes 的可见性
        const firstMesVisible = mesElements.length > 0 ? {
            display: getComputedStyle(mesElements[0]).display,
            visibility: getComputedStyle(mesElements[0]).visibility,
            opacity: getComputedStyle(mesElements[0]).opacity,
        } : null;

        return {
            chatStructure,
            mesElementParents,
            allMesCount: allMes.length,
            allMesInfo,
            chatComputedStyle: computedStyle,
            firstMesVisible,
            // 检查 chatElement 初始化是否有问题
            welcomePanel_exists: !!document.querySelector('#chat .welcomePanel'),
            // 使用 jQuery 检查
            jquery_chat_children_count: window.$('#chat').children().length,
            jquery_chat_mes_count: window.$('#chat').find('.mes').length,
            // 欢迎面板中的子元素
            welcomePanel_children: document.querySelector('.welcomePanel') ?
                Array.from(document.querySelector('.welcomePanel').children).slice(0, 10).map(c => ({
                    tag: c.tagName,
                    class: c.className.substring(0, 100),
                    innerText: c.innerText.substring(0, 100),
                })) : null,
        };
    });

    console.log('DOM 结构分析结果:');
    console.log(JSON.stringify(result, null, 2));
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));

    console.log('\n结果已保存到', outputFile);
    await browser.close();
})();
