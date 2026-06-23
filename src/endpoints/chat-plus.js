// 多用户角色对话后端模块
// 注册到 /api/chat/*
// 核心功能：系统角色卡列表、用户聊天会话、积分扣费、AI生成

import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import yaml from 'yaml';
import sanitize from 'sanitize-filename';
import { sync as writeFileAtomicSync } from 'write-file-atomic';

import { serverDirectory } from '../server-directory.js';
import { getConfigValue, tryParse, humanizedDateTime, generateTimestamp, getSeparator, color } from '../util.js';
import {
    getCurrentHandle,
    deductCredits,
    getUserCredits,
} from './auth-plus.js';
import { getUserDirectories } from '../users.js';
import { generate as aiGenerate, listModels as aiListModels, getModelConfig as aiGetModel, estimateTokenCount as aiEstimateTokens } from './ai-adapter.js';

// ---------- 路由 ----------
export const router = express.Router();

// ---------- 常量 ----------
// 系统预设角色卡目录（只读，管理员上传后放在此处）
const SYSTEM_CHAR_DIR = path.join(serverDirectory, 'default', 'content');
// 管理员公共角色卡目录（管理员上传的公共角色池）
const ADMIN_CHAR_DIR = path.join(serverDirectory, 'data', 'default-user', 'characters');
// 系统预设脚本（角色卡附带的 .js）
const SYSTEM_SCRIPTS_DIR = path.join(serverDirectory, 'default', 'scripts');

// ---------- 工具函数 ----------

/**
 * 从 SillyTavern PNG 角色卡中提取嵌入的元数据 JSON
 * 元数据存储在 PNG 的 tEXt chunk 中，关键字为 chara / chara_card_v3
 * @param {string} pngPath PNG 文件路径
 * @returns {Object|null} 解析后的角色卡数据对象，或 null
 */
function parseTavernCardFromPng(pngPath) {
    try {
        if (!fs.existsSync(pngPath)) return null;
        const buffer = fs.readFileSync(pngPath);
        // PNG 签名 (8 字节)
        const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        if (!buffer.subarray(0, 8).equals(pngSignature)) return null;

        // 遍历 chunk
        let offset = 8;
        while (offset < buffer.length) {
            if (offset + 8 > buffer.length) break;
            const length = buffer.readUInt32BE(offset);
            const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
            const dataStart = offset + 8;
            const dataEnd = dataStart + length;
            if (dataEnd + 4 > buffer.length) break;

            // tEXt / iTXt / zTXt 都是文本块类型
            if (type === 'tEXt' || type === 'zTXt' || type === 'iTXt') {
                const chunkData = buffer.subarray(dataStart, dataEnd);
                let textData = null;
                let keyword = null;

                if (type === 'tEXt') {
                    // tEXt: keyword(null-terminated) + text
                    const nullIdx = chunkData.indexOf(0);
                    if (nullIdx > 0) {
                        keyword = chunkData.subarray(0, nullIdx).toString('latin1');
                        const rawValue = chunkData.subarray(nullIdx + 1);
                        // SillyTavern 角色卡数据通常是 Base64 编码的
                        const rawStr = rawValue.toString('latin1');
                        if (/^[A-Za-z0-9+/=]+$/.test(rawStr.trim())) {
                            try {
                                textData = Buffer.from(rawStr, 'base64').toString('utf-8');
                            } catch {
                                textData = rawValue.toString('utf-8');
                            }
                        } else {
                            textData = rawValue.toString('utf-8');
                        }
                    }
                } else if (type === 'iTXt') {
                    // iTXt: keyword(null) + compression_flag(1) + compression_method(1) + language_tag(null) + translated_keyword(null) + text
                    const nullIdx1 = chunkData.indexOf(0);
                    if (nullIdx1 > 0) {
                        keyword = chunkData.subarray(0, nullIdx1).toString('latin1');
                        if (chunkData[nullIdx1 + 1] === 0) {
                            // 未压缩
                            const nullIdx2 = chunkData.indexOf(0, nullIdx1 + 3);
                            if (nullIdx2 > 0) {
                                const nullIdx3 = chunkData.indexOf(0, nullIdx2 + 1);
                                if (nullIdx3 > 0) {
                                    textData = chunkData.subarray(nullIdx3 + 1).toString('utf-8');
                                }
                            }
                        }
                    }
                } else if (type === 'zTXt') {
                    // zTXt: keyword(null) + compression_method(1) + compressed_text
                    const nullIdx = chunkData.indexOf(0);
                    if (nullIdx > 0) {
                        keyword = chunkData.subarray(0, nullIdx).toString('latin1');
                        try {
                            textData = zlib.inflateSync(chunkData.subarray(nullIdx + 2)).toString('utf-8');
                        } catch {
                            // 压缩数据解析失败，跳过
                        }
                    }
                }

                if (textData && (keyword === 'chara' || keyword === 'chara_card_v2' || keyword === 'chara_card_v3' || keyword === 'ccv3')) {
                    try {
                        const parsed = JSON.parse(textData);
                        // V2 格式: { spec, spec_version, data: {...} }
                        if (parsed && parsed.data) {
                            return {
                                ...parsed.data,
                                _tavernSpec: parsed.spec,
                                _tavernVersion: parsed.spec_version,
                            };
                        }
                        // V1 格式或扁平结构
                        if (parsed && parsed.name) {
                            return parsed;
                        }
                    } catch {
                        // JSON 解析失败
                    }
                }
            }

            // 移动到下一个 chunk
            offset = dataEnd + 4; // +4 for CRC
        }
        return null;
    } catch (e) {
        console.warn(`[chat-plus] Failed to parse PNG metadata for ${pngPath}:`, e.message);
        return null;
    }
}

