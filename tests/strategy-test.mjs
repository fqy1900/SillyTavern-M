import { chromium } from 'playwright';

const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--headless=new'],
});

const context = await browser.newContext();
const page = await context.newPage();

console.log('=== 测试不同的 tabs 初始化策略 ===');

try {
    await page.goto('http://127.0.0.1:8000/chat.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(10000);

    const result = await page.evaluate(() => {
        const results = [];
        
        // 策略 1: 预先给 tab panel 添加 ui-tabs-panel 类
        results.push('\n【策略 1】 预先添加类:');
        (function() {
            const $test1 = jQuery('<div id="test_tabs_1"></div>');
            $test1.append('<ul><li><a href="#panel_a">Tab A</a></li><li><a href="#panel_b">Tab B</a></li></ul>');
            $test1.append('<div id="panel_a" class="ui-tabs-panel ui-widget-content ui-corner-bottom">Content A</div>');
            $test1.append('<div id="panel_b" class="ui-tabs-panel ui-widget-content ui-corner-bottom">Content B</div>');
            jQuery('body').append($test1);
            
            $test1.tabs();
            
            const children = [];
            $test1.children().each(function(idx, el) {
                children.push(`${el.tagName}#${el.id}`);
            });
            results.push(`  子元素: ${children.join(', ')}`);
            
            // 检查 tab 按钮
            const buttons = [];
            $test1.find('ul li').each(function(idx, li) {
                buttons.push(`tab ${idx}: aria-controls="${li.getAttribute('aria-controls')}"`);
            });
            results.push(`  Tab 按钮: ${buttons.join(', ')}`);
            
            $test1.remove();
        })();
        
        // 策略 2: 让 jQuery UI 创建新元素，然后移动内容
        results.push('\n【策略 2】 让 jQuery UI 创建，然后移动内容:');
        (function() {
            const $tabs = jQuery('#bg_tabs');
            
            // 先销毁
            if ($tabs.data('ui-tabs')) {
                $tabs.tabs('destroy');
            }
            
            // 保存 tab panel 内容
            const $global = jQuery('#bg_global_tab');
            const $chat = jQuery('#bg_chat_tab');
            const globalHtml = $global.html();
            const chatHtml = $chat.html();
            
            results.push(`  - 保存内容: global=${globalHtml.substring(0, 30)}, chat=${chatHtml.substring(0, 30)}`);
            
            // 移除所有 tab panel（包括 ui-id-* 和我们的）
            $tabs.children().each(function() {
                if (!jQuery(this).is('ul')) {
                    jQuery(this).remove();
                }
            });
            results.push(`  - 清理后 #bg_tabs 子元素: ${$tabs.children().length} (应该只有 UL)`);
            
            // 初始化 tabs - 这将让 jQuery UI 创建新的 panel 元素
            $tabs.tabs();
            results.push(`  - tabs 初始化后 #bg_tabs 子元素: ${$tabs.children().length}`);
            
            // 找到 jQuery UI 创建的 panel
            const $uiPanels = $tabs.find('> [id^="ui-id-"]');
            results.push(`  - jQuery UI 创建的 panel 数量: ${$uiPanels.length}`);
            
            // 将内容移动到 jQuery UI 创建的 panel 中
            if ($uiPanels.length >= 2) {
                $uiPanels.eq(0).html(globalHtml);
                $uiPanels.eq(1).html(chatHtml);
                
                // 更新 panel ID（可选）
                $uiPanels.eq(0).attr('id', 'bg_global_tab');
                $uiPanels.eq(1).attr('id', 'bg_chat_tab');
                
                // 更新 tab 按钮的 href
                $tabs.find('ul li:nth-child(1) a').attr('href', '#bg_global_tab');
                $tabs.find('ul li:nth-child(2) a').attr('href', '#bg_chat_tab');
                
                // 重新设置 aria-controls
                $tabs.find('ul li:nth-child(1)').attr('aria-controls', 'bg_global_tab');
                $tabs.find('ul li:nth-child(2)').attr('aria-controls', 'bg_chat_tab');
                
                results.push(`  ✓ 内容已移动到正确的 panel`);
            }
            
            results.push(`  - 最终 #bg_tabs 子元素数量: ${$tabs.children().length}`);
            $tabs.children().each(function(idx, el) {
                results.push(`    [${idx}] ${el.tagName}#${el.id}`);
            });
        })();
        
        // 检查 #chat 数量
        results.push('\n【最终检查】');
        results.push(`  #chat 元素数量: ${document.querySelectorAll('#chat').length}`);
        results.push(`  #sheld 元素数量: ${document.querySelectorAll('#sheld').length}`);
        
        return { results: results };
    });

    result.results.forEach((line) => console.log(line));

} catch (error) {
    console.error('测试过程中出错:', error);
} finally {
    await browser.close();
    console.log('\n测试完成');
}
