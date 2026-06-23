const fs = require('fs');

// 读取道渊角色卡聊天数据
const filePath = 'd:/project-codewhale/SillyTavern-trae/data/default-user/chats/《道渊》v5.1/《道渊》v5.1 - 2026-06-20@14h46m18s493ms.jsonl';
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n').filter(l => l.trim());

// 第2行是第一条消息（开场白）
const msg = JSON.parse(lines[1]);

console.log('=== 开场白 swipes 结构 ===');
console.log('swipe_id:', msg.swipe_id);
console.log('swipes 数量:', msg.swipes?.length || 0);

if (msg.swipes && msg.swipes.length > 0) {
    const firstSwipe = msg.swipes[0];
    console.log('\n第一个 swipe 内容长度:', firstSwipe.length);
    
    // 提取 HTML 内容
    const htmlMatch = firstSwipe.match(/```html\s*\r?\n([\s\S]*?)\r?\n```/i);
    if (htmlMatch) {
        const htmlContent = htmlMatch[1];
        console.log('\nHTML 内容长度:', htmlContent.length);
        
        // 搜索脚本标签
        const scriptMatch = htmlContent.match(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi);
        if (scriptMatch) {
            console.log('\n找到', scriptMatch.length, '个脚本标签');
            scriptMatch.forEach((s, i) => {
                console.log(`\n--- 脚本 ${i} ---`);
                console.log(s.substring(0, 500));
            });
        } else {
            console.log('\n没有找到脚本标签');
        }
        
        // 搜索 switchToSecondGreeting
        if (htmlContent.includes('switchToSecondGreeting')) {
            console.log('\n✅ 找到 switchToSecondGreeting');
            const idx = htmlContent.indexOf('switchToSecondGreeting');
            console.log('上下文:', htmlContent.substring(Math.max(0, idx - 100), idx + 200));
        } else {
            console.log('\n❌ 没有找到 switchToSecondGreeting');
        }
    }
}