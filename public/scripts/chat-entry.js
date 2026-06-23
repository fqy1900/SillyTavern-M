// chat-entry.js - SillyTavern 聊天页面入口脚本
// 负责解析 URL 参数、自动加载角色卡和聊天、管理积分

// ===================== 配置 =====================
const CONFIG = {
    API_BASE: '',
    DEFAULT_CREDITS_COST: 5,
    CREDITS_CHECK_INTERVAL: 30000,
};

// ===================== 状态 =====================
const chatEntryState = {
    charId: null,
    chatId: null,
    handle: null,
    initialized: false,
    creditsDeducted: false,
};

// ===================== 工具函数 =====================
function getCTX() {
    try {
        return globalThis.SillyTavern?.getContext?.();
    } catch {
        return null;
    }
}

function parseUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        charId: params.get('char'),
        chatId: params.get('chat'),
        handle: params.get('handle'),
    };
}

// ===================== API 调用 =====================
async function apiCall(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };
    const token = sessionStorage.getItem('appToken');
    if (token) headers['X-CSRF-Token'] = token;
    try {
        const res = await fetch(endpoint, { ...options, headers, credentials: 'include' });
        if (!res.ok) {
            console.warn('[chat-entry] API returned', res.status, 'for', endpoint);
            return null;
        }
        const text = await res.text();
        try {
            return JSON.parse(text);
        } catch {
            console.warn('[chat-entry] Non-JSON response from', endpoint);
            return null;
        }
    } catch (e) {
        console.error('[chat-entry] API call failed:', endpoint, e);
        return null;
    }
}

async function getUserInfo() {
    return await apiCall('/api/app/user/info');
}

async function deductCredits(amount) {
    return await apiCall('/api/app/credits/deduct', {
        method: 'POST',
        body: JSON.stringify({ amount }),
    });
}

// ===================== 积分管理 =====================
// 注意：/api/app/user/info 和 /api/app/credits/deduct 是多用户系统（/app）的专属端点
// 在 /chat.html（SillyTavern 原生核心）中不存在，无需积分检查
async function checkUserCredits() {
    // SillyTavern 原生核心不需要积分检查
    return true;
}

async function deductAndCheckCredits() {
    // SillyTavern 原生核心不需要积分检查
    return true;
}

// ===================== 等待 SillyTavern 就绪 =====================
function waitForSillyTavernReady() {
    return new Promise((resolve) => {
        const check = () => {
            const ctx = getCTX();
            return ctx && ctx.eventSource && ctx.eventSource.emit;
        };

        if (check()) {
            resolve();
            return;
        }

        const interval = setInterval(() => {
            if (check()) {
                clearInterval(interval);
                resolve();
            }
        }, 200);

        setTimeout(() => {
            clearInterval(interval);
            if (getCTX()) {
                resolve();
            } else {
                console.warn('[chat-entry] SillyTavern init timeout, proceeding anyway');
                resolve();
            }
        }, 30000);
    });
}

// ===================== 等待聊天加载完成 =====================
function waitForChatLoaded() {
    return new Promise((resolve) => {
        const ctx = getCTX();
        if (!ctx || !ctx.eventSource) {
            setTimeout(resolve, 1000);
            return;
        }

        const ctxChars = ctx.characters || [];
        const ctxChat = ctx.chat || [];

        if (ctxChars.length > 0 && ctxChat.length > 0) {
            resolve();
            return;
        }

        const handler = () => {
            ctx.eventSource.removeListener('chatLoaded', handler);
            setTimeout(resolve, 500);
        };
        ctx.eventSource.on('chatLoaded', handler);

        setTimeout(() => {
            ctx.eventSource.removeListener('chatLoaded', handler);
            resolve();
        }, 15000);

        // 也用轮询保底
        const interval = setInterval(() => {
            const c = getCTX();
            if (c && (c.characters?.length > 0 || c.chat?.length > 0)) {
                clearInterval(interval);
                ctx.eventSource.removeListener('chatLoaded', handler);
                resolve();
            }
        }, 300);
        setTimeout(() => clearInterval(interval), 15000);
    });
}

