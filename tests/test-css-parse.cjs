const fs = require('fs');

// 从 app-main.js 中提取 processComplexCss 函数
const appMainContent = fs.readFileSync('d:/project-codewhale/SillyTavern-trae/public/scripts/app-main.js', 'utf-8');

// 提取道渊角色卡的 CSS
const chatPath = 'd:/project-codewhale/SillyTavern-trae/data/default-user/chats/《道渊》v5.1/《道渊》v5.1 - 2026-06-20@14h46m18s493ms.jsonl';
const chatContent = fs.readFileSync(chatPath, 'utf-8');
const lines = chatContent.split('\n').filter(l => l.trim());
const msg = JSON.parse(lines[1]);

const htmlBlockMatch = msg.swipes[0].match(/^\s*```html\s*\r?\n([\s\S]*?)\r?\n```\s*$/i);
let rawHtml = htmlBlockMatch[1];

// 提取 <head> 中的 CSS
let headStyles = '';
const headMatch = rawHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
if (headMatch) {
    const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let styleMatch;
    while ((styleMatch = styleRegex.exec(headMatch[1])) !== null) {
        headStyles += styleMatch[1] + '\n';
    }
}

console.log('=== CSS 内容分析 ===');
console.log('CSS 总长度:', headStyles.length);

// 检查特殊 CSS 特性
const features = [
    '@import',
    '@keyframes',
    '@property',
    '@media',
    ':root',
    'body',
    '.info-card',
    '.info-card::before',
    '--angle',
    'conic-gradient',
    'box-shadow',
    'border',
    'backdrop-filter',
    'mask-composite',
    'text-shadow',
    '.journey-link',
    '.journey-link:hover',
    '@keyframes fadeIn',
    '@keyframes spin',
];

console.log('\nCSS 特性检测:');
features.forEach(f => {
    const found = headStyles.includes(f);
    console.log(`  ${found ? '✅' : '❌'} ${f}`);
});

// 测试 @adobe/css-tools 是否能解析这段 CSS
console.log('\n=== 使用 @adobe/css-tools 解析测试 ===');
try {
    const css = require('@adobe/css-tools');
    const ast = css.parse(headStyles);
    console.log('✅ CSS 解析成功！');
    
    if (ast.stylesheet && ast.stylesheet.rules) {
        const rules = ast.stylesheet.rules;
        console.log('总规则数:', rules.length);
        
        // 按类型统计
        const typeCounts = {};
        rules.forEach(r => {
            const type = r.type;
            typeCounts[type] = (typeCounts[type] || 0) + 1;
        });
        
        console.log('规则类型分布:');
        Object.keys(typeCounts).forEach(t => {
            console.log(`  ${t}: ${typeCounts[t]}`);
        });

        // 检查普通规则的选择器
        console.log('\n普通规则选择器（前 10 个）:');
        rules.filter(r => r.type === 'rule').slice(0, 10).forEach((r, i) => {
            console.log(`  [${i}] ${r.selectors.join(', ')}`);
        });

        // 检查 keyframes
        console.log('\n@keyframes 规则:');
        rules.filter(r => r.type === 'keyframes').forEach((r, i) => {
            console.log(`  [${i}] ${r.name}`);
        });

        // 检查 @property
        console.log('\n@ rules（如 @property）:');
        rules.filter(r => r.type !== 'rule' && r.type !== 'keyframes' && r.type !== 'media').forEach((r, i) => {
            console.log(`  [${i}] ${r.type}: ${r.property || JSON.stringify(r).substring(0, 80)}`);
        });

        // 检查 @media
        console.log('\n@media 规则:');
        rules.filter(r => r.type === 'media').forEach((r, i) => {
            console.log(`  [${i}] ${r.media || '(media)'} - ${r.rules?.length || 0} sub rules`);
        });
    }
} catch (e) {
    console.log('❌ CSS 解析失败:', e.message);
    console.log('错误位置:', JSON.stringify(e).substring(0, 200));
}

console.log('\n=== 结论 ===');
console.log('CSS 包含大量高级特性（@keyframes、@property、conic-gradient、backdrop-filter）');
console.log('这些特性需要正确的 CSS AST 解析才能为选择器添加正确的作用域前缀');
