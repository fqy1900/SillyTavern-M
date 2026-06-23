// 新增的多用户授权 + 积分管理模块
// 独立 Router，注册到 /api/auth/*
// 依赖：原 src/users.js 提供的基础能力（node-persist、密码哈希、用户目录）

import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import storage from 'node-persist';

import {
    KEY_PREFIX,
    toKey,
    getUserDirectories,
    getPasswordHash,
    getPasswordSalt,
    getAccountVersion,
    initUserStorage,
    ensurePublicDirectoriesExist,
    getCookieSecret,
    getCookieSessionName,
    getSessionCookieAge,
    getUserAvatar,
} from '../users.js';
import { getConfigValue, generateTimestamp, color } from '../util.js';
import { serverDirectory } from '../server-directory.js';

export const router = express.Router();

// ---------- 常量 ----------
const CREDITS_KEY_PREFIX = 'credits:';        // node-persist: credits:{handle} -> number
const CONSUMPTION_FILE = 'consumption.json';  // 每个用户目录下的消费记录
const PROFILE_FILE = 'profile.json';          // 每个用户目录下的扩展资料（昵称、头像等）
const NEW_USER_DEFAULT_CREDITS = 1000;        // 新注册用户默认赠送积分

// ---------- 工具 ----------
function jsonResponse(res, status, data) {
    res.status(status).json(data);
}

function sendSuccess(res, data) {
    jsonResponse(res, 200, { success: true, ...data });
}

function sendError(res, status, message) {
    jsonResponse(res, status, { success: false, error: message });
}

async function getUserRecord(handle) {
    const key = toKey(handle);
    const record = await storage.getItem(key);
    return record || null;
}

async function setUserRecord(handle, record) {
    const key = toKey(handle);
    await storage.setItem(key, record);
}

async function getUserCredits(handle) {
    const key = `${CREDITS_KEY_PREFIX}${handle}`;
    const v = await storage.getItem(key);
    return typeof v === 'number' ? v : NEW_USER_DEFAULT_CREDITS;
}

async function setUserCredits(handle, amount) {
    const key = `${CREDITS_KEY_PREFIX}${handle}`;
    await storage.setItem(key, amount);
}

// 获取用户目录路径
function getUserDataDir(handle) {
    const dirs = getUserDirectories(handle);
    return dirs.root;
}

// 读取/写入用户扩展资料（昵称、头像）
function getProfilePath(handle) {
    return path.join(getUserDataDir(handle), PROFILE_FILE);
}

function getUserProfile(handle) {
    try {
        const p = getProfilePath(handle);
        if (fs.existsSync(p)) {
            return JSON.parse(fs.readFileSync(p, 'utf-8'));
        }
    } catch (e) {
        console.warn(color.yellow(`[auth-plus] Failed to read profile for ${handle}: ${e.message}`));
    }
    return { nickname: handle, avatar: '' };
}

function setUserProfile(handle, profile) {
    const p = getProfilePath(handle);
    fs.writeFileSync(p, JSON.stringify(profile, null, 2), 'utf-8');
}

// 消费记录
function getConsumptionPath(handle) {
    return path.join(getUserDataDir(handle), CONSUMPTION_FILE);
}

function getUserConsumption(handle) {
    try {
        const p = getConsumptionPath(handle);
        if (fs.existsSync(p)) {
            return JSON.parse(fs.readFileSync(p, 'utf-8'));
        }
    } catch (e) {
        console.warn(color.yellow(`[auth-plus] Failed to read consumption for ${handle}: ${e.message}`));
    }
    return [];
}

function appendConsumption(handle, record) {
    const list = getUserConsumption(handle);
    list.unshift(record);
    // 最多保留 2000 条
    if (list.length > 2000) list.length = 2000;
    const p = getConsumptionPath(handle);
    fs.writeFileSync(p, JSON.stringify(list, null, 2), 'utf-8');
}

