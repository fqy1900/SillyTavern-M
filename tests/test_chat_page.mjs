/**
 * 测试 chat.html 页面，检查控制台错误
 */
import { chromium } from '@playwright/test';

const errors = [];
const warnings = [];
const logs = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// 监听控制台消息
page.on('console', msg => {
    if (msg.type() === 'error') {
        errors.push(msg.text());
    } else if (msg.type() === 'warning') {
        warnings.push(msg.text());
    } else {
        logs.push(msg.text());
    }
});

// 导航到 chat.html
console.log('Navigating to chat.html...');
await page.goto('http://localhost:8000/chat.html?t=playwright-test');

// 等待页面加载
console.log('Waiting for page to load...');
await page.waitForTimeout(12000);

// 获取页面标题
const title = await page.title();
console.log(`Page title: ${title}`);

// 检查页面状态
const heading = page.locator('h2').first();
if (heading) {
    const headingText = await heading.textContent();
    console.log(`Page heading: ${headingText}`);
}

// 打印错误
console.log('\n=== ERRORS ===');
for (const err of errors) {
    console.log(`ERROR: ${err.substring(0, 200)}`);
}

console.log(`\nTotal errors: ${errors.length}`);
console.log(`Total warnings: ${warnings.length}`);

// 截图
await page.screenshot({ path: '../temp/chat-test.png', fullPage: true });
console.log('\nScreenshot saved to temp/chat-test.png');

await browser.close();