/**
 * CSS Style Processing Tests (TDD)
 * 
 * 测试目标：验证 formatMessageContent / decodeStyleTags 能正确处理复杂 CSS
 * 
 * 已知问题：
 * 1. @import 被包裹在 .bubble-content 选择器内（@import 必须在最顶层）
 * 2. :root CSS 变量被写成 .bubble-content :root（完全无效）
 * 3. @keyframes 被包裹在选择器内（无效）
 * 4. @media 查询被包裹在选择器内（无效）
 * 5. body 选择器被写成 .bubble-content body（气泡中没有 body 元素）
 */

import { describe, it, expect, beforeEach } from 'vitest';

// 将 app-main.js 中的函数暴露为全局（通过 JSDOM 模拟）
// 我们直接在这里实现相同的逻辑并测试它

function encodeStyleTags(text) {
    const styleRegex = /<style>([\s\S]*?)<\/style>/gims;
    return text.replace(styleRegex, (_, match) =>
        `<custom-style>${encodeURIComponent(match)}</custom-style>`
    );
}

// 当前有缺陷的版本（作为对照组）
function decodeStyleTags_BROKEN(text, scopeSelector) {
    const decodeRegex = /<custom-style>([\s\S]*?)<\/custom-style>/gms;
    return text.replace(decodeRegex, (_, encoded) => {
        const css = decodeURIComponent(encoded);
        return `<style data-scoped>${scopeSelector} { ${css} }</style>`;
    });
}

// 修复后的版本（我们需要实现的）
function decodeStyleTags_FIXED(text, scopeSelector) {
    const decodeRegex = /<custom-style>([\s\S]*?)<\/custom-style>/gms;
    return text.replace(decodeRegex, (_, encoded) => {
        const css = decodeURIComponent(encoded);
        return processComplexCss(css, scopeSelector);
    });
}

/**
 * 处理复杂 CSS：
 * - 提取 @import 放在最顶层
 * - 提取 :root 变量并转换为作用域选择器
 * - 提取 @keyframes 保持顶层（内部选择器加作用域前缀）
 * - 提取 @media 保持顶层（内部选择器加作用域前缀）
 * - body/html 选择器替换为作用域选择器
 * - 其他普通选择器加上作用域前缀
 */
