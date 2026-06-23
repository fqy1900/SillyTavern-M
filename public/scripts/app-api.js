// app-api.js — 前端 API 客户端，统一封装所有后端请求

class ApiClient {
    constructor(baseUrl = '') {
        this.baseUrl = baseUrl;
        this._csrfToken = '';
        this._csrfPromise = null;
    }

    /**
     * 获取并缓存 CSRF Token。可重复调用，只发起一次实际请求。
     */
    async ensureCsrfToken() {
        if (this._csrfPromise) return this._csrfPromise;
        this._csrfPromise = (async () => {
            try {
                const res = await fetch(this.baseUrl + '/csrf-token');
                const data = await res.json();
                this._csrfToken = data.token || '';
            } catch (e) {
                this._csrfToken = '';
            }
        })();
        return this._csrfPromise;
    }

    async request(method, path, body, options = {}) {
        const url = this.baseUrl + path;
        const headers = { 'Content-Type': 'application/json', ...options.headers };
        const cfg = { method, headers };

        // 状态变更请求自动携带 CSRF Token
        if (method !== 'GET' && method !== 'HEAD' && this._csrfToken) {
            headers['x-csrf-token'] = this._csrfToken;
        }

        if (body !== undefined && body !== null) {
            cfg.body = JSON.stringify(body);
        }
        const res = await fetch(url, cfg);
        if (!res.headers.get('content-type')?.includes('json')) {
            throw new Error(`服务器返回非 JSON 响应 (${res.status})`);
        }
        const data = await res.json();
        if (!res.ok && !data.success) {
            const msg = data.error || `请求失败 (${res.status})`;
            const err = new Error(msg);
            err.status = res.status;
            throw err;
        }
        return data;
    }

    /**
     * SSE 流式请求：读取 text/event-stream 事件
     * onEvent({ event, data, lastEventId })
     * event: meta / delta / done / error
     */
    async requestStream(method, path, body, onEvent) {
        const url = this.baseUrl + path;
        const headers = { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' };
        const cfg = { method, headers };
        if (body !== undefined && body !== null) {
            cfg.body = JSON.stringify(body);
        }
        const res = await fetch(url, cfg);
        const isStream = res.headers.get('content-type')?.includes('text/event-stream');

        if (!res.ok) {
            let msg = `请求失败 (${res.status})`;
            if (!isStream) {
                try {
                    const data = await res.json();
                    msg = data.error || msg;
                } catch (_) {}
            }
            throw new Error(msg);
        }

        // 非流式：直接返回 JSON
        if (!isStream) {
            return await res.json();
        }

        // 流式：读取 ReadableStream
        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let currentEvent = 'message';
        let currentData = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            // SSE 解析：每行以 \n 分隔，空行分隔事件
            let lineStart = 0;
            while (lineStart < buffer.length) {
                const lineEnd = buffer.indexOf('\n', lineStart);
                if (lineEnd === -1) break;
                const line = buffer.substring(lineStart, lineEnd);
                lineStart = lineEnd + 1;

                if (line === '') {
                    // 事件结束
                    if (currentData) {
                        try {
                            const parsed = JSON.parse(currentData);
                            onEvent({ event: currentEvent, data: parsed });
                        } catch (e) {
                            onEvent({ event: currentEvent, data: currentData, raw: true });
                        }
                        currentData = '';
                        currentEvent = 'message';
                    }
                } else if (line.startsWith('event:')) {
                    currentEvent = line.substring(6).trim();
                } else if (line.startsWith('data:')) {
                    const chunk = line.substring(5).trim();
                    currentData += chunk;
                }
            }

            // 移除已处理的内容
            if (lineStart > 0) {
                buffer = buffer.substring(lineStart);
            }
        }
        return { done: true };
    }

    get(path, options) { return this.request('GET', path, undefined, options); }
    post(path, body, options) { return this.request('POST', path, body, options); }
    put(path, body, options) { return this.request('PUT', path, body, options); }
    delete(path, body, options) { return this.request('DELETE', path, body, options); }
}

// ---------- Auth API ----------
export const authApi = {
    // 公开
    register(data) { return this._post('/api/auth/register', data); },
    login(data) { return this._post('/api/auth/login', data); },
    status() { return this._get('/api/auth/status'); },
    // 需要登录
    logout() { return this._post('/api/auth/logout'); },
    me() { return this._get('/api/auth/me'); },
    updateProfile(data) { return this._post('/api/auth/profile', data); },
    changePassword(data) { return this._post('/api/auth/password', data); },
    getCredits() { return this._get('/api/auth/credits'); },
    getConsumption(page = 1, pageSize = 20) {
        return this._get(`/api/auth/consumption?page=${page}&pageSize=${pageSize}`);
    },
    // 内部
    _get(path) { return api.get(path); },
    _post(path, data) { return api.post(path, data); },
};

// ---------- Chat API ----------
export const chatApi = {
    // 公开
    getCharacters() { return this._get('/api/chat/characters'); },
    getCharacter(id) { return this._get(`/api/chat/character/${encodeURIComponent(id)}`); },
    getModels() { return this._get('/api/chat/models'); },
    // 需要登录
    getChats(charId) {
        return this._get(`/api/chat/chats/${encodeURIComponent(charId)}`);
    },
    getChat(charId, chatId) {
        return this._get(`/api/chat/chat/${encodeURIComponent(charId)}/${encodeURIComponent(chatId)}`);
    },
    createChat(charId) {
        return this._post(`/api/chat/chat/${encodeURIComponent(charId)}/create`);
    },
    sendMessage(charId, chatId, { content, modelId, genParams }) {
        return this._post(
            `/api/chat/chat/${encodeURIComponent(charId)}/${encodeURIComponent(chatId)}/send`,
            { content, modelId, genParams }
        );
    },
    /**
     * 流式发送消息（SSE）
     * onEvent(event, data) - event: 'meta' | 'delta' | 'done' | 'error'
     * 返回 Promise，如果是流式返回 { streaming: true }，否则返回完整 JSON
     */
    sendMessageStreaming(charId, chatId, { content, modelId, genParams }, onEvent) {
        return api.requestStream(
            'POST',
            `/api/chat/chat/${encodeURIComponent(charId)}/${encodeURIComponent(chatId)}/send`,
            { content, modelId, genParams },
            onEvent
        );
    },
    editMessage(charId, chatId, messageIndex, newContent) {
        return this._post(
            `/api/chat/chat/${encodeURIComponent(charId)}/${encodeURIComponent(chatId)}/edit-message`,
            { messageIndex, newContent }
        );
    },
    deleteMessage(charId, chatId, messageIndex) {
        return this._post(
            `/api/chat/chat/${encodeURIComponent(charId)}/${encodeURIComponent(chatId)}/delete-message`,
            { messageIndex }
        );
    },
    resendMessage(charId, chatId, messageIndex, { modelId, genParams }) {
        return this._post(
            `/api/chat/chat/${encodeURIComponent(charId)}/${encodeURIComponent(chatId)}/resend`,
            { messageIndex, modelId, genParams }
        );
    },
    deleteChat(charId, chatId) {
        return this._post(`/api/chat/chat/${encodeURIComponent(charId)}/${encodeURIComponent(chatId)}/delete`);
    },
    saveChatSettings(charId, chatId, { background, modelId }) {
        return this._post(
            `/api/chat/chat/${encodeURIComponent(charId)}/${encodeURIComponent(chatId)}/settings`,
            { background, modelId }
        );
    },
    // 内部
    _get(path) { return api.get(path); },
    _post(path, data) { return api.post(path, data); },
};

const api = new ApiClient();
export default api;
