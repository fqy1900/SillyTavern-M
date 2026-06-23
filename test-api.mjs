// 端到端测试：验证开场白加载
async function test() {
    const baseUrl = 'http://127.0.0.1:8002/api/chat';

    // 1. 登录获取 token（或作为 default-user）
    console.log('=== 1. 测试角色卡详情接口 ===');
    const chars = ['default_Seraphina', '《道渊》v5.1', '催眠都市', '轮回修仙录'];
    for (const charId of chars) {
        try {
            const res = await fetch(`${baseUrl}/character/${encodeURIComponent(charId)}`);
            const data = await res.json();
            if (data.success && data.character) {
                const c = data.character;
                console.log(`✓ ${charId}`);
                console.log(`  name: ${c.name || '(无)'}`);
                console.log(`  first_mes: ${c.first_mes ? `存在 (${c.first_mes.length} chars)` : '不存在'}`);
                console.log(`  description: ${c.description ? `存在 (${c.description.length} chars)` : '不存在'}`);
            } else {
                console.log(`✗ ${charId} - ${data.error || '未找到'}`);
            }
        } catch (e) {
            console.log(`✗ ${charId} - 请求失败: ${e.message}`);
        }
    }

    console.log('\n=== 2. 测试创建新聊天（验证开场白自动添加）===');
    const testChars = ['《道渊》v5.1', '催眠都市', 'default_Seraphina'];
    for (const charId of testChars) {
        try {
            const res = await fetch(`${baseUrl}/chat/${encodeURIComponent(charId)}/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await res.json();
            if (data.success && data.chat) {
                const chat = data.chat;
                console.log(`✓ ${charId}`);
                console.log(`  chatId: ${chat.id}`);
                console.log(`  messages: ${chat.messages?.length || 0} 条`);
                if (chat.messages && chat.messages.length > 0) {
                    console.log(`  第一条消息 (${chat.messages[0].role}): ${chat.messages[0].content.substring(0, 80)}...`);
                } else {
                    console.log(`  警告: 没有开场消息!`);
                }
            } else {
                console.log(`✗ ${charId} - ${data.error || '失败'}`);
            }
        } catch (e) {
            console.log(`✗ ${charId} - 请求失败: ${e.message}`);
        }
    }

    console.log('\n=== 3. 测试加载已有聊天（验证开场白自动补全）===');
    // 加载原有的聊天
    const existingChat = '2026-06-19@17h28m58s889ms_1781861338889';
    try {
        const res = await fetch(`${baseUrl}/chat/${encodeURIComponent('《道渊》v5.1')}/${existingChat}`);
        const data = await res.json();
        if (data.success && data.chat) {
            const chat = data.chat;
            console.log(`✓ 加载聊天成功`);
            console.log(`  messages: ${chat.messages?.length || 0} 条`);
            if (chat.messages && chat.messages.length > 0) {
                console.log(`  第一条消息 (${chat.messages[0].role}): ${chat.messages[0].content.substring(0, 100)}...`);
            }
        } else {
            console.log(`✗ - ${data.error || '失败'}`);
        }
    } catch (e) {
        console.log(`✗ - 请求失败: ${e.message}`);
    }

    console.log('\n=== 测试完成 ===');
}

test().catch(console.error);
