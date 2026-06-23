import { chromium } from 'playwright';

const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--headless=new'],
});

const context = await browser.newContext();
const page = await context.newPage();

console.log('=== 检查 backgrounds.js 执行 ===');

try {
    await page.goto('http://127.0.0.1:8000/chat.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(10000);

    // 检查 #bg_tabs 中 tab panel 的真实状态
    console.log('\n[1] 手动检查 #bg_tabs 结构:');
    const structureInfo = await page.evaluate(() => {
        const bgTabs = document.getElementById('bg_tabs');
        if (!bgTabs) return { exists: false };
        
        const directChildren = [];
        Array.from(bgTabs.children).forEach((child, idx) => {
            directChildren.push({
                index: idx,
                tag: child.tagName,
                id: child.id || '(no id)',
                class_preview: child.className.substring(0, 60),
                child_count: child.children.length,
            });
        });
        
        // 检查 ul 内部
        const ul = bgTabs.querySelector('ul');
        const ulChildren = [];
        if (ul) {
            Array.from(ul.children).forEach((li, idx) => {
                const a = li.querySelector('a');
                ulChildren.push({
                    index: idx,
                    href: a?.getAttribute('href') || '(no href)',
                    text: a?.textContent?.trim() || '',
                    aria_controls: li.getAttribute('aria-controls') || '(none)',
                });
            });
        }
        
        return {
            exists: true,
            direct_children: directChildren,
            ul_children: ulChildren,
            first_child: bgTabs.firstElementChild?.tagName || '(none)',
            second_child: bgTabs.firstElementChild?.nextElementSibling?.id || '(none)',
            third_child: bgTabs.firstElementChild?.nextElementSibling?.nextElementSibling?.id || '(none)',
        };
    });

    if (structureInfo.exists) {
        console.log(`  #bg_tabs 直接子元素 (${structureInfo.direct_children.length}):`);
        structureInfo.direct_children.forEach((c) => {
            console.log(`    [${c.index}] ${c.tag} id="${c.id}" (children=${c.child_count})`);
            console.log(`       class: ${c.class_preview}`);
        });
        
        console.log(`\n  顺序: 1st=${structureInfo.first_child}, 2nd=${structureInfo.second_child}, 3rd=${structureInfo.third_child}`);
        
        console.log(`\n  ul 内部 (${structureInfo.ul_children.length} 个 li):`);
        structureInfo.ul_children.forEach((li) => {
            console.log(`    [${li.index}] href="${li.href}" text="${li.text}" aria-controls="${li.aria_controls}"`);
        });
    }

    // 关键测试：手动运行我们的修复逻辑，看看是否有效
    console.log('\n[2] 手动测试修复逻辑:');
    const manualTest = await page.evaluate(() => {
        const $bgTabs = jQuery('#bg_tabs');
        const $tabList = $bgTabs.find('> ul.bg_tabs_list');
        const $globalTab = jQuery('#bg_global_tab');
        const $chatTab = jQuery('#bg_chat_tab');
        
        console.log('  - $bgTabs.length =', $bgTabs.length);
        console.log('  - $tabList.length =', $tabList.length);
        console.log('  - $globalTab.length =', $globalTab.length);
        console.log('  - $chatTab.length =', $chatTab.length);
        
        // 检查当前 #bg_tabs 的子元素
        const beforeChildren = [];
        $bgTabs.children().each(function(idx, el) {
            beforeChildren.push({
                index: idx,
                tag: el.tagName,
                id: el.id || '(no id)',
            });
        });
        
        // 测试我们的清理逻辑
        // 1. 销毁 tabs
        if ($bgTabs.data('ui-tabs')) {
            console.log('  - 存在 ui-tabs 数据，尝试销毁');
            try { $bgTabs.tabs('destroy'); } catch(e) { console.log('  - 销毁失败:', e.message); }
        }
        
        // 2. 移除非 ul、非 tab panel 的子元素
        console.log('  - 移除多余元素...');
        $bgTabs.children().each(function() {
            const $child = jQuery(this);
            const childId = $child.attr('id') || '';
            const isUl = $child.is('ul');
            const isGlobalTab = childId === 'bg_global_tab';
            const isChatTab = childId === 'bg_chat_tab';
            
            if (!isUl && !isGlobalTab && !isChatTab) {
                console.log(`    - 移除: ${this.tagName}#${childId}`);
                $child.remove();
            }
        });
        
        // 3. 检查清理后的结构
        const afterChildren = [];
        $bgTabs.children().each(function(idx, el) {
            afterChildren.push({
                index: idx,
                tag: el.tagName,
                id: el.id || '(no id)',
            });
        });
        
        console.log('  - 清理后的子元素数量:', afterChildren.length);
        afterChildren.forEach((c) => {
            console.log(`    [${c.index}] ${c.tag} id="${c.id}"`);
        });
        
        // 4. 检查 #bg_global_tab 和 #bg_chat_tab 是否是 #bg_tabs 的直接子元素
        console.log('  - #bg_global_tab 父元素 ID:', jQuery('#bg_global_tab').parent().attr('id'));
        console.log('  - #bg_chat_tab 父元素 ID:', jQuery('#bg_chat_tab').parent().attr('id'));
        
        // 5. 重新初始化 tabs
        console.log('  - 重新初始化 tabs...');
        $bgTabs.tabs({
            beforeLoad: function(event, ui) {
                console.log('    - beforeLoad 触发，阻止默认行为');
                event.preventDefault();
            }
        });
        
        // 6. 检查初始化后的结构
        const finalChildren = [];
        $bgTabs.children().each(function(idx, el) {
            finalChildren.push({
                index: idx,
                tag: el.tagName,
                id: el.id || '(no id)',
                has_ui_panel: el.classList.contains('ui-tabs-panel'),
            });
        });
        
        console.log('  - 初始化后的子元素数量:', finalChildren.length);
        finalChildren.forEach((c) => {
            console.log(`    [${c.index}] ${c.tag} id="${c.id}" ui-panel=${c.has_ui_panel}`);
        });
        
        // 7. 检查 tab 按钮的 aria-controls
        const tabButtons = [];
        $tabList.find('li').each(function(idx, li) {
            tabButtons.push({
                index: idx,
                aria_controls: li.getAttribute('aria-controls'),
                href: li.querySelector('a')?.getAttribute('href'),
            });
        });
        
        console.log('  - Tab 按钮:');
        tabButtons.forEach((b) => {
            console.log(`    [${b.index}] href="${b.href}" aria-controls="${b.aria_controls}"`);
        });
        
        return {
            before_cleanup: beforeChildren.length,
            after_cleanup: afterChildren.length,
            final_children: finalChildren.length,
            tab_buttons: tabButtons,
        };
    });

    console.log('\n=== 结论 ===');
    console.log('检查浏览器控制台的输出以了解详细执行情况');

} catch (error) {
    console.error('测试过程中出错:', error);
} finally {
    await browser.close();
    console.log('\n测试完成');
}
