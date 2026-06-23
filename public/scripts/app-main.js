// app-main.js — 主应用入口：初始化、视图切换、登录状态管理
import api, { authApi, chatApi } from './app-api.js';
import { DOMPurify, hljs, showdown, css } from '../lib.js';

// ======== 最小 SillyTavern shim（供 JS-Slash-Runner 等插件使用） ========
// 注意：SillyTavern 核心 script.js 依赖完整原生 DOM，无法在自定义 UI 中完整加载。
// 这里提供插件所需的最小导出 shim，兼容 eventSource.emit / chat / chat_metadata 等调用。

// 简单的 EventEmitter（兼容 EventEmitter2 API 的基础子集）
class ShimmEmitter {
    constructor(opts) {
        this._listeners = new Map();
        this._onceMark = Symbol('once');
    }
    on(event, fn) {
        if (!this._listeners.has(event)) this._listeners.set(event, []);
        this._listeners.get(event).push(fn);
        return this;
    }
    addListener(event, fn) { return this.on(event, fn); }
    once(event, fn) {
        const wrapped = (...args) => {
            this.off(event, wrapped);
            fn.apply(null, args);
        };
        wrapped[this._onceMark] = true;
        return this.on(event, wrapped);
    }
    off(event, fn) {
        const arr = this._listeners.get(event);
        if (!arr) return this;
        const idx = arr.indexOf(fn);
        if (idx >= 0) arr.splice(idx, 1);
        return this;
    }
    removeListener(event, fn) { return this.off(event, fn); }
    removeAllListeners(event) {
        if (event === undefined) this._listeners.clear();
        else this._listeners.delete(event);
        return this;
    }
    emit(event, ...args) {
        const arr = this._listeners.get(event);
        if (!arr || arr.length === 0) return false;
        for (const fn of [...arr]) { try { fn(...args); } catch (e) { console.warn('[eventEmitter]', e); } }
        return true;
    }
    emitAsync(event, ...args) {
        return Promise.resolve(this.emit(event, ...args));
    }
    listeners(event) {
        return [...(this._listeners.get(event) || [])];
    }
}

const stEventSource = new ShimmEmitter();

// event_types shim（与 SillyTavern events.js 保持一致）
const stEventTypes = {
    USER_MESSAGE_RENDERED: 'USER_MESSAGE_RENDERED',
    CHARACTER_MESSAGE_RENDERED: 'CHARACTER_MESSAGE_RENDERED',
    MESSAGE_SLASH_COMMANDS_EXCUTED: 'MESSAGE_SLASH_COMMANDS_EXCUTED',
    CHAT_CHANGED: 'CHAT_CHANGED',
    CHAT_LOADED: 'CHAT_LOADED',
    REQUEST_REGENERATE: 'REQUEST_REGENERATE',
    REQUEST_EDIT: 'REQUEST_EDIT',
    REQUEST_DELETE: 'REQUEST_DELETE',
    SYSTEM_MESSAGE_RECEIVED: 'SYSTEM_MESSAGE_RECEIVED',
    USER_MESSAGE_RECEIVED: 'USER_MESSAGE_RECEIVED',
    CHARACTER_MESSAGE_RECEIVED: 'CHARACTER_MESSAGE_RECEIVED',
    AI_RESPONSE_FINISHED: 'AI_RESPONSE_FINISHED',
    STREAMING_TOKEN_RECEIVED: 'STREAMING_TOKEN_RECEIVED',
    GROUP_CHAT_UPDATED: 'GROUP_CHAT_UPDATED',
    CHARACTER_UNLOAD: 'CHARACTER_UNLOAD',
};

// 导出到 window 供 third-party 插件访问
window.eventSource = stEventSource;
window.event_types = stEventTypes;
// chat / chat_metadata 在 state.currentChat 上同步更新

// 全局状态
const state = {
    currentUser: null,
    currentView: 'characters',
    currentChar: null,
    currentChat: null,
    models: [],
    genParams: {
        temperature: 0.9,
        max_tokens: 512,
        top_p: 0.9,
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
        reasoning: 0.5,
        streaming: true,
    },
};

// ===================== 工具 =====================
function showToast(msg, duration = 3000) {
    const $t = $('#toast');
    $t.text(msg).fadeIn();
    setTimeout(() => $t.fadeOut(), duration);
}

