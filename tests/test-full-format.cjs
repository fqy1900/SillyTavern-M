// 模拟 app-main.js 中的 formatMessageContent 逻辑
// 使用 @adobe/css-tools 进行 CSS 解析

const DOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const cssLib = require('@adobe/css-tools');

const window = new JSDOM('').window;
const purify = DOMPurify(window);

// 道渊角色卡开场白 HTML
const htmlContent = `
<html>
<head>
    <style>
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
            text-shadow: 0 0 5px var(--accent-color), 0 0 10px var(--highlight-color), 0 0 20px var(--border-color-1);
        }

        .section {
            margin-bottom: 20px;
            padding-left: 20px;
            border-left: 3px solid var(--accent-color);
        }

        .section h3 {
            color: var(--accent-color);
        }

        .journey-container {
            margin-top: 25px;
            text-align: center;
            padding: 15px;
            background: rgba(213, 0, 249, 0.08);
            border-radius: 8px;
            border: 1px dashed rgba(213, 0, 249, 0.4);
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
            body { padding: 10px; }
            .info-card { padding: 25px 20px; }
            h1 { font-size: 1.5em; }
        }
    </style>
</head>
<body>
    <div class="info-card" id="info-card">
        <h1>欢迎体验本卡，希望为您带来沉浸式游玩感受！</h1>
        <div class="section">
            <h3>重要提示</h3>
            <p>本卡搭载前端代码，使用前请确保已安装酒馆助手、提示词模板语法</p>
        </div>
        <div class="journey-container">
            <p>请<span class="journey-link" onclick="switchToSecondGreeting()">点击这里</span>开始您的仙途吧♡</p>
        </div>
    </div>

    <script>
        async function switchToSecondGreeting() {
            console.log('switchToSecondGreeting called!');
            if (typeof getChatMessages !== 'undefined' && typeof setChatMessage !== 'undefined') {
                try {
                    const msgs = await getChatMessages(0, { include_swipe: true });
                    if (msgs && msgs[0] && msgs[0].swipes && msgs[0].swipes.length > 1) {
                        setChatMessage(msgs[0].swipes[1], 0, { swipe_id: 1, refresh: 'display_and_render_current' });
                    }
                } catch (err) {
                    console.error(err);
                }
            }
        }
    </script>
</body>
</html>
`;

// 模拟 formatMessageContent 的处理流程
function encodeStyleTags(text) {
    const styleRegex = /<style>([\s\S]*?)<\/style>/gims;
    return text.replace(styleRegex, (_, match) =>
        `<custom-style>${encodeURIComponent(match)}</custom-style>`
    );
}

function decodeStyleTags(text, scopeSelector) {
    const decodeRegex = /<custom-style>([\s\S]*?)<\/custom-style>/gms;
    return text.replace(decodeRegex, (_, encoded) => {
        const css = decodeURIComponent(encoded);
        return processComplexCss(css, scopeSelector);
    });
}

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

// 模拟完整的处理流程
function formatMessageContent(content) {
    // 1. 提取脚本
    const extractedScripts = [];
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gim;
    let contentWithoutScripts = content.replace(scriptRegex, (fullMatch, scriptText) => {
        extractedScripts.push({ text: scriptText.trim(), src: '' });
        return '';
    });

    // 2. 移除 html/head/body 包装
    let rawHtml = contentWithoutScripts
        .replace(/^[\s]*<html[^>]*>[\s\S]*?<head[^>]*>[\s\S]*?<\/head>[\s\S]*?<body[^>]*>/ims, '')
        .replace(/<\/body>[\s\S]*?<\/html>[\s]*$/ims, '')
        .trim();

    // 3. 编码 style -> custom-style
    rawHtml = encodeStyleTags(rawHtml);

    // 4. DOMPurify 净化
    rawHtml = purify.sanitize(rawHtml, {
        ADD_TAGS: ['custom-style', 'link'],
        ADD_ATTR: [
            'class', 'id', 'style', 'href', 'rel', 'src', 'onload', 'media', 'type',
            'onclick', 'onchange', 'onsubmit', 'onkeydown', 'onkeyup', 'onkeypress',
            'onmousedown', 'onmouseup', 'onmouseover', 'onmouseout', 'onmouseenter', 'onmouseleave',
            'onfocus', 'onblur', 'oninput', 'onscroll', 'ondblclick',
            'data-*',
        ],
        FORBID_TAGS: ['script'],
    });

    // 5. 解码 custom-style -> style + 作用域前缀
    rawHtml = decodeStyleTags(rawHtml, '.bubble-content');

    // 6. 附加脚本
    let pendingScripts = '';
    if (extractedScripts.length > 0) {
        pendingScripts = extractedScripts.map(script => {
            return `<script data-pending-scripts="true">${script.text}</script>`;
        }).join('');
    }

    return rawHtml + pendingScripts;
}

// 执行测试
const result = formatMessageContent(htmlContent);
console.log('=== 处理后的 HTML 长度 ===');
console.log(result.length, 'chars');

console.log('\n=== 关键检查项 ===');

// 1. 检查 onclick 是否被保留
const hasOnclick = result.includes('onclick');
console.log('✅ onclick 被保留:', hasOnclick);
if (hasOnclick) {
    const onclickMatch = result.match(/onclick="[^"]*"/);
    console.log('   onclick 值:', onclickMatch ? onclickMatch[0] : 'N/A');
}

// 2. 检查脚本函数定义是否被保留
const hasSwitchToSecond = result.includes('switchToSecondGreeting');
console.log('✅ 脚本函数定义保留:', hasSwitchToSecond);

// 3. 检查 CSS 选择器是否被正确前缀
const hasBubblePrefix = result.includes('.bubble-content .info-card');
console.log('✅ CSS 选择器前缀正确 (.bubble-content .info-card):', hasBubblePrefix);

const hasBubbleContent = result.includes('.bubble-content {');
console.log('✅ :root/body 被替换为 .bubble-content:', hasBubbleContent);

// 4. 检查关键 CSS 属性是否被保留
const hasBorderColor = result.includes('rgba(0, 255, 255, 0.3)');
console.log('✅ border 颜色保留:', hasBorderColor);

const hasBoxShadow = result.includes('box-shadow');
console.log('✅ box-shadow 保留:', hasBoxShadow);

const hasTextShadow = result.includes('text-shadow');
console.log('✅ text-shadow 保留:', hasTextShadow);

const hasConicGradient = result.includes('conic-gradient');
console.log('✅ conic-gradient 保留:', hasConicGradient);

const hasFadeIn = result.includes('@keyframes fadeIn');
console.log('✅ @keyframes fadeIn 保留:', hasFadeIn);

const hasSpin = result.includes('@keyframes spin');
console.log('✅ @keyframes spin 保留:', hasSpin);

const hasMediaQuery = result.includes('@media');
console.log('✅ @media 查询保留:', hasMediaQuery);

// 5. 检查 @import 是否被保留
const hasImport = result.includes('@import');
console.log('✅ @import 保留:', hasImport);

console.log('\n=== 输出前 2000 字符 ===');
console.log(result.substring(0, 2000));

console.log('\n...\n=== 输出包含 journey-link 的部分 ===');
const journeyIdx = result.indexOf('journey-link');
if (journeyIdx >= 0) {
    console.log(result.substring(Math.max(0, journeyIdx - 50), journeyIdx + 200));
}

// 验证无错误
const hasErrors = result.includes('[processComplexCss]') || result.includes('CSS parse error');
console.log('\n✅ 无 CSS 解析错误:', !hasErrors);