function jsonResponse(res, status, data) {
    res.status(status).json(data);
}
function sendSuccess(res, data) {
    jsonResponse(res, 200, { success: true, ...data });
}
function sendError(res, status, message) {
    jsonResponse(res, status, { success: false, error: message });
}

/**
 * 从指定目录加载角色卡列表
 * @param {string} charDir - 角色卡目录
 * @param {boolean} isSystem - 是否为系统内置角色
 */
async function loadCharacterList(charDir, isSystem) {
    const chars = [];
    try {
        if (!fs.existsSync(charDir)) return chars;
        const files = fs.readdirSync(charDir);

        const charFiles = [];
        for (const file of files) {
            if (!file.endsWith('.png') && !file.endsWith('.jpg') && !file.endsWith('.json')) continue;
            const base = file.replace(/\.(png|jpg|json)$/, '');
            charFiles.push({ file, base, isJson: file.endsWith('.json') });
        }

        const jsonBases = new Set(charFiles.filter(f => f.isJson).map(f => f.base));
        const idToFiles = new Map();
        for (const f of charFiles) {
            let resolveId = f.base;
            if (!f.isJson) {
                const match = findJsonForImage(f.base, charDir);
                if (match) resolveId = match;
            }
            if (!idToFiles.has(resolveId)) {
                idToFiles.set(resolveId, { jsonId: f.isJson ? f.base : (findJsonForImage(f.base, charDir) || f.base), imageId: f.base, priority: f.isJson ? 0 : 1 });
            } else if (f.isJson) {
                idToFiles.set(resolveId, { jsonId: f.base, imageId: idToFiles.get(resolveId).imageId, priority: 0 });
            }
        }

        for (const [id, info] of idToFiles) {
            const charInfo = await loadCharacterMeta(id, charDir, isSystem);
            if (charInfo) {
                chars.push(charInfo);
            }
        }
    } catch (e) {
        console.error(`[chat-plus] Failed to read characters from ${charDir}:`, e);
    }
    return chars;
}

function findJsonForImage(base, charDir) {
    const candidates = [
        base.replace(/^default_/, ''),
        base.replace(/^default-/, ''),
    ];
    for (const candidate of candidates) {
        if (candidate !== base && fs.existsSync(path.join(charDir, `${candidate}.json`))) {
            return candidate;
        }
    }
    return null;
}

/**
 * 获取系统角色卡列表（带缩略信息）
 * 包含：系统内置角色 + 管理员公共角色池
 */
