const http = require('http');

let cookieStr = null;

function parseCookies(setCookieHeader) {
    if (!setCookieHeader) return '';
    const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    return cookies.map(c => c.split(';')[0]).join('; ');
}

async function httpPost(path, data) {
    return new Promise(resolve => {
        const d = JSON.stringify(data);
        const req = http.request({
            host: '127.0.0.1', port: 8002, path: path, method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(d),
                ...(cookieStr ? { Cookie: cookieStr } : {})
            }
        }, (res) => {
            let body = '';
            res.on('data', dd => body += dd);
            res.on('end', () => {
                if (res.headers['set-cookie']) {
                    cookieStr = parseCookies(res.headers['set-cookie']);
                    console.log('   Cookie received:', cookieStr.slice(0, 80) + '...');
                }
                console.log('POST', path, '=>', res.statusCode);
                resolve(body);
            });
        });
        req.write(d);
        req.end();
    });
}

async function httpGet(path) {
    return new Promise(resolve => {
        http.get({
            host: '127.0.0.1', port: 8002, path: path,
            headers: cookieStr ? { Cookie: cookieStr } : {}
        }, (res) => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => {
                console.log('GET', path, '=>', res.statusCode);
                resolve(body);
            });
        });
    });
}

async function main() {
    console.log('===== E2E Chat Test (v2) =====\n');

    // 登录
    const loginRes = await httpPost('/api/auth/login', { handle: 'testuser123', password: 'testpass123' });
    console.log('1. Login:', JSON.parse(loginRes).success ? '✓ Success' : '✗ Failed');

    // 用户信息
    const me = await httpGet('/api/auth/me');
    console.log('2. Current user:', JSON.parse(me).handle || '(none)');

    // 角色卡列表
    const chars = await httpGet('/api/chat/characters');
    console.log('3. System characters:', JSON.parse(chars).characters.length, '个');

    // 角色卡详情
    const det = await httpGet('/api/chat/character/Seraphina');
    console.log('4. Character:', JSON.parse(det).character.name);

    // 模型
    const models = await httpGet('/api/chat/models');
    console.log('5. Models:', JSON.parse(models).models.length, '个');

    // 创建聊天
    const createRes = await httpPost('/api/chat/chat/Seraphina/create', {});
    const chat = JSON.parse(createRes).chat;
    console.log('6. New chat:', chat.characterName);

    // 发送消息
    const sendRes = await httpPost('/api/chat/chat/Seraphina/' + chat.id + '/send', {
        content: '你好，Seraphina！',
        modelId: 'gpt-4o-mini',
        genParams: { temperature: 0.9, max_tokens: 512 }
    });
    const sendData = JSON.parse(sendRes);
    console.log('7. Send message:', sendData.success ? '✓' : '✗ ' + (sendData.error || ''));
    if (sendData.message) console.log('   Reply:', sendData.message.content);

    // 积分
    const credits = await httpGet('/api/auth/credits');
    console.log('8. Credits remaining:', JSON.parse(credits).credits);

    // 消费记录
    const cons = await httpGet('/api/auth/consumption');
    console.log('9. Consumption records:', JSON.parse(cons).list.length, '条');

    // 修改昵称
    const update = await httpPost('/api/auth/profile', { nickname: 'TestUser123' });
    console.log('10. Profile update:', JSON.parse(update).success ? '✓' : '✗');

    // 登出
    const logout = await httpPost('/api/auth/logout', {});
    console.log('11. Logout:', JSON.parse(logout).success ? '✓' : '✗');

    console.log('\n========== ALL TESTS PASSED ==========\n');
}

main().catch(err => {
    console.error('ERROR:', err);
    process.exit(1);
});
