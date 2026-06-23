import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const results = [];
const screenshotDir = path.join(process.cwd(), 'screenshots');

if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

function log(section, message, data = null) {
    const entry = { time: new Date().toISOString(), section, message, data };
    results.push(entry);
    const prefix = `[${section}]`;
    console.log(prefix.padEnd(20, ' '), message, data !== null ? JSON.stringify(data).substring(0, 300) : '');
}

(async () => {
    log('SETUP', '启动浏览器 (使用系统 Chrome)...');
    // 使用系统 Chrome
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const browser = await chromium.launch({
        executablePath: chromePath,
        headless: true,
        channel: 'chrome'
    });
    const context = await browser.newContext();
    const page = await context.newPage();

    // 收集 console 消息
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
    const pageErrors = [];
    page.on('pageerror', (err) => {
        pageErrors.push(err.message);
        log('PAGE_ERROR', err.message.substring(0, 200));
    });

    // ===== STEP 1: 打开 chat.html =====
    log('STEP1', '打开 http://127.0.0.1:8000/chat.html');
    try {
        await page.goto('http://127.0.0.1:8000/chat.html', { waitUntil: 'networkidle', timeout: 60000 });
        log('STEP1', '页面已加载, URL: ' + page.url());
    } catch (e) {
        log('STEP1', '页面加载失败: ' + e.message);
    }
    await page.screenshot({ path: path.join(screenshotDir, '01-after-load.png') });

    // ===== STEP 2: 等待脚本加载 =====
    log('STEP2', '等待 15 秒让所有脚本加载并初始化...');
    await page.waitForTimeout(15000);

    // 检查 SillyTavern 是否就绪
    const stReady = await page.evaluate(() => {
        return {
            hasSillyTavern: typeof globalThis.SillyTavern !== 'undefined',
            hasGetContext: !!(globalThis.SillyTavern && globalThis.SillyTavern.getContext),
            characters: (() => {
                try {
                    const ctx = globalThis.SillyTavern && globalThis.SillyTavern.getContext && globalThis.SillyTavern.getContext();
                    return ctx && ctx.characters ? ctx.characters.map(c => ({ name: c.name, avatar: c.avatar })) : null;
                } catch (e) { return { error: e.message }; }
            })()
        };
    });
    log('STEP2', 'SillyTavern 状态:', stReady);
    await page.screenshot({ path: path.join(screenshotDir, '02-after-wait.png') });

    // ===== STEP 3: 检查 Console 消息 =====
    log('STEP3', 'Console 统计:', {
        total: consoleMessages.length,
        errors: consoleErrors.length,
        warnings: consoleWarnings.length,
        pageErrors: pageErrors.length
    });
    log('STEP3', '最近 Console 消息:');
    consoleMessages.slice(-30).forEach(m => console.log(`  [${m.type}] ${m.text.substring(0, 200)}`));
    if (consoleErrors.length > 0) {
        log('STEP3', 'Console 错误详情:');
        consoleErrors.forEach((e, i) => console.log(`  [ERROR ${i}] ${e.text.substring(0, 300)}`));
    }

    // ===== STEP 4: 检查 #chat 元素 =====
    log('STEP4', '检查 #chat 元素...');
    const chatStatus = await page.evaluate(() => {
        const chat = document.querySelector('#chat');
        const mesTpl = document.querySelector('#message_template');
        return {
            chat_exists: !!chat,
            chat_tagName: chat ? chat.tagName : null,
            chat_classList: chat ? Array.from(chat.classList) : null,
            chat_children_count: chat ? chat.children.length : 0,
            chat_innerText_length: chat ? chat.innerText.length : 0,
            chat_mes_count: chat ? chat.querySelectorAll('.mes').length : 0,
            message_template_exists: !!mesTpl,
            message_template_children: mesTpl ? mesTpl.children.length : 0,
            chat_outer_html_start: chat ? chat.outerHTML.substring(0, 300) : null,
            jquery_available: typeof window.$ !== 'undefined',
            jquery_version: window.$ ? window.$.fn && window.$.fn.jquery : null
        };
    });
    log('STEP4', '#chat 元素状态:', chatStatus);

    // ===== STEP 5: 检查 chatElement / messageTemplate =====
    log('STEP5', '检查关键变量值...');
    const varsStatus = await page.evaluate(() => {
        const ctx = globalThis.SillyTavern && globalThis.SillyTavern.getContext && globalThis.SillyTavern.getContext();
        return {
            ctx_exists: !!ctx,
            ctx_chat: ctx && ctx.chat ? { length: ctx.chat.length, sample: ctx.chat.slice(0, 2).map(m => ({ name: m.name, is_user: m.is_user, mes: m.mes ? m.mes.substring(0, 50) : null })) } : null,
            chat_data_length: ctx && ctx.chat ? ctx.chat.length : 0,
            has_chatElement: ctx && typeof ctx.chatElement !== 'undefined',
            has_messageTemplate: ctx && typeof ctx.messageTemplate !== 'undefined',
            chatElement_is_null: ctx && ctx.chatElement === null,
            chatElement_is_undefined: ctx && typeof ctx.chatElement === 'undefined',
            messageTemplate_is_null: ctx && ctx.messageTemplate === null,
            // 通过 jQuery DOM 检查
            jquery_chat: window.$ ? window.$('#chat').length : 0,
            jquery_chat_children: window.$ ? window.$('#chat').children().length : 0,
            jquery_message_template: window.$ ? window.$('#message_template .mes').length : 0,
            // 检查 DOM 上 #chat 内部内容
            chat_inner_html: document.querySelector('#chat') ? document.querySelector('#chat').innerHTML.substring(0, 200) : null,
            // 检查 selectCharacterById 是否可用
            has_selectCharacterById: ctx && typeof ctx.selectCharacterById === 'function',
            characters: ctx && ctx.characters ? ctx.characters.slice(0, 5).map(c => ({ name: c.name })) : null
        };
    });
    log('STEP5', '变量状态:', varsStatus);

    // ===== STEP 6: 模拟发送消息，检查消息是否渲染 =====
    log('STEP6', '尝试选择角色卡并发送消息...');
    let charSelected = false;

    if (varsStatus.has_selectCharacterById && varsStatus.characters && varsStatus.characters.length > 0) {
        const selectResult = await page.evaluate(async () => {
            try {
                const ctx = globalThis.SillyTavern.getContext();
                await ctx.selectCharacterById(0);
                return { success: true, charName: ctx.characters[0].name };
            } catch (e) { return { success: false, error: e.message }; }
        });
        log('STEP6', '选择角色卡结果:', selectResult);
        charSelected = selectResult && selectResult.success;
        await page.waitForTimeout(5000);
    } else {
        log('STEP6', '没有可用的角色卡或 selectCharacterById 函数');
    }
    await page.screenshot({ path: path.join(screenshotDir, '03-after-char-select.png') });

    // 手动在 textarea 输入并发送
    try {
        const textarea = await page.$('#send_textarea');
        if (textarea) {
            await textarea.fill('你好');
            await page.waitForTimeout(1000);
            log('STEP6', '已在 textarea 输入"你好"');

            // 点击发送按钮
            const sendBtn = await page.$('#send_but, button.send_but');
            if (sendBtn) {
                await sendBtn.click();
                log('STEP6', '已点击发送按钮');
            } else {
                await textarea.press('Enter');
                log('STEP6', '已按 Enter 发送');
            }
        } else {
            log('STEP6', '未找到 #send_textarea 元素');
        }
    } catch (e) {
        log('STEP6', '发送消息失败: ' + e.message);
    }

    // 等待消息渲染
    log('STEP7', '等待 15 秒让消息响应和渲染...');
    await page.waitForTimeout(15000);
    await page.screenshot({ path: path.join(screenshotDir, '04-after-send.png') });

    // ===== STEP 7: 检查发送后的 #chat 状态 =====
    const afterSend = await page.evaluate(() => {
        const chat = document.querySelector('#chat');
        const mesEls = chat ? chat.querySelectorAll('.mes') : [];
        return {
            chat_children_count: chat ? chat.children.length : 0,
            mes_count: mesEls.length,
            chat_inner_text_length: chat ? chat.innerText.length : 0,
            ctx_chat_length: (() => {
                try {
                    const ctx = globalThis.SillyTavern.getContext();
                    return ctx.chat ? ctx.chat.length : 0;
                } catch (e) { return { error: e.message }; }
            })(),
            messages: Array.from(mesEls).slice(0, 10).map((el, i) => ({
                idx: i,
                class: el.className.substring(0, 100),
                text: el.innerText.substring(0, 150)
            }))
        };
    });
    log('STEP7', '发送后的 #chat 状态:', {
        children_count: afterSend.chat_children_count,
        mes_count: afterSend.mes_count,
        inner_text_length: afterSend.chat_inner_text_length,
        ctx_chat_length: afterSend.ctx_chat_length
    });
    afterSend.messages.forEach(m => {
        log('STEP7_MSG', `消息[${m.idx}] ${m.class.substring(0, 50)}: ${m.text}`);
    });

    // ===== STEP 8: 深度检查 chatElement/messageTemplate 变量 =====
    log('STEP8', '深度检查...');
    const deepCheck = await page.evaluate(() => {
        // 检查 script.js 中的模块变量是否能被访问
        const chat = document.querySelector('#chat');
        const tpl = document.querySelector('#message_template .mes');

        // 检查 ctx.chatElement （它是 export const，理论上可以访问）
        const ctx = globalThis.SillyTavern.getContext();
        const result = {
            dom_chat_exists: !!chat,
            dom_message_template_mes_exists: !!tpl,
            ctx_chatElement_exists: typeof ctx.chatElement !== 'undefined',
            ctx_chatElement_type: typeof ctx.chatElement,
            ctx_chatElement_length: ctx.chatElement && ctx.chatElement.length ? ctx.chatElement.length : null,
            ctx_chatElement_selector: ctx.chatElement && ctx.chatElement.selector ? ctx.chatElement.selector : null,
            ctx_messageTemplate_exists: typeof ctx.messageTemplate !== 'undefined',
            ctx_messageTemplate_type: typeof ctx.messageTemplate,
            ctx_messageTemplate_length: ctx.messageTemplate && ctx.messageTemplate.length ? ctx.messageTemplate.length : null,
            // 关键: chatElement 中的元素是否有内容
            chatElement_html: ctx.chatElement && ctx.chatElement.html ? ctx.chatElement.html().substring(0, 300) : null,
            chatElement_children_length: ctx.chatElement && ctx.chatElement.children ? ctx.chatElement.children().length : null,
            // chatElement 是否指向正确的 DOM
            chatElement_matches_dom: ctx.chatElement && ctx.chatElement.is && ctx.chatElement.is('#chat'),
            // 直接检查 #chat 上一次是否被操作
            chat_has_mes: chat ? chat.querySelector('.mes') !== null : false,
            // 检查 chat 数据与 DOM 是否同步
            ctx_chat_data_count: ctx.chat ? ctx.chat.length : 0,
            dom_mes_count: chat ? chat.querySelectorAll('.mes').length : 0,
            mismatch_detected: ctx.chat && chat ? (ctx.chat.length !== chat.querySelectorAll('.mes').length) : null,
        };
        return result;
    });
    log('STEP8', '深度检查结果:', deepCheck);

    // 如果发现 mismatch，检查 updateMessageElement
    if (deepCheck.mismatch_detected) {
        log('STEP8', '发现 chat 数据和 DOM 不匹配，检查 updateMessageElement 函数');
        const fnStatus = await page.evaluate(() => {
            const ctx = globalThis.SillyTavern.getContext();
            return {
                has_updateMessageElement: typeof ctx.updateMessageElement === 'function',
                has_buildAndInjectChat: typeof ctx.buildAndInjectChat === 'function',
                has_rebuildExtension: typeof ctx.rebuildExtension === 'function',
                chat_is_array: Array.isArray(ctx.chat),
                sample_message: ctx.chat && ctx.chat.length > 0 ? ctx.chat[ctx.chat.length - 1] : null
            };
        });
        log('STEP8', '函数可用性:', fnStatus);
    }

    // ===== 汇总报告 =====
    console.log('\n========== 测试报告 ==========');
    console.log('Console 错误:', consoleErrors.length, '条');
    console.log('Console 警告:', consoleWarnings.length, '条');
    console.log('页面异常:', pageErrors.length, '条');
    console.log('#chat 元素存在:', chatStatus.chat_exists, '(子元素数:', chatStatus.chat_children_count, ')');
    console.log('#message_template 存在:', chatStatus.message_template_exists);
    console.log('jQuery 可用:', chatStatus.jquery_available, '版本:', chatStatus.jquery_version);
    console.log('ctx.chatElement 存在:', deepCheck.ctx_chatElement_exists, '长度:', deepCheck.ctx_chatElement_length);
    console.log('ctx.messageTemplate 存在:', deepCheck.ctx_messageTemplate_exists, '长度:', deepCheck.ctx_messageTemplate_length);
    console.log('chatElement 指向 #chat:', deepCheck.chatElement_matches_dom);
    console.log('ctx.chat 数据长度:', deepCheck.ctx_chat_data_count);
    console.log('DOM .mes 元素数量:', deepCheck.dom_mes_count);
    console.log('数据/DOM 不匹配:', deepCheck.mismatch_detected);
    console.log('角色选择成功:', charSelected);

    // 保存详细 JSON
    const outputFile = path.join(process.cwd(), 'debug-result.json');
    fs.writeFileSync(outputFile, JSON.stringify({
        consoleMessages, consoleErrors, consoleWarnings, pageErrors,
        chatStatus, varsStatus, afterSend, deepCheck,
        summary: {
            consoleErrors: consoleErrors.length,
            pageErrors: pageErrors.length,
            chatElementExists: deepCheck.ctx_chatElement_exists,
            chatElementLength: deepCheck.ctx_chatElement_length,
            messageTemplateExists: deepCheck.ctx_messageTemplate_exists,
            messageTemplateLength: deepCheck.ctx_messageTemplate_length,
            ctxChatDataLength: deepCheck.ctx_chat_data_count,
            domMesCount: deepCheck.dom_mes_count,
            mismatch: deepCheck.mismatch_detected,
            charSelected
        }
    }, null, 2));
    log('RESULT', `完整结果已保存到: ${outputFile}`);

    await browser.close();
    console.log('调试完成。');
})();