async function getSystemCharacterList() {
    // 加载系统内置角色（default/content/）
    const systemChars = await loadCharacterList(SYSTEM_CHAR_DIR, true);
    // 加载管理员公共角色池（data/default-user/characters/）
    const adminChars = await loadCharacterList(ADMIN_CHAR_DIR, false);
    return [...systemChars, ...adminChars];
}

/**
 * 加载角色卡元数据（从指定目录）
 * @param {string} id - 角色ID
 * @param {string} charDir - 角色卡目录
 * @param {boolean} isSystem - 是否为系统内置角色
 */
async function loadCharacterMeta(id, charDir, isSystem) {
    const pngPath = path.join(charDir, `${id}.png`);
    const jpgPath = path.join(charDir, `${id}.jpg`);
    const jsonPath = path.join(charDir, `${id}.json`);
    try {
        // 优先找 JSON
        if (fs.existsSync(jsonPath)) {
            const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
            // 非角色卡 JSON 文件（无 name 等角色字段）跳过
            if (!data.name && !data.description && !data.personality) {
                return null;
            }
            return {
                id,
                name: data.name || id,
                description: data.description || '',
                avatar: `/api/chat/character-avatar/${id}`,
                worldbooks: (data.worldbooks || []).map(w => ({ id: w.name, name: w.name })),
                tags: data.tags || [],
                isSystem,
            };
        }
        // PNG 角色卡（尝试从元数据中读取，支持 SillyTavern V2/V3 格式）
        if (fs.existsSync(pngPath)) {
            const pngData = parseTavernCardFromPng(pngPath);
            if (pngData) {
                return {
                    id,
                    name: pngData.name || id,
                    description: pngData.description || '',
                    avatar: `/api/chat/character-avatar/${id}`,
                    worldbooks: [],
                    tags: Array.isArray(pngData.tags) ? pngData.tags : [],
                    isSystem,
                };
            }
            return {
                id,
                name: id,
                description: '',
                avatar: `/api/chat/character-avatar/${id}`,
                worldbooks: [],
                tags: [],
                isSystem,
            };
        }
        // JPG 角色卡（无元数据）
        if (fs.existsSync(jpgPath)) {
            return {
                id,
                name: id,
                description: '',
                avatar: `/api/chat/character-avatar/${id}`,
                worldbooks: [],
                tags: [],
                isSystem,
            };
        }
    } catch (e) {
        console.warn(`[chat-plus] Failed to load char meta for ${id}:`, e.message);
    }
    return null;
}

/**
 * 兼容旧接口：加载系统角色卡元数据
 */
async function loadSystemCharacterMeta(id) {
    return loadCharacterMeta(id, SYSTEM_CHAR_DIR, true);
}

/**
 * 获取系统角色卡完整数据（自动查找所在目录）
 */
