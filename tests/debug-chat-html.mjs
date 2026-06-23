import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const results = [];
const screenshotDir = path.join(process.cwd(), 'tests', 'screenshots');

if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
}

function log(section, message, data = null) {
    const entry = { time: new Date().toISOString(), section, message, data };
    results.push(entry);
    const prefix = `[${section}]`;
    console.log(prefix.padEnd(20, ' '), message, data !== null ? JSON.stringify(data).substring(0, 300) : '');
}

(async () => {
    log('SETUP', '启动浏览器...');
    const browser = await chromium.launch({ headless: false, slowMo: 50 });
    const context = await browser.newContext();
    const page = await context.newPage();

    // 收集所有 console 消息
    const consoleMessages = [];
    const consoleErrors = [];
    const consoleWarnings = [];
    page.on('console', (msg) => {
        const text = msg.text();
        const type = msg.type();
        consoleMessages.push({ type, text, time: new Date().toISOString() });
        if (type === 'error') consoleErrors.push({ type, text });
        if (type === 'warning') consoleWarnings.push({ type, text });
    });

    // 收集页面错误
    const pageErrors = [];
    page.on('pageerror', (err) => {
        pageErrors.push(err.message);
        log('PAGE_ERROR', err.message);
    });

    // 1. 打开 chat.html（带一个角色卡参数）
    log('STEP1', '打开 http://127.0.0.1:8000/chat.html');
    try {
        await page.goto('http://127.0.0.1:8000/chat.html', { waitUntil: 'networkidle', timeout: 30000 });
        log('STEP1', '页面已加载');
        await page.screenshot({ path: path.join(screenshotDir, 'step1-loaded.png'), fullPage: false });
    } catch (e) {
        log('STEP1', '页面加载失败: ' + e.message);
    }

    // 2. 等待页面完全加载
    log('STEP2', '等待 15 秒让页面脚本全部加载...');
    await page.waitForTimeout(15000);
    await page.screenshot({ path: path.join(screenshotDir, 'step2-after-15s.png') });

    // 检查是否有角色卡列表
    try {
        const charList = await page.evaluate(() => {
            const ctx = window.SillyTavern && window.SillyTavern.getContext && window.SillyTavern.getContext();
            return ctx && ctx.characters ? ctx.characters.map(c => ({ name: c.name, avatar: c.avatar })) : null;
        });
        log('STEP2', '角色卡列表:', charList);
    } catch (e) {
        log('STEP2', '获取角色卡列表失败: ' + e.message);
    }

    // 3. 检查 Console 错误信息
    log('STEP3', '检查 Console 消息...');
    log('STEP3', `Console 消息总数: ${consoleMessages.length}`);
    log('STEP3', `Console 错误数: ${consoleErrors.length}`);
    log('STEP3', `Console 警告数: ${consoleWarnings.length}`);
    log('STEP3', `Page 错误数: ${pageErrors.length}`);

    // 打印所有错误
    consoleErrors.forEach((err, i) => {
        log('CONSOLE_ERROR', `错误 #${i + 1}: ${err.text.substring(0, 500)}`);
    });
    consoleWarnings.forEach((warn, i) => {
        log('CONSOLE_WARN', `警告 #${i + 1}: ${warn.text.substring(0, 500)}`);
    });
    pageErrors.forEach((err, i) => {
        log('PAGE_ERROR', `页面错误 #${i + 1}: ${err.substring(0, 500)}`);
    });

    // 截取最近的 20 条 console 消息
    const recentConsole = consoleMessages.slice(-30);
    log('STEP3', '最近 30 条 Console 消息:');
    recentConsole.forEach((m, i) => {
        console.log(`  [${m.type}] ${m.text.substring(0, 200)}`);
    });

    // 4. 检查 #chat 元素状态
    log('STEP4', '检查 #chat 元素状态...');
    const chatStatus = await page.evaluate(() => {
        const chat = document.querySelector('#chat');
        return {
            exists: !!chat,
            innerHTML_length: chat ? chat.innerHTML.length : 0,
            innerText_length: chat ? chat.innerText.length : 0,
            children_count: chat ? chat.children.length : 0,
            mes_count: chat ? chat.querySelectorAll('.mes').length : 0,
            outerHTML: chat ? chat.outerHTML.substring(0, 500) : null,
            class_list: chat ? Array.from(chat.classList) : []
        };
    });
    log('STEP4', '#chat 元素状态:', chatStatus);

    // 5. 检查 chatElement, messageTemplate 等变量
    log('STEP5', '检查 chatElement / messageTemplate 变量...');
    const varsStatus = await page.evaluate(() => {
        const ctx = window.SillyTavern && window.SillyTavern.getContext && window.SillyTavern.getContext();
        const result = {
            ctx_exists: !!ctx,
            ctx_keys: ctx ? Object.keys(ctx).slice(0, 50) : null,
            chatElement_exists: false,
            chatElement_outerHTML: null,
            messageTemplate_exists: false,
            messageTemplate_outerHTML: null,
            chat_data: null,
            chat_length: 0
        };
        if (ctx) {
            // 尝试访问各种可能的变量名
            result.chat_data = ctx.chat ? { length: ctx.chat.length, keys: Object.keys(ctx.chat).slice(0, 20) } : null;
            result.chat_length = ctx.chat ? ctx.chat.length : 0;
            // 检查可能的 chatElement 定义位置
            if (window.chatElement) {
                result.chatElement_exists = true;
                result.chatElement_outerHTML = window.chatElement.outerHTML.substring(0, 300);
            }
            if (window.messageTemplate) {
                result.messageTemplate_exists = true;
                result.messageTemplate_outerHTML = window.messageTemplate.outerHTML.substring(0, 300);
            }
            if (ctx.chatElement) {
                result.chatElement_exists = true;
                result.chatElement_outerHTML = typeof ctx.chatElement === 'string' ? ctx.chatElement.substring(0, 300) : (ctx.chatElement.outerHTML ? ctx.chatElement.outerHTML.substring(0, 300) : 'object');
            }
            if (ctx.messageTemplate) {
                result.messageTemplate_exists = true;
                result.messageTemplate_outerHTML = typeof ctx.messageTemplate === 'string' ? ctx.messageTemplate.substring(0, 300) : (ctx.messageTemplate.outerHTML ? ctx.messageTemplate.outerHTML.substring(0, 300) : 'object');
            }
        }
        return result;
    });
    log('STEP5', 'ctx 变量状态:', {
        ctx_exists: varsStatus.ctx_exists,
        chatElement_exists: varsStatus.chatElement_exists,
        messageTemplate_exists: varsStatus.messageTemplate_exists,
        chat_length: varsStatus.chat_length
    });

    // 6. 尝试选择一个角色卡
    log('STEP6', '选择一个角色卡并发送消息...');
    let charSelected = false;
    try {
        // 先尝试点击角色选择面板
        const charPanelBtn = await page.$('a[href="#character_panels"]');
        if (charPanelBtn) {
            await charPanelBtn.click();
            await page.waitForTimeout(2000);
            log('STEP6', '已点击角色卡面板按钮');
        }

        // 尝试通过 JS API 选择角色
        const selectResult = await page.evaluate(async () => {
            const ctx = window.SillyTavern && window.SillyTavern.getContext && window.SillyTavern.getContext();
            if (!ctx || !ctx.characters || ctx.characters.length === 0) {
                return { success: false, reason: 'no characters' };
            }
            const char = ctx.characters[0];
            const idx = 0;
            try {
                if (typeof ctx.selectCharacterById === 'function') {
                    await ctx.selectCharacterById(idx);
                    return { success: true, charName: char.name };
                } else if (typeof ctx.selectCharacter === 'function') {
                    await ctx.selectCharacter(idx);
                    return { success: true, charName: char.name };
                }
                return { success: false, reason: 'no select function' };
            } catch (e) {
                return { success: false, reason: e.message };
            }
        });
        log('STEP6', '选择角色卡结果:', selectResult);
        charSelected = selectResult && selectResult.success;
        await page.waitForTimeout(3000);
    } catch (e) {
        log('STEP6', '选择角色卡出错: ' + e.message);
    }

    await page.screenshot({ path: path.join(screenshotDir, 'step6-after-char.png') });

    // 6b. 在文本框输入消息并点击发送
    log('STEP6b', '输入"你好"并发送...');
    try {
        // 查找 textarea 输入框
        const textarea = await page.$('#send_textarea, textarea, [data-testid="send_textarea"]');
        if (textarea) {
            await textarea.fill('你好');
            await page.waitForTimeout(500);
            log('STEP6b', '已输入文本');

            // 查找发送按钮
            const sendBtn = await page.$('#send_but, button#send, [data-testid="send_button"], button[aria-label*="send"], button[aria-label*="Send"], .right-nav-panel button:not([disabled]):not([style*="display: none"])');
            if (sendBtn) {
                await sendBtn.click();
                log('STEP6b', '已点击发送按钮');
            } else {
                // 尝试按回车
                await textarea.press('Enter');
                log('STEP6b', '已按 Enter 发送');
            }
        } else {
            log('STEP6b', '未找到 textarea 输入框');
        }
    } catch (e) {
        log('STEP6b', '输入/发送失败: ' + e.message);
    }

    // 7. 等待回复，检查 #chat 容器是否有新消息元素
    log('STEP7', '等待 10 秒让消息渲染...');
    await page.waitForTimeout(10000);
    await page.screenshot({ path: path.join(screenshotDir, 'step7-after-send.png') });

    const chatAfterSend = await page.evaluate(() => {
        const chat = document.querySelector('#chat');
        const mes = chat ? Array.from(chat.querySelectorAll('.mes')).map(el => ({
            class: el.className.substring(0, 100),
            text: el.innerText.substring(0, 200),
            outerHTML_length: el.outerHTML.length
        })) : [];
        return {
            mes_count: mes.length,
            chat_innerHTML_length: chat ? chat.innerHTML.length : 0,
            messages: mes
        };
    });
    log('STEP7', '发送后 #chat 状态:', {
        mes_count: chatAfterSend.mes_count,
        chat_innerHTML_length: chatAfterSend.chat_innerHTML_length
    });
    chatAfterSend.messages.forEach((m, i) => {
        log('STEP7_MSG', `消息 #${i + 1}: ${m.text.substring(0, 150)}`);
    });

    // 8. 执行命令检查关键变量
    log('STEP8', '执行命令检查...');
    const step8 = await page.evaluate(() => {
        const chatEl = document.querySelector('#chat');
        const mesEls = document.querySelectorAll('#chat .mes');
        const ctx = window.SillyTavern && window.SillyTavern.getContext && window.SillyTavern.getContext();
        return {
            chatEl_exists: !!chatEl,
            chatEl_tagName: chatEl ? chatEl.tagName : null,
            chatEl_children: chatEl ? chatEl.children.length : 0,
            mesEls_count: mesEls.length,
            ctx_chat_length: ctx && ctx.chat ? ctx.chat.length : 0,
            ctx_chat: ctx && ctx.chat ? ctx.chat.map(m => ({
                is_user: m.is_user,
                name: m.name,
                mes_length: m.mes ? m.mes.length : 0,
                extra: Object.keys(m)
            })) : null
        };
    });
    log('STEP8', 'document.querySelector(#chat):', {
        exists: step8.chatEl_exists,
        tagName: step8.chatEl_tagName,
        children: step8.chatEl_children
    });
    log('STEP8', 'document.querySelectorAll(#chat .mes).length:', step8.mesEls_count);
    log('STEP8', 'SillyTavern.getContext().chat.length:', step8.ctx_chat_length);
    if (step8.ctx_chat) {
        step8.ctx_chat.forEach((m, i) => {
            log('STEP8_CHAT', `chat[${i}]: is_user=${m.is_user}, name=${m.name}, mes_length=${m.mes_length}`);
        });
    }

    // 深入检查 chatElement 和 messageTemplate 定义位置
    log('STEP8', '深度检查脚本中定义的变量...');
    const deepCheck = await page.evaluate(() => {
        // 检查所有可能定义这些变量的脚本
        const result = {
            window_chatElement: typeof window.chatElement !== 'undefined',
            window_messageTemplate: typeof window.messageTemplate !== 'undefined',
            globalThis_chatElement: typeof globalThis.chatElement !== 'undefined',
            // 检查 script.js 内容
            scriptJs_has_chatElement: false,
            scriptJs_has_messageTemplate: false,
            chat_html: document.querySelector('#chat') ? document.querySelector('#chat').innerHTML.substring(0, 500) : null
        };
        // 检查 script.js 是否定义了这些
        const scripts = document.querySelectorAll('script');
        for (const s of scripts) {
            if (s.src && s.src.includes('script.js')) {
                // 已加载的 script.js
                try {
                    // 通过 Function 间接访问全局作用域
                    const hasChat = new Function('return typeof chatElement !== "undefined"')();
                    const hasTemplate = new Function('return typeof messageTemplate !== "undefined"')();
                    result.scriptJs_has_chatElement = hasChat;
                    result.scriptJs_has_messageTemplate = hasTemplate;
                } catch (e) {}
                break;
            }
        }
        // 直接检查全局作用域（非严格模式下 script.js 的 var 声明会挂载到 window）
        try {
            result.window_chatElement = new Function('return typeof chatElement !== "undefined" && chatElement !== null')();
            result.window_messageTemplate = new Function('return typeof messageTemplate !== "undefined" && messageTemplate !== null')();
            if (result.window_chatElement) {
                result.chatElement_info = new Function('return typeof chatElement + " | " + (chatElement && chatElement.tagName ? chatElement.tagName : "not-DOM") + " | " + (chatElement && chatElement.outerHTML ? chatElement.outerHTML.substring(0, 200) : "")')();
            }
            if (result.window_messageTemplate) {
                result.messageTemplate_info = new Function('return typeof messageTemplate + " | " + (messageTemplate && messageTemplate.tagName ? messageTemplate.tagName : "not-DOM") + " | " + (messageTemplate && messageTemplate.outerHTML ? messageTemplate.outerHTML.substring(0, 200) : "")')();
            }
        } catch (e) {
            result.eval_error = e.message;
        }
        return result;
    });
    log('STEP8', '深度检查结果:', deepCheck);

    // 关闭浏览器
    await page.waitForTimeout(3000);
    await browser.close();

    // 输出总结报告
    console.log('\n========== 测试报告 ==========');
    console.log(`Console 错误: ${consoleErrors.length} 条`);
    console.log(`Console 警告: ${consoleWarnings.length} 条`);
    console.log(`页面未捕获异常: ${pageErrors.length} 条`);
    console.log(`#chat 元素存在: ${chatStatus.exists}`);
    console.log(`#chat .mes 元素数量: ${chatAfterSend.mes_count}`);
    console.log(`ctx.chat 数据长度: ${step8.ctx_chat_length}`);
    console.log(`已选择角色: ${charSelected}`);
    console.log(`chatElement 变量定义: ${deepCheck.window_chatElement}`);
    console.log(`messageTemplate 变量定义: ${deepCheck.window_messageTemplate}`);

    // 保存详细结果到 JSON 文件
    const outputFile = path.join(process.cwd(), 'tests', 'debug-chat-html-result.json');
    fs.writeFileSync(outputFile, JSON.stringify({
        consoleMessages, consoleErrors, consoleWarnings, pageErrors,
        chatStatus, varsStatus, chatAfterSend, step8, deepCheck,
        summary: {
            consoleErrorCount: consoleErrors.length,
            consoleWarnCount: consoleWarnings.length,
            pageErrorCount: pageErrors.length,
            chatElementExists: chatStatus.exists,
            mesCountAfterSend: chatAfterSend.mes_count,
            ctxChatLength: step8.ctx_chat_length,
            charSelected,
            chatElementDefined: deepCheck.window_chatElement,
            messageTemplateDefined: deepCheck.window_messageTemplate
        }
    }, null, 2));
    log('RESULT', `详细结果已保存到: ${outputFile}`);
})();
