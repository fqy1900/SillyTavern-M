const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/test_user_8002/chats/《道渊》v5.1/2026-06-19@17h28m58s889ms_1781861338889.json', 'utf-8'));
const content = data.messages[0].content;

// 查找完整的 switchToSecondGreeting 函数
const bodyMatch = content.match(/<body>([\s\S]*?)<\/body>/);
if (bodyMatch) {
    const bodyContent = bodyMatch[1];
    const scriptMatch = bodyContent.match(/<script>([\s\S]*?)<\/script>/);
    if (scriptMatch) {
        const script = scriptMatch[1];
        console.log('=== 脚本内容（前3000字符）===');
        console.log(script.substring(0, 3000));
    }
}
