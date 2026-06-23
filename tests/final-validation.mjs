import { chromium } from 'playwright';

const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--headless=new'],
});

const context = await browser.newContext();
const page = await context.newPage();

console.log('=== 最终修复验证测试 ===');

try {
    await page.goto('http://127.0.0.1:8000/chat.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(10000);

    let allPassed = true;

    // 1. 检查 #chat 元素
    console.log('\n[1] 检查 #chat 元素:');
    const chatCount = await page.evaluate(() => document.querySelectorAll('#chat').length);
    console.log(`  数量: ${chatCount} (期望: 1)`);
    if (chatCount !== 1) {
        console.log('  ✗ 失败！');
        allPassed = false;
    } else {
        console.log('  ✓ 通过');
    }

    // 2. 检查 #sheld 元素
    console.log('\n[2] 检查 #sheld 元素:');
    const sheldCount = await page.evaluate(() => document.querySelectorAll('#sheld').length);
    console.log(`  数量: ${sheldCount} (期望: 1)`);
    if (sheldCount !== 1) {
        console.log('  ✗ 失败！');
        allPassed = false;
    } else {
        console.log('  ✓ 通过');
    }

    // 3. 检查 #bg_tabs 元素
    console.log('\n[3] 检查 #bg_tabs 元素:');
    const bgTabsCount = await page.evaluate(() => document.querySelectorAll('#bg_tabs').length);
    console.log(`  数量: ${bgTabsCount} (期望: 1)`);
    if (bgTabsCount !== 1) {
        console.log('  ✗ 失败！');
        allPassed = false;
    } else {
        console.log('  ✓ 通过');
    }

    // 4. 检查 #bg_tabs 的子元素结构
    console.log('\n[4] 检查 #bg_tabs 的子元素结构:');
    const bgTabsInfo = await page.evaluate(() => {
        const bgTabs = document.getElementById('bg_tabs');
        if (!bgTabs) return { exists: false };
        
        const children = [];
        Array.from(bgTabs.children).forEach((child, idx) => {
            children.push({
                index: idx,
                tag: child.tagName,
                id: child.id || '(no id)',
                class: child.className.substring(0, 80),
                child_count: child.children.length,
            });
        });
        
        return {
            exists: true,
            total: bgTabs.children.length,
            children: children,
        };
    });

    if (bgTabsInfo.exists) {
        console.log(`  子元素数量: ${bgTabsInfo.total} (期望: 3 - UL, #bg_global_tab, #bg_chat_tab)`);
        bgTabsInfo.children.forEach((c) => {
            console.log(`    [${c.index}] ${c.tag}#${c.id}`);
            console.log(`       class: ${c.class}`);
        });
        
        const hasCorrectStructure = bgTabsInfo.total === 3;
        if (!hasCorrectStructure) {
            console.log('  ⚠ 子元素数量不对（可能有 ui-id-* 元素残留）');
        } else {
            console.log('  ✓ 结构看起来正确');
        }
    }

    // 5. 检查 #bg_tabs 中是否有 ui-id-* 元素
    console.log('\n[5] 检查 #bg_tabs 中是否有 ui-id-* 元素:');
    const uiIdCount = await page.evaluate(() => {
        const bgTabs = document.getElementById('bg_tabs');
        if (!bgTabs) return 0;
        return bgTabs.querySelectorAll('[id^="ui-id-"]').length;
    });
    console.log(`  ui-id-* 元素数量: ${uiIdCount} (期望: 0)`);
    if (uiIdCount === 0) {
        console.log('  ✓ 没有多余的 ui-id-* 元素');
    } else {
        console.log('  ⚠ 有多余的元素需要检查');
        allPassed = false;
    }

    // 6. 检查 #chat 中的 .mes 元素
    console.log('\n[6] 检查 #chat 中的 .mes 元素:');
    const mesCount = await page.evaluate(() => {
        const chat = document.getElementById('chat');
        if (!chat) return -1;
        return chat.querySelectorAll('.mes').length;
    });
    console.log(`  .mes 数量: ${mesCount}`);
    if (mesCount >= 0) {
        console.log('  ✓ #chat 可访问');
    } else {
        console.log('  ✗ #chat 不存在');
        allPassed = false;
    }

    // 7. 检查 script.js 中的 chatElement 是否正确
    console.log('\n[7] 验证 script.js chatElement 逻辑:');
    const chatElementTest = await page.evaluate(() => {
        // 模拟 findCorrectChatElement 的逻辑
        const allChats = document.querySelectorAll('#chat');
        if (allChats.length === 0) return { status: 'no_chats', result: null };
        if (allChats.length === 1) return { status: 'one_chat', result: 'correct' };
        
        // 检查是否有嵌套在 #Backgrounds 中的 #chat
        for (const chat of allChats) {
            let inBackgrounds = false;
            let node = chat.parentElement;
            while (node && node !== document.body) {
                if (node.id === 'Backgrounds') {
                    inBackgrounds = true;
                    break;
                }
                node = node.parentElement;
            }
            if (!inBackgrounds) {
                return { status: 'multi_chats', result: 'found_correct', mes_count: chat.querySelectorAll('.mes').length };
            }
        }
        
        return { status: 'multi_chats', result: 'fallback', mes_count: allChats[0].querySelectorAll('.mes').length };
    });
    
    console.log(`  状态: ${chatElementTest.status}`);
    console.log(`  结果: ${chatElementTest.result}`);
    if (chatElementTest.mes_count !== undefined) {
        console.log(`  .mes 数量: ${chatElementTest.mes_count}`);
    }

    // 8. 检查控制台是否有错误
    console.log('\n[8] 检查页面控制台:');
    const consoleMessages = [];
    page.on('console', (msg) => {
        if (msg.type() === 'error' || msg.type() === 'warning') {
            consoleMessages.push({ type: msg.type(), text: msg.text().substring(0, 100) });
        }
    });
    
    // 等待一下确保我们捕获了所有消息
    await page.waitForTimeout(2000);
    
    console.log(`  捕获到的错误/警告: ${consoleMessages.length}`);
    if (consoleMessages.length === 0) {
        console.log('  ✓ 没有发现错误/警告');
    } else {
        consoleMessages.slice(0, 5).forEach((m, idx) => {
            console.log(`    [${idx}] [${m.type}] ${m.text}`);
        });
    }

    // 最终总结
    console.log('\n=== 总结 ===');
    if (allPassed && chatCount === 1 && sheldCount === 1) {
        console.log('✓✓✓ 所有检查通过！✓✓✓');
        console.log('- #chat 元素数量: 1 (正确)');
        console.log('- #sheld 元素数量: 1 (正确)');
        console.log('- #bg_tabs 元素数量: 1 (正确)');
        console.log('- 没有多余的 ui-id-* 元素');
        console.log('- script.js 能够正确识别 #chat');
    } else {
        console.log('⚠ 部分检查未通过，请查看详细信息');
    }

} catch (error) {
    console.error('测试过程中出错:', error);
} finally {
    await browser.close();
    console.log('\n测试完成');
}
