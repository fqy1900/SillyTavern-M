// 端到端 API 测试
async function test() {
    const base = 'http://127.0.0.1:8002/api/chat';

    // 测试角色详情
    console.log('=== /character/:id ===');
    const charIds = ['%E3%80%8A%E9%81%93%E6%B8%8A%E3%80%8Bv5.1', encodeURIComponent('催眠都市'), 'default_Seraphina', encodeURIComponent('轮回修仙录')];
    for (const id of charIds) {
        try {
            const res = await fetch(`${base}/character/${id}`);
            const data = await res.json();
            if (data.success && data.character) {
                const c = data.character;
                console.log(`✓ ${id}`);
                console.log(`  name: ${c.name}`);
                console.log(`  first_mes: ${c.first_mes ? `存在 (${c.first_mes.length} chars)` : '不存在'}`);
            } else {
                console.log(`✗ ${id}: ${data.error || '未知错误'}`);
            }
        } catch (e) { console.log(`✗ ${id}: ${e.message}`); }
    }

    console.log('\n=== 登录测试 ===');
    // 先获取 cookie
    const cookieJar = {};
    const testLogin = async () => {
        // 尝试注册/登录 testuser123 (已有账户)
        const loginRes = await fetch('http://127.0.0.1:8002/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ handle: 'testuser123', password: 'testuser123' }),
        });
        const cookie = loginRes.headers.get('set-cookie') || '';
        if (loginRes.ok) {
            console.log('✓ 登录成功');
            return cookie;
        } else {
            const data = await loginRes.json();
            console.log(`登录: ${data.error || data.success || '未知'}`);
            return null;
        }
    };
    const cookie = await testLogin();
    if (!cookie) {
        console.log('跳过需要登录的测试');
        return;
    }

    console.log('\n=== POST /chat/:charId/create ===');
    const testCreateChars = ['%E3%80%8A%E9%81%93%E6%B8%8A%E3%80%8Bv5.1', encodeURIComponent('催眠都市')];
    for (const id of testCreateChars) {
        try {
            const res = await fetch(`${base}/chat/${id}/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Cookie': cookie }
            });
            const data = await res.json();
            if (data.success && data.chat) {
                const chat = data.chat;
                console.log(`✓ ${id}`);
                console.log(`  消息数量: ${chat.messages?.length || 0}`);
                if (chat.messages?.[0]) {
                    console.log(`  首条消息预览: ${chat.messages[0].content.substring(0, 80)}...`);
                }
            } else {
                console.log(`✗ ${id}: ${data.error || '未知'}`);
            }
        } catch (e) { console.log(`✗ ${id}: ${e.message}`); }
    }

    console.log('\n=== GET /chat/:charId/:chatId 已有聊天加载 ===');
    const existingChat = '2026-06-19@17h28m58s889ms_1781861338889';
    try {
        const res = await fetch(`${base}/chat/%E3%80%8A%E9%81%93%E6%B8%8A%E3%80%8Bv5.1/${existingChat}`, { headers: { 'Cookie': cookie } });
        const data = await res.json();
        if (data.success && data.chat) {
            const chat = data.chat;
            console.log(`✓ 加载成功`);
            console.log(`  消息数量: ${chat.messages?.length || 0}`);
            if (chat.messages?.[0]) {
                console.log(`  首条消息预览: ${chat.messages[0].content.substring(0, 120)}...`);
            } else {
                console.log(`  (无开场白)`);
            }
        } else {
            console.log(`✗ : ${data.error || '未知'}`);
        }
    } catch (e) { console.log(`✗ : ${e.message}`); }

    console.log('\n=== 测试完成 ===');
}

test().catch(console.error);
