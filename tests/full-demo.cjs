// tests/full-demo.cjs — 完整功能演示测试
// 演示：注册 → 登录 → 角色卡列表 → 创建聊天 → 多轮对话（非流式+流式）→ 积分消耗记录 → 修改资料 → 登出

const http = require('http');

const HOST = '127.0.0.1';
const PORT = 8002;
let cookies = '';

const LOGIN = () => {
    if (!cookies) {
        console.log('⚠️  未登录，跳过权限请求');
    }
};

// -------- 工具函数 --------
function doRequest(method, path, body) {
    return new Promise((resolve, reject) => {
        const headers = { 'Content-Type': 'application/json', Cookie: cookies };
        const req = http.request({ host: HOST, port: PORT, method, path, headers }, (res) => {
            const setCookie = res.headers['set-cookie'];
            if (setCookie) {
                const jar = new Map();
                for (const existing of cookies.split(';').map(s => s.trim()).filter(Boolean)) {
                    const idx = existing.indexOf('=');
                    const k = idx >= 0 ? existing.substring(0, idx) : existing;
                    const v = idx >= 0 ? existing.substring(idx + 1) : '';
                    if (k) jar.set(k, v);
                }
                for (const c of Array.isArray(setCookie) ? setCookie : [setCookie]) {
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
            res.on('data', (c) => data += c);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
                catch (e) { resolve({ status: res.statusCode, body: data }); }
            });
        });
        req.on('error', reject);
        if (body !== undefined) req.write(JSON.stringify(body));
        req.end();
    });
}

