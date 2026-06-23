import { chromium } from 'playwright';

const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--headless=new'],
});

const context = await browser.newContext();
const page = await context.newPage();

console.log('=== 手动测试修复函数 ===');

try {
    await page.goto('http://127.0.0.1:8000/chat.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(10000);

    // 在浏览器控制台中执行我们的修复逻辑
    console.log('\n[1] 在浏览器中执行修复逻辑:');
    const result = await page.evaluate(() => {
        const log = [];
        
        // 检查当前状态
        const $bgTabs = jQuery('#bg_tabs');
        log.push(`修复前 #bg_tabs 子元素数量: ${$bgTabs.children().length}`);
        $bgTabs.children().each(function(idx, el) {
            log.push(`  [${idx}] ${el.tagName} id="${el.id}"`);
        });
        
        // 尝试直接修复: 销毁 tabs -> 移除 ui-id-* -> 移动 tab panel 到正确位置 -> 重新初始化
        try {
            // 1. 销毁 tabs
            if ($bgTabs.data('ui-tabs')) {
                $bgTabs.tabs('destroy');
                log.push('✓ tabs 已销毁');
            }
            
            // 2. 保存 tab panel 内容
            const globalHtml = jQuery('#bg_global_tab').html();
            const chatHtml = jQuery('#bg_chat_tab').html();
            log.push(`✓ 已保存 tab panel 内容`);
            
            // 3. 移除 #bg_tabs 中所有非 ul 元素
            const $tabList = $bgTabs.find('> ul');
            $bgTabs.children().each(function() {
                if (!jQuery(this).is('ul')) {
                    jQuery(this).remove();
                }
            });
            log.push(`✓ 已清理 #bg_tabs，当前子元素数量: ${$bgTabs.children().length}`);
            
            // 4. 确保 ul 在 #bg_tabs 中
            if ($bgTabs.children('ul').length === 0) {
                $bgTabs.append($tabList);
                log.push('✓ ul 已重新添加到 #bg_tabs');
            }
            
            // 5. 创建新的 tab panel，紧跟 ul
            jQuery('<div id="bg_global_tab" class="bg_tab_panel"></div>')
                .html(globalHtml)
                .appendTo($bgTabs);
            jQuery('<div id="bg_chat_tab" class="bg_tab_panel"></div>')
                .html(chatHtml)
                .appendTo($bgTabs);
            log.push(`✓ tab panel 已重新创建，当前子元素数量: ${$bgTabs.children().length}`);
            
            // 6. 确保 tab 按钮 href 正确
            $bgTabs.find('ul li:nth-child(1) a').attr('href', '#bg_global_tab');
            $bgTabs.find('ul li:nth-child(2) a').attr('href', '#bg_chat_tab');
            log.push('✓ tab 按钮 href 已更新');
            
            // 7. 再次检查 #bg_tabs 结构
            log.push(`初始化前 #bg_tabs 子元素:`);
            $bgTabs.children().each(function(idx, el) {
                log.push(`  [${idx}] ${el.tagName} id="${el.id}"`);
            });
            
            // 8. 初始化 tabs
            $bgTabs.tabs({
                beforeLoad: function(event, ui) {
                    event.preventDefault();
                }
            });
            log.push('✓ tabs 已重新初始化');
            
            // 9. 检查初始化后的结构
            log.push(`初始化后 #bg_tabs 子元素数量: ${$bgTabs.children().length}`);
            $bgTabs.children().each(function(idx, el) {
                log.push(`  [${idx}] ${el.tagName} id="${el.id}" ui-panel=${el.classList.contains('ui-tabs-panel')}`);
            });
            
            // 10. 检查 tab 按钮的 aria-controls
            $bgTabs.find('ul li').each(function(idx, li) {
                const a = li.querySelector('a');
                log.push(`  Tab ${idx}: href="${a?.getAttribute('href')}" aria-controls="${li.getAttribute('aria-controls')}"`);
            });
            
            return {
                success: true,
                log: log,
                final_child_count: $bgTabs.children().length,
                has_extra_ui_id: $bgTabs.find('> [id^="ui-id-"]').length > 0,
            };
        } catch (e) {
            log.push(`✗ 错误: ${e.message}`);
            return {
                success: false,
                error: e.message,
                log: log,
            };
        }
    });

    // 打印结果
    console.log(`  成功: ${result.success}`);
    console.log(`  最终子元素数量: ${result.final_child_count}`);
    console.log(`  是否有多余 ui-id-*: ${result.has_extra_ui_id}`);
    console.log(`\n  执行日志:`);
    result.log.forEach((line, idx) => {
        console.log(`    ${line}`);
    });

    // 再检查一次 #chat 元素数量
    console.log('\n[2] 最终检查:');
    const finalCheck = await page.evaluate(() => {
        return {
            chat_count: document.querySelectorAll('#chat').length,
            sheld_count: document.querySelectorAll('#sheld').length,
            bgtabs_count: document.querySelectorAll('#bg_tabs').length,
        };
    });
    
    console.log(`  #chat: ${finalCheck.chat_count}`);
    console.log(`  #sheld: ${finalCheck.sheld_count}`);
    console.log(`  #bg_tabs: ${finalCheck.bgtabs_count}`);

} catch (error) {
    console.error('测试过程中出错:', error);
} finally {
    await browser.close();
    console.log('\n测试完成');
}
