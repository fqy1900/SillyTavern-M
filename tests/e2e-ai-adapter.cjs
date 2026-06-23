// tests/e2e-ai-adapter.cjs - 测试真实 AI 适配器
// 说明：
//  - 需要配置环境变量或在 data/models.json 中配置 apiKey
//  - 本脚本支持测试 OpenAI / Anthropic / DeepSeek / Ollama 等多后端
//  - 使用方式：`set OPENAI_API_KEY=sk-xxx & node tests\e2e-ai-adapter.cjs`

const http = require('http');

const HOST = '127.0.0.1';
const PORT = 8002;
const BASE = `http://${HOST}:${PORT}`;

// 存储 cookie（会话）
let cookies = '';

// ------------- 工具：统一发送 HTTP 请求 -------------
function httpRequest(method, path, body, options = {}) {
    return new Promise((resolve, reject) => {
        const headers = {
            'Content-Type': 'application/json',
            Cookie: cookies,
            ...options.headers,
        };
        const req = http.request({
            host: HOST,
            port: PORT,
            method,
            path,
            headers,
        }, (res) => {
            // 更新 cookie - 保存所有 set-cookie 条目（包括签名）
            const setCookie = res.headers['set-cookie'];
            if (setCookie) {
                const cookiesToAdd = Array.isArray(setCookie) ? setCookie : [setCookie];
                const jar = new Map();
                // 解析已保存的 cookie
                for (const existing of cookies.split(';').map(s => s.trim()).filter(Boolean)) {
                    const idx = existing.indexOf('=');
                    const k = idx >= 0 ? existing.substring(0, idx) : existing;
                    const v = idx >= 0 ? existing.substring(idx + 1) : '';
                    if (k) jar.set(k, v);
                }
                for (const c of cookiesToAdd) {
                    const kv = c.split(';')[0].trim();
                    const idx = kv.indexOf('=');
                    if (idx >= 0) {
                        const k = kv.substring(0, idx);
                        const v = kv.substring(idx + 1);
                        jar.set(k, v);
                    }
                }
                cookies = Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
            }
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const contentType = res.headers['content-type'] || '';
                    if (contentType.includes('json')) {
                        resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers });
                    } else {
                        resolve({ status: res.statusCode, body: data, headers: res.headers });
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        if (body !== undefined) req.write(JSON.stringify(body));
        req.end();
    });
}

// 测试结果报告
const report = [];
function assert(test, name, expectedStatus) {
    const pass = expectedStatus === undefined
        ? test.status >= 200 && test.status < 300
        : test.status === expectedStatus;
    const line = `  ${pass ? '✓' : '✗'} ${name} -> status ${test.status}`;
    report.push(line);
    console.log(line);
    return pass;
}

// SSE 流式读取
function httpRequestStream(method, path, body, onEvent) {
    return new Promise((resolve, reject) => {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
            Cookie: cookies,
        };
        const req = http.request({
            host: HOST,
            port: PORT,
            method,
            path,
            headers,
        }, (res) => {
            const setCookie2 = res.headers['set-cookie'];
            if (setCookie2) {
                const cookiesToAdd2 = Array.isArray(setCookie2) ? setCookie2 : [setCookie2];
                const jar2 = new Map();
                for (const existing of cookies.split(';').map(s => s.trim()).filter(Boolean)) {
                    const idx = existing.indexOf('=');
                    const k = idx >= 0 ? existing.substring(0, idx) : existing;
                    const v = idx >= 0 ? existing.substring(idx + 1) : '';
                    if (k) jar2.set(k, v);
                }
                for (const c of cookiesToAdd2) {
                    const kv = c.split(';')[0].trim();
                    const idx = kv.indexOf('=');
                    if (idx >= 0) {
                        const k = kv.substring(0, idx);
                        const v = kv.substring(idx + 1);
                        jar2.set(k, v);
                    }
                }
                cookies = Array.from(jar2.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
            }

            const isStream = (res.headers['content-type'] || '').includes('text/event-stream');
            if (!isStream) {
                let data = '';
                res.on('data', (c) => data += c);
                res.on('end', () => {
                    try {
                        resolve({ status: res.statusCode, body: JSON.parse(data), streaming: false });
                    } catch (e) {
                        resolve({ status: res.statusCode, body: data, streaming: false });
                    }
                });
                return;
            }

            let buffer = '';
            let currentEvent = 'message';
            let currentData = '';
            res.on('data', (chunk) => {
                buffer += chunk.toString('utf-8');
                let lineStart = 0;
                while (lineStart < buffer.length) {
                    const lineEnd = buffer.indexOf('\n', lineStart);
                    if (lineEnd === -1) break;
                    const line = buffer.substring(lineStart, lineEnd);
                    lineStart = lineEnd + 1;
                    if (line === '') {
                        if (currentData) {
                            try {
                                const parsed = JSON.parse(currentData);
                                onEvent({ event: currentEvent, data: parsed });
                            } catch (e) {
                                onEvent({ event: currentEvent, data: currentData });
                            }
                            currentData = '';
                            currentEvent = 'message';
                        }
                    } else if (line.startsWith('event:')) {
                        currentEvent = line.substring(6).trim();
                    } else if (line.startsWith('data:')) {
                        currentData += line.substring(5).trim();
                    }
                }
                if (lineStart > 0) buffer = buffer.substring(lineStart);
            });
            res.on('end', () => resolve({ status: res.statusCode, streaming: true }));
        });
        req.on('error', reject);
        if (body !== undefined) req.write(JSON.stringify(body));
        req.end();
    });
}

// ------------- 主要测试流程 -------------
async function main() {
    console.log('');
    console.log('========================================');
    console.log('    多后端 AI 适配器综合测试');
    console.log('========================================');
    console.log('');
    console.log('可用 API Key 检测：');
    console.log(`  OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✓ 已配置' : '✗ 未配置'}`);
    console.log(`  ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? '✓ 已配置' : '✗ 未配置'}`);
    console.log(`  DEEPSEEK_API_KEY: ${process.env.DEEPSEEK_API_KEY ? '✓ 已配置' : '✗ 未配置'}`);
    console.log(`  GOOGLE_API_KEY: ${process.env.GOOGLE_API_KEY ? '✓ 已配置' : '✗ 未配置'}`);
    console.log(`  Ollama（本地）: http://127.0.0.1:11434`);
    console.log('');

    // Step 1: 用户注册 + 登录
    console.log('[Step 1] 用户注册 + 登录');
    try {
        const handle = 'testuser_' + Date.now();
        const reg = await httpRequest('POST', '/api/auth/register', {
            handle,
            password: 'Test@12345',
        });
        if (reg.status === 200 || reg.status === 201) {
            console.log('  ✓ 注册成功:', handle);
            console.log('  [register] Set-Cookie headers:', reg.headers && reg.headers['set-cookie']);
            console.log('  [register] cookies jar:', cookies);
            const login2 = await httpRequest('POST', '/api/auth/login', {
                handle,
                password: 'Test@12345',
            });
            console.log('  [login] status:', login2.status);
            console.log('  [login] Set-Cookie headers:', login2.headers && login2.headers['set-cookie']);
            console.log('  [login] cookies jar:', cookies);
            assert(login2, '登录', 200);
        } else {
            console.log('  ✗ 注册失败:', reg.status, reg.body && reg.body.error);
            return;
        }
    } catch (e) {
        console.log('  ✗ 注册/登录错误:', e.message);
        return;
    }

    // Step 2: 获取当前用户信息
    console.log('\n[Step 2] 获取当前用户 /api/auth/me');
    const me = await httpRequest('GET', '/api/auth/me');
    assert(me, '获取用户信息', 200);
    console.log('  -> body:', JSON.stringify(me.body).substring(0, 200));

    // Step 3: 系统角色卡列表
    console.log('\n[Step 3] 系统角色卡 /api/chat/characters');
    const chars = await httpRequest('GET', '/api/chat/characters');
    assert(chars, '获取角色卡列表');
    const charList = chars.body && chars.body.characters ? chars.body.characters : [];
    console.log(`  -> 角色数: ${charList.length}`);
    const charId = charList[0]?.id;
    if (!charId) {
        console.log('  ⚠️ 没有角色卡，跳过发送消息测试');
        return;
    }
    console.log(`  -> 选择角色: ${charId}`);

    // Step 4: 获取模型列表
    console.log('\n[Step 4] 模型列表 /api/chat/models');
    const models = await httpRequest('GET', '/api/chat/models');
    assert(models, '获取模型列表');
    const modelList = models.body && models.body.models ? models.body.models : [];
    console.log(`  -> 模型数: ${modelList.length}`);
    for (const m of modelList) console.log(`     - ${m.id} (provider: ${m.provider || 'unknown'})`);

    // Step 5: 创建新聊天
    console.log(`\n[Step 5] 创建与 ${charId} 的聊天`);
    const create = await httpRequest('POST', `/api/chat/chat/${encodeURIComponent(charId)}/create`);
    assert(create, '创建新聊天');
    const chatId = create.body && create.body.chat ? create.body.chat.id : undefined;
    if (!chatId) {
        console.log('  ⚠️ 创建失败');
        return;
    }
    console.log(`  -> chatId: ${chatId}`);

    // Step 6: 发送消息（先测试非流式，再测试流式）
    // 选择一个有 API Key 可用的模型
    let pickedModel = modelList.find(m => {
        if (m.provider === 'openai' && process.env.OPENAI_API_KEY) return true;
        if (m.provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) return true;
        if (m.provider === 'google' && process.env.GOOGLE_API_KEY) return true;
        if (m.provider === 'ollama') return true; // 本地 Ollama 不需要 key
        return false;
    }) || modelList[0];
    console.log(`\n[Step 6] 发送消息 (non-streaming) 使用模型: ${pickedModel.id}`);

    const userMsg = '你好，请用一句话介绍自己';
    const sendPath = `/api/chat/chat/${encodeURIComponent(charId)}/${encodeURIComponent(chatId)}/send`;
    const sendBody = {
        content: userMsg,
        modelId: pickedModel.id,
        genParams: {
            temperature: 0.7,
            max_tokens: 512,
            top_p: 0.9,
            streaming: false,
        },
    };
    const send = await httpRequest('POST', sendPath, sendBody);

    if (send.status === 200) {
        console.log('  ✓ 发送成功');
        const msg = send.body && send.body.message;
        if (msg) {
            console.log('  -> 用户消息:', userMsg);
            console.log('  -> AI 回复:', (msg.content || '').substring(0, 300));
            console.log('  -> 剩余积分:', send.body.remainingCredits);
            console.log('  -> 模型信息:', send.body.model);
        } else {
            console.log('  -> body:', JSON.stringify(send.body).substring(0, 500));
        }
        report.push('  ✓ 发送消息（非流式） -> status 200');
    } else if (send.status === 402) {
        console.log(`  ⚠️ 积分不足（402）:`, send.body);
        report.push(`  ⚠️ 发送消息（非流式） -> status 402 积分不足`);
    } else if (send.status === 500) {
        console.log(`  ⚠️ AI 生成失败（500）:`, send.body && send.body.error);
        console.log('    （可能是 API key 未配置或网络问题）');
        report.push(`  ⚠️ 发送消息（非流式） -> status 500 AI 错误`);
    } else {
        console.log(`  ✗ 发送失败 (${send.status}):`, send.body);
        report.push(`  ✗ 发送消息（非流式） -> status ${send.status}`);
    }

    // Step 7: 发送消息（SSE 流式）
    console.log(`\n[Step 7] 发送消息 (SSE streaming) 使用同一模型`);
    const streamBody = {
        content: '好的，请再说说你擅长什么？',
        modelId: pickedModel.id,
        genParams: {
            temperature: 0.7,
            max_tokens: 512,
            top_p: 0.9,
            streaming: true,
        },
    };
    let fullReply = '';
    let gotMeta = false;
    let gotDelta = false;
    let gotDone = false;

    const streamResult = await httpRequestStream('POST', sendPath, streamBody, ({ event, data }) => {
        if (event === 'meta') {
            gotMeta = true;
            console.log(`  [meta] model=${data.model?.id}, remainingCredits=${data.remainingCredits}, cost=${data.cost}`);
        } else if (event === 'delta') {
            gotDelta = true;
            fullReply += data.content || '';
            // 只打印前几条，避免刷屏
            if (fullReply.length < 100) process.stdout.write(data.content || '');
        } else if (event === 'done') {
            gotDone = true;
            if (data.content) fullReply = data.content;
            console.log('');
            console.log(`  [done] total tokens=${data.totalTokens || 'n/a'}`);
        } else if (event === 'error') {
            console.log(`  [error] ${data.message || data}`);
        }
    });

    if (streamResult.streaming) {
        console.log(`  ✓ 流式完成，回复长度: ${fullReply.length} 字符`);
        console.log(`  ✓ gotMeta=${gotMeta}, gotDelta=${gotDelta}, gotDone=${gotDone}`);
        report.push('  ✓ 发送消息（SSE 流式） -> streaming=true');
    } else if (streamResult.status === 200) {
        console.log(`  ✓ 非流式回退完成`);
        if (streamResult.body && streamResult.body.message) {
            console.log(`  -> AI 回复:`, (streamResult.body.message.content || '').substring(0, 200));
        }
        report.push('  ✓ 发送消息（SSE 流式回退为 JSON） -> status 200');
    } else {
        console.log(`  ✗ 流式失败 (${streamResult.status})`);
        report.push(`  ✗ 发送消息（SSE 流式） -> status ${streamResult.status}`);
    }

    // Step 8: 检查积分和消费记录
    console.log('\n[Step 8] 积分与消费记录');
    const credits = await httpRequest('GET', '/api/auth/credits');
    assert(credits, '获取积分');
    console.log('  -> body:', credits.body);

    const consumption = await httpRequest('GET', '/api/auth/consumption');
    assert(consumption, '获取消费记录');
    console.log(`  -> body:`, JSON.stringify(consumption.body).substring(0, 300));

    // Step 9: 用户登出
    console.log('\n[Step 9] 用户登出');
    const logout = await httpRequest('POST', '/api/auth/logout');
    assert(logout, '用户登出');

    console.log('\n========================================');
    console.log('    测试报告');
    console.log('========================================');
    console.log(report.join('\n'));
    console.log('');
    console.log(`测试完成: http://127.0.0.1:8002/characters`);
}

main().catch((e) => {
    console.error('测试崩溃:', e);
    process.exit(1);
});
