const http = require('http');

const BASE = 'http://127.0.0.1:8002';
let cookie = '';
let csrfToken = '';

function httpRequest(method, path, body) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE);
        const opts = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
        };
        if (cookie) opts.headers['Cookie'] = cookie;
        if (csrfToken) opts.headers['x-csrf-token'] = csrfToken;
        const req = http.request(opts, (res) => {
            let data = '';
            if (res.headers['set-cookie']) {
                cookie = res.headers['set-cookie'].join('; ');
            }
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function fetchCsrfToken() {
    const res = await httpRequest('GET', '/csrf-token');
    if (res.body && res.body.token) {
        csrfToken = res.body.token;
        console.log(`  - CSRF Token: ${csrfToken.substring(0, 20)}...`);
    } else {
        console.log('  ⚠️  Failed to get CSRF token');
    }
}

function ok(label, status, expected = 200) {
    if (status === expected) {
        console.log(`  ✅ ${label} (${status})`);
    } else {
        console.log(`  ❌ ${label} (${status}, expected ${expected})`);
    }
}

function hr() {
    console.log('---');
}

async function main() {
    console.log('========== 集成测试（含CSRF） ==========');
    console.log(`时间: ${new Date().toLocaleString()}`);
    console.log();

    const handle = 'test_full_' + Date.now();

    // 0. 获取 CSRF Token
    hr();
    console.log('[0] 获取 CSRF Token');
    await fetchCsrfToken();

    // 1. 注册
    hr();
    console.log('[1] 注册用户');
    let res = await httpRequest('POST', '/api/auth/register', {
        handle, nickname: '完整流程测试', password: 'TestPass123!'
    });
    ok('注册', res.status);
    console.log(`  - 初始积分: ${res.body.credits}`);

    // 2. 登录
    hr();
    console.log('[2] 登录');
    csrfToken = '';
    await fetchCsrfToken();
    res = await httpRequest('POST', '/api/auth/login', { handle, password: 'TestPass123!' });
    ok('登录', res.status);
    console.log(`  - nickname: ${res.body.nickname}`);
    console.log(`  - 积分: ${res.body.credits}`);

    // 3. 用户信息
    hr();
    console.log('[3] 获取用户信息');
    res = await httpRequest('GET', '/api/auth/me');
    ok('GET /me', res.status);
    console.log(`  - nickname: ${res.body.nickname}`);

    // 4. 角色卡列表
    hr();
    console.log('[4] 角色卡列表（应过滤非角色 JSON）');
    res = await httpRequest('GET', '/api/chat/characters');
    ok('角色卡列表', res.status);
    const chars = res.body.characters || [];
    console.log(`  - 共 ${chars.length} 个角色（期望 ≤ 3 👉 过滤后只保留真实角色）`);
    for (const c of chars) {
        console.log(`    · ${c.id} → name: "${c.name}"`);
    }

    // 5. 选择第一个角色并检查详情
    hr();
    if (chars.length > 0) {
        const charId = chars[0].id;
        console.log(`[5] 查看角色详情: ${charId}`);
        res = await httpRequest('GET', `/api/chat/character/${encodeURIComponent(charId)}`);
        ok('角色详情', res.status);
        console.log(`  - name: ${res.body.character?.name}`);
        console.log(`  - description: ${(res.body.character?.description || '').substring(0, 60)}...`);

        // 6. 创建聊天
        hr();
        console.log('[6] 创建聊天');
        res = await httpRequest('POST', `/api/chat/chat/${encodeURIComponent(charId)}/create`);
        ok('创建聊天', res.status);
        const chatId = res.body.chat?.id;
        console.log(`  - chatId: ${chatId}`);
        console.log(`  - 开场白: ${(res.body.chat?.messages?.[0]?.content || '').substring(0, 60)}...`);

        if (chatId) {
            // 7. 发送消息
            hr();
            console.log('[7] 发送消息（非流式）');
            res = await httpRequest('POST', `/api/chat/chat/${encodeURIComponent(charId)}/${encodeURIComponent(chatId)}/send`, {
                content: '你好！请做个自我介绍吧',
                modelId: 'mock-demo',
                genParams: { streaming: false },
            });
            ok('发送消息', res.status);
            console.log(`  - 剩余积分: ${res.body.remainingCredits}`);
            console.log(`  - 消耗积分: ${res.body.cost}`);
            console.log(`  - 回复: ${(res.body.message?.content || '').substring(0, 80)}...`);

            // 8. 消费记录验证
            hr();
            console.log('[8] 消费记录');
            res = await httpRequest('GET', '/api/auth/consumption?page=1&pageSize=10');
            ok('消费记录', res.status);
            console.log(`  - 共 ${res.body.total} 条`);
            if (res.body.list && res.body.list.length > 0) {
                const item = res.body.list[0];
                console.log(`  - 最新: type=${item.type}, amount=${item.amount}, reason=${item.reason}`);
            }
        }
    }

    // 9. 修改昵称
    hr();
    console.log('[9] 修改昵称');
    res = await httpRequest('POST', '/api/auth/profile', { nickname: '新昵称_验证' });
    ok('修改昵称', res.status);
    console.log(`  - 新昵称: ${res.body.profile?.nickname}`);

    // 10. 修改密码 & 验证
    hr();
    console.log('[10] 修改密码');
    res = await httpRequest('POST', '/api/auth/password', {
        oldPassword: 'TestPass123!',
        newPassword: 'NewPass456!'
    });
    ok('修改密码', res.status);

    console.log('[11] 用新密码重新登录');
    cookie = '';
    csrfToken = '';
    await fetchCsrfToken();
    res = await httpRequest('POST', '/api/auth/login', { handle, password: 'NewPass456!' });
    ok('新密码登录', res.status);
    console.log(`  - 登录成功: ${res.body.success}`);

    // 11. 退出登录
    hr();
    console.log('[12] 退出登录');
    res = await httpRequest('POST', '/api/auth/logout');
    ok('退出登录', res.status);

    // 12. 验证未登录不可访问
    hr();
    console.log('[13] 验证退出后不可访问');
    res = await httpRequest('GET', '/api/auth/me');
    ok('未登录不可访问 /me', res.status, 401);

    hr();
    console.log('========== 测试完成 ==========');
}

main().catch(console.error);
