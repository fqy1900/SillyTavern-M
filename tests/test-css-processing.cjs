const css = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;700&display=swap');

:root {
    --bg-color: #030a16;
    --card-bg: radial-gradient(circle at 50% 0%, rgba(20, 150, 255, 0.25), rgba(5, 10, 20, 0.85));
    --border-color-1: #00ffff;
    --border-color-2: #ffffff;
    --primary-text: #f0f8ff;
    --secondary-text: #a7d0d6;
    --accent-color: #00ffff;
    --highlight-color: #d500f9;
    --header-font: 'Noto Sans SC', sans-serif;
}

body {
    font-family: 'Noto Sans SC', sans-serif;
    background-color: var(--bg-color);
    color: var(--primary-text);
    margin: 0;
    padding: 20px;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    box-sizing: border-box;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    overflow: hidden;
}

.info-card {
    background: var(--card-bg);
    border-radius: 16px;
    padding: 40px 30px;
    max-width: 700px;
    width: 100%;
    position: relative;
    z-index: 1;
    overflow: hidden;
    border: 1px solid rgba(0, 255, 255, 0.3);
    box-shadow: 0 0 25px rgba(0, 255, 255, 0.4), 0 0 45px rgba(255, 255, 255, 0.2);
    transition: transform 0.2s ease-out;
    animation: fadeIn 1s ease-out forwards;
    opacity: 0;
    backdrop-filter: blur(5px);
}

@keyframes fadeIn {
    to {
        opacity: 1;
    }
}

.info-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 16px;
    padding: 2px;
    background: conic-gradient(from var(--angle), var(--border-color-1), var(--border-color-2), var(--border-color-1));
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    animation: spin 5s linear infinite;
    pointer-events: none;
}

@property --angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

@keyframes spin {
  to {
    --angle: 360deg;
  }
}

h1 {
    text-align: center;
    font-size: 1.8em;
    color: #fff;
    margin-top: 0;
    margin-bottom: 25px;
    font-weight: 700;
    letter-spacing: 2px;
    text-shadow: 0 0 5px var(--accent-color), 0 0 10px var(--highlight-color), 0 0 20px var(--border-color-1);
}

.section {
    margin-bottom: 20px;
    padding-left: 20px;
    border-left: 3px solid var(--accent-color);
    position: relative;
}

.section h3 {
    font-size: 1.1em;
    color: var(--accent-color);
    margin: 0 0 10px 0;
    font-weight: 400;
    display: flex;
    align-items: center;
}

.section p, .section ul {
    margin: 0;
    padding: 0;
    font-size: 0.95em;
    line-height: 1.8;
    color: var(--secondary-text);
}

.section strong {
    color: var(--highlight-color);
    font-weight: 700;
}

