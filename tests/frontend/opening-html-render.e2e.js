/**
 * 开场白 HTML 渲染 E2E 测试
 *
 * 测试场景：
 * 1. 创建带有 HTML 代码块开场白的角色
 * 2. 创建新聊天
 * 3. 验证 HTML 内容正确渲染
 * 4. 验证嵌入脚本正确执行
 *
 * 运行方式：
 * 1. 确保 SillyTavern 服务运行在 http://127.0.0.1:8000
 * 2. cd tests && npm install (如果需要)
 * 3. npm run test:e2e
 */

import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

test.describe('开场白 HTML 渲染测试', () => {
    test.beforeEach(testSetup.awaitST);

    test('应正确渲染开场白中的 HTML 代码块', async ({ page }) => {
        // 创建带有 HTML 开场白的测试角色
        const testChar = {
            id: 'test_html_opening_' + Date.now(),
            name: 'HTML测试角色',
            description: '测试角色用于验证 HTML 开场白渲染',
            first_mes: '```html\n<div class="test-opening">开场白内容</div>\n```',
            avatar: '/api/chat/character-avatar/default_Seraphina',
        };

        // 上传测试角色 (通过 API)
        await page.evaluate(async (ch) => {
            const res = await fetch('/api/chat/character/' + ch.id, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ch),
            });
            return res.json();
        }, testChar);

        // 选择该角色创建新聊天
        await page.click('#charList .char-card[data-id="' + testChar.id + '"]');

        // 等待聊天消息加载
        await page.waitForSelector('#chatMessages .chat-bubble', { timeout: 5000 });

        // 验证开场白内容被渲染
        const openingContent = await page.locator('#chatMessages .bubble-content .test-opening');
        await expect(openingContent).toBeVisible();
        await expect(openingContent).toHaveText('开场白内容');
    });

    test('应正确执行开场白中的嵌入脚本', async ({ page }) => {
        // 创建带有脚本的 HTML 开场白
        const testChar = {
            id: 'test_script_opening_' + Date.now(),
            name: '脚本测试角色',
            description: '测试角色用于验证脚本执行',
            first_mes: '```html\n<div id="script-test">脚本测试</div>\n<script>\nwindow.__OPENING_SCRIPT_EXECUTED = true;\nwindow.__OPENING_SCRIPT_VALUE = 42;\n</script>\n```',
            avatar: '/api/chat/character-avatar/default_Seraphina',
        };

        // 上传测试角色
        await page.evaluate(async (ch) => {
            const res = await fetch('/api/chat/character/' + ch.id, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ch),
            });
            return res.json();
        }, testChar);

        // 选择该角色
        await page.click('#charList .char-card[data-id="' + testChar.id + '"]');

        // 等待聊天消息加载
        await page.waitForSelector('#chatMessages .chat-bubble', { timeout: 5000 });

        // 等待脚本执行
        await page.waitForFunction('window.__OPENING_SCRIPT_EXECUTED === true', { timeout: 5000 });

        // 验证脚本执行结果
        const scriptValue = await page.evaluate(() => window.__OPENING_SCRIPT_VALUE);
        expect(scriptValue).toBe(42);

        // 验证脚本设置的元素存在
        const scriptTestDiv = await page.locator('#chatMessages #script-test');
        await expect(scriptTestDiv).toBeVisible();
    });

    test('应正确处理开场白中的 style 标签', async ({ page }) => {
        // 创建带有样式的 HTML 开场白
        const testChar = {
            id: 'test_style_opening_' + Date.now(),
            name: '样式测试角色',
            description: '测试角色用于验证样式应用',
            first_mes: '```html\n<style>\n.opening-style-test { color: red; font-weight: bold; }\n</style>\n<div class="opening-style-test">红色加粗文本</div>\n```',
            avatar: '/api/chat/character-avatar/default_Seraphina',
        };

        // 上传测试角色
        await page.evaluate(async (ch) => {
            const res = await fetch('/api/chat/character/' + ch.id, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ch),
            });
            return res.json();
        }, testChar);

        // 选择该角色
        await page.click('#charList .char-card[data-id="' + testChar.id + '"]');

        // 等待聊天消息加载
        await page.waitForSelector('#chatMessages .chat-bubble', { timeout: 5000 });

        // 等待样式应用
        await page.waitForTimeout(500);

        // 验证样式被正确应用 (通过检查 computed style)
        const styledDiv = await page.locator('#chatMessages .bubble-content .opening-style-test');
        await expect(styledDiv).toBeVisible();

        // 获取元素的 computed style
        const color = await styledDiv.evaluate(el => getComputedStyle(el).color);
        const fontWeight = await styledDiv.evaluate(el => getComputedStyle(el).fontWeight);

        // 验证样式已应用（color 应该是 rgb(255, 0, 0) 即红色，font-weight 应该是 bold）
        expect(color).toBe('rgb(255, 0, 0)');
        expect(fontWeight).toBe('700');
    });

    test('普通 markdown 开场白应正常渲染', async ({ page }) => {
        // 创建普通 markdown 开场白
        const testChar = {
            id: 'test_md_opening_' + Date.now(),
            name: 'Markdown测试角色',
            description: '测试角色用于验证普通 markdown 渲染',
            first_mes: '这是一个**加粗**和`代码`的开场白。',
            avatar: '/api/chat/character-avatar/default_Seraphina',
        };

        // 上传测试角色
        await page.evaluate(async (ch) => {
            const res = await fetch('/api/chat/character/' + ch.id, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ch),
            });
            return res.json();
        }, testChar);

        // 选择该角色
        await page.click('#charList .char-card[data-id="' + testChar.id + '"]');

        // 等待聊天消息加载
        await page.waitForSelector('#chatMessages .chat-bubble', { timeout: 5000 });

        // 验证 markdown 被渲染
        const boldText = await page.locator('#chatMessages .bubble-content strong');
        await expect(boldText).toHaveText('加粗');

        const codeText = await page.locator('#chatMessages .bubble-content code');
        await expect(codeText).toHaveText('代码');
    });
});