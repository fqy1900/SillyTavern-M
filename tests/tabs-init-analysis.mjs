import { chromium } from 'playwright';

const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--headless=new'],
});

const context = await browser.newContext();
const page = await context.newPage();

console.log('=== 分析 tabs 初始化问题 ===');

try {
    // 在页面完全加载后，检查 #bg_tabs 的状态
    await page.goto('http://127.0.0.1:8000/chat.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(10000);

    // 1. 检查 #bg_tabs 是否有 jQuery UI tabs 数据
    console.log('\n[1] 检查 jQuery UI tabs 状态:');
    const tabsStatus = await page.evaluate(() => {
        const $tabs = $('#bg_tabs');
        const hasTabsData = $tabs.data('ui-tabs') !== undefined;
        const isActive = $tabs.hasClass('ui-tabs');
        
        // 检查 tab 按钮的 aria-controls 属性
        const tabButtonsInfo = [];
        $tabs.find('.bg_tabs_list li').each((idx, li) => {
            const $li = $(li);
            const $a = $li.find('a');
            tabButtonsInfo.push({
                index: idx,
                class: $li.attr('class') || '',
                aria_controls: $li.attr('aria-controls') || '(none)',
                href: $a.attr('href') || '(no href)',
            });
        });
        
        return {
            exists: $tabs.length > 0,
            has_tabs_data: hasTabsData,
            is_active: isActive,
            tab_buttons: tabButtonsInfo,
        };
    });

    console.log(`  存在: ${tabsStatus.exists}`);
    console.log(`  有 ui-tabs 数据: ${tabsStatus.has_tabs_data}`);
    console.log(`  有 ui-tabs class: ${tabsStatus.is_active}`);
    console.log(`  Tab 按钮:`);
    tabsStatus.tab_buttons.forEach((btn) => {
        console.log(`    [${btn.index}] href="${btn.href}" aria-controls="${btn.aria_controls}"`);
        console.log(`       classes: ${btn.class.substring(0, 80)}`);
    });

    // 2. 模拟 tabs 初始化前后的变化
    console.log('\n[2] 手动检查 $(\'#bg_global_tab\') 在 jQuery 中的状态:');
    const panelStatus = await page.evaluate(() => {
        const bgGlobal = document.getElementById('bg_global_tab');
        const bgChat = document.getElementById('bg_chat_tab');
        
        // 检查元素在 tabs 初始化后是否被添加了类
        return {
            bg_global: {
                exists: !!bgGlobal,
                class: bgGlobal?.className || '(none)',
                has_ui_panel_class: bgGlobal?.classList?.contains('ui-tabs-panel') || false,
                parent_id: bgGlobal?.parentElement?.id || '(none)',
                parent_tag: bgGlobal?.parentElement?.tagName || '(none)',
            },
            bg_chat: {
                exists: !!bgChat,
                class: bgChat?.className || '(none)',
                has_ui_panel_class: bgChat?.classList?.contains('ui-tabs-panel') || false,
                parent_id: bgChat?.parentElement?.id || '(none)',
                parent_tag: bgChat?.parentElement?.tagName || '(none)',
            },
        };
    });

    console.log(`  #bg_global_tab:`);
    console.log(`    存在: ${panelStatus.bg_global.exists}`);
    console.log(`    class: ${panelStatus.bg_global.class}`);
    console.log(`    有 ui-tabs-panel: ${panelStatus.bg_global.has_ui_panel_class}`);
    console.log(`    父元素: ${panelStatus.bg_global.parent_tag}#${panelStatus.bg_global.parent_id}`);

    console.log(`\n  #bg_chat_tab:`);
    console.log(`    存在: ${panelStatus.bg_chat.exists}`);
    console.log(`    class: ${panelStatus.bg_chat.class}`);
    console.log(`    有 ui-tabs-panel: ${panelStatus.bg_chat.has_ui_panel_class}`);
    console.log(`    父元素: ${panelStatus.bg_chat.parent_tag}#${panelStatus.bg_chat.parent_id}`);

    // 3. 检查 #bg_tabs 的 HTML 结构（看看是否有 ul 之外的元素）
    console.log('\n[3] #bg_tabs 的结构:');
    const structureInfo = await page.evaluate(() => {
        const bgTabs = document.getElementById('bg_tabs');
        if (!bgTabs) return { exists: false };
        
        const firstLevelChildren = [];
        Array.from(bgTabs.children).forEach((child, idx) => {
            firstLevelChildren.push({
                index: idx,
                tag: child.tagName,
                id: child.id || '(no id)',
                class: child.className.substring(0, 100),
                child_count: child.children.length,
            });
        });
        
        return {
            exists: true,
            children: firstLevelChildren,
        };
    });

    if (structureInfo.exists) {
        console.log(`  直接子元素 (${structureInfo.children.length}):`);
        structureInfo.children.forEach((c) => {
            console.log(`    [${c.index}] ${c.tag}#${c.id} (children=${c.child_count})`);
            console.log(`       class: ${c.class}`);
        });
    }

    // 4. 关键测试：使用浏览器控制台手动检查 jQuery 选择器
    console.log('\n[4] 手动检查 jQuery 选择:');
    const jqueryInfo = await page.evaluate(() => {
        const $bgTabs = $('#bg_tabs');
        const $bgGlobalTab = $('#bg_global_tab');
        const $bgChatTab = $('#bg_chat_tab');
        
        // 检查 $bg_tabs.find('#bg_global_tab')
        const $foundInTabs = $bgTabs.find('#bg_global_tab');
        
        // 检查 $bg_tabs.children('#bg_global_tab')
        const $childrenInTabs = $bgTabs.children('#bg_global_tab');
        
        return {
            bg_tabs_length: $bgTabs.length,
            bg_global_length: $bgGlobalTab.length,
            bg_chat_length: $bgChatTab.length,
            find_in_tabs: $foundInTabs.length,
            children_in_tabs: $childrenInTabs.length,
        };
    });

    console.log(`  $('#bg_tabs').length = ${jqueryInfo.bg_tabs_length}`);
    console.log(`  $('#bg_global_tab').length = ${jqueryInfo.bg_global_length}`);
    console.log(`  $('#bg_chat_tab').length = ${jqueryInfo.bg_chat_length}`);
    console.log(`  $('#bg_tabs').find('#bg_global_tab').length = ${jqueryInfo.find_in_tabs}`);
    console.log(`  $('#bg_tabs').children('#bg_global_tab').length = ${jqueryInfo.children_in_tabs}`);

    console.log('\n=== 分析 ===');
    console.log('关键问题：jQuery UI tabs 无法将 #bg_global_tab/#bg_chat_tab 识别为 tab panel');
    console.log('可能原因：');
    console.log('1. 元素在 tabs 初始化时不存在（timing 问题）');
    console.log('2. 元素不是 #bg_tabs 的直接子元素');
    console.log('3. 有其他 JavaScript 代码干扰了 tabs 初始化');
    console.log('4. jQuery UI tabs 的初始化逻辑有问题');

} catch (error) {
    console.error('测试过程中出错:', error);
} finally {
    await browser.close();
    console.log('\n测试完成');
}
