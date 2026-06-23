const { execSync } = require('child_process');
const fs = require('fs');

console.log('测试登录流程...\n');

try {
    // Step 1: 获取 CSRF token 和 session cookie
    console.log('[1] 获取 CSRF Token');
    execSync('curl -s -c cookies.txt http://127.0.0.1:8002/csrf-token -o csrf.json');
    const csrfData = JSON.parse(fs.readFileSync('csrf.json', 'utf-8'));
    const csrf = csrfData.token;
    console.log('  CSRF Token:', csrf.slice(0, 20) + '...');
    console.log('  Cookie: 已保存\n');

    // Step 2: 尝试登录（使用 testuser123 用户，但密码未知）
    console.log('[2] 尝试登录 testuser123');
    const loginCmd = `curl -s -b cookies.txt -c cookies.txt -X POST http://127.0.0.1:8002/api/auth/login -H "Content-Type: application/json" -H "x-csrf-token: ${csrf}" -d "{\\"handle\\":\\"testuser123\\",\\"password\\":\\"test123\\"}"`;
    const loginResult = execSync(loginCmd).toString();
    console.log('  响应:', loginResult);

    // Step 3: 检查状态
    console.log('\n[3] 检查登录状态');
    const statusCmd = 'curl -s -b cookies.txt http://127.0.0.1:8002/api/auth/status';
    const statusResult = execSync(statusCmd).toString();
    console.log('  响应:', statusResult);

} catch(e) {
    console.error('Error:', e.message);
} finally {
    // 清理
    try { fs.unlinkSync('cookies.txt'); } catch(e) {}
    try { fs.unlinkSync('csrf.json'); } catch(e) {}
}
