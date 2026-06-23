import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

(async () => {
    // 直接读取 HTML 文件，分析 bg_tabs 区域
    const htmlPath = path.join(process.cwd(), '..', 'public', 'chat.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');

    // 查找 bg_tabs 的开始和结束
    const startIdx = html.indexOf('id="bg_tabs"');
    const bg_tabs_start_open = html.lastIndexOf('<div', startIdx - 100);

    // 找匹配的闭合 </div>
    let depth = 0;
    let i = startIdx;
    while (i < html.length) {
        const openMatch = html.substr(i, 20).match(/^<div[^>]*>/);
        const closeMatch = html.substr(i, 20).match(/^<\/div>/);
        if (openMatch) {
            depth++;
            i += openMatch[0].length;
        } else if (closeMatch) {
            depth--;
            if (depth === 0) {
                break;
            }
            i += closeMatch[0].length;
        } else {
            i++;
        }
    }

    console.log('bg_tabs 起始:', startIdx);
    console.log('bg_tabs 结束 (估计):', i);
    console.log('bg_tabs 大小 (估计):', i - startIdx);

    // 检查 bg_tabs 里是否有问题
    const bgTabsContent = html.substring(startIdx - 100, startIdx + 500);
    console.log('\nbg_tabs 前后 500 字节预览:');
    console.log(bgTabsContent);

    // 检查 bg_tabs 内是否有未闭合的标签
    console.log('\n在 bg_tabs 起始附近检查是否有未闭合 <div>:');
    for (let j = Math.max(0, startIdx - 200); j < startIdx; j++) {
        if (html.substring(j, j + 4) === '<div') {
            console.log(`位置 ${j}:`, html.substring(j, j + 50));
        }
    }

    // 查找 bg_global_tab
    const globalTabIdx = html.indexOf('id="bg_global_tab"');
    const chatTabIdx = html.indexOf('id="bg_chat_tab"');
    console.log('\nbg_global_tab 位置:', globalTabIdx);
    console.log('bg_chat_tab 位置:', chatTabIdx);

    // 检查 bg_tabs 内部有多少个 <div>...</div>
    const bgTabsHtml = html.substring(startIdx, i);
    const divOpenCount = (bgTabsHtml.match(/<div[^>]*>/g) || []).length;
    const divCloseCount = (bgTabsHtml.match(/<\/div>/g) || []).length;
    console.log('\nbg_tabs 内部 <div> 数:', divOpenCount);
    console.log('bg_tabs 内部 </div> 数:', divCloseCount);
    console.log('不平衡:', divOpenCount - divCloseCount);

    await browser.close();
})();