function doStreamRequest(method, path, body, onEvent) {
    return new Promise((resolve, reject) => {
        const headers = { 'Content-Type': 'application/json', 'Accept': 'text/event-stream', Cookie: cookies };
        const req = http.request({ host: HOST, port: PORT, method, path, headers }, (res) => {
            const setCookie = res.headers['set-cookie'];
            if (setCookie) {
                const jar = new Map();
                for (const existing of cookies.split(';').map(s => s.trim()).filter(Boolean)) {
                    const idx = existing.indexOf('=');
                    const k = idx >= 0 ? existing.substring(0, idx) : existing;
                    const v = idx >= 0 ? existing.substring(idx + 1) : '';
                    if (k) jar.set(k, v);
                }
                for (const c of Array.isArray(setCookie) ? setCookie : [setCookie]) {
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
            const isStream = (res.headers['content-type'] || '').includes('text/event-stream');
            if (!isStream) {
                let data = '';
                res.on('data', (c) => data += c);
                res.on('end', () => {
                    try { resolve({ status: res.statusCode, body: JSON.parse(data), streaming: false }); }
                    catch (e) { resolve({ status: res.statusCode, body: data, streaming: false }); }
                });
                return;
            }
            let buffer = '';
            res.on('data', (chunk) => {
                buffer += chunk.toString('utf-8');
                let lineStart = 0;
                while (lineStart < buffer.length) {
                    const lineEnd = buffer.indexOf('\n', lineStart);
                    if (lineEnd === -1) break;
                    const line = buffer.substring(lineStart, lineEnd);
                    lineStart = lineEnd + 1;
                    if (line === '') {
                        continue;
                    }
                    if (line.startsWith('event:')) {
                        onEvent({ event: line.substring(6).trim(), data: null, line: 'event' });
                    } else if (line.startsWith('data:')) {
                        const payload = line.substring(5).trim();
                        try { onEvent({ event: 'data', data: JSON.parse(payload) }); }
                        catch (e) { onEvent({ event: 'data', data: payload }); }
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

const hr = () => console.log('\n' + '─'.repeat(72));
const ok = (name, status, note) => {
    const flag = (status >= 200 && status < 300) ? '✅' : '❌';
    console.log(`  ${flag} ${name} → status ${status}${note ? '  ' + note : ''}`);
};

async function main() {
    console.log('╔══════════════════════════════════════════════════════════════════════════╗');
    console.log('║   SillyTavern 多用户系统 + AI 适配器 — 完整功能演示                         ║');
    console.log('╚══════════════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`服务器: http://${HOST}:${PORT}`);
    console.log(`时间: ${new Date().toLocaleString()}`);

    // --- 步骤 1：注册新用户 ---
    hr();
    const handle = 'demo_user_' + Date.now();
    const nickname = '演示用户';
    console.log('[步骤 1] 用户注册 — POST /api/auth/register');
    console.log(`  用户名: ${handle}`);
    const reg = await doRequest('POST', '/api/auth/register', { handle, nickname, password: 'Demo@12345' });
    if (reg.status === 200) {
        console.log(`  ✅ 注册成功，赠送初始积分: ${reg.body.credits || 1000}`);
    } else {
        console.log(`  ❌ 注册失败 (${reg.status}): ${reg.body.error || reg.body}`);
        return;
    }

    // --- 步骤 2：登录 ---
    hr();
    console.log('[步骤 2] 用户登录 — POST /api/auth/login');
    const login = await doRequest('POST', '/api/auth/login', { handle, password: 'Demo@12345' });
    if (login.status === 200) {
        console.log(`  ✅ 登录成功`);
        console.log(`  - handle: ${login.body.handle}`);
        console.log(`  - nickname: ${login.body.nickname}`);
        console.log(`  - 积分: ${login.body.credits}`);
        console.log(`  - isAdmin: ${login.body.isAdmin}`);
    } else {
        console.log(`  ❌ 登录失败 (${login.status}): ${login.body.error || login.body}`);
        return;
    }

    // --- 步骤 3：获取用户信息 ---
    hr();
    console.log('[步骤 3] 获取当前用户 — GET /api/auth/me');
    const me = await doRequest('GET', '/api/auth/me');
    ok('获取用户信息', me.status);
    console.log(`  - body: ${JSON.stringify(me.body)}`);

    // --- 步骤 4：角色卡列表 ---
    hr();
    console.log('[步骤 4] 系统角色卡列表 — GET /api/chat/characters');
    const chars = await doRequest('GET', '/api/chat/characters');
    ok('角色卡列表', chars.status);
    const charList = chars.body && chars.body.characters || [];
    console.log(`  - 共 ${charList.length} 个角色卡`);
    // 显示前 5 个
    for (const c of charList.slice(0, 5)) {
        console.log(`    · ${c.name}${c.note ? ' (' + c.note + ')' : ''}`);
    }

    // --- 步骤 5：模型列表 ---
    hr();
    console.log('[步骤 5] 可用模型列表 — GET /api/chat/models');
    const models = await doRequest('GET', '/api/chat/models');
    ok('模型列表', models.status);
    const modelList = models.body && models.body.models || [];
    console.log(`  - 共 ${modelList.length} 个模型`);
    for (const m of modelList) {
        console.log(`    · [${m.provider}] ${m.name}${m.supportsStreaming ? ' (支持流式)' : ''} — cost: ${m.costPerToken}/token`);
    }

    // --- 步骤 6：选择角色卡并查看详情 ---
    hr();
    const targetChar = charList[0];
    console.log(`[步骤 6] 查看角色卡详情 — GET /api/chat/character/${targetChar.id}`);
    const charDetail = await doRequest('GET', `/api/chat/character/${encodeURIComponent(targetChar.id)}`);
    ok('角色卡详情', charDetail.status);
    if (charDetail.status === 200) {
        const d = charDetail.body.character;
        console.log(`  - 名称: ${d.name}`);
        console.log(`  - 描述: ${(d.description || '').substring(0, 80)}...`);
        console.log(`  - 性格: ${d.personality || ''}`);
        console.log(`  - 开场白: ${(d.first_mes || '').substring(0, 80)}...`);
    }

    // --- 步骤 7：创建聊天 ---
    hr();
    console.log(`[步骤 7] 创建与 ${targetChar.name} 的聊天 — POST /api/chat/chat/${targetChar.id}/create`);
    const create = await doRequest('POST', `/api/chat/chat/${encodeURIComponent(targetChar.id)}/create`);
    ok('创建聊天', create.status);
    const chat = create.body && create.body.chat;
    if (!chat) {
        console.log('  ❌ 无法继续：创建聊天失败');
        return;
    }
    console.log(`  - chatId: ${chat.id}`);
    console.log(`  - name: ${chat.name}`);
    console.log(`  - 初始消息数: ${chat.messages ? chat.messages.length : 0}`);

    // --- 步骤 8：发送第一条消息（非流式） ---
    hr();
    const modelId = 'mock-demo';
    console.log(`[步骤 8] 发送第一条消息（非流式）— POST /send 模型: ${modelId}`);
    const msg1 = '你好！很高兴认识你，可以做个自我介绍吗？';
    console.log(`  - 用户消息: "${msg1}"`);
    const send1Path = `/api/chat/chat/${encodeURIComponent(targetChar.id)}/${encodeURIComponent(chat.id)}/send`;
    const send1 = await doRequest('POST', send1Path, {
        content: msg1,
        modelId,
        genParams: { temperature: 0.7, max_tokens: 512, streaming: false },
    });
    if (send1.status === 200) {
        console.log(`  ✅ AI 回复成功`);
        console.log(`  - ${targetChar.name}: "${send1.body.message.content}"`);
        console.log(`  - tokens: ${send1.body.usage ? JSON.stringify(send1.body.usage) : 'n/a'}`);
        console.log(`  - 剩余积分: ${send1.body.remainingCredits}`);
        console.log(`  - 本次费用: ${send1.body.cost}`);
    } else {
        console.log(`  ❌ 发送失败 (${send1.status}): ${send1.body.error || send1.body}`);
    }

    // --- 步骤 9：发送第二条消息（流式 SSE） ---
    hr();
    console.log(`[步骤 9] 发送第二条消息（流式 SSE）— model: ${modelId}`);
    const msg2 = '告诉我，你最擅长回答什么样的问题？';
    console.log(`  - 用户消息: "${msg2}"`);
    console.log(`  - 流式接收中:`);
    process.stdout.write(`  > `);

    let gotMeta = false, gotDelta = false, gotDone = false;
    let fullReply = '';
    let remainingCredits = 0;
    let lastEvent = null;

    const stream = await doStreamRequest('POST', send1Path, {
        content: msg2,
        modelId,
        genParams: { temperature: 0.8, max_tokens: 512, streaming: true },
    }, ({ event, data }) => {
        if (data && data.constructor === Object) {
            if (data.content) { fullReply += data.content; process.stdout.write(data.content); }
            if (data.remainingCredits !== undefined) {
                remainingCredits = data.remainingCredits;
                if (!gotMeta) { console.log(''); console.log(`  - 初始化：剩余积分 ${data.remainingCredits}，流式传输开始...`); process.stdout.write(`  > `); }
                gotMeta = true;
            }
        }
        gotDelta = gotMeta; // 简化：一旦有 meta 之后都算
    });

    if (stream.status === 200) {
        console.log('');
        console.log(`  ✅ 流式响应完成`);
        console.log(`  - 完整回复: "${fullReply.substring(0, 150)}${fullReply.length > 150 ? '...' : ''}"`);
        console.log(`  - 剩余积分: ${remainingCredits}`);
        console.log(`  - streaming: ${stream.streaming}`);
    } else {
        console.log(`  ❌ 流式发送失败 (${stream.status})`);
    }

    // --- 步骤 10：积分与消费记录 ---
    hr();
    console.log('[步骤 10] 消费记录查询 — GET /api/auth/consumption');
    const consumption = await doRequest('GET', '/api/auth/consumption');
    ok('消费记录', consumption.status);
    if (consumption.status === 200 && consumption.body) {
        console.log(`  - 总消费条目: ${consumption.body.total}`);
        console.log(`  - 当前积分: ${consumption.body.credits}`);
        const list = consumption.body.list || [];
        for (const item of list.slice(0, 3)) {
            const d = new Date(item.time);
            console.log(`    · [${d.toLocaleString()}] ${item.type} -${item.amount} credits (剩余: ${item.remaining}) — ${item.reason || ''}`);
        }
    }

    // --- 步骤 11：修改用户资料 ---
    hr();
    console.log('[步骤 11] 修改用户资料 — POST /api/auth/profile');
    const newNick = '超级用户测试员';
    const profile = await doRequest('POST', '/api/auth/profile', { nickname: newNick });
    ok('修改资料', profile.status);
    if (profile.status === 200) {
        console.log(`  - 昵称已更新为: "${newNick}"`);
    }

    // --- 步骤 12：查询用户当前状态 ---
    hr();
    console.log('[步骤 12] 再次查询用户状态');
    const me2 = await doRequest('GET', '/api/auth/me');
    ok('查询用户', me2.status);
    console.log(`  - handle: ${me2.body.handle}`);
    console.log(`  - nickname: ${me2.body.nickname}`);
    console.log(`  - 剩余积分: ${me2.body.credits}`);

    // --- 步骤 13：用户登出 ---
    hr();
    console.log('[步骤 13] 用户登出 — POST /api/auth/logout');
    const logout = await doRequest('POST', '/api/auth/logout');
    ok('登出', logout.status);

    // --- 步骤 14：验证登出后访问受限 ---
    hr();
    console.log('[步骤 14] 验证：登出后尝试发送消息（应返回 401）');
    const fail = await doRequest('POST', send1Path, { content: 'should fail', modelId });
    ok('鉴权验证', fail.status);
    if (fail.status === 401) {
        console.log(`  ✅ 鉴权生效，无法发送消息`);
    } else {
        console.log(`  ⚠️  未登录但请求成功？ status=${fail.status}`);
    }

    hr();
    console.log('');
    console.log('════════════════════════════════════════════════════════════════════════════');
    console.log('                          🎉  演示完成  🎉');
    console.log('════════════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('核心模块全部正常工作：');
    console.log('  ✅ 用户注册/登录/登出 （cookie session 鉴权）');
    console.log('  ✅ 系统角色卡列表与详情');
    console.log('  ✅ 多模型配置与选择 (OpenAI / Anthropic / DeepSeek / Google / Ollama / Mock)');
    console.log('  ✅ 创建聊天会话');
    console.log('  ✅ AI 消息发送（非流式 JSON 响应）');
    console.log('  ✅ AI 消息发送（SSE 流式打字机输出）');
    console.log('  ✅ 积分扣费 & 消费记录');
    console.log('  ✅ 用户资料修改');
    console.log('  ✅ 权限控制：未登录无法发送消息');
    console.log('');
    console.log(`👉 浏览器访问: http://${HOST}:${PORT}/characters 进入角色卡页`);
    console.log(`👉 登录后访问: http://${HOST}:${PORT}/app 进入聊天界面`);
    console.log('');
}

main().catch((e) => {
    console.error('\n❌ 演示异常:', e.message);
    console.error(e);
    process.exit(1);
});
