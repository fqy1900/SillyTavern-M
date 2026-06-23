import { chromium } from 'playwright';

(async () => {
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const browser = await chromium.launch({
        executablePath: chromePath,
        headless: true,
    });

    const page = await browser.newPage();
    console.log('打开 chat.html...');
    await page.goto('http://127.0.0.1:8000/chat.html', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(10000);

    const result = await page.evaluate(() => {
        // 检查 ui-id-4 的内容
        const uiId4 = document.querySelector('#ui-id-4');
        const uiId6 = document.querySelector('#ui-id-6');

        // 检查 bg_tabs 的结构
        const bgTabs = document.querySelector('#bg_tabs');

        return {
            bg_tabs_children_count: bgTabs ? bgTabs.children.length : 0,
            bg_tabs_children: bgTabs ? Array.from(bgTabs.children).map(c => c.tagName + (c.id ? '#' + c.id : '') + ' class=' + String(c.className).substring(0, 40)) : [],

            ui_id_4_exists: !!uiId4,
            ui_id_4_content_length: uiId4 ? uiId4.innerHTML.length : 0,
            ui_id_4_children: uiId4 ? Array.from(uiId4.children).slice(0, 3).map(c => c.tagName + '#' + c.id) : [],
            ui_id_4_preview: uiId4 ? uiId4.innerHTML.substring(0, 200) : null,

            ui_id_6_exists: !!uiId6,
            ui_id_6_content_length: uiId6 ? uiId6.innerHTML.length : 0,
            ui_id_6_children: uiId6 ? Array.from(uiId6.children).slice(0, 3).map(c => c.tagName + '#' + c.id) : [],

            bg_global_tab_exists: document.querySelector('#bg_global_tab') !== null,
            bg_chat_tab_exists: document.querySelector('#bg_chat_tab') !== null,

            bg_global_tab_in_bg_tabs: bgTabs && bgTabs.querySelector('#bg_global_tab') !== null,
            bg_chat_tab_in_bg_tabs: bgTabs && bgTabs.querySelector('#bg_chat_tab') !== null,

            bg_tabs_html_size: bgTabs ? bgTabs.innerHTML.length : 0,
        };
    });

    console.log('=== #bg_tabs 结构分析 ===');
    console.log(JSON.stringify(result, null, 2));

    const result2 = await page.evaluate(() => {
        // 检查浏览器是否缓存了旧的 DOM
        const bgTabs = document.querySelector('#bg_tabs');
        if (!bgTabs) return { error: 'bg_tabs not found' };

        // 直接检查 bgTabs 的第一个子元素
        return {
            first_child: bgTabs.children[0] ? bgTabs.children[0].tagName + '#' + bgTabs.children[0].id : 'NONE',
            second_child: bgTabs.children[1] ? bgTabs.children[1].tagName + '#' + bgTabs.children[1].id : 'NONE',
            third_child: bgTabs.children[2] ? bgTabs.children[2].tagName + '#' + bgTabs.children[2].id : 'NONE',
            fourth_child: bgTabs.children[3] ? bgTabs.children[3].tagName + '#' + bgTabs.children[3].id : 'NONE',
            fifth_child: bgTabs.children[4] ? bgTabs.children[4].tagName + '#' + bgTabs.children[4].id : 'NONE',
        };
    });

    console.log('\n=== 精确子元素检查 ===');
    console.log(JSON.stringify(result2, null, 2));

    const result3 = await page.evaluate(() => {
        // 检查所有 #sheld 和 #chat 的精确位置
        const allShelds = Array.from(document.querySelectorAll('#sheld')).map((el, i) => {
            let parent = el.parentElement;
            const chain = [];
            for (let j = 0; j < 10 && parent; j++) {
                chain.push(parent.tagName + (parent.id ? '#' + parent.id : ''));
                parent = parent.parentElement;
            }
            return { index: i, parent_chain: chain };
        });

        return allShelds;
    });

    console.log('\n=== #sheld 父链 ===');
    console.log(JSON.stringify(result3, null, 2));

    await browser.close();
})();