async function getSystemCharacter(id) {
    const dirs = [
        { dir: SYSTEM_CHAR_DIR, isSystem: true },
        { dir: ADMIN_CHAR_DIR, isSystem: false },
    ];

    let foundDir = null;
    let isSystem = true;
    let jsonId = id;
    let hasImage = false;
    let foundPngPath = null;
    for (const { dir, isSystem: sys } of dirs) {
        const jsonPath = path.join(dir, `${id}.json`);
        const pngPath = path.join(dir, `${id}.png`);
        if (fs.existsSync(jsonPath) || fs.existsSync(pngPath)) {
            foundDir = dir;
            isSystem = sys;
            hasImage = fs.existsSync(pngPath) || fs.existsSync(path.join(dir, `${id}.jpg`));
            foundPngPath = pngPath;
            if (!fs.existsSync(jsonPath)) {
                const alt = findJsonForImage(id, dir);
                if (alt) jsonId = alt;
            }
            break;
        }
    }

    if (!foundDir) return null;

    const charInfo = await loadCharacterMeta(jsonId, foundDir, isSystem);
    if (!charInfo) return null;

    const jsonPath = path.join(foundDir, `${jsonId}.json`);
    const charData = { id, isSystem };

    // 优先从 JSON 读取，其次从 PNG 元数据读取
    let loadedFromJson = false;
    try {
        if (fs.existsSync(jsonPath)) {
            const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
            Object.assign(charData, data);
            loadedFromJson = true;
        }
    } catch (e) {
        console.warn(`[chat-plus] Failed to load char JSON for ${id}:`, e.message);
    }

    // 如果没有从 JSON 读取，尝试从 PNG 元数据读取
    if (!loadedFromJson && foundPngPath && fs.existsSync(foundPngPath)) {
        try {
            const pngData = parseTavernCardFromPng(foundPngPath);
            if (pngData) {
                Object.assign(charData, pngData);
            }
        } catch (e) {
            console.warn(`[chat-plus] Failed to load char PNG metadata for ${id}:`, e.message);
        }
    }

    if (!charData.name) charData.name = charInfo?.name || id;
    if (!charData.description) charData.description = charInfo?.description || '';
    if (!charData.avatar) {
        charData.avatar = hasImage
            ? `/api/chat/character-avatar/${id}`
            : charInfo?.avatar || '/api/chat/character-avatar/' + id;
    }

    // 加载世界书详情
    if (charData.worldbooks && Array.isArray(charData.worldbooks)) {
        charData.worldbooks = charData.worldbooks.map(w => {
            const wi = loadSystemWorldbook(w.name || w);
            return wi || w;
        }).filter(Boolean);
    }

    // 加载关联脚本列表（仅系统目录有脚本）
    const scriptPath = path.join(SYSTEM_SCRIPTS_DIR, `${id}.js`);
    charData.hasScript = fs.existsSync(scriptPath);
    if (charData.hasScript) {
        charData.scriptUrl = `/api/chat/character-script/${id}`;
    }

    return charData;
}

/**
 * 加载系统世界书
 */
function loadSystemWorldbook(name) {
    const wiDir = path.join(serverDirectory, 'default', 'content', 'worlds');
    const wiFiles = [
        path.join(wiDir, `${name}.json`),
        path.join(wiDir, `${name}.yaml`),
    ];
    for (const f of wiFiles) {
        if (fs.existsSync(f)) {
            try {
                const content = fs.readFileSync(f, 'utf-8');
                const data = f.endsWith('.yaml') ? yaml.parse(content) : JSON.parse(content);
                return { name, entries: data.entries || data };
            } catch (e) {
                console.warn(`[chat-plus] Failed to load worldbook ${name}:`, e.message);
            }
        }
    }
    return null;
}

/**
 * 获取用户的聊天目录（不存在则创建）
 */
function getUserChatDir(handle, charId) {
    const dirs = getUserDirectories(handle);
    const charChatDir = path.join(dirs.chats, sanitize(charId));
    if (!fs.existsSync(charChatDir)) {
        fs.mkdirSync(charChatDir, { recursive: true });
    }
    return charChatDir;
}

/**
 * 列出用户与某角色的所有聊天会话
 */