// ===================== 自动加载角色卡 =====================
async function loadCharacter(charId) {
    const ctx = getCTX();
    if (!ctx) return false;

    // 使用 SillyTavern API 获取所有角色
    let chars = [];
    try {
        chars = ctx.characters || [];
    } catch (e) {
        console.warn('[chat-entry] 获取角色列表失败:', e);
    }

    if (chars.length === 0) {
        console.warn('[chat-entry] 角色列表为空，等待一段时间后重试');
        await new Promise(r => setTimeout(r, 2000));
        try {
            chars = getCTX()?.characters || [];
        } catch (e) {
            console.warn('[chat-entry] 再次获取角色列表失败:', e);
        }
    }

    if (chars.length === 0) {
        console.warn('[chat-entry] 角色列表为空，跳过自动选择');
        return true;
    }

    // 匹配角色卡（URL 参数 char 可以是角色名或头像文件名）
    const decodedCharId = decodeURIComponent(charId).trim();
    console.log('[chat-entry] 尝试匹配角色:', decodedCharId);

    let character = chars.find(c => c.name === decodedCharId)
        || chars.find(c => c.avatar === charId)
        || chars.find(c => c.name === charId)
        || (parseInt(charId, 10) >= 0 ? chars[parseInt(charId, 10)] : null;

    if (!character) {
        console.warn('[chat-entry] 未找到角色卡:', decodedCharId, '可用角色:', chars.map(c => c.name).join(', '));
        return true;
    }

    console.log('[chat-entry] 找到角色:', character.name, '头像:', character.avatar);

    // 优先通过 SillyTavern 核心 API 选择角色卡
    try {
        const ctx = getCTX();
        const charIndex = chars.indexOf(character);
        // 优先使用全局 context 暴露的方法
        if (ctx && typeof ctx.selectCharacterById && charIndex >= 0) {
            console.log('[chat-entry] 使用 ctx.selectCharacterById, 索引:', charIndex);
            await ctx.selectCharacterById(charIndex);
        } else if (typeof window.selectCharacterById !== 'undefined' && charIndex >= 0) {
            console.log('[chat-entry] 使用 window.selectCharacterById, 索引:', charIndex);
            await window.selectCharacterById(charIndex);
        } else {
            // 尝试通过 DOM 点击触发
            console.log('[chat-entry] 尝试通过 DOM 点击角色卡片');
            const $charBlock = $(`#character_list .character_block[chid="${character.avatar}"]`);
            if ($charBlock.length) {
                $charBlock.trigger('click');
            } else {
                console.warn('[chat-entry] 无法自动选择角色卡，请在界面中手动选择');
            }
        }
    } catch (e) {
        console.warn('[chat-entry] 选择角色卡出错:', e);
    }

    return true;
}

// ===================== 积分监听 =====================
// /chat.html 使用 SillyTavern 原生核心，不需要多用户积分系统
function setupCreditsListeners() {
    // SillyTavern 原生核心的代理由用户自己配置的 API key 驱动
    // 不需要额外的积分监听
}

// ===================== 返回按钮 =====================
function setupBackButton() {
    const $btn = $('#chat-back-btn');
    $btn.on('click', () => {
        window.location.href = '/app?view=characters';
    });
    setTimeout(() => $btn.removeClass('hidden'), 1000);
}

// ===================== 主入口 =====================
async function init() {
    const params = parseUrlParams();
    chatEntryState.charId = params.charId;
    chatEntryState.chatId = params.chatId;

    if (!chatEntryState.charId) {
        console.warn('[chat-entry] 缺少角色卡参数');
        return;
    }

    setupBackButton();

    // 等待 SillyTavern 核心就绪
    await waitForSillyTavernReady();
    console.log('[chat-entry] SillyTavern 就绪');

    // 检查积分（占位，无实际动作）
    await checkUserCredits();

    // 先自动选择/加载角色卡（基于 URL ?char= 参数）
    const ok = await loadCharacter(chatEntryState.charId);
    console.log('[chat-entry] 角色卡加载结果:', ok);

    // 角色选择后，等待聊天上下文完全加载（消息渲染等）
    await new Promise(r => setTimeout(r, 800));

    // 设置积分监听（占位）
    setupCreditsListeners();

    chatEntryState.initialized = true;
    console.log('[chat-entry] 初始化完成');
}

// ES module 是异步加载的，DOMContentLoaded 可能已经触发
// 使用 readyState 检查而不是监听事件
function autoInit() {
    // 暴露到全局（调试用）
    window.chatEntry = { state: chatEntryState, init };

    // 如果文档已准备好（DOMContentLoaded 已触发），延迟执行 init
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        setTimeout(init, 800);
    } else {
        // 文档还在加载中，监听 DOMContentLoaded
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(init, 800);
        });
    }
}

autoInit();
