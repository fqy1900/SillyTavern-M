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
        
        // 查找 switchToSecondGreeting 的所有出现位置
        let idx = htmlContent.indexOf('switchToSecondGreeting');
        while (idx !== -1) {
            console.log('=== switchToSecondGreeting 出现在位置', idx, '===');
            console.log('上下文 (前后各500字符):');
            const start = Math.max(0, idx - 500);
            const end = Math.min(htmlContent.length, idx + 500);
            console.log(htmlContent.substring(start, end));
            console.log('\n');
            idx = htmlContent.indexOf('switchToSecondGreeting', idx + 1);
        }
        
        // 检查是否有第二个 swipe（Alternate Greeting）
        if (msg.swipes.length > 1) {
            console.log('\n=== 第二个 swipe 内容 ===');
            const secondSwipe = msg.swipes[1];
            console.log('长度:', secondSwipe.length);
            
            // 检查第二个 swipe 是否也包含 switchToSecondGreeting
            if (secondSwipe.includes('switchToSecondGreeting')) {
                console.log('第二个 swipe 也包含 switchToSecondGreeting');
            } else {
                console.log('第二个 swipe 不包含 switchToSecondGreeting');
            }
        }
    }
}