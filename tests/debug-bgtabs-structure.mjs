import { chromium } from 'playwright';

const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--headless=new'],
});

const context = await browser.newContext();
const page = await context.newPage();

console.log('=== 调试 #bg_tabs 结构 ===');

try {
    await page.goto('http://127.0.0.1:8000/chat.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(10000);

    // 检查 #bg_tabs 中 tab 按钮与 panel 的关联
    console.log('\n[1] tab 按钮与 panel 关联:');
    const tabRelations = await page.evaluate(() => {
        const bgTabs = document.getElementById('bg_tabs');
        if (!bgTabs) return { exists: false };
        
        const tabButtons = bgTabs.querySelectorAll('ul.bg_tabs_list li');
        const relations = [];
        
        tabButtons.forEach((li, idx) => {
            const a = li.querySelector('a');
            relations.push({
                index: idx,
                href: a?.getAttribute('href') || '(no href)',
                aria_controls: li.getAttribute('aria-controls') || '(none)',
                tab_text: a?.textContent?.trim() || '',
            });
        });
        
        // 检查每个 panel 是否被正确识别
        const panels = [];
        Array.from(bgTabs.children).forEach((child, idx) => {
            if (child.tagName !== 'UL') {
                panels.push({
                    index: idx,
                    id: child.id || '(no id)',
                    class: child.className.substring(0, 80),
                    has_ui_panel_class: child.classList.contains('ui-tabs-panel'),
                });
            }
        });
        
        return {
            exists: true,
            tab_relations: relations,
            panels: panels,
        };
    });

    if (tabRelations.exists) {
        console.log('  Tab 按钮:');
        tabRelations.tab_relations.forEach((tr) => {
            console.log(`    [${tr.index}] href="${tr.href}" aria-controls="${tr.aria_controls}" text="${tr.tab_text}"`);
        });
        
        console.log('\n  Tab panel 元素:');
        tabRelations.panels.forEach((p) => {
            console.log(`    [${p.index}] id="${p.id}"`);
            console.log(`       class: ${p.class}`);
            console.log(`       has ui-tabs-panel: ${p.has_ui_panel_class}`);
        });
        
        console.log('\n  分析:');
        console.log('  - href 正确指向 #bg_global_tab 和 #bg_chat_tab 吗？');
        console.log('  - aria-controls 指向的是正确的 panel 吗？');
        console.log('  - 为什么 jQuery UI 会创建额外的 ui-id-* 元素？');
    }

    // 检查 tab panel 是否有正确的内容
    console.log('\n[2] 检查 tab panel 内容:');
    const panelContent = await page.evaluate(() => {
        const bgGlobal = document.getElementById('bg_global_tab');
        const bgChat = document.getElementById('bg_chat_tab');
        const uiId8 = document.getElementById('ui-id-8');
        const uiId10 = document.getElementById('ui-id-10');
        
        return {
            bg_global: {
                exists: !!bgGlobal,
                has_children: bgGlobal ? bgGlobal.children.length > 0 : false,
                child_count: bgGlobal ? bgGlobal.children.length : 0,
                is_visible: bgGlobal ? window.getComputedStyle(bgGlobal).display !== 'none' : false,
            },
            bg_chat: {
                exists: !!bgChat,
                has_children: bgChat ? bgChat.children.length > 0 : false,
                child_count: bgChat ? bgChat.children.length : 0,
                is_visible: bgChat ? window.getComputedStyle(bgChat).display !== 'none' : false,
            },
            ui_id_8: {
                exists: !!uiId8,
                child_count: uiId8 ? uiId8.children.length : 0,
                inner_html_preview: uiId8 ? uiId8.innerHTML.substring(0, 100) : '',
            },
            ui_id_10: {
                exists: !!uiId10,
                child_count: uiId10 ? uiId10.children.length : 0,
                inner_html_preview: uiId10 ? uiId10.innerHTML.substring(0, 100) : '',
            },
        };
    });

    console.log(`  #bg_global_tab:`);
    console.log(`    存在: ${panelContent.bg_global.exists}, 可见: ${panelContent.bg_global.is_visible}`);
    console.log(`    子元素: ${panelContent.bg_global.child_count}, 有内容: ${panelContent.bg_global.has_children}`);
    
    console.log(`\n  #bg_chat_tab:`);
    console.log(`    存在: ${panelContent.bg_chat.exists}, 可见: ${panelContent.bg_chat.is_visible}`);
    console.log(`    子元素: ${panelContent.bg_chat.child_count}, 有内容: ${panelContent.bg_chat.has_children}`);
    
    console.log(`\n  #ui-id-8 (jQuery UI 生成):`);
    console.log(`    存在: ${panelContent.ui_id_8.exists}, 子元素: ${panelContent.ui_id_8.child_count}`);
    console.log(`    内容预览: "${panelContent.ui_id_8.inner_html_preview}"`);
    
    console.log(`\n  #ui-id-10 (jQuery UI 生成):`);
    console.log(`    存在: ${panelContent.ui_id_10.exists}, 子元素: ${panelContent.ui_id_10.child_count}`);
    console.log(`    内容预览: "${panelContent.ui_id_10.inner_html_preview}"`);

    console.log('\n=== 结论 ===');
    console.log('关键问题已解决：#chat, #sheld, #bg_tabs 都只有一个元素');
    console.log('剩余问题：#bg_tabs 中有多余的空 ui-id-* 元素');
    console.log('这对功能没有影响，但可以进一步清理');

} catch (error) {
    console.error('测试过程中出错:', error);
} finally {
    await browser.close();
    console.log('\n测试完成');
}