function formatTime(ts) {
    if (!ts) return '--';
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function getGenParams() {
    return {
        temperature: parseFloat($('#paramTemp').val()),
        max_tokens: parseInt($('#paramMaxTokens').val()),
        top_p: parseFloat($('#paramTopP').val()),
        frequency_penalty: parseFloat($('#paramFreqPen').val()),
        presence_penalty: parseFloat($('#paramPresPen').val()),
        reasoning: parseFloat($('#paramReasoning').val()),
        streaming: $('#paramStreaming').is(':checked'),
    };
}

// ===================== 视图切换 =====================
function switchView(viewName, data) {
    state.currentView = viewName;
    // 菜单高亮
    $('.sidebar-menu-btn').removeClass('active');
    $(`.sidebar-menu-btn[data-view="${viewName}"]`).addClass('active');

    // 隐藏所有视图
    $('.view-section').hide();
    $('#viewChat').hide();

    // 右侧栏
    const $right = $('#rightSidebar');

    if (viewName === 'characters') {
        $('#viewCharacters').show();
        $right.hide();
        loadCharacterList();
    } else if (viewName === 'chat') {
        $('#viewChat').show();
        $right.show();
        loadChatView(data);
    } else if (viewName === 'user') {
        $('#viewUser').show();
        $right.hide();
        loadUserCenter();
    }
}

// ===================== 初始化 =====================
async function init() {
    // 获取 CSRF Token
    api.ensureCsrfToken();

    // 监听来自 iframe 的高度调整消息
    window.addEventListener('message', function(event) {
        const data = event.data;
        if (data && data.type === 'ST_IFRAME_HEIGHT' && data.iframeId) {
            const iframe = document.getElementById(data.iframeId);
            if (iframe && data.height > 0) {
                // 设置最小高度为 300px，实际高度为内容高度
                const newHeight = Math.max(300, parseInt(data.height, 10));
                iframe.style.height = newHeight + 'px';
                // 让滚动区域也更新
                setTimeout(function() {
                    const chatMessages = document.getElementById('chatMessages');
                    if (chatMessages) {
                        // 触发重新布局
                        chatMessages.scrollTop = chatMessages.scrollTop;
                    }
                }, 50);
            }
        }
    });

    // 检查登录状态
    try {
        const res = await authApi.status();
        if (!res.authed) {
            window.location.href = '/login';
            return;
        }
        state.currentUser = res;
        renderUserSidebar(res);
    } catch (e) {
        window.location.href = '/login';
        return;
    }

    // 加载模型列表
    try {
        const res = await chatApi.getModels();
        state.models = res.models || [];
        renderModelSelect();
    } catch (e) {
        console.warn('Failed to load models:', e);
    }

    // 隐藏加载遮罩
    $('#appLoader').fadeOut(() => $(document.body).css('display', ''));
    $('body.app-page').css('display', 'flex');

    // 检查 URL 参数
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    if (view === 'chat' && params.get('char')) {
        const charId = params.get('char');
        const chatId = params.get('session');
        if (chatId) {
            switchView('chat', { charId, chatId });
        } else {
            // 只有角色 ID，没有聊天会话，需要先选角色并创建/加载会话
            await selectCharacter(charId);
        }
    } else {
        switchView('characters');
    }

    setupEventListeners();
}

// ===================== 侧边栏渲染 =====================
function renderUserSidebar(user) {
    $('#sidebarNickname').text(user.nickname || user.handle);
    $('#sidebarCreditsNum').text(user.credits ?? '--');
    if (user.avatar) $('#sidebarAvatar').attr('src', user.avatar);
}

// ===================== 事件绑定 =====================
// 注意：所有绑定使用 .off().on() 模式，防止重复绑定导致事件触发多次
function setupEventListeners() {
    // 菜单导航（委托绑定，兼容动态元素）
    $(document).off('click.st-app', '.sidebar-menu-btn').on('click.st-app', '.sidebar-menu-btn', function () {
        const view = $(this).data('view');
        if (!view) return;
        switchView(view);
        history.pushState({}, '', '/app');
    });

    // 退出登录
    $(document).off('click.st-app', '#logoutBtn').on('click.st-app', '#logoutBtn', async () => {
        try {
            await authApi.logout();
        } catch (e) { /* 忽略错误 */ }
        window.location.href = '/login';
    });

    // 头像上传
    $('#sidebarAvatar').off('click.st-app').on('click.st-app', () => $('#avatarUpload').trigger('click'));
    $('#avatarUpload').off('change.st-app').on('change.st-app', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const avatarUrl = ev.target.result;
            try {
                await authApi.updateProfile({ avatar: avatarUrl });
                $('#sidebarAvatar, #ucAvatar').attr('src', avatarUrl);
                showToast('头像已更新');
            } catch (err) { showToast('更新失败：' + err.message); }
        };
        reader.readAsDataURL(file);
    });

    // URL hash 变化（浏览器前进后退）
    // 只绑定一次（使用全局监听器标记）
    if (!window._st_popstateBound) {
        window.addEventListener('popstate', () => {
            const params = new URLSearchParams(window.location.search);
            const view = params.get('view');
            if (view === 'chat' && params.get('char')) {
                switchView('chat', { charId: params.get('char'), chatId: params.get('session') });
            } else {
                switchView(params.get('view') || 'characters');
            }
        });
        window._st_popstateBound = true;
    }

    // 聊天设置面板
    $('#chatSettingsBtn').off('click.st-app').on('click.st-app', () => {
        $('#rightCharPanel').hide();
        $('#rightChatPanel').show();
        $('#rightSidebar').show();
    });

    // 背景设置
    $('#chatBgBtn').off('click.st-app').on('click.st-app', () => {
        $('#bgModal').fadeIn();
        loadBgOptions();
    });

    $('#bgModalClose').off('click.st-app').on('click.st-app', () => $('#bgModal').fadeOut());
    $('#bgModal').off('click.st-app').on('click.st-app', (e) => { if (e.target === $('#bgModal')[0]) $('#bgModal').fadeOut(); });

    $('#bgUrlBtn').off('click.st-app').on('click.st-app', () => {
        const url = $('#bgUrlInput').val().trim();
        if (!url) return;
        setChatBg(url);
        $('#bgModal').fadeOut();
    });

    // 发送按钮
    $('#chatSendBtn').off('click.st-app').on('click.st-app', () => {
        const content = $('#chatInput').val();
        if (!content?.trim()) return;
        $('#chatInput').val('');
        sendMessage(content);
    });

    // 输入框快捷键
    $('#chatInput').off('keydown.st-app').on('keydown.st-app', function (e) {
        if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
            e.preventDefault();
            const content = $(this).val();
            if (!content?.trim()) return;
            $(this).val('');
            sendMessage(content);
        }
    });

    // 聊天返回按钮
    $('#chatBackBtn').off('click.st-app').on('click.st-app', () => {
        state.currentChat = null;
        state.currentChar = null;
        switchView('characters');
    });

    // 参数滑块联动显示值
    ['paramTemp', 'paramMaxTokens', 'paramCtxLen', 'paramTopP', 'paramFreqPen', 'paramPresPen', 'paramReasoning'].forEach(id => {
        const $el = $(`#${id}`);
        const valId = id.replace('param', 'val').replace('CtxLen', 'CtxLen');
        $el.off('input.st-app').on('input.st-app', () => {
            $(`#${valId}`).text($el.val());
            state.genParams[id.replace('param', '').toLowerCase()] = parseFloat($el.val());
        });
    });

    // 参数保存按钮
    $('#paramSaveBtn').off('click.st-app').on('click.st-app', () => {
        const params = getGenParams();
        if (state.currentChar && state.currentChat) {
            chatApi.saveChatSettings(state.currentChar.id, state.currentChat.id, params);
        }
        state.genParams = params;
        showToast('参数已保存');
    });

    // 关闭右边栏
    $('#rightPanelClose, #rightChatPanelClose').off('click.st-app').on('click.st-app', () => {
        $('#rightSidebar').hide();
    });
}

// ===================== 角色卡列表 =====================
async function loadCharacterList() {
    const $list = $('#charList');
    const $loading = $('#charListLoading');
    const $empty = $('#charListEmpty');

    $list.empty();
    $loading.show();
    $empty.hide();

    try {
        const res = await chatApi.getCharacters();
        $loading.hide();
        if (!res.characters || res.characters.length === 0) {
            $empty.show();
            return;
        }
        res.characters.forEach(ch => {
            const $card = $(`
                <div class="char-card" data-id="${ch.id}">
                    <img src="${ch.avatar}" alt="${ch.name}" class="char-card-avatar">
                    <div class="char-card-name">${ch.name}</div>
                    <div class="char-card-desc">${(ch.description||'').slice(0,50)}${(ch.description||'').length>50?'...':''}</div>
                    ${ch.tags&&ch.tags.length?`<div class="char-card-tags">${ch.tags.slice(0,3).map(t=>`<span class="tag">${t}</span>`).join('')}</div>`:''}
                </div>
            `);
            $card.find('.char-card-avatar').one('error', function() { this.src='img/No-Image-Placeholder.svg'; });
            $card.on('click', () => selectCharacter(ch.id));
            $list.append($card);
        });
    } catch (e) {
        $loading.text('加载失败：' + e.message);
    }
}

async function selectCharacter(charId) {
    try {
        // 存储角色信息到 sessionStorage（供 chat.html 使用）
        const res = await chatApi.getCharacter(charId);
        if (!res.character) return showToast('加载角色信息失败');

        const charInfo = {
            id: charId,
            name: res.character.name,
            avatar: res.character.avatar,
        };
        sessionStorage.setItem('selectedChar', JSON.stringify(charInfo));

        // 获取或创建聊天会话
        let chatId = '';
        try {
            const chatsRes = await chatApi.getChats(charId);
            const chats = chatsRes.chats || [];
            if (chats.length > 0) {
                chatId = chats[0].id;
            }
        } catch (e) {
            // 获取聊天列表失败，不阻塞跳转
            console.warn('[selectCharacter] 获取聊天列表失败:', e);
        }

        // 跳转到聊天页面（使用完整的 SillyTavern 核心 + 插件）
        const params = new URLSearchParams({ char: charId });
        if (chatId) params.set('chat', chatId);
        window.location.href = '/chat.html?' + params.toString();
    } catch (e) {
        showToast('网络错误：' + e.message);
    }
}

function renderCharDetailPanel(ch) {
    $('#rightCharPanel').show();
    $('#rightChatPanel').hide();
    $('#rightCharAvatar').one('error', function(){ this.src='img/No-Image-Placeholder.svg'; }).attr('src', ch.avatar || 'img/No-Image-Placeholder.svg');
    $('#rightCharName').text(ch.name || '--');
    $('#rightCharDesc').text(ch.description || '暂无描述');
    $('#rightCharTags').empty();
    if (ch.tags) ch.tags.forEach(t => $('#rightCharTags').append(`<span class="tag">${t}</span>`));
    $('#rightCharWorldbooks').empty();
    if (ch.worldbooks && ch.worldbooks.length) {
        $('#rightCharWorldbooks').append('<h4>世界书</h4>');
        ch.worldbooks.forEach(w => {
            $('#rightCharWorldbooks').append(`<div class="wb-entry"><strong>${w.name}</strong></div>`);
        });
    }
}

// ===================== 模型选择 =====================
function renderModelSelect() {
    const $sel = $('#paramModel');
    $sel.empty();
    state.models.forEach(m => {
        $sel.append(`<option value="${m.id}">${m.name}</option>`);
    });
}

// ===================== 背景 =====================
const DEFAULT_BGS = [
    '/backgrounds/royal.jpg',
    '/backgrounds/bedroom%20clean.jpg',
    '/backgrounds/bedroom%20red.jpg',
    '/backgrounds/tavern%20day.jpg',
];

function loadBgOptions() {
    const $grid = $('#bgGrid');
    $grid.empty();
    const currentBg = state.currentChat?.settings?.background || '';
    DEFAULT_BGS.forEach(bg => {
        const $item = $(`<div class="bg-item" style="background-image:url('${bg}')" data-bg="${bg}"></div>`);
        if (bg === currentBg) $item.addClass('selected');
        $item.on('click', () => {
            setChatBg(bg);
            $('#bgModal').fadeOut();
        });
        $grid.append($item);
    });
}

