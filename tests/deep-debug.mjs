import { chromium } from 'playwright';

const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: false,
    slowMo: 100,
});

const context = await browser.newContext();
const page = await context.newPage();

console.log('=== 深度 DOM 结构分析 ===');

try {
    await page.goto('http://127.0.0.1:8000/chat.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(10000);

    // 1. 查找所有 #chat 和 #sheld 的父元素
    console.log('\n[1] 查找重复元素的父元素路径');
    const parentInfo = await page.evaluate(() => {
        const getAncestors = (el) => {
            const ancestors = [];
            let node = el;
            while (node && node.nodeType === 1) {
                const id = node.id ? `#${node.id}` : '';
                const classes = node.className && typeof node.className === 'string' 
                    ? `.${node.className.split(/\s+/).filter(c => c).slice(0, 2).join('.')}` 
                    : '';
                ancestors.push(`${node.tagName.toLowerCase()}${id}${classes}`);
                node = node.parentElement;
            }
            return ancestors.reverse().join(' > ');
        };

        const allChats = document.querySelectorAll('#chat');
        const allShelds = document.querySelectorAll('#sheld');
        
        const chatPaths = Array.from(allChats).map((el, idx) => ({
            index: idx,
            mes_count: el.querySelectorAll('.mes').length,
            parent_path: getAncestors(el),
        }));
        
        const sheldPaths = Array.from(allShelds).map((el, idx) => ({
            index: idx,
            parent_path: getAncestors(el),
        }));

        return { chatPaths, sheldPaths };
    });

    console.log('\n#chat 元素路径:');
    parentInfo.chatPaths.forEach((p, idx) => {
        console.log(`  [${idx}] .mes=${p.mes_count}: ${p.parent_path}`);
    });

    console.log('\n#sheld 元素路径:');
    parentInfo.sheldPaths.forEach((p, idx) => {
        console.log(`  [${idx}]: ${p.parent_path}`);
    });

    // 2. 查找 #ui-id 元素（jQuery UI tabs 生成的）
    console.log('\n[2] 查找 jQuery UI 生成的元素');
    const uiElements = await page.evaluate(() => {
        const elements = [];
        document.querySelectorAll('[id^="ui-id-"]').forEach((el) => {
            const style = window.getComputedStyle(el);
            elements.push({
                id: el.id,
                tag: el.tagName,
                display: style.display,
                visibility: style.visibility,
                children_count: el.children.length,
                innerHTML_length: el.innerHTML.length,
            });
        });
        return elements;
    });

    if (uiElements.length > 0) {
        console.log(`  发现 ${uiElements.length} 个 ui-id 元素:`);
        uiElements.forEach((el) => {
            console.log(`    ${el.id} (${el.tag}): display=${el.display}, children=${el.children_count}`);
        });
    } else {
        console.log('  没有发现 ui-id 元素（这是好消息！）');
    }

    // 3. 检查 #bg_tabs 的结构
    console.log('\n[3] 检查 #bg_tabs 的结构');
    const bgTabsInfo = await page.evaluate(() => {
        const bgTabs = document.getElementById('bg_tabs');
        if (!bgTabs) return { exists: false };
        
        const children = [];
        Array.from(bgTabs.children).forEach((child, idx) => {
            const style = window.getComputedStyle(child);
            children.push({
                index: idx,
                tag: child.tagName,
                id: child.id || '(no id)',
                class: child.className.substring(0, 50),
                display: style.display,
            });
        });

        return {
            exists: true,
            children: children,
        };
    });

    if (bgTabsInfo.exists) {
        console.log(`  #bg_tabs 有 ${bgTabsInfo.children.length} 个子元素:`);
        bgTabsInfo.children.forEach((c) => {
            console.log(`    [${c.index}] ${c.tag}#${c.id} class=${c.class} display=${c.display}`);
        });
    } else {
        console.log('  #bg_tabs 不存在');
    }

    // 4. 检查是否有 chat.html 被作为 AJAX 内容加载
    console.log('\n[4] 检查是否有重复的 chat.html 结构');
    const duplicateHtmlCheck = await page.evaluate(() => {
        // 查找包含完整 chat.html 结构的元素
        const suspiciousElements = [];
        
        // 查找所有包含 #chat 的元素
        document.querySelectorAll('*').forEach((el) => {
            if (el.id === 'chat') return;
            const innerChats = el.querySelectorAll(':scope > #chat');
            if (innerChats.length > 0 && el.id !== 'chat') {
                suspiciousElements.push({
                    id: el.id,
                    tag: el.tagName,
                    class: el.className.substring(0, 100),
                });
            }
        });

        return { suspiciousElements };
    });

    console.log(`  发现 ${duplicateHtmlCheck.suspiciousElements.length} 个可疑容器:`);
    duplicateHtmlCheck.suspiciousElements.forEach((el, idx) => {
        console.log(`    [${idx}] ${el.tag}#${el.id} class=${el.class}`);
    });

    // 5. 检查 script.js 中 chatElement 的状态
    console.log('\n[5] 检查 chatElement 实际引用');
    const chatElementStatus = await page.evaluate(() => {
        // 直接访问第一个 #chat
        const firstChat = document.getElementById('chat');
        const allChats = document.querySelectorAll('#chat');
        
        const firstChatInfo = firstChat ? {
            mes_count: firstChat.querySelectorAll('.mes').length,
            display: window.getComputedStyle(firstChat).display,
        } : null;

        // 选择可见的 #chat（模拟 script.js 中的逻辑）
        const visibleChat = Array.from(allChats).find(el => {
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden';
        });

        return {
            firstChat: firstChatInfo,
            visibleChat: visibleChat ? {
                mes_count: visibleChat.querySelectorAll('.mes').length,
                display: window.getComputedStyle(visibleChat).display,
            } : null,
            allChatsCount: allChats.length,
        };
    });

    console.log(`  总 #chat 元素: ${chatElementStatus.allChatsCount}`);
    console.log(`  第一个 #chat: .mes=${chatElementStatus.firstChat?.mes_count}, display=${chatElementStatus.firstChat?.display}`);
    console.log(`  可见的 #chat: .mes=${chatElementStatus.visibleChat?.mes_count}, display=${chatElementStatus.visibleChat?.display}`);

    console.log('\n=== 分析结论 ===');
    if (chatElementStatus.allChatsCount === 2) {
        console.log('问题: 有 2 个 #chat，两个都是可见的！');
        console.log('推测: jQuery UI tabs 仍然在加载 chat.html 作为 AJAX 内容，或者还有其他问题');
    }

} catch (error) {
    console.error('测试过程中出错:', error);
} finally {
    console.log('\n按 Ctrl+C 关闭浏览器...');
    await page.waitForTimeout(15000);
    await browser.close();
}
