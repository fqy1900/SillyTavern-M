import { chromium } from 'playwright';

const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--headless=new'],
});

const context = await browser.newContext();
const page = await context.newPage();

console.log('=== 细致分析 #bg_tabs 结构 ===');

try {
    await page.goto('http://127.0.0.1:8000/chat.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(10000);

    // 1. 检查 #bg_tabs 的所有直接子元素
    console.log('\n[1] #bg_tabs 直接子元素:');
    const childrenInfo = await page.evaluate(() => {
        const bgTabs = document.getElementById('bg_tabs');
        if (!bgTabs) return { exists: false };
        
        const children = [];
        Array.from(bgTabs.children).forEach((child, idx) => {
            const style = window.getComputedStyle(child);
            children.push({
                index: idx,
                tag: child.tagName,
                id: child.id || '(no id)',
                class: child.className.substring(0, 100),
                display: style.display,
                child_count: child.children.length,
                inner_text_preview: child.textContent.substring(0, 50).replace(/\s+/g, ' ').trim(),
            });
        });

        return {
            exists: true,
            total_children: bgTabs.children.length,
            children: children,
        };
    });

    if (childrenInfo.exists) {
        console.log(`  共 ${childrenInfo.total_children} 个直接子元素:`);
        childrenInfo.children.forEach((c) => {
            console.log(`    [${c.index}] ${c.tag} id="${c.id}" display=${c.display} children=${c.child_count}`);
            console.log(`        class: ${c.class}`);
            if (c.inner_text_preview) {
                console.log(`        text: "${c.inner_text_preview}"`);
            }
        });
    }

    // 2. 检查 #bg_global_tab 和 #bg_chat_tab 的实际父元素
    console.log('\n[2] 检查 #bg_global_tab 和 #bg_chat_tab 的位置:');
    const panelPositions = await page.evaluate(() => {
        const bgGlobal = document.getElementById('bg_global_tab');
        const bgChat = document.getElementById('bg_chat_tab');
        
        const getParentChain = (el, depth = 3) => {
            if (!el) return '(element not found)';
            const chain = [];
            let node = el;
            for (let i = 0; i < depth && node; i++) {
                chain.push(`${node.tagName}${node.id ? '#' + node.id : ''}${node.className ? '.' + node.className.split(' ').slice(0, 1).join('.') : ''}`);
                node = node.parentElement;
            }
            return chain.join(' < ');
        };
        
        return {
            bg_global: {
                found: !!bgGlobal,
                parent_chain: getParentChain(bgGlobal, 4),
                is_direct_child_of_bg_tabs: bgGlobal?.parentElement?.id === 'bg_tabs',
            },
            bg_chat: {
                found: !!bgChat,
                parent_chain: getParentChain(bgChat, 4),
                is_direct_child_of_bg_tabs: bgChat?.parentElement?.id === 'bg_tabs',
            },
        };
    });

    console.log(`  #bg_global_tab:`);
    console.log(`    找到: ${panelPositions.bg_global.found}`);
    console.log(`    父链: ${panelPositions.bg_global.parent_chain}`);
    console.log(`    是否是 #bg_tabs 直接子元素: ${panelPositions.bg_global.is_direct_child_of_bg_tabs}`);

    console.log(`\n  #bg_chat_tab:`);
    console.log(`    找到: ${panelPositions.bg_chat.found}`);
    console.log(`    父链: ${panelPositions.bg_chat.parent_chain}`);
    console.log(`    是否是 #bg_tabs 直接子元素: ${panelPositions.bg_chat.is_direct_child_of_bg_tabs}`);

    // 3. 关键问题！检查 #bg_tabs 中是否真的包含完整 chat.html 内容
    console.log('\n[3] 检查 #ui-id-4 的内容来源:');
    const uiId4Analysis = await page.evaluate(() => {
        const uiId4 = document.getElementById('ui-id-4');
        if (!uiId4) return { exists: false };
        
        // 检查是否包含 <title> 标签
        const hasTitleTag = uiId4.querySelector('title') !== null;
        const hasBaseTag = uiId4.querySelector('base') !== null;
        
        // 检查是否有重复的 #chat
        const innerChats = uiId4.querySelectorAll('#chat');
        const innerShelds = uiId4.querySelectorAll('#sheld');
        
        // 检查是否有 #bg_tabs 在 #ui-id-4 中（递归嵌套！）
        const innerBgTabs = uiId4.querySelectorAll('#bg_tabs');
        
        return {
            exists: true,
            has_html_head: hasTitleTag || hasBaseTag,
            has_title: hasTitleTag,
            has_base: hasBaseTag,
            inner_chat_count: innerChats.length,
            inner_sheld_count: innerShelds.length,
            inner_bgtabs_count: innerBgTabs.length,
            total_child_elements: uiId4.querySelectorAll('*').length,
        };
    });

    if (uiId4Analysis.exists) {
        console.log(`  包含 HTML HEAD 标签: ${uiId4Analysis.has_html_head}`);
        console.log(`  包含 <title>: ${uiId4Analysis.has_title}`);
        console.log(`  包含 <base>: ${uiId4Analysis.has_base}`);
        console.log(`  内部 #chat 元素数量: ${uiId4Analysis.inner_chat_count}`);
        console.log(`  内部 #sheld 元素数量: ${uiId4Analysis.inner_sheld_count}`);
        console.log(`  内部 #bg_tabs 元素数量: ${uiId4Analysis.inner_bgtabs_count} <- 递归嵌套！`);
        console.log(`  内部总元素数: ${uiId4Analysis.total_child_elements}`);
    }

    // 4. 检查整个页面中 #chat 和 #sheld 的数量
    console.log('\n[4] 页面中所有 #chat, #sheld, #bg_tabs:');
    const duplicateIds = await page.evaluate(() => {
        const allChats = document.querySelectorAll('#chat');
        const allShelds = document.querySelectorAll('#sheld');
        const allBgTabs = document.querySelectorAll('#bg_tabs');
        
        const getPath = (el) => {
            const parts = [];
            let node = el;
            while (node && node.nodeType === 1) {
                parts.unshift(`${node.tagName}${node.id ? '#' + node.id : ''}`);
                node = node.parentElement;
            }
            return parts.join(' > ');
        };
        
        return {
            chats: Array.from(allChats).map((c, i) => ({
                index: i,
                path: getPath(c).substring(0, 150),
                mes_count: c.querySelectorAll('.mes').length,
                display: window.getComputedStyle(c).display,
            })),
            shelds: Array.from(allShelds).map((s, i) => ({
                index: i,
                path: getPath(s).substring(0, 150),
            })),
            bgtabs: Array.from(allBgTabs).map((t, i) => ({
                index: i,
                path: getPath(t).substring(0, 150),
                child_count: t.children.length,
            })),
        };
    });

    console.log(`  #chat 元素: ${duplicateIds.chats.length}`);
    duplicateIds.chats.forEach((c) => {
        console.log(`    [${c.index}] .mes=${c.mes_count} display=${c.display}`);
        console.log(`       path: ${c.path}`);
    });

    console.log(`\n  #sheld 元素: ${duplicateIds.shelds.length}`);
    duplicateIds.shelds.forEach((s) => {
        console.log(`    [${s.index}] path: ${s.path}`);
    });

    console.log(`\n  #bg_tabs 元素: ${duplicateIds.bgtabs.length}`);
    duplicateIds.bgtabs.forEach((t) => {
        console.log(`    [${t.index}] children=${t.child_count} path: ${t.path}`);
    });

    console.log('\n=== 结论 ===');
    console.log(`问题: jQuery UI tabs 通过 AJAX 加载了整个 chat.html 到 #ui-id-4`);
    console.log(`原因: jQuery UI 可能认为 #bg_global_tab 不存在，所以将 href="#bg_global_tab" 当作 URL 来请求`);
    console.log(`结果: 导致 #chat 和 #sheld 重复，script.js 的 chatElement 指向错误的元素`);

} catch (error) {
    console.error('测试过程中出错:', error);
} finally {
    await browser.close();
    console.log('\n测试完成');
}