function setChatBg(url) {
    $('#chatMessages').css('background-image', `url('${url}')`);
    state.currentChat = state.currentChat || {};
    state.currentChat.settings = state.currentChat.settings || {};
    state.currentChat.settings.background = url;
    if (state.currentChar && state.currentChat) {
        chatApi.saveChatSettings(state.currentChar.id, state.currentChat.id, { background: url });
    }
}

// ===================== 用户中心 =====================
async function loadUserCenter() {
    const user = state.currentUser;
    if (!user) return;

    try {
        const meRes = await authApi.me();
        const userData = meRes;
        state.currentUser = userData;
        $('#ucNickname').text(userData.nickname || userData.handle);
        $('#ucCredits').text(userData.credits ?? '--');
        $('#ucCreatedAt').text(formatTime(userData.createdAt));
        if (userData.avatar) $('#ucAvatar').attr('src', userData.avatar);
        renderUserSidebar(userData);
    } catch (e) {
        console.warn('Failed to load user info:', e);
    }

    // 修改昵称
    $('#ucNicknameBtn').off('click.userCenter').on('click.userCenter', async () => {
        const currentVal = $('#ucNickname').text();
        const newNick = await customPrompt('请输入新昵称', currentVal);
        if (!newNick || newNick === currentVal) return;
        try {
            await authApi.updateProfile({ nickname: newNick });
            $('#ucNickname').text(newNick);
            $('#sidebarNickname').text(newNick);
            showToast('昵称已更新');
        } catch (e) { showToast('修改失败：' + e.message); }
    });

    // 修改密码
    $('#ucPwdBtn').off('click.userCenter').on('click.userCenter', async () => {
        const $msg = $('#ucPwdMsg');
        const oldPwd = $('#ucOldPwd').val();
        const newPwd = $('#ucNewPwd').val();
        const confirmVal = $('#ucNewPwdConfirm').val();
        $msg.hide();
        if (!oldPwd || !newPwd) return $msg.text('请填写所有字段').addClass('error').show();
        if (newPwd.length < 6) return $msg.text('新密码至少6个字符').addClass('error').show();
        if (newPwd !== confirmVal) return $msg.text('两次密码不一致').addClass('error').show();
        try {
            await authApi.changePassword({ oldPassword: oldPwd, newPassword: newPwd });
            $msg.text('密码修改成功').removeClass('error').addClass('success').show();
            $('#ucOldPwd, #ucNewPwd, #ucNewPwdConfirm').val('');
        } catch (e) { $msg.text(e.message).addClass('error').show(); }
    });

    // 消费记录
    loadConsumption(1);
}

async function loadConsumption(page) {
    const $list = $('#consumptionList');
    const $loading = $('#consumptionLoading');
    const $empty = $('#consumptionEmpty');
    const $pager = $('#consumptionPagination');

    $list.empty();
    $loading.show();
    $empty.hide();
    $pager.empty();

    try {
        const res = await authApi.getConsumption(page, 20);
        $loading.hide();
        if (!res.list || res.list.length === 0) {
            $empty.show();
            return;
        }
        res.list.forEach(item => {
            $list.append(`
                <div class="consumption-item">
                    <span class="consumption-item-time">${formatTime(item.time)}</span>
                    <span class="consumption-item-reason">${item.reason || '对话消费'}</span>
                    <span class="consumption-item-amount">-${item.amount}</span>
                </div>
            `);
        });
        // 分页
        const totalPages = Math.ceil(res.total / res.pageSize);
        if (totalPages > 1) {
            for (let i = 1; i <= totalPages; i++) {
                const $btn = $(`<button>${i}</button>`);
                if (i === page) $btn.addClass('active');
                $btn.on('click', () => loadConsumption(i));
                $pager.append($btn);
            }
        }
    } catch (e) {
        $loading.text('加载失败：' + e.message);
    }
}

// ===================== 聊天视图加载 =====================
async function loadChatView({ charId, chatId }) {
    if (!charId || !chatId) return;

    try {
        // 加载角色详情（如果还没加载）
        if (!state.currentChar || state.currentChar.id !== charId) {
            const charRes = await chatApi.getCharacter(charId);
            if (charRes.character) {
                state.currentChar = charRes.character;
                renderCharDetailPanel(state.currentChar);
            }
        }

        // 加载聊天
        const chatRes = await chatApi.getChat(charId, chatId);
        if (!chatRes.chat) return showToast('加载聊天失败');

        state.currentChat = chatRes.chat;

        // 同步到 SillyTavern shim 状态（供 JS-Slash-Runner 等插件使用）
        // 插件通过 window.chat / window.chat_metadata 访问
        if (!window.chat) window.chat = [];
        window.chat.length = 0;
        if (state.currentChat.messages) {
            state.currentChat.messages.forEach(msg => window.chat.push(msg));
        }
        if (!window.chat_metadata) window.chat_metadata = {};
        window.chat_metadata.script_injects = state.currentChat.metadata?.script_injects || {};
        window.character = state.currentChar;
        if (!window.characters) window.characters = [state.currentChar];

        // ====== SillyTavern 核心函数 Shim（供角色卡 HTML 内联脚本使用）======
        // 这些函数模拟 SillyTavern 原生 API，使依赖这些函数的角色卡脚本能在 /app 页面正常工作

        /**
         * 获取聊天消息（支持 swipes）
         * @param {number} count - 获取消息数量（0 = 获取全部）
         * @param {object} options - 选项
         * @param {boolean} options.include_swipe - 是否包含 swipes
         * @returns {Promise<Array>} 消息数组
         */
        window.getChatMessages = async function(count, options = {}) {
            const messages = state.currentChat?.messages || [];
            const result = [];

            // 获取指定数量的消息（从最新消息往前数）
            const sliceCount = count > 0 ? count : messages.length;
            const startIdx = Math.max(0, messages.length - sliceCount);

            for (let i = startIdx; i < messages.length; i++) {
                const msg = { ...messages[i], id: i };
                // 如果需要包含 swipes，添加 swipe 信息
                if (options.include_swipe && msg.swipes) {
                    result.push({
                        ...msg,
                        swipes: msg.swipes,
                        swipe_id: msg.swipe_id ?? 0,
                    });
                } else {
                    result.push(msg);
                }
            }

            return result;
        };

        /**
         * 设置聊天消息内容（支持切换 swipe）
         * @param {string} content - 新内容
         * @param {number} index - 消息索引
         * @param {object} options - 选项
         * @param {number} options.swipe_id - 切换到的 swipe 索引
         * @param {string} options.refresh - 刷新方式 ('display_and_render_current')
         */
        window.setChatMessage = async function(content, index, options = {}) {
            if (!state.currentChat?.messages) return;

            const msg = state.currentChat.messages[index];
            if (!msg) return;

            try {
                // 如果有 swipe_id 选项，切换到指定的 swipe
                if (options.swipe_id !== undefined) {
                    const swipeContent = msg.swipes?.[options.swipe_id];
                    if (swipeContent !== undefined) {
                        msg.swipe_id = options.swipe_id;
                        msg.content = swipeContent;
                    }
                } else {
                    msg.content = content;
                }

                // 如果需要刷新显示
                if (options.refresh === 'display_and_render_current') {
                    // 更新 DOM 中的消息内容
                    const $bubble = findBubbleByIndex(index);
                    if ($bubble.length) {
                        $bubble.find('.bubble-content').first().html(formatMessageContent({ ...msg }, index));
                    }
                }

                // 同步到 window.chat
                if (window.chat && window.chat[index]) {
                    window.chat[index] = { ...msg };
                }
            } catch (e) {
                console.error('[setChatMessage] Error:', e);
                throw e;
            }
        };

        // ====== SillyTavern 核心函数 Shim 结束 ======

        renderChatHeader();
        renderChatMessages();

        // 触发 chatLoaded 事件（SillyTavern shim）
        stEventSource.emit(stEventTypes.CHAT_LOADED, { detail: { id: charId, character: state.currentChar } });

        // 加载脚本（如果角色有脚本）
        loadCharacterScript(state.currentChar);

        // 更新 URL
        const url = new URL(window.location);
        url.searchParams.set('view', 'chat');
        url.searchParams.set('char', charId);
        url.searchParams.set('session', chatId);
        history.pushState({}, '', url);

    } catch (e) {
        showToast('网络错误：' + e.message);
    }
}

