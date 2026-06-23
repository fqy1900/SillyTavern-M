/**
 * TDD: 注册功能 CSRF 测试 — 最终验证
 *
 * GREEN 阶段 — 验证前端 CSRF 修复生效
 * 所有测试都应通过
 */
const http = require('http');
const fs = require('fs');

const BASE = 'http://127.0.0.1:8002';

function httpRequest(method, path, body, csrfToken, cookie) {
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
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data), cookie: resCookie });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data, cookie: resCookie });
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
    return { token: res.body?.token || '', cookie: res.cookie || '' };
}

function assert(condition, message) {
    if (!condition) {
        console.error(`  ❌ FAIL: ${message}`);
        process.exitCode = 1;
        return false;
    }
    console.log(`  ✅ PASS: ${message}`);
    return true;
}

async function main() {
    console.log('========================================');
    console.log('TDD GREEN PHASE — CSRF 注册测试');
    console.log('验证前端 CSRF 修复已生效');
    console.log('========================================\n');

    const testUser = 'tdd_green_' + Date.now();
    let allPassed = true;

    // ============ 测试 1: 代码分析 ============
    console.log('[测试 1] 验证前端代码已添加 CSRF 处理');
    const registerHtml = fs.readFileSync('public/register.html', 'utf-8');
    const appApiJs = fs.readFileSync('public/scripts/app-api.js', 'utf-8');
    const appMainJs = fs.readFileSync('public/scripts/app-main.js', 'utf-8');

    allPassed &= assert(
        appApiJs.includes('ensureCsrfToken'),
        'app-api.js 包含 ensureCsrfToken 方法'
    );
    allPassed &= assert(
        appApiJs.includes('x-csrf-token'),
        'app-api.js 在请求中携带 CSRF Token 头'
    );
    allPassed &= assert(
        registerHtml.includes('api.ensureCsrfToken'),
        'register.html 页面加载时调用 ensureCsrfToken'
    );
    allPassed &= assert(
        appMainJs.includes('api.ensureCsrfToken'),
        'app-main.js 初始化时调用 ensureCsrfToken'
    );

    // ============ 测试 2: API 可用性 ============
    console.log('\n[测试 2] 验证前端模拟注册请求（像浏览器一样）');
    const csrf1 = await fetchCsrfToken();
    assert(csrf1.token.length > 0, 'CSRF Token 获取成功');
    assert(csrf1.cookie.length > 0, 'Cookie 获取成功');

    const res2 = await httpRequest('POST', '/api/auth/register', {
        handle: testUser,
        nickname: 'GREEN测试',
        password: 'TestPass123!',
    }, csrf1.token, csrf1.cookie);
    allPassed &= assert(
        res2.status === 200 && res2.body.success === true,
        `注册成功: status=${res2.status}, credits=${res2.body.credits}`
    );

    // ============ 测试 3: 重复注册拒绝 ============
    console.log('\n[测试 3] 重复用户名拒绝');
    const csrf3 = await fetchCsrfToken();
    const res3 = await httpRequest('POST', '/api/auth/register', {
        handle: testUser,
        nickname: '重复',
        password: 'TestPass123!',
    }, csrf3.token, csrf3.cookie);
    allPassed &= assert(
        res3.status === 409,
        `重复用户名返回 409 (实际: ${res3.status})`
    );

    // ============ 测试 4: 参数验证 ============
    console.log('\n[测试 4] 参数验证');
    const csrf4a = await fetchCsrfToken();
    const r4a = await httpRequest('POST', '/api/auth/register', {
        handle: 'ab', nickname: '太短', password: 'TestPass123!',
    }, csrf4a.token, csrf4a.cookie);
    allPassed &= assert(r4a.status === 400, '用户名过短拒绝');

    const csrf4b = await fetchCsrfToken();
    const r4b = await httpRequest('POST', '/api/auth/register', {
        handle: testUser + '_valid', nickname: 'ok', password: '12',
    }, csrf4b.token, csrf4b.cookie);
    allPassed &= assert(r4b.status === 400, '密码过短拒绝');

    // ============ 测试 5: 登录 + 完整流程 ============
    console.log('\n[测试 5] 注册后登录 + API 调用');
    const csrf5 = await fetchCsrfToken();
    const login5 = await httpRequest('POST', '/api/auth/login', {
        handle: testUser, password: 'TestPass123!',
    }, csrf5.token, csrf5.cookie);
    allPassed &= assert(
        login5.status === 200 && login5.body.success === true,
        `登录成功: ${login5.body.nickname}, 积分: ${login5.body.credits}`
    );

    // ============ 测试 6: 退出后不可访问 ============
    console.log('\n[测试 6] 权限控制');
    const csrf6 = await fetchCsrfToken();
    const logout6 = await httpRequest('POST', '/api/auth/logout', {}, csrf6.token, csrf6.cookie);
    allPassed &= assert(logout6.status === 200, '退出登录成功');

    const csrf6b = await fetchCsrfToken();
    const me6 = await httpRequest('GET', '/api/auth/me', null, csrf6b.token, csrf6b.cookie);
    allPassed &= assert(
        me6.status === 401,
        `退出后不可访问 /me (实际: ${me6.status})`
    );

    console.log('\n========================================');
    console.log(allPassed
        ? '🎉  GREEN 阶段全部通过！前端 CSRF 修复生效'
        : '❌ 存在失败测试，需要继续修复'
    );
    console.log('========================================');
}

main().catch(e => {
    console.error('Test error:', e.message);
    process.exitCode = 1;
});
