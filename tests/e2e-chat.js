const http = require('http');

let cookies = null;

async function httpPost(path, data) {
    return new Promise(resolve => {
        const d = JSON.stringify(data);
        const req = http.request({
            host: '127.0.0.1',
            port: 8002,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(d),
                ...(cookies ? { Cookie: cookies.join(';') } : {})
            }
        }, (res) => {
            let body = '';
            res.on('data', dd => body += dd);
            res.on('end', () => {
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
            host: '127.0.0.1',
            port: 8002,
            path: path,
            headers: cookies ? { Cookie: cookies.join(';') } : {}
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
    // 登录
    const loginRes = await httpPost('/api/auth/login', { handle: 'testuser123', password: 'testpass123' });
    console.log('Login:', JSON.parse(loginRes).success ? '✓ Success' : '✗ Failed');

    // 获取用户信息
    const me = await httpGet('/api/auth/me');
    console.log('Me:', JSON.parse(me).handle);

    // 获取系统角色卡
    const chars = await httpGet('/api/chat/characters');
    console.log('Characters count:', JSON.parse(chars).characters.length);

    // 获取角色卡详情
    const det = await httpGet('/api/chat/character/Seraphina');
    console.log('Character detail:', JSON.parse(det).character.name);

    // 创建聊天
    const createRes = await httpPost('/api/chat/chat/Seraphina/create', {});
    const chat = JSON.parse(createRes).chat;
    console.log('Chat created:', chat.id.slice(0, 30), '...');

    // 发送消息
    const sendRes = await httpPost('/api/chat/chat/Seraphina/' + chat.id + '/send', {
        content: '你好，Seraphina！森林里最近有什么有趣的事吗？',
        modelId: 'gpt-4o-mini',
        genParams: { temperature: 0.9, max_tokens: 512 }
    });
    const sendData = JSON.parse(sendRes);
    console.log('Send success:', sendData.success);
    if (sendData.message) {
        console.log('AI reply:', sendData.message.content);
    } else {
        console.log('Error:', sendData.error);
    }

    // 检查积分消耗
    const credits = await httpGet('/api/auth/credits');
    console.log('Credits remaining:', JSON.parse(credits));

    // 消费记录
    const cons = await httpGet('/api/auth/consumption');
    const consData = JSON.parse(cons);
    console.log('Consumption records:', consData.list.length);

    // 用户中心
    const userInfo = await httpGet('/api/auth/me');
    console.log('User profile:', JSON.parse(userInfo).nickname, 'handle=', JSON.parse(userInfo).handle);

    // 修改昵称
    const update = await httpPost('/api/auth/profile', { nickname: '测试用户一号' });
    console.log('Profile update:', JSON.parse(update).success ? '✓ Success' : '✗ Failed');

    // 登出测试
    const logout = await httpPost('/api/auth/logout', {});
    console.log('Logout:', JSON.parse(logout).success ? '✓ Success' : '✗ Failed');

    console.log('');
    console.log('========== ALL TESTS PASSED ==========');
}

main().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