function listUserChats(handle, charId) {
    const charChatDir = getUserChatDir(handle, charId);
    const chats = [];
    try {
        const files = fs.readdirSync(charChatDir);
        for (const file of files) {
            if (!file.endsWith('.json')) continue;
            try {
                const data = JSON.parse(fs.readFileSync(path.join(charChatDir, file), 'utf-8'));
                chats.push({
                    id: file.replace('.json', ''),
                    name: data.name || file,
                    updatedAt: data.updatedAt || data.last_modified || 0,
                    messageCount: Array.isArray(data.messages) ? data.messages.length : 0,
                });
            } catch (e) {
                // 跳过损坏的文件
            }
        }
    } catch (e) {
        // 目录不存在则返回空
    }
    return chats.sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * 保存聊天数据
 */
function saveChat(handle, charId, chatId, data) {
    const charChatDir = getUserChatDir(handle, charId);
    const filePath = path.join(charChatDir, `${chatId}.json`);
    writeFileAtomicSync(filePath, JSON.stringify(data, null, 2));
}

/**
 * 加载聊天数据（支持 .json 和 .jsonl 格式）
 */
function loadChat(handle, charId, chatId) {
    const charChatDir = getUserChatDir(handle, charId);

    // 尝试读取 .json 文件
    const jsonPath = path.join(charChatDir, `${chatId}.json`);
    if (fs.existsSync(jsonPath)) {
        return JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    }

    // 尝试读取 .jsonl 文件（SillyTavern 原生格式）
    const jsonlPath = path.join(charChatDir, `${chatId}.jsonl`);
    if (!fs.existsSync(jsonlPath)) return null;

    const content = fs.readFileSync(jsonlPath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim() !== '');

    if (lines.length === 0) return null;

    // 第一行是 metadata
    const metadataLine = JSON.parse(lines[0]);
    const chat = {
        id: chatId,
        name: metadataLine.chat_metadata?.name || chatId,
        metadata: metadataLine.chat_metadata || {},
        messages: [],
        createdAt: metadataLine.chat_metadata?.createdAt || Date.now(),
        updatedAt: Date.now(),
    };

    // 后续行是消息
    for (let i = 1; i < lines.length; i++) {
        try {
            const msg = JSON.parse(lines[i]);
            // 保留完整的消息结构（包括 swipes）
            chat.messages.push({
                role: msg.is_user ? 'user' : 'assistant',
                name: msg.name,
                content: msg.mes || msg.content || '',
                send_date: msg.send_date || Date.now(),
                // SillyTavern 特有属性：swipes
                swipes: msg.swipes || [],
                swipe_id: msg.swipe_id || 0,
                extra: msg.extra || {},
            });
        } catch (e) {
            // 跳过损坏的行
        }
    }

    return chat;
}

/**
 * 带开场白补全的异步聊天加载
 * 用于 GET /chat/:charId/:chatId 路由
 */
async function loadChatWithOpening(handle, charId, chatId) {
    const chat = loadChat(handle, charId, chatId);
    if (!chat) return null;

    // 如果聊天没有消息，尝试从角色卡补全开场白
    if ((!chat.messages || chat.messages.length === 0)) {
        try {
            const char = await getSystemCharacter(charId);
            if (char && char.first_mes) {
                chat.messages = [{
                    role: 'assistant',
                    name: char.name,
                    content: char.first_mes,
                    send_date: chat.createdAt || Date.now(),
                }];
                // 保存回文件
                saveChat(handle, charId, chatId, chat);
            }
        } catch { /* ignore */ }
    }
    return chat;
}

// ---------- 公开路由：系统角色卡列表 ----------
router.get('/characters', async function (req, res) {
    try {
        const chars = await getSystemCharacterList();
        return sendSuccess(res, { characters: chars });
    } catch (e) {
        console.error('[chat-plus] /characters error:', e);
        return sendError(res, 500, '服务器错误');
    }
});

// ---------- 公开路由：单个角色卡详情 ----------
router.get('/character/:id', async function (req, res) {
    try {
        const char = await getSystemCharacter(req.params.id);
        if (!char) return sendError(res, 404, '角色卡不存在');
        return sendSuccess(res, { character: char });
    } catch (e) {
        console.error('[chat-plus] /character/:id error:', e);
        return sendError(res, 500, '服务器错误');
    }
});

// ---------- 公开路由：角色卡头像（支持 PNG 角色卡，从系统和管理员目录加载） ----------
router.get('/character-avatar/:id', async function (req, res) {
    const id = req.params.id;
    const dirs = [SYSTEM_CHAR_DIR, ADMIN_CHAR_DIR];

    for (const dir of dirs) {
        const candidates = [
            path.join(dir, `${id}.png`),
            path.join(dir, `${id}.jpg`),
            path.join(dir, `default_${id}.png`),
            path.join(dir, `default_${id}.jpg`),
        ];
        const noPrefix = id.replace(/^default_/, '');
        if (noPrefix !== id) {
            candidates.push(path.join(dir, `${noPrefix}.png`));
            candidates.push(path.join(dir, `${noPrefix}.jpg`));
        }
        for (const p of candidates) {
            if (fs.existsSync(p)) {
                res.setHeader('Content-Type', p.endsWith('.png') ? 'image/png' : 'image/jpeg');
                return res.send(fs.readFileSync(p));
            }
        }
    }
    return sendError(res, 404, '头像不存在');
});

// ---------- 公开路由：角色卡关联脚本 ----------
router.get('/character-script/:id', async function (req, res) {
    const id = req.params.id;
    const scriptPath = path.join(SYSTEM_SCRIPTS_DIR, `${id}.js`);
    if (!fs.existsSync(scriptPath)) return sendError(res, 404, '脚本不存在');
    res.setHeader('Content-Type', 'application/javascript');
    return res.send(fs.readFileSync(scriptPath, 'utf-8'));
});

// ---------- 公开路由：系统模型列表（从 ai-adapter 读取） ----------
router.get('/models', function (req, res) {
    return sendSuccess(res, { models: aiListModels() });
});

// ---------- 需要登录：获取与某角色的聊天会话列表 ----------
router.get('/chats/:charId', function (req, res) {
    const handle = getCurrentHandle(req);
    if (!handle) return sendError(res, 401, '未登录');
    const chats = listUserChats(handle, req.params.charId);
    return sendSuccess(res, { chats });
});

// ---------- 需要登录：加载聊天（自动补全开场白） ----------
router.get('/chat/:charId/:chatId', async function (req, res) {
    const handle = getCurrentHandle(req);
    if (!handle) return sendError(res, 401, '未登录');
    const chat = await loadChatWithOpening(handle, req.params.charId, req.params.chatId);
    if (!chat) return sendError(res, 404, '聊天不存在');
    return sendSuccess(res, { chat });
});

// ---------- 需要登录：创建新聊天 ----------
router.post('/chat/:charId/create', async function (req, res) {
    const handle = getCurrentHandle(req);
    if (!handle) return sendError(res, 401, '未登录');

    const charId = req.params.charId;
    const char = await getSystemCharacter(charId);
    if (!char) return sendError(res, 404, '角色卡不存在');

    const chatId = sanitize(`${humanizedDateTime(new Date())}_${Date.now()}`);
    const now = Date.now();
    const initialMessage = char.first_mes
        ? { role: 'assistant', name: char.name, content: char.first_mes, send_date: now }
        : null;

    const chatData = {
        id: chatId,
        name: char.name + ' - ' + humanizedDateTime(new Date()),
        characterId: charId,
        characterName: char.name,
        createdAt: now,
        updatedAt: now,
        messages: initialMessage ? [initialMessage] : [],
        settings: {
            background: '',
            modelId: aiListModels()[0]?.id || '',
        },
    };

    saveChat(handle, charId, chatId, chatData);
    return sendSuccess(res, { chat: chatData });
});

// ---------- 需要登录：发送消息（核心聊天逻辑） ----------
router.post('/chat/:charId/:chatId/send', async function (req, res) {
    const handle = getCurrentHandle(req);
    if (!handle) return sendError(res, 401, '未登录');

    const { charId, chatId } = req.params;
    const { content, modelId, genParams } = req.body || {};

    if (!content || !content.trim()) return sendError(res, 400, '消息不能为空');

    const char = await getSystemCharacter(charId);
    if (!char) return sendError(res, 404, '角色卡不存在');

    let chat = loadChat(handle, charId, chatId);
    if (!chat) return sendError(res, 404, '聊天不存在');

    // 确定使用的模型
    const models = aiListModels();
    const model = models.find(m => m.id === modelId) || models[0];
    if (!model) return sendError(res, 400, '无效的模型');

    // 先估算 token 数并扣费
    const systemPrompt = buildSystemPrompt(char, chat);
    const messages = buildMessages(chat, content, char);
    const estimatedPromptTokens = aiEstimateTokens(systemPrompt + ' ' + messages.map(m => m.content).join(' '));
    const estimatedCost = model.costPerToken * estimatedPromptTokens;
    const deductResult = await deductCredits(handle, estimatedCost, `与 ${char.name} 对话`);
    if (!deductResult.ok) {
        return sendError(res, 402, deductResult.reason);
    }

    // 添加用户消息
    const userMsg = {
        role: 'user',
        name: 'You',
        content,
        send_date: Date.now(),
    };
    chat.messages.push(userMsg);

    // 调用 AI 生成
    try {
        const isStreaming = genParams?.streaming !== false;
        const genResult = await aiGenerate(model, systemPrompt, messages, genParams);

        let fullContent = '';
        let finalUsage = null;

        if (genResult.stream) {
            // 流式：返回 SSE 流
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'keep-alive',
            });

            // 先发送模型/费用等元信息
            res.write(`event: meta\n`);
            res.write(`data: ${JSON.stringify({
                model: { id: model.id, name: model.name },
                remainingCredits: deductResult.remaining,
                cost: estimatedCost,
                streaming: true,
            })}\n\n`);

            // 发送正文增量
            for await (const delta of genResult.stream) {
                fullContent += delta;
                res.write(`event: delta\n`);
                res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
            }

            finalUsage = genResult.getFinalStats?.();
            res.write(`event: done\n`);
            res.write(`data: ${JSON.stringify({
                content: fullContent,
                totalTokens: finalUsage?.totalTokens || estimatedPromptTokens,
                promptTokens: finalUsage?.promptTokens || estimatedPromptTokens,
                completionTokens: finalUsage?.completionTokens || aiEstimateTokens(fullContent),
            })}\n\n`);
            res.end();
        } else {
            // 非流式：返回完整 JSON
            fullContent = genResult.content;
            finalUsage = {
                totalTokens: genResult.totalTokens || estimatedPromptTokens,
                promptTokens: genResult.promptTokens || estimatedPromptTokens,
                completionTokens: genResult.completionTokens || aiEstimateTokens(fullContent),
            };
        }

        const assistantMsg = {
            role: 'assistant',
            name: char.name,
            content: fullContent,
            send_date: Date.now(),
        };
        chat.messages.push(assistantMsg);
        chat.updatedAt = Date.now();
        saveChat(handle, charId, chatId, chat);

        // 如果是流式，已经通过 SSE 发送完；否则返回 JSON
        if (!genResult.stream) {
            return sendSuccess(res, {
                message: assistantMsg,
                remainingCredits: deductResult.remaining,
                model: { id: model.id, name: model.name },
                cost: Math.round(estimatedCost * 10000) / 10000,
                usage: finalUsage,
            });
        }

        // 流式已结束，返回即可
        return;
    } catch (e) {
        // AI 生成失败，回退积分
        const { setUserCredits, getUserCredits } = await import('./auth-plus.js');
        const current = await getUserCredits(handle);
        await setUserCredits(handle, current + estimatedCost);
        console.error(color.red('[chat-plus] AI generation error: ' + (e.message || e)));
        // 只有非流式的时候 JSON 响应
        if (!res.headersSent) {
            return sendError(res, 500, 'AI 生成失败：' + e.message);
        } else {
            // 如果已经开始 SSE 发送，用 error 事件通知
            try {
                res.write(`event: error\n`);
                res.write(`data: ${JSON.stringify({ message: e.message })}\n\n`);
                res.end();
            } catch (err) {}
        }
    }
});

