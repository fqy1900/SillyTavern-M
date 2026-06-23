import { chromium } from 'playwright';
import fs from 'fs';

const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: false,
    slowMo: 100,
});

const context = await browser.newContext();
const page = await context.newPage();

console.log('=== 修复验证测试开始 ===');

try {
    // 1. 打开页面
    console.log('\n[步骤1] 打开 chat.html');
    await page.goto('http://127.0.0.1:8000/chat.html', { waitUntil: 'domcontentloaded' });
    console.log('  ✓ 页面已加载');

    // 2. 监听控制台错误
    const consoleErrors = [];
    const consoleWarnings = [];
    page.on('console', msg => {
        if (msg.type() === 'error') {
            consoleErrors.push(msg.text());
        } else if (msg.type() === 'warning') {
            consoleWarnings.push(msg.text());
        }
    });

    // 3. 等待页面完全加载
    console.log('\n[步骤2] 等待页面脚本加载完成（10秒）');
    await page.waitForTimeout(10000);

    // 4. 检查 #chat 元素数量和状态
    console.log('\n[步骤3] 检查 #chat 元素');
    const chatInfo = await page.evaluate(() => {
        const allChats = document.querySelectorAll('#chat');
        const result = [];
        allChats.forEach((el, idx) => {
            const style = window.getComputedStyle(el);
            result.push({
                index: idx,
                display: style.display,
                visibility: style.visibility,
                innerHTML_length: el.innerHTML.length,
                children_count: el.children.length,
                mes_count: el.querySelectorAll('.mes').length,
            });
        });
        return {
            count: allChats.length,
            details: result,
        };
    });

    console.log(`  #chat 元素数量: ${chatInfo.count}`);
    if (chatInfo.count === 0) {
        console.log('  ✗ 没有找到 #chat 元素！');
    } else if (chatInfo.count === 1) {
        console.log('  ✓ 只有 1 个 #chat 元素（修复有效）');
        console.log(`    - 可见性: display=${chatInfo.details[0].display}, visibility=${chatInfo.details[0].visibility}`);
        console.log(`    - .mes 元素数量: ${chatInfo.details[0].mes_count}`);
    } else {
        console.log(`  ⚠ 发现 ${chatInfo.count} 个 #chat 元素（仍然有问题）`);
        chatInfo.details.forEach((el, idx) => {
            console.log(`    [${idx}] display=${el.display}, visibility=${el.visibility}, .mes=${el.mes_count}`);
        });
    }

    // 5. 检查 jQuery chatElement 是否指向正确的元素
    console.log('\n[步骤4] 检查 chatElement 初始化');
    try {
        const chatElementInfo = await page.evaluate(() => {
            // 获取所有 #chat 元素
            const allChats = document.querySelectorAll('#chat');
            const allChatsInfo = [];
            allChats.forEach((el, idx) => {
                const style = window.getComputedStyle(el);
                allChatsInfo.push({
                    index: idx,
                    display: style.display,
                    visibility: style.visibility,
                    isVisible: style.display !== 'none' && style.visibility !== 'hidden',
                });
            });

            return {
                allChats: allChatsInfo,
            };
        });
        console.log(`  所有 #chat 元素: ${JSON.stringify(chatElementInfo.allChats, null, 2)}`);
    } catch (e) {
        console.log(`  chatElement 检查失败: ${e.message}`);
    }

    // 6. 检查是否有重复的 #sheld
    console.log('\n[步骤5] 检查是否有重复的 #sheld 元素');
    const sheldInfo = await page.evaluate(() => {
        const allShelds = document.querySelectorAll('#sheld');
        const result = [];
        allShelds.forEach((el, idx) => {
            const style = window.getComputedStyle(el);
            result.push({
                index: idx,
                display: style.display,
                visibility: style.visibility,
            });
        });
        return {
            count: allShelds.length,
            details: result,
        };
    });

    console.log(`  #sheld 元素数量: ${sheldInfo.count}`);
    if (sheldInfo.count === 1) {
        console.log('  ✓ 只有 1 个 #sheld 元素');
    } else if (sheldInfo.count > 1) {
        console.log(`  ⚠ 发现 ${sheldInfo.count} 个 #sheld 元素`);
    }

    // 7. 检查控制台错误
    console.log('\n[步骤6] 检查控制台输出');
    console.log(`  错误数量: ${consoleErrors.length}`);
    console.log(`  警告数量: ${consoleWarnings.length}`);
    if (consoleErrors.length > 0) {
        console.log('  前 5 个错误:');
        consoleErrors.slice(0, 5).forEach((err, idx) => {
            console.log(`    [${idx}] ${err.substring(0, 200)}`);
        });
    }

    // 8. 测试发送消息
    console.log('\n[步骤7] 测试发送消息');
    try {
        // 查找角色选择器
        const charSelectExists = await page.evaluate(() => !!document.querySelector('#character_select'));
        console.log(`  角色选择器存在: ${charSelectExists}`);

        if (charSelectExists) {
            // 尝试选择第一个角色
            const firstCharOption = await page.evaluate(() => {
                const select = document.querySelector('#character_select');
                if (select && select.options.length > 1) {
                    select.selectedIndex = 1;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    return select.options[1].text;
                }
                return null;
            });

            if (firstCharOption) {
                console.log(`  已选择角色: ${firstCharOption}`);
                await page.waitForTimeout(2000);
            }
        }

        // 查找并点击输入框
        const inputExists = await page.evaluate(() => !!document.querySelector('#send_textarea'));
        const sendBtnExists = await page.evaluate(() => !!document.querySelector('#send_button'));
        console.log(`  输入框存在: ${inputExists}, 发送按钮存在: ${sendBtnExists}`);

        if (inputExists && sendBtnExists) {
            // 输入消息
            await page.evaluate(() => {
                const textarea = document.querySelector('#send_textarea');
                textarea.value = '你好';
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
            });
            console.log('  ✓ 已输入消息 "你好"');

            // 记录发送前的 .mes 数量
            const mesCountBefore = await page.evaluate(() => {
                const chat = document.querySelector('#chat');
                return chat ? chat.querySelectorAll('.mes').length : 0;
            });
            console.log(`  发送前 .mes 数量: ${mesCountBefore}`);

            // 点击发送按钮
            await page.evaluate(() => {
                document.querySelector('#send_button').click();
            });
            console.log('  ✓ 已点击发送按钮');

            // 等待消息显示
            await page.waitForTimeout(5000);

            // 检查发送后的 .mes 数量
            const mesCountAfter = await page.evaluate(() => {
                const chat = document.querySelector('#chat');
                return chat ? chat.querySelectorAll('.mes').length : 0;
            });
            console.log(`  发送后 .mes 数量: ${mesCountAfter}`);

            if (mesCountAfter > mesCountBefore) {
                console.log('  ✓ 消息成功渲染到 #chat 中！');
            } else {
                console.log('  ⚠ 消息数量没有增加，可能仍然有问题');
            }
        }
    } catch (e) {
        console.log(`  发送消息测试失败: ${e.message}`);
    }

    // 9. 总结
    console.log('\n=== 测试总结 ===');
    console.log(`#chat 元素数量: ${chatInfo.count}（期望: 1）`);
    console.log(`#sheld 元素数量: ${sheldInfo.count}（期望: 1）`);
    console.log(`控制台错误: ${consoleErrors.length}（期望: 0）`);

    if (chatInfo.count === 1 && sheldInfo.count === 1) {
        console.log('\n✓✓✓ 修复验证通过！✓✓✓');
    } else {
        console.log('\n⚠ 可能需要进一步排查 ⚠');
    }

} catch (error) {
    console.error('测试过程中出错:', error);
} finally {
    console.log('\n按 Ctrl+C 关闭浏览器...');
    await page.waitForTimeout(10000);
    await browser.close();
}
