const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/test_user_8002/chats/《道渊》v5.1/2026-06-19@17h28m58s889ms_1781861338889.json', 'utf-8'));
const content = data.messages[0].content;

// 查找 switchToSecondGreeting 函数
const switchFunc = content.match(/function switchToSecondGreeting[\s\S]*?(?=\n\s*function|\n\s*<\/script>|$(?![\s\S]))/);
if (switchFunc) {
    console.log('=== switchToSecondGreeting 函数 ===');
    console.log(switchFunc[0]);
} else {
    // 尝试另一种方式查找
    const idx = content.indexOf('function switchToSecondGreeting');
    if (idx !== -1) {
        const endIdx = content.indexOf('function', idx + 20);
        const func = content.substring(idx, endIdx !== -1 ? endIdx : content.indexOf('</script>', idx));
        console.log('=== switchToSecondGreeting 函数 ===');
        console.log(func);
    } else {
        console.log('未找到函数');
    }
}