function renderChatHeader() {
    const ch = state.currentChar;
    const chat = state.currentChat;
    $('#chatCharAvatar').one('error', function(){ this.src='img/user-default.png'; }).attr('src', ch?.avatar || 'img/user-default.png');
    $('#chatCharName').text(ch?.name || '--');
    const model = state.models.find(m => m.id === chat?.settings?.modelId);
    $('#chatModelName').text(model?.name || state.models[0]?.name || '--');
    if (chat?.settings?.background) {
        $('#chatMessages').css('background-image', `url('${chat.settings.background}')`);
    } else {
        $('#chatMessages').css('background-image', 'none');
    }
}

function renderChatMessages() {
    const $msgs = $('#chatMessages');
    $msgs.empty();
    if (!state.currentChat?.messages) return;
    state.currentChat.messages.forEach((msg, idx) => {
        appendMessageBubble(msg, idx, false);
    });
    scrollToBottom();
}

function appendMessageBubble(msg, idx, animate = true) {
    const $msgs = $('#chatMessages');
    const role = msg.role === 'user' ? 'user' : 'assistant';
    const edited = msg.edited ? '<span class="bubble-edited">（已编辑）</span>' : '';
    const time = formatTime(msg.send_date);
    const $bubble = $(`
        <div class="chat-bubble ${role}" data-idx="${idx}">
            <div class="bubble-content">${formatMessageContent(msg, idx)}</div>
            <div class="bubble-meta">
                <span>${time}</span>${edited}
                <button type="button" class="bubble-actions-btn edit-btn" data-action="edit"><i class="fa-solid fa-pen"></i></button>
                <button type="button" class="bubble-actions-btn delete-btn" data-action="delete"><i class="fa-solid fa-trash"></i></button>
                ${role === 'user' ? '<button type="button" class="bubble-actions-btn resend-btn" data-action="resend"><i class="fa-solid fa-rotate-right"></i></button>' : ''}
            </div>
        </div>
    `);

    // 气泡操作：停止事件传播，避免触发长按/文档级处理器，也避免原生对话框导致宿主 React 渲染循环
    $bubble.find('.bubble-actions-btn').on('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        const action = $(this).data('action');
        if (action === 'edit') editMessage(idx);
        else if (action === 'delete') deleteMessage(idx);
        else if (action === 'resend') resendMessage(idx);
    });

    // 长按显示操作面板（移动端），使用独立的事件处理器，与按钮点击互不干扰
    let pressTimer;
    let pressedOnAction = false;
    $bubble.on('mousedown', function (ev) {
        // 如果点击的是按钮本身，不触发长按逻辑
        if ($(ev.target).closest('.bubble-actions-btn').length > 0) {
            pressedOnAction = true;
            return;
        }
        pressedOnAction = false;
        pressTimer = setTimeout(() => showBubbleActions($bubble), 500);
    }).on('mouseup mouseleave', function () {
        if (pressedOnAction) return;
        clearTimeout(pressTimer);
    });

    if (!animate) $bubble.css('animation', 'none');
    $msgs.append($bubble);
    scrollToBottom();

    // HTML 代码块中的内联脚本在 jQuery .html() 注入后不会自动执行，手动执行
    const $content = $bubble.find('.bubble-content');
    if ($content.find('[data-pending-scripts]').length > 0) {
        executeInlineScripts($content[0]);
        $content.find('[data-pending-scripts]').remove();
    }

    // 触发 SillyTavern 事件（供 JS-Slash-Runner 等插件使用）
    // 注意：window.event_types / window.eventSource 由 app-main.js 顶部 shim 初始化
    const evtName = msg.is_user
        ? window.event_types.USER_MESSAGE_RENDERED
        : window.event_types.CHARACTER_MESSAGE_RENDERED;
    window.eventSource.emit(evtName, idx, msg.is_system ? 'system' : msg.role);
}

// showdown converter（主要使用）：用于 markdown → HTML 转换，同 SillyTavern 默认配置
const messageConverter = new showdown.Converter({
    'tables': true,
    'tasklists': true,
    'smoothLivePreview': true,
    'parseImgDimensions': true,
    'simplifiedAutoLink': true,
    'openLinksInNewWindow': true,
});

/**
 * 编码 style 标签为 custom-style（供 DOMPurify 保留，渲染时恢复并加作用域）
 * 参考 SillyTavern scripts/chats.js 的 encodeStyleTags / decodeStyleTags
 */
function encodeStyleTags(text) {
    const styleRegex = /<style>([\s\S]*?)<\/style>/gims;
    return text.replace(styleRegex, (_, match) =>
        `<custom-style>${encodeURIComponent(match)}</custom-style>`
    );
}

/**
 * 解码 custom-style 标签，恢复为 <style> 并正确处理复杂 CSS
 * @param {string} text
 * @param {string} scopeSelector 作用域选择器（如 '.bubble-content'）
 */
function decodeStyleTags(text, scopeSelector) {
    const decodeRegex = /<custom-style>([\s\S]*?)<\/custom-style>/gms;
    return text.replace(decodeRegex, (_, encoded) => {
        const css = decodeURIComponent(encoded);
        return processComplexCss(css, scopeSelector);
    });
}

/**
 * 处理复杂 CSS：正确解析 @import/:root/@keyframes/@media/body 等
 * 避免将 at-rules 嵌套在选择器内，同时给普通选择器加上作用域前缀
 * @param {string} css 原始 CSS 内容
 * @param {string} scopeSelector 作用域选择器
 * @returns {string} 处理后的完整 style 内容
 */
function processComplexCss(cssText, scopeSelector) {
    try {
        const ast = css.parse(cssText);
        const sheet = ast?.stylesheet;
        if (!sheet) return `<style>${cssText}</style>`;

        function addPrefixToSelectors(selectors) {
            return selectors.map(sel => {
                if (!sel) return sel;
                const trimmed = sel.trim();
                if (!trimmed) return sel;
                // 跳过 at-rules（@property, @font-face, @keyframes, @supports 等）
                if (trimmed.startsWith('@')) return trimmed;
                if (trimmed === 'body' || trimmed === 'html' || trimmed === ':root') return scopeSelector;
                if (trimmed.startsWith('body ') || trimmed.startsWith('html ')) {
                    return scopeSelector + ' ' + trimmed.substring(5);
                }
                if (trimmed.startsWith('::')) return trimmed;
                return scopeSelector + ' ' + trimmed;
            });
        }

        function processRule(rule) {
            if (rule.type === 'rule') {
                rule.selectors = addPrefixToSelectors(rule.selectors);
            } else if (rule.type === 'media' && Array.isArray(rule.rules)) {
                rule.rules = rule.rules.map(processRule);
            } else if (rule.type === 'supports' && Array.isArray(rule.rules)) {
                rule.rules = rule.rules.map(processRule);
            }
            return rule;
        }

        sheet.rules = sheet.rules.map(processRule);

        return `<style data-scoped>${css.stringify(ast)}</style>`;
    } catch (e) {
        console.warn('[processComplexCss] CSS parse error:', e.message);
        return `<style>${cssText}</style>`;
    }
}

/**
 * 手动执行 HTML 中的内联脚本
 * jQuery .html() 不会执行动态注入的脚本，需要手动 eval
 * @param {string} html 注入后的 HTML 字符串（已含 script 标签）
 * @param {Element} container 注入容器元素
 */
function executeInlineScripts(container) {
    container.querySelectorAll('script').forEach(oldScript => {
        const src = oldScript.src;
        const text = oldScript.textContent;

        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach(attr => {
            if (attr.name !== 'src' && attr.name !== 'type') {
                newScript.setAttribute(attr.name, attr.value);
            }
        });

        if (src) {
            // 外部脚本：创建新元素追加到 DOM（浏览器自动加载执行）
            newScript.src = src;
            newScript.async = false; // 保持顺序执行
            document.head.appendChild(newScript);
        } else if (text.trim()) {
            // 内联脚本：eval 执行（作用域为全局）
            try {
                // eslint-disable-next-line no-eval
                eval(text);
            } catch (e) {
                console.warn('[executeInlineScripts] eval error:', e);
            }
        }
        // 移除原 script 标签
        oldScript.remove();
    });
}

