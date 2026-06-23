/**
 * CSS Style Processing TDD Test Runner
 * 
 * 测试目标：验证 decodeStyleTags 能正确处理复杂 CSS
 * 运行：node tests/run-css-tests.cjs
 */

const fs = require('fs');
const path = require('path');

// ============ 待测试函数 ============

function encodeStyleTags(text) {
    const styleRegex = /<style>([\s\S]*?)<\/style>/gims;
    return text.replace(styleRegex, (_, match) =>
        `<custom-style>${encodeURIComponent(match)}</custom-style>`
    );
}

// 当前有缺陷的版本（作为对照）
function decodeStyleTags_BROKEN(text, scopeSelector) {
    const decodeRegex = /<custom-style>([\s\S]*?)<\/custom-style>/gms;
    return text.replace(decodeRegex, (_, encoded) => {
        const css = decodeURIComponent(encoded);
        return `<style data-scoped>${scopeSelector} { ${css} }</style>`;
    });
}

// 修复后的版本
function decodeStyleTags_FIXED(text, scopeSelector) {
    const decodeRegex = /<custom-style>([\s\S]*?)<\/custom-style>/gms;
    return text.replace(decodeRegex, (_, encoded) => {
        const css = decodeURIComponent(encoded);
        return processComplexCss(css, scopeSelector);
    });
}

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

    // 2. 提取 @keyframes
    const keyframesRegex = /@keyframes[^{]+\{[\s\S]*?\n\s*\}/g;
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

        if (selector === 'body' || selector === 'html' || selector === 'html, body') {
            selector = scopeSelector;
        } else if (selector.startsWith('body ') || selector.startsWith('html ')) {
            selector = scopeSelector + selector.substring(4);
        } else {
            const selectors = selector.split(',').map(s => {
                const trimmed = s.trim();
                if (!trimmed) return s;
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
        for (const media of mediaQueries) {
            const mediaInnerMatch = media.match(/(@media[^{]+\{)([\s\S]*?)(\n\s*\})/);
            if (mediaInnerMatch) {
                const [, header, inner, footer] = mediaInnerMatch;
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

// ============ 测试框架 ============
const results = [];
let failed = 0;
let passed = 0;

function test(name, fn) {
    try {
        fn();
        passed++;
        results.push({ name, status: 'PASS', error: null });
        console.log(`  \u2713 ${name}`);
    } catch (e) {
        failed++;
        results.push({ name, status: 'FAIL', error: e.message });
        console.log(`  \u2717 ${name}`);
        console.log(`    Error: ${e.message}`);
    }
}

function expect(actual) {
    return {
        toBe: (expected) => { if (actual !== expected) throw new Error(`Expected ${expected} but got ${actual}`); },
        toContain: (expected) => { if (!String(actual).includes(expected)) throw new Error(`Expected to contain: ${expected}\nActual: ${String(actual).substring(0, 500)}`); },
        toMatch: (regex) => { if (!regex.test(actual)) throw new Error(`Expected to match: ${regex}\nActual: ${String(actual).substring(0, 500)}`); },
        not: {
            toBe: (expected) => { if (actual === expected) throw new Error(`Expected NOT to be: ${expected}`); },
            toContain: (expected) => { if (String(actual).includes(expected)) throw new Error(`Expected NOT to contain: ${expected}\nActual: ${String(actual).substring(0, 300)}`); },
            toMatch: (regex) => { if (regex.test(actual)) throw new Error(`Expected NOT to match: ${regex}\nActual: ${String(actual).substring(0, 300)}`); },
        }
    };
}

function section(name) {
    console.log(`\n${name}`);
    console.log('='.repeat(name.length));
}

// ============ 运行测试 ============
console.log('========================================');
console.log('  CSS Style Processing Tests (TDD)');
console.log('========================================');

section('1. @import 语句处理');
{
    const testCss = `@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC&display=swap');\n\n.test { color: red; }`;
    const encoded = `<custom-style>${encodeURIComponent(testCss)}</custom-style>`;
    const output = decodeStyleTags_FIXED(encoded, '.bubble-content');
    test('@import 应该在样式表最顶层', () => {
        expect(output).toMatch(/^<style data-scoped>@import/);
    });
    test('@import 不应在任何选择器内部', () => {
        expect(output).not.toMatch(/\{[^}]*@import[^}]*\}/);
    });
}

section('2. :root CSS 变量处理');
{
    const testCss = `:root {
    --bg-color: #030a16;
    --accent-color: #00ffff;
}

.info-card { background-color: var(--bg-color); }`;
    const encoded = `<custom-style>${encodeURIComponent(testCss)}</custom-style>`;
    const output = decodeStyleTags_FIXED(encoded, '.bubble-content');
    test('不应产生 .bubble-content :root', () => {
        expect(output).not.toContain('.bubble-content :root');
    });
    test(':root 变量应该放在 .bubble-content 下', () => {
        expect(output).toContain('.bubble-content {');
        expect(output).toContain('--bg-color:');
        expect(output).toContain('--accent-color:');
    });
}

section('3. @keyframes 动画处理');
{
    const testCss = `@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

.info-card { animation: fadeIn 1s ease-out; }`;
    const encoded = `<custom-style>${encodeURIComponent(testCss)}</custom-style>`;
    const output = decodeStyleTags_FIXED(encoded, '.bubble-content');
    test('@keyframes 应该保留', () => {
        expect(output).toContain('@keyframes fadeIn');
    });
    test('@keyframes 不应被包裹在选择器内', () => {
        expect(output).not.toMatch(/\.bubble-content\{[^}]*@keyframes/);
    });
}

section('4. @media 媒体查询处理');
{
    const testCss = `.info-card { padding: 40px; }

@media (max-width: 600px) {
    .info-card { padding: 25px 20px; }
    h1 { font-size: 1.5em; }
}`;
    const encoded = `<custom-style>${encodeURIComponent(testCss)}</custom-style>`;
    const output = decodeStyleTags_FIXED(encoded, '.bubble-content');
    test('@media 查询应该在最顶层', () => {
        expect(output).toContain('@media (max-width: 600px)');
    });
    test('@media 内部选择器应该加作用域前缀', () => {
        expect(output).toContain('.bubble-content .info-card');
        expect(output).toContain('.bubble-content h1');
    });
}

section('5. body/html 选择器处理');
{
    const testCss = `body {
    font-family: 'Noto Sans SC', sans-serif;
    background-color: #030a16;
    color: #f0f8ff;
}`;
    const encoded = `<custom-style>${encodeURIComponent(testCss)}</custom-style>`;
    const output = decodeStyleTags_FIXED(encoded, '.bubble-content');
    test('不应产生 .bubble-content body', () => {
        expect(output).not.toContain('.bubble-content body');
    });
    test('body 应该替换为 .bubble-content', () => {
        expect(output).toContain('.bubble-content {');
        expect(output).toContain('font-family');
        expect(output).toContain('background-color');
    });
}

section('6. 普通选择器的作用域前缀处理');
{
    const testCss = `.info-card { background: red; }
.section { margin: 10px; }`;
    const encoded = `<custom-style>${encodeURIComponent(testCss)}</custom-style>`;
    const output = decodeStyleTags_FIXED(encoded, '.bubble-content');
    test('类选择器应该加上作用域前缀', () => {
        expect(output).toContain('.bubble-content .info-card');
        expect(output).toContain('.bubble-content .section');
    });
}

section('7. 多选择器逗号分隔处理');
{
    const testCss = `.section p, .section ul { margin: 0; padding: 0; }`;
    const encoded = `<custom-style>${encodeURIComponent(testCss)}</custom-style>`;
    const output = decodeStyleTags_FIXED(encoded, '.bubble-content');
    test('每个逗号分隔的选择器都应该加前缀', () => {
        expect(output).toContain('.bubble-content .section p');
        expect(output).toContain('.bubble-content .section ul');
    });
}

section('8. 综合测试：完整复杂 CSS');
{
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
    const output = decodeStyleTags_FIXED(encoded, '.bubble-content');

    test('应该保留 @import', () => {
        expect(output).toContain("@import url('https://fonts.googleapis.com");
    });
    test(':root 变量应该正确处理', () => {
        expect(output).toContain('--bg-color:');
    });
    test('@keyframes 应该正确处理', () => {
        expect(output).toContain('@keyframes fadeIn');
    });
    test('@media 应该正确处理', () => {
        expect(output).toContain('@media (max-width: 600px)');
    });
    test('普通选择器应该加前缀', () => {
        expect(output).toContain('.bubble-content .info-card');
    });
    test('body 应该被替换', () => {
        expect(output).not.toContain('.bubble-content body');
    });
    test(':root 不应该被错误前缀', () => {
        expect(output).not.toContain('.bubble-content :root');
    });
}

// ============ 真实角色数据测试 ============
section('9. 真实角色数据：《道渊》v5.1');
{
    const chatPath = path.join(__dirname, '..', 'data', 'test_user_8002', 'chats', '\u300A\u9053\u6E0A\u300Bv5.1', '2026-06-19@17h28m58s889ms_1781861338889.json');
    if (fs.existsSync(chatPath)) {
        const rawContent = fs.readFileSync(chatPath, 'utf-8');
        const chatData = JSON.parse(rawContent);
        const content = chatData.messages[0].content;

        const styleMatch = content.match(/<style>([\s\S]*?)<\/style>/);
        if (!styleMatch) {
            console.log('  - 跳过：未找到 <style> 标签');
        } else {
            const rawCss = styleMatch[1];
            const encoded = `<custom-style>${encodeURIComponent(rawCss)}</custom-style>`;
            const output = decodeStyleTags_FIXED(encoded, '.bubble-content');

            test('真实角色的 @import 应该在最顶层', () => {
                expect(output).toMatch(/^<style data-scoped>@import/);
            });
            test('真实角色的 :root 变量应该在 .bubble-content 下', () => {
                expect(output).toContain('--bg-color:');
                expect(output).not.toContain('.bubble-content :root');
            });
            test('真实角色的 @keyframes 应该保留', () => {
                expect(output).toContain('@keyframes fadeIn');
                expect(output).toContain('@keyframes spin');
            });
            test('真实角色的 @property 应该保留', () => {
                expect(output).toContain('@property --angle');
            });
            test('真实角色的 @media 应该保留', () => {
                expect(output).toContain('@media (max-width: 600px)');
            });
            test('真实角色的 body 应该被替换', () => {
                expect(output).not.toContain('.bubble-content body');
            });
            test('真实角色的 .info-card 应该加前缀', () => {
                expect(output).toContain('.bubble-content .info-card');
            });
            test('真实角色的 .bubble-content :root 不应出现', () => {
                expect(output).not.toContain('.bubble-content :root');
            });
        }
    } else {
        console.log('  - 跳过：找不到测试数据文件');
    }
}

// ============ 结果汇总 ============
console.log('\n========================================');
console.log(`  测试结果：${passed} 通过，${failed} 失败`);
console.log('========================================');

if (failed > 0) {
    console.log('\n失败的测试：');
    results.filter(r => r.status === 'FAIL').forEach(r => {
        console.log(`  - ${r.name}`);
        console.log(`    ${r.error}`);
    });
    process.exit(1);
} else {
    console.log('\n\u2713 所有测试通过！');
}
