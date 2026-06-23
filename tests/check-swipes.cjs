const fs = require('fs');

// 读取道渊角色卡聊天数据
const filePath = 'd:/project-codewhale/SillyTavern-trae/data/default-user/chats/《道渊》v5.1/《道渊》v5.1 - 2026-06-20@14h46m18s493ms.jsonl';
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n').filter(l => l.trim());

console.log('=== 聊天数据结构分析 ===');
console.log('总行数:', lines.length);

// 第1行是 metadata
const metadata = JSON.parse(lines[0]);
console.log('\n第1行 metadata:');
console.log('  chat_metadata.variables:', metadata.chat_metadata?.variables);

// 第2行是第一条消息（开场白）
const msg = JSON.parse(lines[1]);
console.log('\n第2条消息（开场白）:');
console.log('  name:', msg.name);
console.log('  is_user:', msg.is_user);
console.log('  swipe_id:', msg.swipe_id);
console.log('  swipes 数量:', msg.swipes?.length || 0);
console.log('  mes (当前内容):', msg.mes?.substring(0, 100));

// 检查 swipes 结构
if (msg.swipes) {
    console.log('\n  swipes 详情:');
    msg.swipes.forEach((s, i) => {
        console.log(`    [${i}] 长度: ${s.length}, 开头: ${s.substring(0, 50).replace(/\n/g, '\\n')}`);
    });
}

// 模拟 shim 函数返回的数据
console.log('\n=== 模拟 getChatMessages shim 返回值 ===');
const messages = [msg]; // state.currentChat.messages
const result = [];

for (let i = 0; i < messages.length; i++) {
    const m = { ...messages[i], id: i };
    // 如果需要包含 swipes
    if (m.swipes) {
        result.push({
            ...m,
            swipes: m.swipes,
            swipe_id: m.swipe_id ?? 0,
        });
    } else {
        result.push(m);
    }
}

console.log('返回的消息数量:', result.length);
console.log('第一条消息:');
console.log('  id:', result[0].id);
console.log('  swipes:', result[0].swipes?.length || 'undefined');
console.log('  swipe_id:', result[0].swipe_id);

// 检查 switchToSecondGreeting 函数的判断条件
console.log('\n=== switchToSecondGreeting 判断条件 ===');
const msgs = result;
const condition1 = msgs && msgs[0]; // 是否有第一条消息
const condition2 = msgs[0] && msgs[0].swipes; // 是否有 swipes
const condition3 = msgs[0].swipes && msgs[0].swipes.length > 1; // 是否有多个 swipes

console.log('  msgs 存在:', !!msgs);
console.log('  msgs[0] 存在:', !!msgs[0]);
console.log('  msgs[0].swipes 存在:', !!msgs[0]?.swipes);
console.log('  swipes.length > 1:', msgs[0]?.swipes?.length > 1);

if (condition3) {
    console.log('\n✅ 条件满足，应该能切换到第二个开场白');
    console.log('第二个开场白内容（前100字符）:', msgs[0].swipes[1].substring(0, 100));
} else {
    console.log('\n❌ 条件不满足，会弹出提示');
    if (!msgs[0]?.swipes) {
        console.log('  问题: swipes 属性不存在');
    } else if (msgs[0].swipes.length <= 1) {
        console.log('  问题: swipes 数量不足（只有', msgs[0].swipes.length, '个）');
    }
}