// ---------- 需要登录：编辑消息 ----------
router.post('/chat/:charId/:chatId/edit-message', function (req, res) {
    const handle = getCurrentHandle(req);
    if (!handle) return sendError(res, 401, '未登录');

    const { charId, chatId } = req.params;
    const { messageIndex, newContent } = req.body || {};

    const chat = loadChat(handle, charId, chatId);
    if (!chat) return sendError(res, 404, '聊天不存在');
    if (typeof messageIndex !== 'number' || !chat.messages[messageIndex]) {
        return sendError(res, 400, '无效的消息索引');
    }

    chat.messages[messageIndex] = {
        ...chat.messages[messageIndex],
        content: newContent,
        edited: true,
        editedAt: Date.now(),
    };
    chat.updatedAt = Date.now();
    saveChat(handle, charId, chatId, chat);
    return sendSuccess(res, { message: chat.messages[messageIndex] });
});

// ---------- 需要登录：删除消息 ----------
router.post('/chat/:charId/:chatId/delete-message', function (req, res) {
    const handle = getCurrentHandle(req);
    if (!handle) return sendError(res, 401, '未登录');

    const { charId, chatId } = req.params;
    const { messageIndex } = req.body || {};

    const chat = loadChat(handle, charId, chatId);
    if (!chat) return sendError(res, 404, '聊天不存在');
    if (typeof messageIndex !== 'number' || !chat.messages[messageIndex]) {
        return sendError(res, 400, '无效的消息索引');
    }

    chat.messages.splice(messageIndex, 1);
    chat.updatedAt = Date.now();
    saveChat(handle, charId, chatId, chat);
    return sendSuccess(res, { ok: true });
});