// 扣减积分；成功返回 { ok:true, remaining }，失败返回 { ok:false, reason }
export async function deductCredits(handle, amount, reason) {
    if (amount <= 0) return { ok: true, remaining: await getUserCredits(handle) };
    const current = await getUserCredits(handle);
    if (current < amount) {
        return { ok: false, reason: '积分不足' };
    }
    const remaining = current - amount;
    await setUserCredits(handle, remaining);
    appendConsumption(handle, {
        time: Date.now(),
        type: 'deduct',
        amount,
        remaining,
        reason: reason || '',
    });
    return { ok: true, remaining };
}

// ---------- 会话管理（对原 server-main.js 的 cookie-session 写入用户标识）----------
async function setSessionUser(req, handle) {
    if (!req.session) req.session = {};
    req.session.handle = handle;
    req.session.authed = true;
    req.session.loginAt = Date.now();
    // 设置 session 版本号
    const user = await storage.getItem(toKey(handle));
    if (user) {
        req.session.version = getAccountVersion(user);
    }
}

function clearSession(req) {
    if (req.session) {
        delete req.session.handle;
        delete req.session.authed;
        delete req.session.loginAt;
    }
}

// 从 session 取出当前用户 handle
export function getCurrentHandle(req) {
    if (!req.session || !req.session.authed) return null;
    return req.session.handle || null;
}

// ---------- 公开路由：注册 ----------
router.post('/register', async function (req, res) {
    try {
        const { handle, password, nickname } = req.body || {};
        if (!handle || !password) {
            return sendError(res, 400, '用户名和密码不能为空');
        }
        if (handle.length < 3 || handle.length > 32) {
            return sendError(res, 400, '用户名长度需为 3-32 个字符');
        }
        if (password.length < 6 || password.length > 64) {
            return sendError(res, 400, '密码长度需为 6-64 个字符');
        }

        // 检查是否已存在
        const existing = await getUserRecord(handle);
        if (existing) {
            return sendError(res, 409, '该用户名已被注册');
        }

        const salt = getPasswordSalt();
        const now = Date.now();
        const user = {
            handle,
            name: nickname || handle,
            created: now,
            password: getPasswordHash(password, salt),
            salt,
            enabled: true,
            admin: false,
        };
        await setUserRecord(handle, user);

        // 创建用户目录
        await ensurePublicDirectoriesExist();
        const userDirectories = getUserDirectories(handle);

        // 为新用户复制默认头像
        const defaultAvatarSource = path.join(process.cwd(), 'data', 'default-user', 'User Avatars', 'user-default.png');
        const defaultAvatarDest = path.join(userDirectories.avatars, 'user-default.png');
        if (fs.existsSync(defaultAvatarSource) && !fs.existsSync(defaultAvatarDest)) {
            fs.copyFileSync(defaultAvatarSource, defaultAvatarDest);
        }

        // 初始化积分与资料
        await setUserCredits(handle, NEW_USER_DEFAULT_CREDITS);
        setUserProfile(handle, { nickname: nickname || handle, avatar: 'user-default.png' });

        console.log(color.green(`[auth-plus] Registered new user: ${handle}`));
        return sendSuccess(res, { handle, credits: NEW_USER_DEFAULT_CREDITS });
    } catch (e) {
        console.error(color.red(`[auth-plus] Register error: ${e.message || e}`));
        return sendError(res, 500, '服务器错误：' + e.message);
    }
});

// ---------- 公开路由：登录 ----------
router.post('/login', async function (req, res) {
    try {
        const { handle, password } = req.body || {};
        if (!handle || !password) {
            return sendError(res, 400, '用户名和密码不能为空');
        }

        const user = await getUserRecord(handle);
        if (!user) {
            return sendError(res, 404, '用户不存在');
        }
        if (!user.enabled) {
            return sendError(res, 403, '该账号已被禁用');
        }

        const expected = getPasswordHash(password, user.salt);
        if (expected !== user.password) {
            return sendError(res, 401, '密码错误');
        }

        await setSessionUser(req, handle);
        const profile = getUserProfile(handle);
        const credits = await getUserCredits(handle);

        return sendSuccess(res, {
            handle: user.handle,
            nickname: profile.nickname || user.name,
            avatar: profile.avatar || '',
            credits,
            isAdmin: !!user.admin,
        });
    } catch (e) {
        console.error(color.red(`[auth-plus] Login error: ${e.message || e}`));
        return sendError(res, 500, '服务器错误：' + e.message);
    }
});