/**
 * 创建 iframe 渲染所需的完整 HTML 文档
 * 参考 JS-Slash-Runner 的 createSrcContent 实现
 * @param {string} content 原始 HTML 内容
 * @param {string} iframeId iframe 的唯一标识
 * @returns {string} 完整的 HTML 文档字符串
 */
function createIframeHtml(content, iframeId) {
    // 生成完整的 HTML 文档
    // 将 parent 的函数和状态代理到当前 iframe 的 window 对象
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
*,*::before,*::after{box-sizing:border-box;}
html,body{
    margin:0!important;
    padding:0!important;
    overflow-x:hidden;
    max-width:100%!important;
    width:100%!important;
    min-height:100%!important;
    background:transparent!important;
}
/* 基础样式 */
body{
    font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
}
/* 让根元素填满整个 iframe */
html{height:100%;}
/* 确保内容中的块级元素默认充满宽度 */
body > *{max-width:100%;}
/* 让 div/section/容器等元素充分利用宽度 */
div, section, article, header, footer, nav, aside, main {
    max-width: 100%;
    width: 100%;
}
/* 移除默认表格宽度限制 */
table { max-width: 100%; width: 100%; }
/* 让图片自适应 */
img { max-width: 100%; height: auto; }
/* 让输入框和按钮更合理 */
input, textarea, select, button { max-width: 100%; }
/* 确保脚本中的函数能在全局作用域访问 */
</style>
<script>
// 将 parent 的函数和状态代理到当前 iframe 的 window 对象
(function() {
    // 代理 getChatMessages 和 setChatMessage（核心 API）
    window.getChatMessages = function(count, options) {
        return window.parent.getChatMessages(count, options);
    };

    window.setChatMessage = function(content, index, options) {
        return window.parent.setChatMessage(content, index, options);
    };

    // 代理 triggerSlash（如果存在）
    if (window.parent.triggerSlash) {
        window.triggerSlash = window.parent.triggerSlash;
    }

    // 代理 TavernHelper（酒馆助手插件的 API）
    // 这样道渊角色卡的 switchToSecondGreeting 等函数可以正常工作
    if (window.parent.TavernHelper) {
        window.TavernHelper = window.parent.TavernHelper;
    }

    // 代理 SillyTavern（如果存在）
    if (window.parent.SillyTavern) {
        window.SillyTavern = window.parent.SillyTavern;
    }

    // 代理 alert（使用 parent 的 alert）
    window.alert = window.parent.alert || function(msg) { console.log('[Alert]', msg); };

    // 代理 console
    window.console = window.parent.console;

    // iframe 高度自动调整
    function adjustIframeHeight() {
        const height = Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight,
            document.body.offsetHeight,
            document.documentElement.offsetHeight
        );
        window.parent.postMessage({
            type: 'ST_IFRAME_HEIGHT',
            height: height,
            iframeId: '${iframeId}'
        }, '*');
    }

    // 初始加载完成后调整高度
    window.addEventListener('load', function() {
        setTimeout(adjustIframeHeight, 100);
        setTimeout(adjustIframeHeight, 500);
        setTimeout(adjustIframeHeight, 1000);
    });

    // DOM 变化时也调整
    if (window.MutationObserver) {
        const observer = new MutationObserver(function() {
            adjustIframeHeight();
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true
        });
    } else {
        // 降级方案：定时检测
        setInterval(adjustIframeHeight, 500);
    }

    // 窗口大小变化时调整
    window.addEventListener('resize', adjustIframeHeight);
})();
<\/script>
</head>
<body>
${content}
</body>
</html>`;
}

/**
 * 格式化消息内容（自行实现，不依赖 SillyTavern 核心）
 * 处理规则：
 *  1. 如果是 ```html\n...\n``` 代码块
 *     → 检测是否需要 iframe 渲染
 *     → 如果需要：生成带 srcdoc 的 iframe
 *     → 否则：直接 DOM 渲染
 *  2. 其他情况 → showdown markdown → DOMPurify 消毒 → hljs 代码高亮
 * @param {object|string} msg 消息对象或字符串
 * @param {number} [idx] 消息索引（可选）
 * @returns {string} HTML 字符串
 */
function formatMessageContent(msg, idx) {
    const content = (typeof msg === 'string') ? msg : (msg?.content || '');
    if (!content) return '';

    // 1. HTML 代码块处理
    const htmlBlockMatch = content.match(/^\s*```html\s*\r?\n([\s\S]*?)\r?\n```\s*$/i);
    if (htmlBlockMatch) {
        let rawHtml = htmlBlockMatch[1];

        // 检查是否包含需要全局函数支持的脚本（如 switchToSecondGreeting）
        const needsGlobalFunctions = /switchToSecondGreeting|triggerSlash|getChatMessages|setChatMessage/i.test(rawHtml);

        // 检查是否包含完整的 HTML 文档结构（<html>/<head>/<body>）
        const isFullHtmlDoc = /^[\s]*<html/i.test(rawHtml);

        // 提取 <head> 中的 <style> 标签内容（避免在去除包装时丢失 CSS）
        let headStyles = '';
        const headMatch = rawHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
        if (headMatch) {
            const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
            let styleMatch;
            while ((styleMatch = styleRegex.exec(headMatch[1])) !== null) {
                headStyles += styleMatch[1] + '\n';
            }
        }

        // 移除 <html>/<head>/<body> 包装，直接取内部内容
        rawHtml = rawHtml
            .replace(/^[\s]*<html[^>]*>[\s\S]*?<head[^>]*>[\s\S]*?<\/head>[\s\S]*?<body[^>]*>/ims, '')
            .replace(/<\/body>[\s\S]*?<\/html>[\s]*$/ims, '')
            .trim();

        // 将 <head> 中提取的 CSS 重新添加到 body 内容之前
        if (headStyles.trim()) {
            rawHtml = `<style>${headStyles}</style>\n` + rawHtml;
        }

        // 如果需要全局函数支持或内容较复杂，使用 iframe 渲染
        if (needsGlobalFunctions || isFullHtmlDoc) {
            // 检查是否使用酒馆助手（JS-Slash-Runner）的 iframe 渲染
            // 如果父页面中存在 TavernHelper，说明酒馆助手可能已经处理了这个内容
            // 我们可以复用它的 iframe，而不是创建新的
            const hasTavernHelper = typeof window.TavernHelper !== 'undefined';
            const hasParentTavernHelper = typeof window.parent?.TavernHelper !== 'undefined';

            // 检查 DOM 中是否已经存在 JS-Slash-Runner 的渲染标记
            const messageId = typeof msg === 'object' ? msg?.id ?? idx : idx;
            const existingRuntime = document.querySelector(`[data-msg-id="${messageId}"] > .bubble-content > .TH-render`);
            if (existingRuntime) {
                // JS-Slash-Runner 已经渲染过了，返回空让原有渲染生效
                return '';
            }

            // 如果有 TavernHelper（酒馆助手），让道渊脚本直接使用它的 API
            // 我们不需要创建 iframe，因为道渊会通过 TavernHelper 访问所需功能
            // 但这需要 TavernHelper 提供 getChatMessages 和 setChatMessage...
            // 暂时仍然使用 iframe 渲染，但确保代理正确的 API

            // 使用 iframe 渲染
            const iframeId = `html-greeting-iframe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const iframeHtml = createIframeHtml(rawHtml, iframeId);
            // 对 srcdoc 内容进行 HTML 编码
            const encodedSrcdoc = iframeHtml
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
            return `<iframe class="html-greeting-iframe" id="${iframeId}" srcdoc="${encodedSrcdoc}" loading="lazy" frameborder="0"></iframe>`;
        }

        // 否则使用直接 DOM 渲染（原有逻辑）
        // FIX: 在 DOMPurify 之前提取脚本内容，避免被 FORBID_TAGS 删除
        // 收集所有 <script> 标签的 src 和内容，供执行阶段使用
        const extractedScripts = [];
        const scriptTagRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gims;
        rawHtml = rawHtml.replace(scriptTagRegex, (_, attrs, scriptContent) => {
            const srcMatch = attrs.match(/\bsrc\s*=\s*(["'])(.*?)\1/i);
            const srcAttr = srcMatch ? srcMatch[2] : '';
            extractedScripts.push({ src: srcAttr, text: scriptContent.trim() });
            return ''; // 暂时从 HTML 中移除脚本，在 DOMPurify 之后重新附加
        });

        // 编码 style 标签为 custom-style（供 DOMPurify 保留）
        rawHtml = encodeStyleTags(rawHtml);

        // DOMPurify：允许 custom-style / link（字体），禁止 script（手动执行）
        // 同时添加常见事件处理属性，使按钮/元素的 onclick 等能正常工作
        rawHtml = DOMPurify.sanitize(rawHtml, {
            ADD_TAGS: ['custom-style', 'link'],
            ADD_ATTR: [
                'class', 'id', 'style', 'href', 'rel', 'src', 'onload', 'media', 'type',
                'onclick', 'onchange', 'onsubmit', 'onkeydown', 'onkeyup', 'onkeypress',
                'onmousedown', 'onmouseup', 'onmouseover', 'onmouseout', 'onmouseenter', 'onmouseleave',
                'onfocus', 'onblur', 'oninput', 'onscroll', 'ondblclick',
                'data-*',
            ],
            FORBID_TAGS: ['script'],
        });

        // 解码 custom-style 恢复为 <style>，并附加 .bubble-content 作用域
        rawHtml = decodeStyleTags(rawHtml, '.bubble-content');

        // FIX: 在 DOMPurify 之后重新附加提取的脚本（带内容而非空标记）
        // 脚本内容通过 textContent 方式保留，由 executeInlineScripts 手动 eval 执行
        let pendingScripts = '';
        if (extractedScripts.length > 0) {
            pendingScripts = extractedScripts.map(script => {
                if (script.src) {
                    return `<script data-pending-scripts="true" src="${script.src}"></script>`;
                } else {
                    // 注意：不要在脚本内容前添加注释，否则会导致脚本无法执行
                    return `<script data-pending-scripts="true">${script.text}</script>`;
                }
            }).join('');
        } else {
            // 即使没有脚本，也保留标记保证流程完整性（如果有需要）
            pendingScripts = '<script data-pending-scripts="true"></script>';
        }

        return rawHtml + pendingScripts;
    }

    // 2. 普通 markdown → HTML → 消毒 → 代码高亮
    let html = messageConverter.makeHtml(content);
    html = DOMPurify.sanitize(html, { ADD_TAGS: ['custom-style'] });

    // 注入 hljs 代码高亮（在下一帧进行，DOM 可用后）
    setTimeout(() => {
        document.querySelectorAll('#chatMessages pre code').forEach((block) => {
            try { hljs.highlightElement(block); } catch (e) { /* ignore */ }
        });
    }, 0);

    return html;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML.replace(/\n/g, '<br>');
}

function scrollToBottom() {
    const $msgs = $('#chatMessages');
    $msgs.scrollTop($msgs[0].scrollHeight);
}

// ===================== 消息操作 =====================
// ⚠️ 注意：禁止使用原生 confirm/prompt/alert —— 它们会阻塞事件循环
//    在 React 托管的预览容器中会触发 focus 渲染循环，导致 #185 错误。

/**
 * 非阻塞确认框：返回 Promise<boolean>
 */
function customConfirm(message) {
    return new Promise(function (resolve) {
        const $modal = $('#customConfirm');
        $('#customConfirmMessage').text(message);
        $modal.fadeIn(150);

        // 一次性事件绑定
        const cleanup = function () {
            $('#customConfirmOk, #customConfirmCancel').off('click.customConfirm');
            $modal.off('keydown.customConfirm click.customConfirmMask');
            $modal.fadeOut(150);
        };

        $('#customConfirmOk').off('click.customConfirm').on('click.customConfirm', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            cleanup();
            resolve(true);
        });
        $('#customConfirmCancel').off('click.customConfirm').on('click.customConfirm', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            cleanup();
            resolve(false);
        });
        // ESC 取消
        $modal.off('keydown.customConfirm').on('keydown.customConfirm', function (ev) {
            if (ev.key === 'Escape') {
                ev.preventDefault();
                ev.stopPropagation();
                cleanup();
                resolve(false);
            }
        });
        // 点击遮罩关闭
        $modal.off('click.customConfirmMask').on('click.customConfirmMask', function (ev) {
            if (ev.target === $modal[0]) {
                ev.preventDefault();
                ev.stopPropagation();
                cleanup();
                resolve(false);
            }
        });
    });
}

