const fs = require('fs');

// 读取道渊角色卡聊天数据
const filePath = 'd:/project-codewhale/SillyTavern-trae/data/default-user/chats/《道渊》v5.1/《道渊》v5.1 - 2026-06-20@14h46m18s493ms.jsonl';
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n').filter(l => l.trim());

// 第2行是第一条消息（开场白）
const msg = JSON.parse(lines[1]);

if (msg.swipes && msg.swipes.length > 0) {
    const firstSwipe = msg.swipes[0];
    
    // 提取 HTML 内容
    const htmlMatch = firstSwipe.match(/```html\s*\r?\n([\s\S]*?)\r?\n```/i);
    if (htmlMatch) {
        const htmlContent = htmlMatch[1];
        
        // 查找 switchToSecondGreeting 函数定义
        const funcMatch = htmlContent.match(/async function switchToSecondGreeting\(\) \{[\s\S]*?\n        \}/);
        if (funcMatch) {
            console.log('=== switchToSecondGreeting 完整函数定义 ===');
            console.log(funcMatch[0]);
        }
        
        // 打印第二个 swipe 的内容
        console.log('\n\n=== 第二个 swipe 内容 ===');
        console.log('内容:', msg.swipes[1]);
        console.log('长度:', msg.swipes[1].length);
    }
}