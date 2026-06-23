import { chromium } from 'playwright';

const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--headless=new'],
});

const context = await browser.newContext();
const page = await context.newPage();

console.log('=== 深入分析 jQuery UI tabs 行为 ===');

try {
    await page.goto('http://127.0.0.1:8000/chat.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(10000);

    const info = await page.evaluate(() => {
        const results = [];
        
        // 检查 #bg_global_tab 的真实位置
        const bgGlobal = document.getElementById('bg_global_tab');
        const bgChat = document.getElementById('bg_chat_tab');
        const bgTabs = document.getElementById('bg_tabs');
        
        results.push('【1】 检查 #bg_global_tab 的位置:');
        results.push(`  document.getElementById('bg_global_tab') 存在: ${!!bgGlobal}`);
        results.push(`  父元素: ${bgGlobal?.parentElement?.tagName}#${bgGlobal?.parentElement?.id || '(no id)'}`);
        results.push(`  父元素是 #bg_tabs: ${bgGlobal?.parentElement?.id === 'bg_tabs'}`);
        
        // 检查 jQuery 选择器
        results.push('\n【2】 jQuery 选择器测试:');
        results.push(`  jQuery('#bg_tabs').length: ${jQuery('#bg_tabs').length}`);
        results.push(`  jQuery('#bg_global_tab').length: ${jQuery('#bg_global_tab').length}`);
        results.push(`  jQuery('#bg_tabs').children('#bg_global_tab').length: ${jQuery('#bg_tabs').children('#bg_global_tab').length}`);
        results.push(`  jQuery('#bg_tabs').find('#bg_global_tab').length: ${jQuery('#bg_tabs').find('#bg_global_tab').length}`);
        
        // 检查是否有多个 #bg_global_tab
        results.push('\n【3】 document.querySelectorAll(\'#bg_global_tab\'):');
        const allGlobal = document.querySelectorAll('#bg_global_tab');
        results.push(`  数量: ${allGlobal.length}`);
        allGlobal.forEach((el, idx) => {
            const path = [];
            let node = el;
            while (node && node.nodeType === 1) {
                path.unshift(`${node.tagName}${node.id ? '#' + node.id : ''}`);
                node = node.parentElement;
            }
            results.push(`  [${idx}] ${path.join(' > ')}`);
        });
        
        // 检查 jQuery UI tabs 是如何查找 panel 的
        results.push('\n【4】 模拟 jQuery UI tabs 查找 panel:');
        const $tabs = jQuery('#bg_tabs');
        const $anchors = $tabs.find('.ui-tabs-nav > li > a');
        
        results.push(`  tab 导航中的 a 标签数量: ${$anchors.length}`);
        $anchors.each(function(idx, a) {
            const href = a.getAttribute('href');
            results.push(`  [${idx}] href="${href}"`);
            
            // 模拟 jQuery UI 查找 panel 的逻辑
            if (href && href.startsWith('#')) {
                const panelId = href.substring(1);
                results.push(`    - panel ID: "${panelId}"`);
                
                // 方法 1: getElementById
                const panel1 = document.getElementById(panelId);
                results.push(`    - document.getElementById: ${panel1 ? 'found' : 'not found'}`);
                results.push(`    - panel1 parent: ${panel1?.parentElement?.tagName}#${panel1?.parentElement?.id || '(no id)'}`);
                
                // 方法 2: find within #bg_tabs
                const panel2 = bgTabs.querySelector(`#${panelId}`);
                results.push(`    - bgTabs.querySelector: ${panel2 ? 'found' : 'not found'}`);
                
                // 方法 3: children of #bg_tabs
                const panel3 = bgTabs.querySelector(`:scope > #${panelId}`);
                results.push(`    - bgTabs.querySelector(:scope > #id): ${panel3 ? 'found' : 'not found'}`);
                
                // 检查 jQuery UI 的实际查找方式
                const $panel = jQuery(href, $tabs[0]);
                results.push(`    - jQuery(href, tabs[0]): ${$panel.length} found`);
                if ($panel.length > 0) {
                    results.push(`    - jQuery 找到的 panel 父元素: ${$panel[0].parentElement.tagName}#${$panel[0].parentElement.id || '(no id)'}`);
                }
            }
        });
        
        // 检查 #bg_tabs 中所有元素的顺序
        results.push('\n【5】 #bg_tabs 的直接子元素:');
        Array.from(bgTabs.children).forEach((child, idx) => {
            results.push(`  [${idx}] ${child.tagName} id="${child.id}" class="${child.className.substring(0, 60)}"`);
        });
        
        // 关键：检查 #bg_global_tab 的位置是否正确
        results.push('\n【6】 关键检查:');
        results.push(`  bgTabs.children[0].tagName: ${bgTabs.children[0]?.tagName}`);
        results.push(`  bgTabs.children[1].id: ${bgTabs.children[1]?.id || '(no id)'}`);
        results.push(`  bgTabs.children[2].id: ${bgTabs.children[2]?.id || '(no id)'}`);
        results.push(`  #bg_global_tab 是 bgTabs.children[1]: ${bgTabs.children[1]?.id === 'bg_global_tab'}`);
        results.push(`  #bg_chat_tab 是 bgTabs.children[2]: ${bgTabs.children[2]?.id === 'bg_chat_tab'}`);
        
        // 检查是否有 display: none
        results.push('\n【7】 可见性检查:');
        results.push(`  #bg_global_tab display: ${bgGlobal ? window.getComputedStyle(bgGlobal).display : 'N/A'}`);
        results.push(`  #bg_chat_tab display: ${bgChat ? window.getComputedStyle(bgChat).display : 'N/A'}`);
        results.push(`  #bg_tabs display: ${window.getComputedStyle(bgTabs).display}`);
        
        // 检查 jQuery UI 版本和 tabs 选项
        results.push('\n【8】 jQuery UI 信息:');
        results.push(`  jQuery UI 版本: ${jQuery.ui ? jQuery.ui.version : 'not found'}`);
        
        // 尝试手动调用 jQuery UI tabs 的内部逻辑
        results.push('\n【9】 模拟手动创建 tabs:');
        const $manualTabs = jQuery('<div id="test_tabs_container"></div>');
        $manualTabs.append('<ul><li><a href="#test_panel1">Tab 1</a></li><li><a href="#test_panel2">Tab 2</a></li></ul>');
        $manualTabs.append('<div id="test_panel1">Content 1</div>');
        $manualTabs.append('<div id="test_panel2">Content 2</div>');
        jQuery('body').append($manualTabs);
        
        // 初始化测试 tabs
        $manualTabs.tabs();
        
        // 检查测试结果
        const testChildren = [];
        $manualTabs.children().each(function(idx, el) {
            testChildren.push(`${el.tagName} id="${el.id}" ui-panel=${el.classList.contains('ui-tabs-panel')}`);
        });
        results.push(`  测试 tabs 初始化后子元素: ${testChildren.join(', ')}`);
        
        // 检查 tab 按钮的 aria-controls
        const testButtons = [];
        $manualTabs.find('ul li').each(function(idx, li) {
            testButtons.push(`tab ${idx}: aria-controls="${li.getAttribute('aria-controls')}"`);
        });
        results.push(`  测试 tab 按钮: ${testButtons.join(', ')}`);
        
        // 清理
        $manualTabs.remove();
        
        return {
            results: results,
            bg_global_tab_parent_id: bgGlobal?.parentElement?.id || '(no id)',
            bg_tabs_child_count: bgTabs.children.length,
        };
    });

    console.log(`\n关键发现:`);
    console.log(`  #bg_global_tab 的父元素: ${info.bg_global_tab_parent_id}`);
    console.log(`  #bg_tabs 的直接子元素数量: ${info.bg_tabs_child_count}`);
    
    console.log('\n详细分析:');
    info.results.forEach((line, idx) => {
        console.log(`  ${line}`);
    });

} catch (error) {
    console.error('测试过程中出错:', error);
} finally {
    await browser.close();
    console.log('\n测试完成');
}