// ---------- 需要登录：重新发送消息 ----------
router.post('/chat/:charId/:chatId/resend', async function (req, res) {
    const handle = getCurrentHandle(req);
    if (!handle) return sendError(res, 401, '未登录');

    const { charId, chatId } = req.params;
    const { messageIndex, modelId, genParams } = req.body || {};

    const char = await getSystemCharacter(charId);
    if (!char) return sendError(res, 404, '角色卡不存在');

    let chat = loadChat(handle, charId, chatId);
    if (!chat) return sendError(res, 404, '聊天不存在');
    if (typeof messageIndex !== 'number' || !chat.messages[messageIndex]) {
        return sendError(res, 400, '无效的消息索引');
    }

    // 找到对应用户消息（向上一条）
    if (messageIndex === 0) return sendError(res, 400, '无法重新生成首条消息');
    const targetMsg = chat.messages[messageIndex];
    if (targetMsg.role !== 'user') return sendError(res, 400, '只能重新生成用户消息');

    // 移除该用户消息及其后的 AI 回复
    chat.messages = chat.messages.slice(0, messageIndex);
    chat.updatedAt = Date.now();
    saveChat(handle, charId, chatId, chat);

    // 重新发送（复用 send 逻辑，但复用需要传 content）
    req.body = { content: targetMsg.content, modelId, genParams };
    // 递归调用 send（简单处理，避免代码重复）
    return router.stack
        .find(r => r.route?.path === '/chat/:charId/:chatId/send')
        ?.route?.stack?.[0]?.handle(req, res);
});