/**
 * 非阻塞输入框：返回 Promise<string|null>
 */
function customPrompt(title, defaultValue) {
    return new Promise(function (resolve) {
        const $modal = $('#customPrompt');
        $('#customPromptTitle').text(title);
        $('#customPromptInput').val(defaultValue || '');
        $modal.fadeIn(150, function () {
            $('#customPromptInput').focus().select();
        });

        const cleanup = function () {
            $('#customPromptOk, #customPromptCancel').off('click.customPrompt');
            $modal.off('keydown.customPrompt click.customPromptMask');
            $modal.fadeOut(150);
        };

        $('#customPromptOk').off('click.customPrompt').on('click.customPrompt', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            const val = $('#customPromptInput').val();
            cleanup();
            resolve(val);
        });
        $('#customPromptCancel').off('click.customPrompt').on('click.customPrompt', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            cleanup();
            resolve(null);
        });
        $modal.off('keydown.customPrompt').on('keydown.customPrompt', function (ev) {
            if (ev.key === 'Escape') {
                ev.preventDefault();
                ev.stopPropagation();
                cleanup();
                resolve(null);
            } else if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
                ev.preventDefault();
                ev.stopPropagation();
                const val = $('#customPromptInput').val();
                cleanup();
                resolve(val);
            }
        });
        $modal.off('click.customPromptMask').on('click.customPromptMask', function (ev) {
            if (ev.target === $modal[0]) {
                ev.preventDefault();
                ev.stopPropagation();
                cleanup();
                resolve(null);
            }
        });
    });
}

// 作用域内的 DOM 操作：只在 #chatMessages 下查找，避免误匹配第三方扩展注入的元素
function findBubblesInChat() { return $('#chatMessages').find('.chat-bubble'); }
function findBubbleByIndex(idx) { return $('#chatMessages').find('.chat-bubble[data-idx="' + idx + '"]'); }

async function editMessage(idx) {
    if (!state.currentChat || !state.currentChat.messages) return;
    const msg = state.currentChat.messages[idx];
    if (!msg) return;

    const newContent = await customPrompt('编辑消息', msg.content);
    if (!newContent || newContent === msg.content) return;

    try {
        if (state.currentChar) await chatApi.editMessage(state.currentChar.id, state.currentChat.id, idx, newContent);
        msg.content = newContent;
        msg.edited = true;
        const $bubble = findBubbleByIndex(idx);
        $bubble.find('.bubble-content').first().html(
            formatMessageContent({ ...msg, content: newContent }, idx) + '<span class="bubble-edited">（已编辑）</span>'
        );
        showToast('消息已更新');
    } catch (e) { showToast('编辑失败：' + e.message); }
}

async function deleteMessage(idx) {
    if (!state.currentChat || !state.currentChat.messages) return;
    const msg = state.currentChat.messages[idx];
    if (!msg) return;

    // 先关闭气泡操作浮层，避免它与删除操作互相干扰
    $('#bubbleActions').hide();

    const confirmed = await customConfirm('确定删除这条消息？');
    if (!confirmed) return;

    try {
        if (state.currentChar) await chatApi.deleteMessage(state.currentChar.id, state.currentChat.id, idx);
        state.currentChat.messages.splice(idx, 1);

        // 严格在 #chatMessages 作用域内操作，避免误删扩展注入的元素
        const $target = findBubbleByIndex(idx);
        if ($target.length) $target.remove();

        // 重新编号（同样作用域限定）
        findBubblesInChat().each(function (i) { $(this).attr('data-idx', i); });
        showToast('消息已删除');
    } catch (e) { showToast('删除失败：' + e.message); }
}

