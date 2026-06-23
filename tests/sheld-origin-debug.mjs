import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

(async () => {
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const browser = await chromium.launch({
        executablePath: chromePath,
        headless: true,
    });

    const page = await browser.newPage();
    console.log('打开 index.html...');
    await page.goto('http://127.0.0.1:8000/index.html', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(8000);

    const result = await page.evaluate(() => {
        const allShelds = document.querySelectorAll('#sheld');
        const info = Array.from(allShelds).map((el, i) => ({
            index: i,
            parentTag: el.parentElement ? el.parentElement.tagName : null,
            parentId: el.parentElement ? el.parentElement.id : null,
            parentClass: el.parentElement ? String(el.parentElement.className).substring(0, 100) : null,
            // 追踪父元素路径
            path: (() => {
                let path = '';
                let cur = el;
                while (cur && cur.tagName !== 'BODY') {
                    path = cur.tagName + (cur.id ? '#' + cur.id : '') + (cur.className ? '.' + String(cur.className).split(' ').slice(0, 2).join('.') : '') + ' > ' + path;
                    cur = cur.parentElement;
                }
                return path;
            })(),
            // 检查元素是否是 display:none
            style: getComputedStyle(el).display,
            // 检查是否在某个模板容器中
            insideTemplate: el.closest('.template_element') !== null,
            // 检查是否包含某个特定的 class
            hasClass: el.className,
        }));

        // 检查所有带 #sheld id 的模板
        const templatesWithSheld = Array.from(document.querySelectorAll('.template_element')).filter(el => el.innerHTML && el.innerHTML.includes('id="sheld"'));

        // 检查是否有元素从 template 里被 clone 出来
        const templateEls = Array.from(document.querySelectorAll('.template_element')).slice(0, 10).map(t => ({
            id: t.id,
            innerHTML_preview: t.innerHTML.substring(0, 200),
        }));

        // 检查所有带重复 id 的元素
        const checkDuplicateId = (id) => {
            const els = document.querySelectorAll(id);
            return Array.from(els).map((el, i) => ({
                index: i,
                path: (() => {
                    let p = '';
                    let c = el;
                    while (c && c.parentElement && c.tagName !== 'BODY') {
                        p = c.tagName + (c.id ? '#' + c.id : '') + ' > ' + p;
                        c = c.parentElement;
                    }
                    return p;
                })(),
                display: getComputedStyle(el).display,
            }));
        };

        return {
            shelds: info,
            templatesWithSheld_count: templatesWithSheld.length,
            templateEls,
            duplicate_sheld: checkDuplicateId('#sheld'),
            duplicate_chat: checkDuplicateId('#chat'),
            duplicate_message_template: checkDuplicateId('#message_template'),
        };
    });

    console.log('完整分析:');
    console.log(JSON.stringify(result, null, 2));

    const outputFile = path.join(process.cwd(), 'sheld-origin-debug.json');
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log('\n已保存到', outputFile);

    await browser.close();
})();
