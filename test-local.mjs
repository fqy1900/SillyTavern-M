// 简单测试：直接在 node 中调用 getSystemCharacter
import fs from 'node:fs';
import path from 'node:path';

// 复制 parseTavernCardFromPng 逻辑
function parseTavernCardFromPng(pngPath) {
    try {
        if (!fs.existsSync(pngPath)) return null;
        const buffer = fs.readFileSync(pngPath);
        const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        if (!buffer.subarray(0, 8).equals(pngSignature)) return null;

        let offset = 8;
        while (offset < buffer.length) {
            if (offset + 8 > buffer.length) break;
            const length = buffer.readUInt32BE(offset);
            const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
            const dataStart = offset + 8;
            const dataEnd = dataStart + length;
            if (dataEnd + 4 > buffer.length) break;

            if (type === 'tEXt') {
                const nullIdx = buffer.indexOf(0, dataStart);
                if (nullIdx > 0 && nullIdx < dataEnd) {
                    const keyword = buffer.subarray(dataStart, nullIdx).toString('latin1');
                    const rawValue = buffer.subarray(nullIdx + 1, dataEnd);
                    const rawStr = rawValue.toString('latin1');
                    let textData = null;
                    if (/^[A-Za-z0-9+/=]+$/.test(rawStr.trim())) {
                        try {
                            textData = Buffer.from(rawStr, 'base64').toString('utf-8');
                        } catch {
                            textData = rawValue.toString('utf-8');
                        }
                    } else {
                        textData = rawValue.toString('utf-8');
                    }
                    if (keyword === 'chara' || keyword === 'ccv3') {
                        try {
                            const parsed = JSON.parse(textData);
                            if (parsed && parsed.data) {
                                return parsed.data;
                            }
                            if (parsed && parsed.name) {
                                return parsed;
                            }
                        } catch { /* ignore */ }
                    }
                }
            }
            offset = dataEnd + 4;
        }
        return null;
    } catch (e) { return null; }
}

const SYSTEM_DIR = 'D:\\project-codewhale\\SillyTavern-trae\\default\\content';
const ADMIN_DIR = 'D:\\project-codewhale\\SillyTavern-trae\\data\\default-user\\characters';

function getSystemCharacter(id) {
    const dirs = [{ dir: SYSTEM_DIR, isSystem: true }, { dir: ADMIN_DIR, isSystem: false }];
    let foundDir = null;
    let foundPngPath = null;
    for (const { dir } of dirs) {
        const jsonPath = path.join(dir, `${id}.json`);
        const pngPath = path.join(dir, `${id}.png`);
        if (fs.existsSync(jsonPath) || fs.existsSync(pngPath)) {
            foundDir = dir;
            foundPngPath = pngPath;
            break;
        }
    }
    if (!foundDir) return null;

    const charData = { id };
    const jsonPath = path.join(foundDir, `${id}.json`);
    let loadedFromJson = false;
    try {
        if (fs.existsSync(jsonPath)) {
            const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
            Object.assign(charData, data);
            loadedFromJson = true;
        }
    } catch { /* ignore */ }

    if (!loadedFromJson && foundPngPath && fs.existsSync(foundPngPath)) {
        try {
            const pngData = parseTavernCardFromPng(foundPngPath);
            if (pngData) Object.assign(charData, pngData);
        } catch { /* ignore */ }
    }
    return charData;
}

// 测试
const tests = ['《道渊》v5.1', '催眠都市', 'default_Seraphina', '轮回修仙录', '95后学生时代模拟器', 'JM_帝国'];
for (const id of tests) {
    const c = getSystemCharacter(id);
    if (!c) { console.log(`✗ ${id}: 未找到`); continue; }
    const hasFirstMes = c.first_mes && c.first_mes.length > 0;
    const charName = c.name || id;
    if (hasFirstMes) {
        console.log(`✓ ${id} -> ${charName}: first_mes 存在 (${c.first_mes.length} chars)`);
        // 模拟创建聊天
        const message = { role: 'assistant', name: charName, content: c.first_mes.substring(0, 100) + '...', send_date: Date.now() };
        console.log(`  ↳ 聊天初始消息: ${message.content.substring(0, 60)}...`);
    } else {
        console.log(`✗ ${id} -> ${charName}: 无 first_mes`);
    }
}