@media (max-width: 600px) {
    body {
        padding: 10px;
    }
    .info-card {
        padding: 25px 20px;
    }
    h1 {
        font-size: 1.5em;
    }
}
`;

// 测试各个正则表达式
console.log('=== 1. 测试 propertyRegex ===');
const propertyRegex = /@property[^{]+\{[^}]*\}/g;
const propertyMatches = css.match(propertyRegex);
console.log('property matches:', propertyMatches ? propertyMatches.length : 0);
if (propertyMatches) propertyMatches.forEach((m, i) => console.log('  [' + i + ']', m.replace(/\s+/g, ' ').substring(0, 100)));

console.log('\n=== 2. 测试 keyframesRegex ===');
const keyframesRegex = /@keyframes[^{]+\{[\s\S]*?\n\s*\}/g;
const keyframesMatches = css.match(keyframesRegex);
console.log('keyframes matches:', keyframesMatches ? keyframesMatches.length : 0);
if (keyframesMatches) keyframesMatches.forEach((m, i) => {
    const clean = m.replace(/\s+/g, ' ');
    console.log('  [' + i + ']', clean.substring(0, 120), clean.length > 120 ? '...' : '');
});

console.log('\n=== 3. 测试 mediaRegex ===');
const mediaRegex = /@media[^{]+\{[\s\S]*?\n\s*\}/g;
const mediaMatches = css.match(mediaRegex);
console.log('media matches:', mediaMatches ? mediaMatches.length : 0);
if (mediaMatches) mediaMatches.forEach((m, i) => {
    const clean = m.replace(/\s+/g, ' ');
    console.log('  [' + i + ']', clean.substring(0, 120), clean.length > 120 ? '...' : '');
});

console.log('\n=== 4. 测试 importRegex ===');
const importRegex = /@import\s+[^;]+;/g;
const importMatches = css.match(importRegex);
console.log('import matches:', importMatches ? importMatches.length : 0);
if (importMatches) importMatches.forEach((m, i) => console.log('  [' + i + ']', m.replace(/\s+/g, ' ')));

console.log('\n=== 5. 测试 ruleRegex (提取后剩余CSS中的规则) ===');
// 模拟 processComplexCss 的处理流程
let testCss = css;
testCss = testCss.replace(importRegex, () => '');
testCss = testCss.replace(keyframesRegex, () => '');
testCss = testCss.replace(mediaRegex, () => '');
testCss = testCss.replace(propertyRegex, () => '');

const rootRegex = /:root\s*\{([\s\S]*?)\}/;
const rootMatch = testCss.match(rootRegex);
console.log('root match:', rootMatch ? 'YES' : 'NO');
if (rootMatch) testCss = testCss.replace(rootRegex, '');

const ruleRegex = /([^{]+)\{([^}]*)\}/g;
let count = 0;
let ruleMatch;
while ((ruleMatch = ruleRegex.exec(testCss)) !== null) {
    const selector = ruleMatch[1].trim();
    const rules = ruleMatch[2].trim();
    if (selector && rules) {
        const clean = rules.replace(/\s+/g, ' ');
        console.log('  [' + count + ']', selector, '=>', clean.substring(0, 80));
        count++;
    }
}
console.log('  total rule count:', count);

console.log('\n=== 6. 检查 @keyframes spin 是否被正确提取 ===');
// 注意：@keyframes spin 的内容只有 "to { --angle: 360deg; }"，里面有嵌套的 {}
// 但关键问题是 @keyframes spin 的结尾是 "}\n}"
// 让我看看正则是否能匹配到
const spinTest = `@keyframes spin {
  to {
    --angle: 360deg;
  }
}`;
console.log('spin test match:', spinTest.match(keyframesRegex));

console.log('\n=== 7. 完整模拟 processComplexCss 的输出 ===');
// 模拟完整处理
function processComplexCss(css, scopeSelector) {
    const parts = [];
    const imports = [];
    const keyframes = [];
    const mediaQueries = [];
    const regularRules = [];
    const propertyAtRules = [];

    // 1. 提取 @import
    css = css.replace(importRegex, (match) => { imports.push(match.trim()); return ''; });

    // 2. 提取 @keyframes
    css = css.replace(keyframesRegex, (match) => { keyframes.push(match.trim()); return ''; });

    // 3. 提取 @media
    css = css.replace(mediaRegex, (match) => { mediaQueries.push(match.trim()); return ''; });

    // 4. 提取 @property
    css = css.replace(propertyRegex, (match) => { propertyAtRules.push(match.trim()); return ''; });

    // 5. 处理 :root
    let rootContent = '';
    const rMatch = css.match(rootRegex);
    if (rMatch) { rootContent = rMatch[1].trim(); css = css.replace(rootRegex, ''); }

    // 6. 处理 body/html 和普通规则
    const localRuleRegex = /([^{]+)\{([^}]*)\}/g;
    let localMatch;
    while ((localMatch = localRuleRegex.exec(css)) !== null) {
        let selector = localMatch[1].trim();
        const rules = localMatch[2].trim();
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
        regularRules.push(selector + ' { ' + rules + ' }');
    }

    // 7. 组合
    if (imports.length > 0) parts.push(...imports);
    if (rootContent) parts.push(scopeSelector + ' { ' + rootContent + ' }');
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
                    if (selector === 'body' || selector === 'html') return scopeSelector + ' { ' + rules.trim() + ' }';
                    const selectors = selector.split(',').map(s => {
                        const trimmed = s.trim();
                        if (!trimmed) return s;
                        if (trimmed.startsWith('::')) return trimmed;
                        return scopeSelector + ' ' + trimmed;
                    });
                    return selectors.join(', ') + ' { ' + rules.trim() + ' }';
                });
                parts.push(header + scopedInner + footer);
            } else parts.push(media);
        }
    }
    return '<style data-scoped>' + parts.join('\n\n') + '</style>';
}

const result = processComplexCss(css, '.bubble-content');
console.log(result);
