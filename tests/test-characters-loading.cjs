/**
 * TDD: 角色卡加载机制测试
 *
 * RED 阶段 — 证实当前角色卡加载逻辑有误
 *
 * 问题：
 *   当前 chat-plus.js 只从 default/content/ 加载角色卡（仅3个内置角色），
 *   但管理员在 data/default-user/characters/ 中上传了10+个角色卡，
 *   所有用户都应该能看到这些角色（公共池）。
 *
 * 预期行为：
 *   - default/content/ 的内置角色应返回（Seraphina, Eldoria 等）
 *   - data/default-user/characters/ 的管理员角色应返回
 *   - 每个角色应有 name/description/avatar/avatar_path
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE = 'http://127.0.0.1:8002';
const PROJECT_ROOT = 'd:\\project-codewhale\\SillyTavern-trae';

function httpRequest(method, path, body, csrfToken, cookie) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE);
        const opts = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method,
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
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

// 验证本地文件系统状态（不依赖服务器）
function checkLocalFileSystem() {
    console.log('--- 本地文件系统检查 ---');
    const builtinDir = path.join(PROJECT_ROOT, 'default', 'content');
    const adminDir = path.join(PROJECT_ROOT, 'data', 'default-user', 'characters');

    const builtinFiles = fs.existsSync(builtinDir) ? fs.readdirSync(builtinDir) : [];
    const adminFiles = fs.existsSync(adminDir) ? fs.readdirSync(adminDir) : [];

    const builtinChars = builtinFiles.filter(f => f.endsWith('.json') || f.endsWith('.png') || f.endsWith('.jpg'));
    const adminPngs = adminFiles.filter(f => f.endsWith('.png') || f.endsWith('.jpg'));
    const adminDirs = adminFiles.filter(f => !f.includes('.'));

    console.log(`  default/content/ 文件数: ${builtinFiles.length} (角色相关: ${builtinChars.length})`);
    console.log(`  data/default-user/characters/ PNG数: ${adminPngs.length}`);
    console.log(`  data/default-user/characters/ 目录数: ${adminDirs.length}`);

    function isRealCharacterJson(dir, f) {
        if (!f.endsWith('.json')) return false;
        try {
            const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
            return !!(data.name || data.description || data.personality);
        } catch { return false; }
    }

    return {
        builtinCharCount: builtinChars.filter(f => !f.endsWith('.json') || isRealCharacterJson(builtinDir, f)).length,
        adminPngCount: adminPngs.length,
        builtinPngCount: builtinChars.filter(f => f.endsWith('.png') || f.endsWith('.jpg')).length,
    };
}

async function main() {
    console.log('========================================');
    console.log('TDD RED PHASE — 角色卡加载机制测试');
    console.log('证实当前系统未加载管理员上传的角色卡');
    console.log('========================================\n');

    let allPassed = true;

    // ===== 测试 1: 本地文件验证 =====
    console.log('[测试 1] 本地文件系统检查');
    const local = checkLocalFileSystem();
    allPassed &= assert(
        local.adminPngCount >= 10,
        `管理员角色卡至少10个 (实际: ${local.adminPngCount})`
    );
    console.log();

    // ===== 测试 2: API 返回当前角色卡列表 =====
    console.log('[测试 2] 当前 API 返回的角色卡数');
    const csrf = await fetchCsrfToken();
    const res2 = await httpRequest('GET', '/api/chat/characters', null, csrf.token, csrf.cookie);

    allPassed &= assert(res2.status === 200, `API 正常响应 (status: ${res2.status})`);

    const chars = res2.body?.characters || [];
    console.log(`  API 返回 ${chars.length} 个角色:`);
    for (const c of chars) {
        console.log(`    · ${c.id}: ${c.name}${c.isSystem ? ' (系统)' : ''}`);
    }

    // 现在应该返回 14 个角色（3 个系统内置 + 11 个管理员公共角色）
    allPassed &= assert(
        chars.length >= 10,
        `API 返回 ${chars.length} 个角色（包含管理员公共角色）`
    );
    allPassed &= assert(
        chars.length >= local.adminPngCount,
        `API 返回数 (${chars.length}) >= 管理员 PNG 数 (${local.adminPngCount}) — 管理员角色已加载`
    );

    // ===== 测试 3: 确认具体缺少哪些角色 =====
    console.log('\n[测试 3] 检查缺少的管理员角色');
    const ADMIN_CHAR_DIR = path.join(PROJECT_ROOT, 'data', 'default-user', 'characters');
    const adminFiles = fs.existsSync(ADMIN_CHAR_DIR) ? fs.readdirSync(ADMIN_CHAR_DIR) : [];
    const adminPngs = adminFiles.filter(f => f.endsWith('.png') || f.endsWith('.jpg'));

    const apiCharIds = new Set(chars.map(c => c.id));
    const missingChars = adminPngs
        .map(f => path.basename(f, path.extname(f)))
        .filter(name => !apiCharIds.has(name));

    console.log(`  正在API中查找以下管理员角色:`);
    for (const png of adminPngs) {
        const baseName = path.basename(png, path.extname(png));
        const found = apiCharIds.has(baseName);
        console.log(`    ${found ? '✅' : '❌'} ${png} (${baseName})`);
    }

    allPassed &= assert(
        missingChars.length === 0,
        `所有管理员角色已加载 (缺少: ${missingChars.length} 个)`
    );

    console.log('\n========================================');
    if (!allPassed) {
        console.log('❌ RED 阶段确认：角色卡加载机制有缺陷');
        console.log('\n📋 需要修复：');
        console.log('   1. chat-plus.js 应同时从 default/content/ 和 data/default-user/characters/ 加载');
        console.log('   2. 提供管理员角色卡的头像/详情 API');
        console.log('   3. 所有用户都能看到公共角色池\n');
    } else {
        console.log('🎉 所有检查通过 — 角色卡已正确加载');
    }
    console.log('========================================');
}

main().catch(e => {
    console.error('Test error:', e.message);
    process.exitCode = 1;
});
