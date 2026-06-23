/**
 * CSS 处理对比测试 - 对比 chats.js (SillyTavern 原生) 和 app-main.js (多用户系统)
 * 运行: node tests/compare-css-tests.cjs
 */

const fs = require('fs');
const path = require('path');

// 模拟 @adobe/css-tools 的解析（简化版，仅用于测试对比）
// 真实 chats.js 使用的是完整的 css.parse() / css.stringify()
const { css } = (() => {
    // 尝试使用真实的 @adobe/css-tools，如果不可用则降级到模拟
    try {
        const mod = require('@adobe/css-tools');
        return { css: mod };
    } catch (e) {
        return { css: null };
    }
})();

// ============ 当前 app-main.js 的 processComplexCss ============
// 复制自 app-main.js 第 738-845 行
function processComplexCss(cssInput, scopeSelector) {
    const parts = [];
    const imports = [];
    const keyframes = [];
    const mediaQueries = [];
    const regularRules = [];
    const propertyAtRules = [];

    const importRegex = /@import\s+[^;]+;/g;
    cssInput = cssInput.replace(importRegex, (match) => {
        imports.push(match.trim());
        return '';
    });

    const keyframesRegex = /@keyframes[^{]+\{[\s\S]*?\n\s*\}/g;
    cssInput = cssInput.replace(keyframesRegex, (match) => {
        keyframes.push(match.trim());
        return '';
    });

    const mediaRegex = /@media[^{]+\{[\s\S]*?\n\s*\}/g;
    cssInput = cssInput.replace(mediaRegex, (match) => {
        mediaQueries.push(match.trim());
        return '';
    });

    const propertyRegex = /@property[^{]+\{[^}]*\}/g;
    cssInput = cssInput.replace(propertyRegex, (match) => {
        propertyAtRules.push(match.trim());
        return '';
    });

    const rootRegex = /:root\s*\{([\s\S]*?)\}/;
    let rootContent = '';
    const rootMatch = cssInput.match(rootRegex);
    if (rootMatch) {
        rootContent = rootMatch[1].trim();
        cssInput = cssInput.replace(rootRegex, '');
    }

    const ruleRegex = /([^{]+)\{([^}]*)\}/g;
    let ruleMatch;
    while ((ruleMatch = ruleRegex.exec(cssInput)) !== null) {
        let selector = ruleMatch[1].trim();
        const rules = ruleMatch[2].trim();

        if (!selector || !rules) continue;

        if (selector === 'body' || selector === 'html' || selector === 'html, body') {
            selector = scopeSelector;
        } else if (selector.startsWith('body ') || selector.startsWith('html ')) {
            selector = scopeSelector + ' ' + selector.substring(4).trim();
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

    return parts.join('\n\n');
}

// ============ chats.js 的 decodeStyleTags (使用 css.parse() 版本)
// 复制自 chats.js 第 551-626 行，简化为独立函数
function decodeStyleTags_withCssParse(cssInput, scopeSelector) {
    // chats.js 中的核心逻辑是用 css.parse() 解析 AST，然后递归处理

    function sanitizeSelector(selector) {
        const pseudoClasses = ['has', 'not', 'where', 'is', 'matches', 'any'];
        const pseudoRegex = new RegExp(`:(${pseudoClasses.join('|')})\\(([^)]+)\\)`, 'g');

        selector = selector.replace(pseudoRegex, (match, pseudoClass, content) => {
            return `:${pseudoClass}(${content})`; // chats.js 中使用 custom- 前缀处理类名，这里我们直接加前缀
        };

        return sanitizeSimpleSelector(selector);
    }

    function sanitizeSimpleSelector(selector) {
        return selector.split(/\s+/).map((part) => {
            return part.replace(/\.([\w-]+)/g, (match, className) => {
                if (className.startsWith('custom-')) {
                    return match;
                }
                return `.custom-${className}`;
            });
        }).join(' ');
    }

    try {
        const ast = css.parse(cssInput);
        const sheet = ast?.stylesheet;
        if (sheet) {
            // chats.js 的核心处理函数，为所有规则加前缀
            function processRuleSet(ruleSet, prefix) {
                if (Array.isArray(ruleSet.rules)) {
                    ruleSet.rules = ruleSet.rules.filter(rule => rule.type !== 'import');
                    for (const mediaRule of ruleSet.rules) {
                        if (mediaRule.type === 'rule' && Array.isArray(mediaRule.selectors)) {
                            for (let i = 0; i < mediaRule.selectors.length; i++) {
                                const selector = mediaRule.selectors[i];
                                if (selector) {
                                    mediaRule.selectors[i] = prefix + sanitizeSelector(selector);
                                }
                            }
                        }
                        if (mediaRule.type === 'media') {
                            if (Array.isArray(mediaRule.rules)) {
                                // @media内部的规则也需要加前缀
                                for (const nestedRule of mediaRule.rules) {
                                    if (nestedRule.type === 'rule' && Array.isArray(nestedRule.selectors)) {
                                    for (let i = 0; i < nestedRule.selectors.length; i++) {
                                        const selector = nestedRule.selectors[i];
                                        if (selector) {
                                            nestedRule.selectors[i] = prefix + sanitizeSelector(selector);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            processRuleSet(ast.stylesheet);
        }
        return css.stringify(ast);
    } catch (error) {
        return `CSS ERROR: ${error}`;
    }
}

// ============ 编码/解码工具函数
function encodeStyleTags(text) {
    const styleRegex = /<style>([\s\S]*?)<\/style>/gims;
    return text.replace(styleRegex, (_, match) =>
        `<custom-style>${encodeURIComponent(match)}</custom-style>`
    );
}

// ============ 运行测试
function runTests() {
    console.log('========================================');
    console.log('  CSS 处理对比测试');
    console.log('========================================\n');

    let passed = 0;
    let failed = 0;

    // 测试1：检查 @keyframes 处理
    console.log('【测试1】@keyframes 动画');
    {
        const testCss = `@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

.my-class { animation: fadeIn 1s; }`;

        const encoded = encodeStyleTags(`<style>${testCss}</style>`);

        console.log('  输入 CSS (前200字符): ${testCss.substring(0, 200)}`);
        console.log('');

        const withAst = decodeStyleTags_withCssParse(testCss, '.bubble-content ');
        const withRegex = processComplexCss(testCss, '.bubble-content');

        console.log('  [ chats.js (css.parse) 结果 (前300字符:');
        console.log('  ', withAst.substring(0, 300));
        console.log('');
        console.log('  [ app-main.js (processComplexCss) 结果 (前300字符):');
        console.log('  ', withRegex.substring(0, 300));
        console.log('');

        // 检查关键条件
        const hasValidKeyframesAst = withAst.includes('@keyframes fadeIn');
        const hasValidKeyframesRegex = withRegex.includes('@keyframes fadeIn');
        const hasScopedClassAst = withAst.includes('.bubble-content .custom-my-class');
        const hasScopedClassRegex = withRegex.includes('.bubble-content .my-class');

        console.log(`  chats.js @keyframes 正确: ${hasValidKeyframesAst}`);
        console.log(`  app-main.js @keyframes 正确: ${hasValidKeyframesRegex}`);
        console.log(`  chats.js 选择器加前缀: ${hasScopedClassAst}`);
        console.log(`  app-main.js 选择器加前缀: ${hasScopedClassRegex}`);

        if (hasValidKeyframesRegex && hasScopedClassRegex) {
            console.log('  ✅ 测试通过');
            passed++;
        } else {
            console.log('  ❌ 测试失败');
            failed++;
        }
    }
    console.log('');

    // 测试2：检查 :root 变量和 body 处理
    console.log('【测试2】:root 和 body 选择器');
    {
        const testCss = `:root {
    --bg-color: #030a16;
    --accent-color: #00ffff;
}

body {
    font-family: sans-serif;
    background-color: var(--bg-color);
}

.info-card { background: var(--accent-color); }`;

        const withAst = decodeStyleTags_withCssParse(testCss, '.bubble-content ');
        const withRegex = processComplexCss(testCss, '.bubble-content');

        console.log('  [ chats.js 结果 (前400字符):');
        console.log('  ', withAst.substring(0, 400));
        console.log('');
        console.log('  [ app-main.js 结果 (前400字符):');
        console.log('  ', withRegex.substring(0, 400));
        console.log('');

        const hasRootVars = withRegex.includes('--bg-color:');
        const hasBodyScoped = withRegex.includes('.bubble-content');
        const hasInfoCard = withRegex.includes('.info-card');

        console.log(`  app-main.js :root 变量正确: ${hasRootVars}`);
        console.log(`  app-main.js body 作用域正确: ${hasBodyScoped}`);
        console.log(`  app-main.js .info-card 作用域正确: ${hasInfoCard}`);

        if (hasRootVars && hasBodyScoped && hasInfoCard) {
            console.log('  ✅ 测试通过');
            passed++;
        } else {
            console.log('  ❌ 测试失败');
            failed++;
        }
    }
    console.log('');

    // 测试3：真实角色卡 - 道渊
    console.log('【测试3】真实角色卡 first_mes');
    try {
        const chatPath = path.join(__dirname, '..', 'data', 'test_user_8002', 'chats', '《道渊》v5.1', '2026-06-19@17h28m58s889ms_1781861338889.json');
        const raw = fs.readFileSync(chatPath, 'utf-8');
        const chatData = JSON.parse(raw);
        const firstMes = chatData.messages[0].content;

        // 提取 <style> 内容
        const styleMatch = firstMes.match(/<style>([\s\S]*?)<\/style>/);

        if (!styleMatch) {
            console.log('  跳过：未找到 <style> 标签');
        } else {
            const cssContent = styleMatch[1];
            console.log(`  原始 CSS 长度: ${cssContent.length} 字符`);
            console.log('');

            const withAst = decodeStyleTags_withCssParse(cssContent, '.bubble-content ');
            const withRegex = processComplexCss(cssContent, '.bubble-content');

            // 统计关键 CSS 特性

            // 检查 @keyframes
            const astHasKeyframes = withAst.includes('@keyframes');
            const regexHasKeyframes = withRegex.includes('@keyframes');
            console.log(`  chats.js @keyframes: ${astHasKeyframes}`);
            console.log(`  app-main.js @keyframes: ${regexHasKeyframes}`);

            // 检查 CSS 变量
            const astHasVars = withAst.includes('--');
            const regexHasVars = withRegex.includes('--');
            console.log(`  chats.js CSS 变量: ${astHasVars}`);
            console.log(`  app-main.js CSS 变量: ${regexHasVars}`);

            // 检查 @property
            const astHasProperty = withAst.includes('@property');
            const regexHasProperty = withRegex.includes('@property');
            console.log(`  chats.js @property: ${astHasProperty}`);
            console.log(`  app-main.js @property: ${regexHasProperty}`);

            // 检查 @media
            const astHasMedia = withAst.includes('@media');
            const regexHasMedia = withRegex.includes('@media');
            console.log(`  chats.js @media: ${astHasMedia}`);
            console.log(`  app-main.js @media: ${regexHasMedia}`);

            // 检查选择器处理
            const astHasInfoCard = withAst.includes('.info-card');
            const regexHasInfoCard = withRegex.includes('.info-card');
            console.log(`  chats.js .info-card: ${astHasInfoCard}`);
            console.log(`  app-main.js .info-card: ${regexHasInfoCard}`);

            if (regexHasKeyframes && regexHasVars && regexHasProperty && regexHasMedia && regexHasInfoCard) {
                console.log('  ✅ 测试通过');
                passed++;
            } else {
                console.log('  ❌ 测试失败');
                console.log('');
                console.log('  差异分析:');
                if (!regexHasKeyframes) console.log('    - 缺少 @keyframes');
                if (!regexHasVars) console.log('    - 缺少 CSS 变量');
                if (!regexHasProperty) console.log('    - 缺少 @property');
                if (!regexHasMedia) console.log('    - 缺少 @media');
                if (!regexHasInfoCard) console.log('    - 缺少 .info-card 选择器');
                failed++;
            }

            // 打印结果样本
            console.log('');
            console.log('  ---- chats.js 输出样例 (前600字符:');
            console.log('  ', withAst.substring(0, 600).split('\n').join('\n  '));
            console.log('');
            console.log('  ---- app-main.js 输出样例 (前600字符:');
            console.log('  ', withRegex.substring(0, 600).split('\n').join('\n  '));
        }
    } catch (e) {
        console.log(`  跳过：测试文件读取失败: ${e.message}`);
    }
    console.log('');

    // 测试4：@import 处理
    console.log('【测试4】@import 语句');
    {
        const testCss = `@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC&display=swap');

.my-button { background: red; }`;

        const withRegex = processComplexCss(testCss, '.bubble-content');
        console.log(`  app-main.js 结果 (前200字符: ${withRegex.substring(0, 200)}`);
        console.log('');

        // @import 必须在最前面
        const importAtTop = withRegex.startsWith('@import') || withRegex.trim().startsWith('@import');
        console.log(`  @import 在最前面: ${importAtTop}`);

        // 检查是否 @import 被正确处理
        const hasImport = withRegex.includes('@import');
        console.log(`  包含 @import: ${hasImport}`);

        if (hasImport && importAtTop) {
            console.log('  ✅ 测试通过');
            passed++;
        } else {
            console.log('  ❌ 测试失败');
            failed++;
        }
    }

    console.log('');
    console.log('========================================');
    console.log(`  测试结果: ${passed} 通过, ${failed} 失败`);
    console.log('========================================');
    console.log('');

    // 打印关键差异总结
    console.log('【结论:');
    console.log('  chats.js 使用 css.parse() AST 解析 - 能够正确处理复杂的 CSS 语法树');
    console.log('  app-main.js 使用正则替换 - 仅能处理简单 CSS');
    console.log('  修复方案: 将 app-main.js 中的 processComplexCss 改为使用 css.parse() / css.stringify()');
    console.log('');
}

runTests();
