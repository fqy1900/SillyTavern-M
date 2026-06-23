/**
 * 测试 chat.html 页面基本访问
 * 使用 Node.js 内置 http 模块，无需额外依赖
 */
const http = require('http');

const errors = [];
const warnings = [];

const options = {
    hostname: 'localhost',
    port: 8000,
    path: '/chat.html',
    method: 'GET'
};

const req = http.request(options, (res) => {
    console.log(`状态码: ${res.statusCode}`);
    console.log(`页面标题: chat.html`);

    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        // 检查页面内容中是否有明显错误
        if (data.includes('TypeError') || data.includes('ReferenceError')) {
            errors.push('页面包含 JavaScript 错误标记');
        }
        if (data.includes('require') && data.includes('module')) {
            errors.push('页面可能存在模块加载问题');
        }

        // 打印页面片段
        console.log(`\n页面内容长度: ${data.length} 字符`);
        console.log(`\n页面片段 (前500字符):`);
        console.log(data.substring(0, 500));

        console.log(`\n=== 测试结果 ===`);
        console.log(`状态码: ${res.statusCode}`);
        console.log(`错误数: ${errors.length}`);
        if (errors.length > 0) {
            console.log('错误:');
            errors.forEach(e => console.log(`  - ${e}`));
        } else {
            console.log('未发现明显错误');
        }
    });
});

req.on('error', (e) => {
    console.error(`请求错误: ${e.message}`);
    errors.push(e.message);
});

req.end();