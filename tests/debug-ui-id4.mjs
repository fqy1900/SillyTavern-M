import { chromium } from 'playwright';

const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: false,
    slowMo: 100,
});

const context = await browser.newContext();
const page = await context.newPage();

console.log('=== 调查 #ui-id-4 内容 ===');

try {
    await page.goto('http://127.0.0.1:8000/chat.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(10000);

    // 1. 检查 #bg_tabs 中的 <a> 标签
    console.log('\n[1] 检查 #bg_tabs 中的链接');
    const linkInfo = await page.evaluate(() => {
        const bgTabs = document.getElementById('bg_tabs');
        if (!bgTabs) return { exists: false };
        
        const links = [];
        bgTabs.querySelectorAll('a').forEach((a, idx) => {
            links.push({
                index: idx,
                href: a.getAttribute('href') || '(no href)',
                text: a.textContent.substring(0, 30),
                parent_id: a.parentElement?.id || '(none)',
            });
        });
        
        // 特别检查 ul > li > a 结构
        const tabLinks = [];
        const ul = bgTabs.querySelector('ul.bg_tabs_list');
        if (ul) {
            ul.querySelectorAll('li > a').forEach((a, idx) => {
                tabLinks.push({
                    index: idx,
                    href: a.getAttribute('href') || '(no href)',
                    text: a.textContent.substring(0, 50),
                });
            });
        }

        return {
            exists: true,
            all_links: links,
            tab_links: tabLinks,
        };
    });

    if (linkInfo.exists) {
        console.log(`  #bg_tabs 中所有链接 (${linkInfo.all_links.length}):`);
        linkInfo.all_links.forEach((l) => {
            console.log(`    [${l.index}] href="${l.href}" text="${l.text}" parent=${l.parent_id}`);
        });

        console.log(`\n  bg_tabs_list 中的 tab 链接 (${linkInfo.tab_links.length}):`);
        linkInfo.tab_links.forEach((l) => {
            console.log(`    [${l.index}] href="${l.href}" text="${l.text}"`);
        });
    }

    // 2. 检查 #ui-id-4 的内容
    console.log('\n[2] 检查 #ui-id-4 的内容');
    const uiId4Info = await page.evaluate(() => {
        const uiId4 = document.getElementById('ui-id-4');
        if (!uiId4) return { exists: false };

        const childTags = {};
        Array.from(uiId4.children).forEach((child) => {
            const tag = child.tagName;
            childTags[tag] = (childTags[tag] || 0) + 1;
        });

        // 查找 #ui-id-4 中是否有 #chat
        const innerChat = uiId4.querySelector('#chat');
        const innerSheld = uiId4.querySelector('#sheld');

        // 查看前几个子元素
        const firstChildren = [];
        for (let i = 0; i < Math.min(10, uiId4.children.length); i++) {
            const child = uiId4.children[i];
            firstChildren.push({
                tag: child.tagName,
                id: child.id || '(no id)',
                class: child.className.substring(0, 80),
            });
        }

        return {
            exists: true,
            child_count: uiId4.children.length,
            child_tags: childTags,
            has_inner_chat: !!innerChat,
            has_inner_sheld: !!innerSheld,
            first_children: firstChildren,
        };
    });

    if (uiId4Info.exists) {
        console.log(`  #ui-id-4 存在，有 ${uiId4Info.child_count} 个子元素`);
        console.log(`  包含 #chat: ${uiId4Info.has_inner_chat}`);
        console.log(`  包含 #sheld: ${uiId4Info.has_inner_sheld}`);
        console.log(`  子元素标签统计:`);
        Object.entries(uiId4Info.child_tags).forEach(([tag, count]) => {
            console.log(`    ${tag}: ${count}`);
        });
        console.log(`  前 10 个子元素:`);
        uiId4Info.first_children.forEach((c, idx) => {
            console.log(`    [${idx}] ${c.tag}#${c.id} class=${c.class}`);
        });
    } else {
        console.log('  #ui-id-4 不存在');
    }

    // 3. 检查 #ui-id-4 的父元素和兄弟元素
    console.log('\n[3] 检查 #ui-id-4 的上下文');
    const uiId4Context = await page.evaluate(() => {
        const uiId4 = document.getElementById('ui-id-4');
        if (!uiId4) return { exists: false };

        // 获取关联的 tab 链接
        const tabId = uiId4.getAttribute('aria-labelledby');
        
        // 检查父元素
        const parent = uiId4.parentElement;
        
        // 检查前一个兄弟元素（应该是 tab 导航）
        const prevSibling = uiId4.previousElementSibling;
        
        return {
            exists: true,
            aria_labelledby: tabId,
            parent: {
                id: parent?.id || '(no id)',
                class: parent?.className.substring(0, 80) || '(no class)',
                tag: parent?.tagName,
            },
            prev_sibling: prevSibling ? {
                tag: prevSibling.tagName,
                id: prevSibling.id || '(no id)',
                class: prevSibling.className.substring(0, 80),
            } : null,
        };
    });

    if (uiId4Context.exists) {
        console.log(`  aria-labelledby: ${uiId4Context.aria_labelledby}`);
        console.log(`  父元素: ${uiId4Context.parent.tag}#${uiId4Context.parent.id} class=${uiId4Context.parent.class}`);
        if (uiId4Context.prev_sibling) {
            console.log(`  前一个兄弟: ${uiId4Context.prev_sibling.tag}#${uiId4Context.prev_sibling.id} class=${uiId4Context.prev_sibling.class}`);
        }
    }

    // 4. 检查 chat.html 中 #bg_tabs 原本的 HTML 结构
    console.log('\n[4] 检查 chat.html 中 #bg_tabs 的原始 HTML');
    const originalHtml = await page.evaluate(() => {
        const bgTabs = document.getElementById('bg_tabs');
        if (!bgTabs) return { exists: false };
        
        // 直接获取 chat.html 中 #bg_tabs 的原始内容
        // 检查 ul 内部是否有额外的元素
        const ul = bgTabs.querySelector('ul.bg_tabs_list');
        
        return {
            exists: true,
            ul_html: ul ? ul.innerHTML.substring(0, 1000) : '(no ul)',
            ul_child_count: ul ? ul.children.length : 0,
            bg_tabs_child_count: bgTabs.children.length,
        };
    });

    if (originalHtml.exists) {
        console.log(`  #bg_tabs 子元素数量: ${originalHtml.bg_tabs_child_count}`);
        console.log(`  ul.bg_tabs_list 子元素数量: ${originalHtml.ul_child_count}`);
        console.log(`  ul 内容片段: ${originalHtml.ul_html.substring(0, 300)}...`);
    }

    // 5. 检查是否有指向 chat.html 的链接
    console.log('\n[5] 查找指向 chat.html 的链接');
    const chatHtmlLinks = await page.evaluate(() => {
        const links = [];
        document.querySelectorAll('a[href*="chat"]').forEach((a, idx) => {
            const style = window.getComputedStyle(a);
            if (style.display === 'none') return;
            links.push({
                href: a.getAttribute('href'),
                text: a.textContent.substring(0, 50),
                parent_tag: a.parentElement?.tagName,
                parent_id: a.parentElement?.id || '(no id)',
                grandparent_id: a.parentElement?.parentElement?.id || '(no id)',
            });
        });
        return links;
    });

    if (chatHtmlLinks.length > 0) {
        console.log(`  发现 ${chatHtmlLinks.length} 个指向 chat 的链接:`);
        chatHtmlLinks.forEach((l, idx) => {
            console.log(`    [${idx}] href="${l.href}" text="${l.text}" in ${l.parent_tag}#${l.parent_id}`);
        });
    } else {
        console.log('  没有发现指向 chat 的链接');
    }

} catch (error) {
    console.error('测试过程中出错:', error);
} finally {
    console.log('\n按 Ctrl+C 关闭浏览器...');
    await page.waitForTimeout(10000);
    await browser.close();
}