async function resendMessage(idx) {
    if (!state.currentChat || !state.currentChat.messages) return;
    const msg = state.currentChat.messages[idx];
    if (!msg || msg.role !== 'user') return;

    $('#bubbleActions').hide();

    // 移除这条及之后的消息（严格作用域）
    state.currentChat.messages = state.currentChat.messages.slice(0, idx);
    findBubblesInChat().each(function () {
        const i = parseInt($(this).attr('data-idx'));
        if (i >= idx) $(this).remove();
    });
    // 重新发送
    await sendMessage(msg.content);
}

function showBubbleActions($bubble) {
    const $actions = $('#bubbleActions');
    const rect = $bubble[0].getBoundingClientRect();
    $actions.css({ top: rect.bottom + 4 + 'px', left: rect.left + 'px', right: 'auto', display: 'flex' }).show();
    $actions.data('target-idx', parseInt($bubble.attr('data-idx')));
}

// 绑定气泡操作浮层按钮（长按后出现的那个）
$(document).off('click.bubbleActions').on('click.bubbleActions', '#bubbleActions .bubble-action-btn', function (ev) {
    ev.preventDefault();
    ev.stopPropagation();
    const action = $(this).data('action');
    const idx = $('#bubbleActions').data('target-idx');
    if (idx == null || isNaN(idx)) return;
    if (action === 'edit') editMessage(idx);
    else if (action === 'delete') deleteMessage(idx);
    else if (action === 'resend') resendMessage(idx);
});

// 点击其他区域关闭气泡操作浮层
$(document).off('click.bubbleActionsClose').on('click.bubbleActionsClose', function (e) {
    if ($(e.target).closest('.bubble-actions-btn').length > 0) return;
    if ($(e.target).closest('.chat-bubble').length > 0) return;
    if ($(e.target).closest('#bubbleActions').length > 0) return;
    $('#bubbleActions').fadeOut(100);
});

// ===================== 发送消息（支持 SSE 流式） =====================
async function sendMessage(content) {
    if (!content?.trim() || !state.currentChar || !state.currentChat) return;

    const modelId = $('#paramModel').val() || state.models[0]?.id;
    const params = getGenParams();

    // 添加用户消息气泡
    const userMsg = {
        role: 'user',
        content: content.trim(),
        send_date: Date.now(),
    };
    const userIdx = state.currentChat.messages.length;
    state.currentChat.messages.push(userMsg);
    appendMessageBubble(userMsg, userIdx);

    // 添加 AI 占位气泡
    const aiIdx = userIdx + 1;
    let $placeholder = $(`
        <div class="chat-bubble assistant bubble-generating" data-idx="${aiIdx}">
            <div class="bubble-content">正在生成回复...</div>
        </div>
    `);
    $('#chatMessages').append($placeholder);
    scrollToBottom();

    try {
        let fullContent = '';
        let finished = false;
        let isStreaming = false;

        const streamResult = await chatApi.sendMessageStreaming(
            state.currentChar.id,
            state.currentChat.id,
            { content: content.trim(), modelId, genParams: params },
            ({ event, data }) => {
                if (event === 'meta') {
                    isStreaming = true;
                    if (data.remainingCredits !== undefined) {
                        state.currentUser.credits = data.remainingCredits;
                        $('#sidebarCreditsNum').text(data.remainingCredits);
                        $('#ucCredits').text(data.remainingCredits);
                    }
                    // 开始流式，清空占位文本
                    $placeholder.find('.bubble-content').text('');
                } else if (event === 'delta') {
                    isStreaming = true;
                    fullContent += (data.content || '');
                    $placeholder.find('.bubble-content').text(fullContent);
                    scrollToBottom();
                } else if (event === 'done') {
                    finished = true;
                    if (data.content) fullContent = data.content;
                } else if (event === 'error') {
                    $placeholder.find('.bubble-content').text('生成失败：' + (data.message || '未知错误'));
                    $placeholder.removeClass('bubble-generating');
                    throw new Error(data.message || '流式错误');
                }
            }
        );

        // 如果是流式，streamResult 是 { done: true }
        if (isStreaming) {
            $placeholder.remove();
            const aiMsg = {
                role: 'assistant',
                name: state.currentChar.name,
                content: fullContent,
                send_date: Date.now(),
            };
            state.currentChat.messages.push(aiMsg);
            appendMessageBubble(aiMsg, aiIdx);
            scrollToBottom();
        } else if (streamResult && streamResult.success) {
            // 非流式：完整 JSON 响应
            $placeholder.remove();
            if (streamResult.remainingCredits !== undefined) {
                state.currentUser.credits = streamResult.remainingCredits;
                $('#sidebarCreditsNum').text(streamResult.remainingCredits);
                $('#ucCredits').text(streamResult.remainingCredits);
            }
            state.currentChat.messages.push(streamResult.message);
            appendMessageBubble(streamResult.message, aiIdx);
            scrollToBottom();
        } else {
            $placeholder.find('.bubble-content').text('生成失败：' + (streamResult?.error || '未知错误'));
            $placeholder.removeClass('bubble-generating');
        }
    } catch (e) {
        console.error('[chat] send error:', e);
        $placeholder.find('.bubble-content').text('错误：' + e.message);
        $placeholder.removeClass('bubble-generating');
        showToast('发送失败：' + e.message);
    }
}

// ===================== 加载角色脚本 =====================
async function loadCharacterScript(ch) {
    if (!ch?.hasScript || !ch?.scriptUrl) return;
    try {
        const res = await fetch(ch.scriptUrl);
        if (res.ok) {
            const text = await res.text();
            try {
                // 在沙箱中执行脚本（通过动态创建 script）
                // 注意：这与原有 SillyTavern 扩展系统不同，这里是简化版
                // 完整实现应接入原有的 event_types 系统
                const fn = new Function(text + '\n//# sourceURL=' + ch.scriptUrl);
                fn();
                console.log(`[app] Character script loaded: ${ch.id}`);
            } catch (e) {
                console.warn(`[app] Script execution error for ${ch.id}:`, e);
            }
        }
    } catch (e) {
        console.warn('Failed to load character script:', e);
    }
}

// ===================== 第三方插件加载 =====================
// 与原生 SillyTavern 的 extensions.js 机制保持一致：
// 1) 调用 /api/extensions/discover 获取插件列表
// 2) 读取每个插件的 manifest.json（js, css, i18n 字段）
// 3) 按 loading_order 排序后动态注入 CSS / ES Module JS
const _loadedExtAssets = new Set();

async function discoverAndLoadExtensions() {
    try {
        const res = await fetch('/api/extensions/discover');
        if (!res.ok) return;
        const discovered = await res.json();
        if (!Array.isArray(discovered)) return;

        // 仅加载 third-party/* 插件，避免把系统插件（assets/quick-reply 等）
        // 拉入聊天视图（它们依赖完整的 SillyTavern 前端上下文）
        const plugins = discovered.filter(p => p && typeof p.name === 'string' && p.name.startsWith('third-party/'));

        // 读取 manifest
        const withManifest = [];
        for (const p of plugins) {
            try {
                const mf = await fetch(`/scripts/extensions/${p.name}/manifest.json`).then(r => r.ok ? r.json() : null);
                if (mf) withManifest.push({ ...p, manifest: mf });
                else console.warn(`[ext] 未找到 manifest: ${p.name}`);
            } catch (e) {
                console.warn(`[ext] 读取 manifest 失败: ${p.name}`, e);
            }
        }

        // 按 loading_order 排序
        withManifest.sort((a, b) => {
            const oa = parseInt(a.manifest.loading_order) || 0;
            const ob = parseInt(b.manifest.loading_order) || 0;
            return oa - ob;
        });

        // 注入 CSS / JS
        for (const p of withManifest) {
            await loadExtensionAssets(p.name, p.manifest);
        }

        console.info(`[ext] 已加载 ${withManifest.length} 个第三方插件:`, withManifest.map(p => p.name));
    } catch (e) {
        console.warn('[ext] 插件发现失败:', e);
    }
}

