import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Listen for console messages
const consoleMessages = [];
page.on('console', msg => {
    consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
});

console.log('=== 1. Opening chat.html ===');
await page.goto('http://127.0.0.1:8000/chat.html');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(5000); // Wait for SillyTavern to fully initialize

console.log('\n=== 2. Console errors/warnings ===');
for (const msg of consoleMessages) {
    if (msg.toLowerCase().includes('error') || msg.toLowerCase().includes('warn')) {
        console.log(msg);
    }
}

console.log('\n=== 3. DOM structure check ===');
// Check #chat elements
const chatElements = await page.querySelectorAll('#chat');
console.log(`Number of #chat elements: ${chatElements.length}`);
for (let i = 0; i < chatElements.length; i++) {
    const info = await chatElements[i].evaluate(el => {
        let p = el.parentElement;
        let gp = p ? p.parentElement : null;
        return {
            id: el.id,
            parentId: p ? p.id : null,
            grandParentId: gp ? gp.id : null,
            mesCount: el.querySelectorAll('.mes').length
        };
    });
    console.log(`  #chat[${i}]: parent=#${info.parentId}, grandparent=#${info.grandParentId}, .mes count=${info.mesCount}`);
}

// Check #sheld elements
const sheldElements = await page.querySelectorAll('#sheld');
console.log(`Number of #sheld elements: ${sheldElements.length}`);
for (let i = 0; i < sheldElements.length; i++) {
    const parent = await sheldElements[i].evaluate(el => el.parentElement ? el.parentElement.tagName + '#' + el.parentElement.id : 'null');
    console.log(`  #sheld[${i}]: parent=${parent}`);
}

// Check #bg_tabs elements
const bgTabs = await page.querySelectorAll('#bg_tabs');
console.log(`Number of #bg_tabs elements: ${bgTabs.length}`);

console.log('\n=== 4. SillyTavern context check ===');
const ctxExists = await page.evaluate(() => typeof SillyTavern !== 'undefined' ? 'SillyTavern exists' : 'SillyTavern not found');
console.log(`SillyTavern: ${ctxExists}`);

if (ctxExists === 'SillyTavern exists') {
    const ctxData = await page.evaluate(() => {
        try {
            const ctx = SillyTavern.getContext();
            return {
                hasChatElement: !!ctx.chatElement,
                chatLength: ctx.chat ? ctx.chat.length : -1,
                thisChid: ctx.this_chid,
                charactersLength: ctx.characters ? ctx.characters.length : -1
            };
        } catch (e) {
            return { error: e.message };
        }
    });
    console.log(`Context data: ${JSON.stringify(ctxData)}`);

    // Check chatElement directly
    const chatElementCheck = await page.evaluate(() => {
        try {
            const ctx = SillyTavern.getContext();
            const ce = ctx.chatElement;
            if (!ce) return 'chatElement is null/undefined';
            const isJq = ce instanceof jQuery;
            const el = isJq ? ce[0] : ce;
            return {
                isJQuery: isJq,
                tagName: el.tagName,
                id: el.id,
                mesCount: el.querySelectorAll('.mes').length
            };
        } catch (e) {
            return { error: e.message };
        }
    });
    console.log(`chatElement check: ${JSON.stringify(chatElementCheck)}`);
}

console.log('\n=== 5. Page content check ===');
const chatContent = await page.evaluate(() => {
    const el = document.querySelector('#chat');
    return el ? el.innerHTML.substring(0, 500) : 'NOT FOUND';
});
console.log(`#chat content (first 500 chars): ${chatContent}`);

await browser.close();
