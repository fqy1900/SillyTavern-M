/**
 * 登录功能测试
 */
const http = require('http');

function httpRequest(method, path, body, csrfToken, cookie) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, 'http://127.0.0.1:8002');
        const opts = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method,
            headers: { 'Content-Type': 'application/json' },
        };
        if (csrfToken) opts.headers['x-csrf-token'] = csrfToken;
        if (cookie) opts.headers['Cookie'] = cookie;
        const req = http.request(opts, (res) => {
            let data = '';
            let resCookie = '';
            if (res.headers['set-cookie']) {
                resCookie = res.headers['set-cookie'].join('; ');
            }
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(data), cookie: resCookie }); }
                catch (e) { resolve({ status: res.statusCode, body: data, cookie: resCookie }); }
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function main() {
    console.log('测试登录功能...\n');

    // 1. 获取 CSRF Token
    console.log('[1] 获取 CSRF Token');
    const csrfRes = await httpRequest('GET', '/csrf-token');
    console.log('  Status:', csrfRes.status);
    console.log('  Cookie:', csrfRes.cookie ? '已获取' : '无');
    const csrfToken = csrfRes.body?.token || '';
    console.log('  Token:', csrfToken.slice(0, 20) + '...');

    if (!csrfToken) {
        console.error('  ❌ 获取 CSRF Token 失败');
        return;
    }
    console.log('  ✅ CSRF Token 获取成功\n');

    // 2. 获取现有用户
    console.log('[2] 获取用户列表');
    const usersRes = await httpRequest('GET', '/api/auth/users', null, null, null);
    console.log('  Status:', usersRes.status);
    if (usersRes.body?.users) {
        console.log('  用户:', usersRes.body.users.map(u => u.handle).join(', '));
    }

    // 3. 测试登录（使用第一个用户）
    if (usersRes.body?.users?.length > 0) {
        const testUser = usersRes.body.users[0];
        console.log(`\n[3] 测试登录用户: ${testUser.handle}`);
        console.log('  (使用已知密码 test123)');

        const loginRes = await httpRequest('POST', '/api/auth/login', {
            handle: testUser.handle,
            password: 'test123'
        }, csrfToken, csrfRes.cookie);

        console.log('  Status:', loginRes.status);
        console.log('  Response:', JSON.stringify(loginRes.body));
        console.log('  Set-Cookie:', loginRes.cookie ? '有' : '无');

        if (loginRes.status === 200 && loginRes.body.success) {
            console.log('\n✅ 登录成功！');
        } else {
            console.log('\n❌ 登录失败:', loginRes.body.error);
        }
    } else {
        console.log('\n⚠️ 没有找到测试用户');
    }
}

main().catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
});
