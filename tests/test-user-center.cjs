const http = require('http');
const querystring = require('querystring');

const BASE = 'http://127.0.0.1:8002';
let cookie = '';

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
        if (cookie) {
            opts.headers['Cookie'] = cookie;
        }
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
    console.log('========== 用户中心功能测试 ==========');
    console.log(`时间: ${new Date().toLocaleString()}`);
    console.log();

    const handle = 'testuc_' + Date.now();

    // 1. 注册
    hr();
    console.log('[1] 注册用户');
    let res = await httpRequest('POST', '/api/auth/register', {
        handle, nickname: '用户中心测试', password: 'TestPass123!'
    });
    ok('注册', res.status);
    console.log(`  - 初始积分: ${res.body.credits}`);

    // 2. 登录
    hr();
    console.log('[2] 登录');
    res = await httpRequest('POST', '/api/auth/login', { handle, password: 'TestPass123!' });
    ok('登录', res.status);
    console.log(`  - nickname: ${res.body.nickname}`);
    console.log(`  - 积分: ${res.body.credits}`);

    // 3. 获取用户信息 (/api/auth/me)
    hr();
    console.log('[3] 获取用户信息 GET /api/auth/me');
    res = await httpRequest('GET', '/api/auth/me');
    ok('GET /me', res.status);
    console.log(`  - handle: ${res.body.handle}`);
    console.log(`  - nickname: ${res.body.nickname}`);
    console.log(`  - credits: ${res.body.credits}`);

    // 4. 修改昵称
    hr();
    console.log('[4] 修改昵称 POST /api/auth/profile');
    res = await httpRequest('POST', '/api/auth/profile', { nickname: '新昵称_测试' });
    ok('修改昵称', res.status);
    console.log(`  - 响应: ${JSON.stringify(res.body)}`);

    // 5. 验证昵称已更新
    hr();
    console.log('[5] 验证昵称更新');
    res = await httpRequest('GET', '/api/auth/me');
    console.log(`  - 当前昵称: ${res.body.nickname}`);
    ok('昵称验证', res.body.nickname === '新昵称_测试' ? 200 : 500);

    // 6. 修改密码
    hr();
    console.log('[6] 修改密码 POST /api/auth/password');
    res = await httpRequest('POST', '/api/auth/password', {
        oldPassword: 'TestPass123!',
        newPassword: 'NewPass456!'
    });
    ok('修改密码', res.status);
    console.log(`  - 响应: ${JSON.stringify(res.body)}`);

    // 7. 用新密码登录验证
    hr();
    console.log('[7] 用新密码重新登录验证');
    cookie = ''; // 清除cookie
    res = await httpRequest('POST', '/api/auth/login', { handle, password: 'NewPass456!' });
    ok('新密码登录', res.status);
    console.log(`  - 登录成功: ${res.body.success}`);

    // 8. 获取消费记录（应该为空）
    hr();
    console.log('[8] 获取消费记录 GET /api/auth/consumption');
    res = await httpRequest('GET', '/api/auth/consumption?page=1&pageSize=10');
    ok('消费记录', res.status);
    console.log(`  - total: ${res.body.total}`);
    console.log(`  - list: ${JSON.stringify(res.body.list || []).substring(0, 100)}`);

    // 9. 创建聊天并发送消息（产生消费记录）
    hr();
    console.log('[9] 获取角色卡列表');
    res = await httpRequest('GET', '/api/chat/characters');
    ok('角色卡列表', res.status);
    const chars = res.body.characters || [];
    console.log(`  - 共 ${chars.length} 个角色`);

    if (chars.length > 0) {
        const charId = chars[0].id;
        console.log(`  - 选择角色: ${charId}`);

        hr();
        console.log('[10] 创建聊天');
        res = await httpRequest('POST', `/api/chat/chat/${encodeURIComponent(charId)}/create`);
        ok('创建聊天', res.status);
        const chatId = res.body.chat?.id;
        console.log(`  - chatId: ${chatId}`);

        if (chatId) {
            hr();
            console.log('[11] 发送消息');
            res = await httpRequest('POST', `/api/chat/chat/${encodeURIComponent(charId)}/${encodeURIComponent(chatId)}/send`, {
                content: '测试消费记录',
                modelId: 'mock-demo',
                genParams: { streaming: false },
            });
            ok('发送消息', res.status);
            console.log(`  - remainingCredits: ${res.body.remainingCredits}`);
            console.log(`  - cost: ${res.body.cost}`);

            hr();
            console.log('[12] 再次获取消费记录（应有1条）');
            res = await httpRequest('GET', '/api/auth/consumption?page=1&pageSize=10');
            ok('消费记录', res.status);
            console.log(`  - total: ${res.body.total}`);
            if (res.body.list && res.body.list.length > 0) {
                const item = res.body.list[0];
                console.log(`  - 最新记录: type=${item.type}, amount=${item.amount}, reason=${item.reason}`);
            }
        }
    }

    // 10. 获取积分
    hr();
    console.log('[13] 获取积分 GET /api/auth/credits');
    res = await httpRequest('GET', '/api/auth/credits');
    ok('获取积分', res.status);
    console.log(`  - credits: ${res.body.credits}`);

    hr();
    console.log('========== 测试完成 ==========');
}

main().catch(console.error);
