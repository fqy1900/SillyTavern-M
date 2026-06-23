const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/test_user_8002/chats/《道渊》v5.1/2026-06-19@17h28m58s889ms_1781861338889.json', 'utf-8'));
const content = data.messages[0].content;

// 分析 HTML 结构
console.log('=== HTML 结构分析 ===');
console.log('Starts with ```html:', content.trim().startsWith('```html'));
console.log('Contains <html>:', content.includes('<html>'));
console.log('Contains <body>:', content.includes('<body>'));
console.log('Contains <style>:', content.includes('<style>'));
console.log('Contains <script>:', content.includes('<script>'));
console.log('Contains onclick:', content.includes('onclick'));
console.log('');

// 提取 body 内容
const bodyMatch = content.match(/<body>([\s\S]*?)<\/body>/);
if (bodyMatch) {
    const bodyContent = bodyMatch[1];
    console.log('=== body 内容分析 ===');
    console.log('Body 长度:', bodyContent.length);
    console.log('Body 包含 onclick:', bodyContent.includes('onclick'));
    console.log('Body 包含 <script>:', bodyContent.includes('<script'));
    console.log('');

    // 查找 onclick
    const onclickMatches = bodyContent.match(/onclick=[^>\s]*/gi);
    if (onclickMatches) {
        console.log('=== onclick 属性 ===');
        onclickMatches.slice(0, 5).forEach((m, i) => console.log(`onclick ${i}: ${m}`));
    }

    // 查找脚本标签
    const scriptMatches = bodyContent.match(/<script[\s\S]*?<\/script>/gi);
    if (scriptMatches) {
        console.log('\n=== 脚本标签 (前2个) ===');
        scriptMatches.slice(0, 2).forEach((s, i) => {
            console.log(`Script ${i} (前300字符):`);
            console.log(s.substring(0, 300));
        });
    }
} else {
    console.log('未找到 <body> 标签');
}

// 分析整个 first_mes 中的关键元素
console.log('\n=== 关键元素 ===');
const keyElements = ['点击这里', 'importCharacter', 'importGroupChat', 'import_chat', 'create_chat'];
keyElements.forEach(key => {
    console.log(`"${key}":`, content.includes(key) ? '存在' : '不存在');
});