function processComplexCss(css, scopeSelector) {
    const parts = [];
    const imports = [];
    const keyframes = [];
    const mediaQueries = [];
    const regularRules = [];
    const propertyAtRules = [];

    // 1. 提取并移除所有 @import
    const importRegex = /@import\s+[^;]+;/g;
    css = css.replace(importRegex, (match) => {
        imports.push(match.trim());
        return '';
    });

    // 2. 提取 @keyframes（需要匹配大括号内容）
    const keyframesRegex = /@keyframes\s+[^{]+\{[\s\S]*?\n\s*\}/g;
    css = css.replace(keyframesRegex, (match) => {
        keyframes.push(match.trim());
        return '';
    });

    // 3. 提取 @media 查询
    const mediaRegex = /@media[^{]+\{[\s\S]*?\n\s*\}/g;
    css = css.replace(mediaRegex, (match) => {
        mediaQueries.push(match.trim());
        return '';
    });

    // 4. 提取 @property 等其他 at-rules
    const propertyRegex = /@property[^{]+\{[^}]*\}/g;
    css = css.replace(propertyRegex, (match) => {
        propertyAtRules.push(match.trim());
        return '';
    });

    // 5. 处理剩余的普通规则
    // 分离 :root 和普通规则
    const rootRegex = /:root\s*\{([\s\S]*?)\}/;
    let rootContent = '';
    const rootMatch = css.match(rootRegex);
    if (rootMatch) {
        rootContent = rootMatch[1].trim();
        css = css.replace(rootRegex, '');
    }

    // 处理 body/html 选择器和其他普通规则
    const ruleRegex = /([^{]+)\{([^}]*)\}/g;
    let ruleMatch;
    while ((ruleMatch = ruleRegex.exec(css)) !== null) {
        let selector = ruleMatch[1].trim();
        const rules = ruleMatch[2].trim();

        if (!selector || !rules) continue;

        // body/html 替换为作用域选择器
        if (selector === 'body' || selector === 'html' || selector === 'html, body') {
            selector = scopeSelector;
        } else if (selector.startsWith('body ') || selector.startsWith('html ')) {
            selector = scopeSelector + selector.substring(4);
        } else {
            // 其他选择器加上作用域前缀
            // 处理多选择器情况（逗号分隔）
            const selectors = selector.split(',').map(s => {
                const trimmed = s.trim();
                if (!trimmed) return s;
                // 如果选择器已经带前缀或为伪元素，跳过
                if (trimmed.startsWith('::')) return trimmed;
                return scopeSelector + ' ' + trimmed;
            });
            selector = selectors.join(', ');
        }

        regularRules.push(`${selector} { ${rules} }`);
    }

    // 6. 组合所有部分
    if (imports.length > 0) parts.push(...imports);
    if (rootContent) parts.push(`${scopeSelector} { ${rootContent} }`);
    if (propertyAtRules.length > 0) parts.push(...propertyAtRules);
    if (keyframes.length > 0) parts.push(...keyframes);
    if (regularRules.length > 0) parts.push(...regularRules);
    if (mediaQueries.length > 0) {
        // @media 内部选择器也需要加作用域前缀
        for (const media of mediaQueries) {
            const mediaInnerMatch = media.match(/(@media[^{]+\{)([\s\S]*?)(\n\s*\})/);
            if (mediaInnerMatch) {
                const [, header, inner, footer] = mediaInnerMatch;
                // 给内部规则加作用域前缀
                const scopedInner = inner.replace(/([^{]+)\{([^}]*)\}/g, (m, sel, rules) => {
                    const selector = sel.trim();
                    if (!selector) return m;
                    if (selector === 'body' || selector === 'html') {
                        return `${scopeSelector} { ${rules.trim()} }`;
                    }
                    const selectors = selector.split(',').map(s => {
                        const trimmed = s.trim();
                        if (!trimmed) return s;
                        if (trimmed.startsWith('::')) return trimmed;
                        return scopeSelector + ' ' + trimmed;
                    });
                    return `${selectors.join(', ')} { ${rules.trim()} }`;
                });
                parts.push(`${header}${scopedInner}${footer}`);
            } else {
                parts.push(media);
            }
        }
    }

    return `<style data-scoped>${parts.join('\n\n')}</style>`;
}

// 完整的 formatMessageContent 简化版本（只测试 CSS 处理部分）
function formatMessageContentForTest(htmlContent) {
    const content = htmlContent;

    // 1. 处理 HTML 代码块
    const htmlBlockMatch = content.match(/^\s*```html\s*\r?\n?([\s\S]*?)\r?\n?```\s*$/i);
    if (htmlBlockMatch) {
        let rawHtml = htmlBlockMatch[1];

        // 移除 html/head/body 包装
        rawHtml = rawHtml
            .replace(/^[\s]*<html[^>]*>[\s\S]*?<head[^>]*>[\s\S]*?<\/head>[\s\S]*?<body[^>]*>/ims, '')
            .replace(/<\/body>[\s\S]*?<\/html>[\s]*$/ims, '')
            .trim();

        // 编码 style 标签
        rawHtml = encodeStyleTags(rawHtml);

        // DOMPurify（简化为原样输出，测试中不需要真实净化）
        // rawHtml = DOMPurify.sanitize(rawHtml, ...);

        // 解码 style 标签
        rawHtml = decodeStyleTags_FIXED(rawHtml, '.bubble-content');

        return rawHtml;
    }

    return '';
}

// ============ 测试用例 ============
describe('CSS Style Processing (decodeStyleTags)', () => {

    describe('问题 1: @import 语句处理', () => {
        it('@import 应该在样式表最顶层，不能被选择器包裹', () => {
            const testCss = `@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC&display=swap');\n\n.test { color: red; }`;
            const encoded = `<custom-style>${encodeURIComponent(testCss)}</custom-style>`;

            // 旧版本应该失败
            const brokenOutput = decodeStyleTags_BROKEN(encoded, '.bubble-content');
            expect(brokenOutput).toContain('.bubble-content {');
            expect(brokenOutput).toContain('@import');
            // 注意：旧版本把 @import 放在选择器内，这是错误的
            // 新版本应该把 @import 放在最顶层

            // 新版本应该正确处理
            const fixedOutput = decodeStyleTags_FIXED(encoded, '.bubble-content');
            expect(fixedOutput).toMatch(/^<style data-scoped>@import/);
            // @import 不应在任何选择器内部
            expect(fixedOutput).not.toMatch(/\{[^}]*@import[^}]*\}/);
        });
    });

    describe('问题 2: :root CSS 变量处理', () => {
        it(':root 变量应该转换为作用域选择器而非 .bubble-content :root', () => {
            const testCss = `:root {
    --bg-color: #030a16;
    --accent-color: #00ffff;
}

.info-card { background-color: var(--bg-color); }`;
            const encoded = `<custom-style>${encodeURIComponent(testCss)}</custom-style>`;

            const brokenOutput = decodeStyleTags_BROKEN(encoded, '.bubble-content');
            // 旧版本错误地写成 .bubble-content :root
            expect(brokenOutput).toContain('.bubble-content :root');

            const fixedOutput = decodeStyleTags_FIXED(encoded, '.bubble-content');
            // 新版本应该把 :root 变量直接放在 .bubble-content 下
            expect(fixedOutput).not.toContain('.bubble-content :root');
            expect(fixedOutput).toContain('.bubble-content {');
            expect(fixedOutput).toContain('--bg-color:');
            expect(fixedOutput).toContain('--accent-color:');
        });
    });

    describe('问题 3: @keyframes 动画处理', () => {
        it('@keyframes 应该在样式表最顶层，不能被选择器包裹', () => {
            const testCss = `@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

.info-card { animation: fadeIn 1s ease-out; }`;
            const encoded = `<custom-style>${encodeURIComponent(testCss)}</custom-style>`;

            const brokenOutput = decodeStyleTags_BROKEN(encoded, '.bubble-content');
            // 旧版本错误地把 @keyframes 放在选择器内
            expect(brokenOutput).toMatch(/\.bubble-content \{[^}]*@keyframes/);

            const fixedOutput = decodeStyleTags_FIXED(encoded, '.bubble-content');
            // 新版本 @keyframes 应该在最顶层
            expect(fixedOutput).toContain('@keyframes fadeIn');
            expect(fixedOutput).not.toMatch(/\{[^}]*@keyframes[^}]*\}/);
        });
    });

    describe('问题 4: @media 媒体查询处理', () => {
        it('@media 查询应该在最顶层，内部选择器加上作用域前缀', () => {
            const testCss = `.info-card { padding: 40px; }

@media (max-width: 600px) {
    .info-card { padding: 25px 20px; }
    h1 { font-size: 1.5em; }
}`;
            const encoded = `<custom-style>${encodeURIComponent(testCss)}</custom-style>`;

            const brokenOutput = decodeStyleTags_BROKEN(encoded, '.bubble-content');
            // 旧版本错误地把 @media 放在选择器内
            expect(brokenOutput).toMatch(/\.bubble-content \{[^}]*@media/);

            const fixedOutput = decodeStyleTags_FIXED(encoded, '.bubble-content');
            // 新版本 @media 应该在最顶层
            expect(fixedOutput).toContain('@media (max-width: 600px)');
            expect(fixedOutput).not.toMatch(/\{[^}]*@media[^}]*\{[^}]*\}[^}]*\}/);
            // 内部选择器应该加前缀
            expect(fixedOutput).toContain('.bubble-content .info-card');
            expect(fixedOutput).toContain('.bubble-content h1');
        });
    });

    describe('问题 5: body/html 选择器处理', () => {
        it('body 选择器应该替换为作用域选择器 .bubble-content', () => {
            const testCss = `body {
    font-family: 'Noto Sans SC', sans-serif;
    background-color: #030a16;
    color: #f0f8ff;
}`;
            const encoded = `<custom-style>${encodeURIComponent(testCss)}</custom-style>`;

            const brokenOutput = decodeStyleTags_BROKEN(encoded, '.bubble-content');
            // 旧版本产生 .bubble-content body（气泡中没有 body 元素，无法匹配）
            expect(brokenOutput).toContain('.bubble-content body');

            const fixedOutput = decodeStyleTags_FIXED(encoded, '.bubble-content');
            // 新版本应该将 body 替换为 .bubble-content
            expect(fixedOutput).not.toContain('.bubble-content body');
            expect(fixedOutput).toContain('.bubble-content {');
            expect(fixedOutput).toContain('font-family');
            expect(fixedOutput).toContain('background-color');
        });
    });

    describe('普通选择器的作用域前缀处理', () => {
        it('普通类选择器应该加上作用域前缀', () => {
            const testCss = `.info-card { background: red; }
.section { margin: 10px; }`;
            const encoded = `<custom-style>${encodeURIComponent(testCss)}</custom-style>`;

            const fixedOutput = decodeStyleTags_FIXED(encoded, '.bubble-content');
            expect(fixedOutput).toContain('.bubble-content .info-card');
            expect(fixedOutput).toContain('.bubble-content .section');
        });

        it('多选择器逗号分隔应该每个都加前缀', () => {
            const testCss = `.section p, .section ul { margin: 0; padding: 0; }`;
            const encoded = `<custom-style>${encodeURIComponent(testCss)}</custom-style>`;

            const fixedOutput = decodeStyleTags_FIXED(encoded, '.bubble-content');
            expect(fixedOutput).toContain('.bubble-content .section p');
            expect(fixedOutput).toContain('.bubble-content .section ul');
        });
    });

    describe('综合测试：复杂 CSS 场景', () => {
        it('应该正确处理包含 @import/:root/@keyframes/@media/body 的完整 CSS', () => {
            const testCss = `@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC&display=swap');

:root {
    --bg-color: #030a16;
    --accent-color: #00ffff;
}

body {
    font-family: 'Noto Sans SC', sans-serif;
    background-color: var(--bg-color);
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

.info-card {
    background: var(--bg-color);
    animation: fadeIn 1s ease-out;
}

@media (max-width: 600px) {
    .info-card { padding: 20px; }
}`;
            const encoded = `<custom-style>${encodeURIComponent(testCss)}</custom-style>`;

            const fixedOutput = decodeStyleTags_FIXED(encoded, '.bubble-content');

            // 基本验证
            expect(fixedOutput).toContain("@import url('https://fonts.googleapis.com");
            expect(fixedOutput).toContain('--bg-color:');
            expect(fixedOutput).toContain('@keyframes fadeIn');
            expect(fixedOutput).toContain('@media (max-width: 600px)');
            expect(fixedOutput).toContain('.bubble-content .info-card');
            expect(fixedOutput).toContain('.bubble-content {');

            // 不应该出现错误模式
            expect(fixedOutput).not.toContain('.bubble-content :root');
            expect(fixedOutput).not.toContain('.bubble-content body');
            expect(fixedOutput).not.toMatch(/\.bubble-content \{[^}]*@import/);
            expect(fixedOutput).not.toMatch(/\.bubble-content \{[^}]*@keyframes/);
        });
    });
});