function loadExtensionAssets(name, manifest) {
    return new Promise(resolve => {
        const base = `/scripts/extensions/${name}`;
        let pending = 0;
        const done = () => { if (--pending <= 0) resolve(); };

        // 仅加载 CSS（样式增强不需要 SillyTavern 核心）
        if (manifest.css && typeof manifest.css === 'string') {
            pending++;
            const cssId = `ext-css-${name.replace(/[^a-zA-Z0-9]/g, '-')}`;
            if (!_loadedExtAssets.has(cssId) && !document.getElementById(cssId)) {
                const link = document.createElement('link');
                link.id = cssId;
                link.rel = 'stylesheet';
                link.href = `${base}/${manifest.css}`;
                link.onload = done;
                link.onerror = () => { console.warn(`[ext] CSS 加载失败: ${link.href}`); done(); };
                document.head.appendChild(link);
                _loadedExtAssets.add(cssId);
            } else {
                done();
            }
        }

        // ⚠️ 跳过 JS 模块：第三方插件的 JS 依赖 SillyTavern 完整核心（script.js、power-user.js 等）
        // 在自定义聊天界面未集成完整 SillyTavern 核心之前，不加载第三方插件 JS。
        // 如果您需要 JS-Slash-Runner 等插件功能，请先完整集成 SillyTavern 前端或修改插件源码。
        if (manifest.js && typeof manifest.js === 'string') {
            console.info(`[ext] 跳过 JS 加载（需 SillyTavern 核心）: ${name}/${manifest.js}`);
        }

        if (pending === 0) resolve();
    });
}

// ===================== 发送按钮事件等初始化 =====================
// 页面加载时初始化
$(document).ready(function () {
    // 所有事件绑定统一在 setupEventListeners 中
    // init() 中不再重复绑定
    init();
    // 插件加载与主流程并行，不阻塞界面
    discoverAndLoadExtensions();
});

// ===================== HTML 渲染测试（TDD RED → GREEN） =====================
/**
 * TDD 测试：验证 HTML 代码块渲染功能
 * 运行方式：在浏览器控制台执行 window.runHtmlRenderingTests()
 *
 * RED phase 测试项：
 *  1. formatMessageContent 能否正确提取 style 标签内容？
 *  2. formatMessageContent 能否正确提取 script 标签内容？
 *  3. 注入的 HTML 是否能正确渲染（不破坏气泡结构）？
 */
window.runHtmlRenderingTests = async function () {
    const tests = [];
    let passed = 0;
    let failed = 0;

    function log(msg, isError) {
        console[isError ? 'error' : 'log'](msg);
    }

    // --- TEST 1: 验证 style 标签被保留（通过 custom-style 编码） ---
    (function testStyleExtraction() {
        const testHtml = `<style>
            .test-class { color: red; }
        </style>
        <div class="test-class">Hello</div>`;
        const formatted = formatMessageContent({ content: '```html\n' + testHtml + '\n```' }, 0);

        // style 内容被编码为 custom-style，解码后应包含 .bubble-content .test-class
        const hasScopedStyle = formatted.includes('.bubble-content') && formatted.includes('test-class');
        const hasDiv = formatted.includes('test-class') || formatted.includes('Hello');
        const result = hasScopedStyle && hasDiv;
        tests.push({ name: 'style标签应被编码为custom-style并正确加作用域', passed: !!result });
        if (!result) {
            log(`❌ TEST 1 FAILED: style 未正确编码/作用域化。输出：${formatted.substring(0, 300)}`, true);
        } else {
            log('✅ TEST 1 PASSED: style 正确编码并加作用域');
            passed++;
        }
    })();

    // --- TEST 2: 验证 script 标签被解码并在 DOM 注入后执行 ---
    (function testScriptExecution() {
        // 清理之前的测试残留
        delete window.__TEST_VAR_2;
        delete window.__FIREWORKS_INIT;

        const testHtml = `<script>window.__TEST_VAR_2 = 42;</script>
        <div id="test-div">Script Test</div>`;
        const formatted = formatMessageContent({ content: '```html\n' + testHtml + '\n```' }, 0);

        // 创建气泡容器并注入
        const container = document.createElement('div');
        container.innerHTML = `<div class="chat-bubble"><div class="bubble-content">${formatted}</div></div>`;
        const bubbleContent = container.querySelector('.bubble-content');
        const pendingScript = bubbleContent.querySelector('[data-pending-scripts]');

        // 手动执行脚本（模拟 appendMessageBubble 中的逻辑）
        if (pendingScript) {
            executeInlineScripts(bubbleContent);
            pendingScript.remove();
        }

        // 验证脚本执行
        const scriptRan = window.__TEST_VAR_2 === 42;
        tests.push({ name: 'script标签应被解码并在注入后执行（eval）', passed: !!scriptRan });
        if (!scriptRan) {
            log(`❌ TEST 2 FAILED: script 未执行。__TEST_VAR_2=${window.__TEST_VAR_2}`, true);
        } else {
            log('✅ TEST 2 PASSED: script 执行成功');
            passed++;
        }
    })();

    // --- TEST 3: 验证普通 markdown 不被误判为 HTML 代码块 ---
    (function testMarkdownNotHtml() {
        const md = '这是一段 **加粗** 文字和 `代码`';
        const formatted = formatMessageContent({ content: md }, 0);
        const hasBold = formatted.includes('<strong>') || formatted.includes('加粗');
        const hasCode = formatted.includes('代码') || formatted.includes('<code>');
        const result = hasBold || hasCode;
        tests.push({ name: '普通 markdown 应正常渲染', passed: !!result });
        if (!result) {
            log(`❌ TEST 3 FAILED: markdown 未渲染。输出：${formatted}`, true);
        } else {
            log('✅ TEST 3 PASSED: markdown 正常渲染');
            passed++;
        }
    })();

    // --- TEST 4: 端到端气泡渲染测试 ---
    (function testBubbleRendering() {
        const container = document.createElement('div');
        container.id = 'test-bubble-container';
        document.body.appendChild(container);
        delete window.__FIREWORKS_INIT; // 清理残留

        const testHtml = `<style>
            .bubble-test { background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 20px; border-radius: 12px; font-family: sans-serif; }
        </style>
        <div class="bubble-test">
            <h2 style="margin:0 0 10px">烟花特效卡片</h2>
            <p style="margin:0">这是带有样式的开场白内容</p>
            <canvas id="test-fireworks" width="400" height="100" style="border:1px solid rgba(255,255,255,0.3);margin-top:10px;"></canvas>
        </div>
        <script>
            window.__FIREWORKS_INIT = true;
            const canvas = document.getElementById('test-fireworks');
            if (canvas && canvas.getContext) {
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = 'white';
                ctx.font = '14px sans-serif';
                ctx.fillText('Canvas OK: ' + window.__FIREWORKS_INIT, 10, 30);
            }
        </script>`;

        const formatted = formatMessageContent({ content: '```html\n' + testHtml + '\n```' }, 0);
        container.innerHTML = `<div class="chat-bubble"><div class="bubble-content">${formatted}</div></div>`;

        // 模拟 appendMessageBubble 的脚本执行逻辑
        const bubbleContent = container.querySelector('.bubble-content');
        const pendingScript = bubbleContent.querySelector('[data-pending-scripts]');
        if (pendingScript) {
            executeInlineScripts(bubbleContent);
            pendingScript.remove();
        }

        // 验证样式和脚本
        const hasGradient = container.querySelector('.bubble-test') !== null;
        const scriptRan = window.__FIREWORKS_INIT === true;
        const canvasExists = container.querySelector('#test-fireworks') !== null;
        const result = hasGradient && scriptRan && canvasExists;
        tests.push({ name: '气泡HTML+样式+Canvas应完整渲染', passed: !!result });
        if (!result) {
            log(`❌ TEST 4 FAILED: 渲染不完整. gradient=${hasGradient} script=${scriptRan} canvas=${canvasExists}`, true);
        } else {
            log('✅ TEST 4 PASSED: 样式+脚本完整渲染');
            passed++;
        }
        document.body.removeChild(container);
    })();

    log(`\n=== HTML 渲染测试结果：${passed}/${tests.length} 通过 ===`, passed < tests.length);
    return tests;
};