// ---------- 需要登录：删除整个聊天 ----------
router.post('/chat/:charId/:chatId/delete', function (req, res) {
    const handle = getCurrentHandle(req);
    if (!handle) return sendError(res, 401, '未登录');

    const { charId, chatId } = req.params;
    const filePath = path.join(getUserChatDir(handle, charId), `${chatId}.json`);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
    return sendSuccess(res, {});
});

// ---------- 需要登录：保存聊天设置 ----------
router.post('/chat/:charId/:chatId/settings', function (req, res) {
    const handle = getCurrentHandle(req);
    if (!handle) return sendError(res, 401, '未登录');

    const { charId, chatId } = req.params;
    const { background, modelId } = req.body || {};

    const chat = loadChat(handle, charId, chatId);
    if (!chat) return sendError(res, 404, '聊天不存在');

    if (typeof background === 'string') chat.settings.background = background;
    if (typeof modelId === 'string') chat.settings.modelId = modelId;
    chat.updatedAt = Date.now();
    saveChat(handle, charId, chatId, chat);
    return sendSuccess(res, { settings: chat.settings });
});

// ============================================================
// AI 生成核心（可扩展替换为实际 API 调用）
// ============================================================

/**
 * 构建系统提示词
 */
function buildSystemPrompt(char, chat) {
    let prompt = '';
    if (char.description) prompt += `角色描述：${char.description}\n`;
    if (char.personality) prompt += `性格：${char.personality}\n`;
    if (char.first_mes) prompt += `开场白：${char.first_mes}\n`;
    if (char.system_prompt) prompt += `${char.system_prompt}\n`;
    return prompt;
}

/**
 * 构建消息历史（用于 chat completion 格式）
 */
function buildMessages(chat, newUserContent, char) {
    const msgs = [];
    for (const msg of chat.messages) {
        if (msg.role === 'user') {
            msgs.push({ role: 'user', content: msg.content });
        } else if (msg.role === 'assistant') {
            msgs.push({ role: 'assistant', content: msg.content });
        }
    }
    msgs.push({ role: 'user', content: newUserContent });
    return msgs;
}

/**
 * AI 生成已移至 ai-adapter.js（统一适配器）
 * 支持：OpenAI / Anthropic / Ollama / DeepSeek / Google Gemini
 * 统一入口：aiGenerate(model, systemPrompt, messages, genParams)
 */
