// 测试 @adobe/css-tools 对道渊角色卡 CSS 的解析
const cssLib = require('@adobe/css-tools');

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

#fireworks-canvas {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
    pointer-events: none;
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

.journey-container {
    margin-top: 25px;
    text-align: center;
    padding: 15px;
    background: rgba(213, 0, 249, 0.08);
    border-radius: 8px;
    border: 1px dashed rgba(213, 0, 249, 0.4);
    box-shadow: 0 0 15px rgba(213, 0, 249, 0.1) inset;
}

.journey-text {
    font-size: 0.95em;
    color: var(--primary-text);
    margin: 0;
    line-height: 1.6;
}

.journey-link {
    color: var(--accent-color);
    font-weight: 700;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    transition: all 0.3s ease;
    text-decoration: underline;
    text-decoration-style: dashed;
    text-underline-offset: 4px;
}

.journey-link:hover {
    color: var(--highlight-color);
    background: rgba(0, 255, 255, 0.1);
    text-shadow: 0 0 8px var(--highlight-color);
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
    .section p, .section ul {
        font-size: 0.9em;
        line-height: 1.7;
    }
    .journey-text {
        font-size: 0.85em;
    }
}
`;

try {
    const ast = cssLib.parse(css);
    console.log('=== 解析成功 ===');
    console.log('AST stylesheet rules count:', ast.stylesheet.rules.length);

    // 遍历并处理规则
    const prefix = '.bubble-content ';
    function processRule(rule) {
        if (rule.type === 'rule') {
            rule.selectors = rule.selectors.map(sel => {
                if (sel === 'body' || sel === 'html') return '.bubble-content';
                if (sel.startsWith('body ') || sel.startsWith('html ')) return '.bubble-content ' + sel.substring(5);
                if (sel.startsWith('::')) return sel;
                return prefix + sel;
            });
        } else if (rule.type === 'media') {
            rule.rules = rule.rules.map(processRule);
        }
        return rule;
    }

    // :root 特殊处理 - 把 :root 转换为作用域选择器
    ast.stylesheet.rules = ast.stylesheet.rules.map(rule => {
        if (rule.type === 'rule' && rule.selectors.includes(':root')) {
            rule.selectors = ['.bubble-content'];
        }
        return rule;
    });

    // 处理普通规则
    ast.stylesheet.rules = ast.stylesheet.rules.map(processRule);

    const result = cssLib.stringify(ast);
    console.log('\n=== 处理后的 CSS ===');
    console.log(result);
} catch (e) {
    console.error('解析失败:', e.message);
}
