const { execSync } = require('child_process');
const fs = require('fs');

console.log('注册并登录测试...\n');

try {
    // Step 1: 获取 CSRF token 和 session cookie
    console.log('[1] 获取 CSRF Token');
    execSync('curl -s -c cookies.txt http://127.0.0.1:8002/csrf-token -o csrf.json');
    const csrfData = JSON.parse(fs.readFileSync('csrf.json', 'utf-8'));
    const csrf = csrfData.token;
    console.log('  CSRF Token:', csrf.slice(0, 20) + '...');

    // Step 2: 注册新用户
    console.log('\n[2] 注册新用户 testlogin123');
    const registerCmd = `curl -s -b cookies.txt -c cookies.txt -X POST http://127.0.0.1:8002/api/auth/register -H "Content-Type: application/json" -H "x-csrf-token: ${csrf}" -d "{\\"handle\\":\\"testlogin123\\",\\"password\\":\\"test123456\\",\\"nickname\\":\\"测试用户\\"}"`;
    const registerResult = execSync(registerCmd).toString();
    console.log('  响应:', registerResult);

    // Step 3: 使用新注册的用户登录
    console.log('\n[3] 登录新用户');
    const loginCmd = `curl -s -b cookies.txt -c cookies.txt -X POST http://127.0.0.1:8002/api/auth/login -H "Content-Type: application/json" -H "x-csrf-token: ${csrf}" -d "{\\"handle\\":\\"testlogin123\\",\\"password\\":\\"test123456\\"}"`;
    const loginResult = execSync(loginCmd).toString();
    console.log('  响应:', loginResult);

    // Step 4: 检查状态
    console.log('\n[4] 检查登录状态');
    const statusCmd = 'curl -s -b cookies.txt http://127.0.0.1:8002/api/auth/status';
    const statusResult = execSync(statusCmd).toString();
    console.log('  响应:', statusResult);

    const status = JSON.parse(statusResult);
    if (status.success && status.authed) {
        console.log('\n✅ 登录成功！');
    } else {
        console.log('\n❌ 登录失败');
    }

} catch(e) {
    console.error('Error:', e.message);
} finally {
    // 清理
    try { fs.unlinkSync('cookies.txt'); } catch(e) {}
    try { fs.unlinkSync('csrf.json'); } catch(e) {}
}
