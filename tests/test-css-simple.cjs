// 测试 CSS 处理和脚本执行逻辑
const cssLib = require('@adobe/css-tools');

// ---------- 测试 1: CSS AST 处理 ----------
console.log('========== 测试 1: CSS AST 处理 ==========');

const css = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;700&display=swap');

:root {
    --bg-color: #030a16;
    --card-bg: radial-gradient(circle at 50% 0%, rgba(20, 150, 255, 0.25), rgba(5, 10, 20, 0.85));
    --border-color-1: #00ffff;
    --border-color-2: #ffffff;
    --primary-text: #f0f8ff;
    --accent-color: #00ffff;
    --highlight-color: #d500f9;
}

body {
    font-family: 'Noto Sans SC', sans-serif;
    background-color: var(--bg-color);
    color: var(--primary-text);
    margin: 0;
    padding: 20px;
}

.info-card {
    background: var(--card-bg);
    border-radius: 16px;
    padding: 40px 30px;
    max-width: 700px;
    border: 1px solid rgba(0, 255, 255, 0.3);
    box-shadow: 0 0 25px rgba(0, 255, 255, 0.4), 0 0 45px rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(5px);
}

@keyframes fadeIn {
    to { opacity: 1; }
}

.info-card::before {
    content: '';
    position: absolute;
    border-radius: 16px;
    background: conic-gradient(from var(--angle), var(--border-color-1), var(--border-color-2), var(--border-color-1));
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    animation: spin 5s linear infinite;
}

@property --angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

@keyframes spin {
  to { --angle: 360deg; }
}

h1 {
    text-align: center;
    color: #fff;
    text-shadow: 0 0 5px var(--accent-color), 0 0 10px var(--highlight-color);
}

.journey-link {
    color: var(--accent-color);
    font-weight: 700;
    cursor: pointer;
}

.journey-link:hover {
    color: var(--highlight-color);
    background: rgba(0, 255, 255, 0.1);
}

@media (max-width: 600px) {
    body { padding: 10px; }
    .info-card { padding: 25px 20px; }
    h1 { font-size: 1.5em; }
}
`;

function processComplexCss(cssText, scopeSelector) {
    try {
        const ast = cssLib.parse(cssText);
        const sheet = ast?.stylesheet;
        if (!sheet) return `<style>${cssText}</style>`;

        function addPrefixToSelectors(selectors) {
            return selectors.map(sel => {
                if (!sel) return sel;
                const trimmed = sel.trim();
                if (!trimmed) return sel;
                // 跳过 at-rules（@property, @font-face, @keyframes, @supports 等）
                if (trimmed.startsWith('@')) return trimmed;
                if (trimmed === 'body' || trimmed === 'html' || trimmed === ':root') return scopeSelector;
                if (trimmed.startsWith('body ') || trimmed.startsWith('html ')) {
                    return scopeSelector + ' ' + trimmed.substring(5);
                }
                if (trimmed.startsWith('::')) return trimmed;
                return scopeSelector + ' ' + trimmed;
            });
        }

        function processRule(rule) {
            if (rule.type === 'rule') {
                rule.selectors = addPrefixToSelectors(rule.selectors);
            } else if (rule.type === 'media' && Array.isArray(rule.rules)) {
                rule.rules = rule.rules.map(processRule);
            } else if (rule.type === 'supports' && Array.isArray(rule.rules)) {
                rule.rules = rule.rules.map(processRule);
            }
            return rule;
        }

        sheet.rules = sheet.rules.map(processRule);
        return `<style data-scoped>${cssLib.stringify(ast)}</style>`;
    } catch (e) {
        console.warn('CSS parse error:', e.message);
        return `<style>${cssText}</style>`;
    }
}

const processed = processComplexCss(css, '.bubble-content');
console.log('处理后的 CSS 片段:');
console.log(processed.substring(0, 2000));
console.log('...\n');

// 验证
const checks = [
    ['@import 保留', processed.includes('@import')],
    ['.bubble-content CSS 变量', processed.includes('.bubble-content {') && processed.includes('--bg-color')],
    ['.bubble-content body 替换', !processed.includes('body {') && processed.includes('.bubble-content {')],
    ['.bubble-content .info-card 前缀', processed.includes('.bubble-content .info-card')],
    ['.bubble-content h1 前缀', processed.includes('.bubble-content h1')],
    ['@keyframes fadeIn 保留', processed.includes('@keyframes fadeIn')],
    ['@keyframes spin 保留', processed.includes('@keyframes spin')],
    ['conic-gradient 保留', processed.includes('conic-gradient')],
    ['box-shadow 保留', processed.includes('box-shadow')],
    ['text-shadow 保留', processed.includes('text-shadow')],
    ['backdrop-filter 保留', processed.includes('backdrop-filter')],
    ['border 颜色保留', processed.includes('rgba(0, 255, 255, 0.3)')],
    ['.journey-link 样式保留', processed.includes('.bubble-content .journey-link')],
    ['.journey-link:hover 保留', processed.includes('.bubble-content .journey-link:hover')],
    ['@media 查询正确前缀', processed.includes('@media (max-width: 600px)') && processed.includes('.bubble-content {\n    padding: 10px')],
    ['@property 未被前缀', !processed.includes('.bubble-content @property') && processed.includes('@property --angle')],
];

console.log('========== 验证结果 ==========');
let allPassed = true;
for (const [name, passed] of checks) {
    const icon = passed ? '✅' : '❌';
    if (!passed) allPassed = false;
    console.log(`${icon} ${name}: ${passed ? 'PASS' : 'FAIL'}`);
}

// ---------- 测试 2: 脚本处理 ----------
console.log('\n========== 测试 2: 脚本处理与执行 ==========');

// 模拟脚本提取和重新注入
const scriptText = `
    async function switchToSecondGreeting() {
        console.log('仙途开启!');
        if (typeof getChatMessages !== 'undefined' && typeof setChatMessage !== 'undefined') {
            const msgs = await getChatMessages(0, { include_swipe: true });
            if (msgs && msgs[0] && msgs[0].swipes && msgs[0].swipes.length > 1) {
                setChatMessage(msgs[0].swipes[1], 0, { swipe_id: 1, refresh: 'display_and_render_current' });
            }
        }
    }
`;

// 检查脚本内容
console.log('switchToSecondGreeting 存在:', scriptText.includes('switchToSecondGreeting'));
console.log('getChatMessages 存在:', scriptText.includes('getChatMessages'));
console.log('setChatMessage 存在:', scriptText.includes('setChatMessage'));

// 验证脚本可以被 eval 执行（检查语法正确性）
try {
    const fn = new Function(scriptText);
    console.log('✅ 脚本语法正确: 可被 Function() 解析');
} catch (e) {
    console.log('❌ 脚本语法错误:', e.message);
    allPassed = false;
}

console.log('\n========== 总结 ==========');
console.log(allPassed ? '✅ 所有测试通过!' : '❌ 部分测试失败，请检查');