// ---------- 需要登录：登出 ----------
router.post('/logout', function (req, res) {
    clearSession(req);
    return sendSuccess(res, {});
});

// ---------- 需要登录：获取当前用户信息 ----------
router.get('/me', async function (req, res) {
    const handle = getCurrentHandle(req);
    if (!handle) return sendError(res, 401, '未登录');

    const user = await getUserRecord(handle);
    if (!user) return sendError(res, 404, '用户不存在');

    const profile = getUserProfile(handle);
    const credits = await getUserCredits(handle);
    return sendSuccess(res, {
        handle,
        nickname: profile.nickname || user.name,
        avatar: profile.avatar || '',
        credits,
        isAdmin: !!user.admin,
        createdAt: user.created,
    });
});

// ---------- 需要登录：修改资料 ----------
router.post('/profile', async function (req, res) {
    const handle = getCurrentHandle(req);
    if (!handle) return sendError(res, 401, '未登录');

    const { nickname, avatar } = req.body || {};
    const profile = getUserProfile(handle);
    if (typeof nickname === 'string') profile.nickname = nickname;
    if (typeof avatar === 'string') profile.avatar = avatar;
    setUserProfile(handle, profile);
    return sendSuccess(res, { profile });
});

// ---------- 需要登录：修改密码 ----------
router.post('/password', async function (req, res) {
    const handle = getCurrentHandle(req);
    if (!handle) return sendError(res, 401, '未登录');

    const { oldPassword, newPassword } = req.body || {};
    if (!oldPassword || !newPassword) return sendError(res, 400, '旧密码和新密码不能为空');
    if (newPassword.length < 6 || newPassword.length > 64) return sendError(res, 400, '新密码长度需为 6-64 个字符');

    const user = await getUserRecord(handle);
    if (!user) return sendError(res, 404, '用户不存在');
    const expected = getPasswordHash(oldPassword, user.salt);
    if (expected !== user.password) return sendError(res, 401, '旧密码错误');

    user.password = getPasswordHash(newPassword, user.salt);
    await setUserRecord(handle, user);
    return sendSuccess(res, {});
});

// ---------- 需要登录：获取积分 ----------
router.get('/credits', async function (req, res) {
    const handle = getCurrentHandle(req);
    if (!handle) return sendError(res, 401, '未登录');
    const credits = await getUserCredits(handle);
    return sendSuccess(res, { credits });
});

// ---------- 需要登录：获取消费记录 ----------
router.get('/consumption', async function (req, res) {
    const handle = getCurrentHandle(req);
    if (!handle) return sendError(res, 401, '未登录');
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(10, parseInt(req.query.pageSize) || 20));
    const list = getUserConsumption(handle);
    const start = (page - 1) * pageSize;
    const data = list.slice(start, start + pageSize);
    return sendSuccess(res, {
        total: list.length,
        page,
        pageSize,
        list: data,
    });
});

// ---------- 公开路由：检查是否已登录 ----------
router.get('/status', async function (req, res) {
    const handle = getCurrentHandle(req);
    if (!handle) return sendSuccess(res, { authed: false });
    const user = await getUserRecord(handle);
    if (!user) return sendSuccess(res, { authed: false });
    const profile = getUserProfile(handle);
    const credits = await getUserCredits(handle);
    return sendSuccess(res, {
        authed: true,
        handle,
        nickname: profile.nickname || user.name,
        avatar: profile.avatar || '',
        credits,
        isAdmin: !!user.admin,
    });
});

// ---------- 供其他 endpoint 使用的积分扣除 helper ----------
export { getUserCredits, setUserCredits, appendConsumption, NEW_USER_DEFAULT_CREDITS };
