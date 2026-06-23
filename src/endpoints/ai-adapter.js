// ai-adapter.js — 统一的多后端 AI 适配器
// 支持：OpenAI (兼容) / Anthropic / DeepSeek / Ollama / 本地
// 对外暴露统一接口：generate(model, systemPrompt, messages, genParams)

import fs from 'node:fs';
import path from 'node:path';
import { serverDirectory } from '../server-directory.js';
import { color } from '../util.js';

// ---------- 配置：模型配置文件路径 ----------
const MODELS_CONFIG_FILE = path.join(serverDirectory, 'data', 'models.json');

// 默认模型（当配置文件为空或未配置时使用）
const DEFAULT_MODEL_CONFIGS = [
    {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        provider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        costPerToken: 0.001,
        supportsStreaming: true,
        description: 'OpenAI GPT-4o Mini，速度快、成本低',
    },
    {
        id: 'claude-3-5-sonnet',
        name: 'Claude 3.5 Sonnet',
        provider: 'anthropic',
        baseUrl: 'https://api.anthropic.com/v1',
        costPerToken: 0.003,
        supportsStreaming: true,
        description: 'Anthropic Claude 3.5 Sonnet，推理与长文本能力强',
    },
    {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        provider: 'google',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        costPerToken: 0.0003,
        supportsStreaming: true,
        description: 'Google Gemini 2.5 Flash，成本最低',
    },
    {
        id: 'deepseek-chat',
        name: 'DeepSeek Chat',
        provider: 'openai',
        baseUrl: 'https://api.deepseek.com/v1',
        costPerToken: 0.0007,
        supportsStreaming: true,
        description: 'DeepSeek（深度求索）中文能力强，性价比高',
    },
    {
        id: 'ollama-local',
        name: 'Ollama 本地模型',
        provider: 'ollama',
        baseUrl: 'http://127.0.0.1:11434',
        costPerToken: 0.0,
        supportsStreaming: true,
        description: '本地 Ollama，完全免费（需手动安装并启动服务）',
    },
];

// ---------- 工具：加载模型配置 ----------
function loadModelConfigs() {
    try {
        if (fs.existsSync(MODELS_CONFIG_FILE)) {
            const data = JSON.parse(fs.readFileSync(MODELS_CONFIG_FILE, 'utf-8'));
            if (Array.isArray(data) && data.length > 0) {
                return data;
            }
        }
    } catch (e) {
        console.warn(color.yellow(`[ai-adapter] Failed to load models.json: ${e.message}`));
    }
    return DEFAULT_MODEL_CONFIGS;
}

const MODEL_CONFIGS = loadModelConfigs();

// 对外暴露：按 ID 获取模型配置
export function getModelConfig(modelId) {
    return MODEL_CONFIGS.find(m => m.id === modelId) || MODEL_CONFIGS[0];
}

// 对外暴露：列出所有模型
export function listModels() {
    return MODEL_CONFIGS.map(m => ({
        id: m.id,
        name: m.name,
        provider: m.provider,
        costPerToken: m.costPerToken,
        supportsStreaming: m.supportsStreaming,
        description: m.description || '',
    }));
}

// ---------- 工具：估算 token 数 ----------
// 中文每字符约 1-2 token，英文每词约 1 token
// 这里用简单估算：总字符数 * 系数
export function estimateTokenCount(text) {
    if (!text) return 0;
    let chineseCount = 0;
    for (const ch of text) {
        if (ch.charCodeAt(0) > 127) chineseCount++;
    }
    const nonChinese = text.length - chineseCount;
    // 中文按 1.8 token / 字符估算，英文按 0.35 token / 字符估算
    return Math.floor(chineseCount * 1.8 + nonChinese * 0.35);
}

// ---------- 主入口：生成回复 ----------
// 返回值：{ content, totalTokens, promptTokens, completionTokens, usage }
// 流式模式：返回 { stream, cleanup }，stream 是 AsyncIterator，每个 yield 是增量文本
export async function generate(model, systemPrompt, messages, genParams) {
    const config = getModelConfig(model.id || model);
    if (!config) {
        throw new Error(`未找到模型配置: ${model.id || model}`);
    }

    const params = {
        temperature: genParams?.temperature ?? 0.9,
        max_tokens: genParams?.max_tokens ?? 512,
        top_p: genParams?.top_p ?? 0.9,
        frequency_penalty: genParams?.frequency_penalty ?? 0.0,
        presence_penalty: genParams?.presence_penalty ?? 0.0,
        stream: genParams?.streaming ?? false,
    };

    if (config.provider === 'mock') {
        return callMock(config, systemPrompt, messages, params);
    }

    // 如果 provider 是 openai 或兼容格式
    if (config.provider === 'openai') {
        return callOpenAICompatible(config, systemPrompt, messages, params);
    }

    if (config.provider === 'anthropic') {
        return callAnthropic(config, systemPrompt, messages, params);
    }

    if (config.provider === 'ollama') {
        return callOllama(config, systemPrompt, messages, params);
    }

    if (config.provider === 'google') {
        return callGoogle(config, systemPrompt, messages, params);
    }

    // 默认回退到 OpenAI 兼容格式
    console.warn(color.yellow(`[ai-adapter] Unknown provider: ${config.provider}, using OpenAI-compatible fallback`));
    return callOpenAICompatible(config, systemPrompt, messages, params);
}

// ---------- 获取 API Key ----------
// 优先从 process.env 读取，其次从 config 的 apiKey 字段
function getApiKey(config) {
    // 例如：OPENAI_API_KEY、ANTHROPIC_API_KEY、DEEPSEEK_API_KEY、GOOGLE_API_KEY
    const envKeyMap = {
        'openai': 'OPENAI_API_KEY',
        'anthropic': 'ANTHROPIC_API_KEY',
        'google': 'GOOGLE_API_KEY',
        'ollama': '', // 本地不需要
    };
    const envName = envKeyMap[config.provider] || `${config.provider.toUpperCase()}_API_KEY`;
    if (envName && process.env[envName]) {
        return process.env[envName];
    }
    // 从配置文件中读取
    if (config.apiKey) return config.apiKey;

    // 兼容大写版本
    const uppercase = envName?.toUpperCase();
    if (uppercase && process.env[uppercase]) return process.env[uppercase];

    // 返回空字符串，调用方决定如何处理
    return '';
}

// ---------- OpenAI 兼容实现 ----------
async function callOpenAICompatible(config, systemPrompt, messages, params) {
    const apiKey = getApiKey(config);
    if (!apiKey) {
        throw new Error(`缺少 API Key。请设置 ${config.provider.toUpperCase()}_API_KEY 环境变量，或在 models.json 的 ${config.id} 条目中配置 apiKey`);
    }

    // 组装消息
    const bodyMessages = [];
    if (systemPrompt && systemPrompt.trim()) {
        bodyMessages.push({ role: 'system', content: systemPrompt });
    }
    for (const msg of messages) {
        bodyMessages.push(msg);
    }

    const url = config.baseUrl?.replace(/\/$/, '') || 'https://api.openai.com/v1';
    const endpoint = `${url}/chat/completions`;

    if (params.stream) {
        // 流式响应
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: config.modelName || config.id,
                messages: bodyMessages,
                temperature: params.temperature,
                max_tokens: params.max_tokens,
                top_p: params.top_p,
                frequency_penalty: params.frequency_penalty,
                presence_penalty: params.presence_penalty,
                stream: true,
            }),
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`API 调用失败 (${response.status}): ${err}`);
        }

        // 返回流式迭代器
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let fullContent = '';
        let promptTokens = estimateTokenCount(systemPrompt + bodyMessages.map(m => m.content).join(' '));
        let completionTokens = 0;

        async function* iterate() {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                // SSE 事件以空行分隔，每一行以 "data: " 开头
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // 最后一行可能是不完整的，暂存
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || !trimmed.startsWith('data:')) continue;
                    const dataStr = trimmed.slice(5).trim();
                    if (dataStr === '[DONE]') continue;
                    try {
                        const data = JSON.parse(dataStr);
                        const delta = data?.choices?.[0]?.delta?.content || '';
                        if (delta) {
                            fullContent += delta;
                            yield delta;
                        }
                        if (data?.usage?.completion_tokens) {
                            completionTokens = data.usage.completion_tokens;
                        }
                    } catch (e) {
                        // 忽略 JSON 解析错误（可能是 meta 行）
                    }
                }
            }
        }

        return {
            stream: iterate(),
            getFinalStats: () => ({
                content: fullContent,
                totalTokens: promptTokens + completionTokens,
                promptTokens,
                completionTokens,
            }),
        };
    }

    // 非流式
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: config.modelName || config.id,
            messages: bodyMessages,
            temperature: params.temperature,
            max_tokens: params.max_tokens,
            top_p: params.top_p,
            frequency_penalty: params.frequency_penalty,
            presence_penalty: params.presence_penalty,
        }),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`API 调用失败 (${response.status}): ${err}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || '';
    const usage = data?.usage || {};
    return {
        content,
        totalTokens: usage.total_tokens || estimateTokenCount(systemPrompt + content + bodyMessages.map(m => m.content).join(' ')),
        promptTokens: usage.prompt_tokens || estimateTokenCount(systemPrompt + bodyMessages.map(m => m.content).join(' ')),
        completionTokens: usage.completion_tokens || estimateTokenCount(content),
    };
}

// ---------- Anthropic 实现 ----------
async function callAnthropic(config, systemPrompt, messages, params) {
    const apiKey = getApiKey(config);
    if (!apiKey) {
        throw new Error('缺少 ANTHROPIC_API_KEY 环境变量，或在 models.json 配置 apiKey');
    }

    const bodyMessages = [];
    for (const msg of messages) {
        bodyMessages.push(msg);
    }

    const url = config.baseUrl?.replace(/\/$/, '') || 'https://api.anthropic.com/v1';
    const endpoint = `${url}/messages`;

    const requestBody = {
        model: config.modelName || 'claude-3-5-sonnet-20240620',
        max_tokens: params.max_tokens,
        temperature: params.temperature,
        top_p: params.top_p,
        messages: bodyMessages,
    };
    if (systemPrompt && systemPrompt.trim()) {
        requestBody.system = systemPrompt;
    }

    if (params.stream) {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({ ...requestBody, stream: true }),
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`API 调用失败 (${response.status}): ${err}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let fullContent = '';

        async function* iterate() {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || !trimmed.startsWith('data:')) continue;
                    const dataStr = trimmed.slice(5).trim();
                    if (!dataStr) continue;
                    try {
                        const data = JSON.parse(dataStr);
                        if (data.type === 'content_block_delta') {
                            const delta = data.delta?.text || '';
                            if (delta) {
                                fullContent += delta;
                                yield delta;
                            }
                        }
                    } catch (e) {}
                }
            }
        }

        const promptTokens = estimateTokenCount(systemPrompt + bodyMessages.map(m => m.content).join(' '));
        return {
            stream: iterate(),
            getFinalStats: () => ({
                content: fullContent,
                totalTokens: promptTokens + estimateTokenCount(fullContent),
                promptTokens,
                completionTokens: estimateTokenCount(fullContent),
            }),
        };
    }

    // 非流式
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`API 调用失败 (${response.status}): ${err}`);
    }

    const data = await response.json();
    const content = data.content?.map(c => c.text).join('') || '';
    const promptTokens = data.usage?.input_tokens || estimateTokenCount(systemPrompt + bodyMessages.map(m => m.content).join(' '));
    const completionTokens = data.usage?.output_tokens || estimateTokenCount(content);
    return {
        content,
        totalTokens: promptTokens + completionTokens,
        promptTokens,
        completionTokens,
    };
}

// ---------- Ollama 实现（本地模型） ----------
async function callOllama(config, systemPrompt, messages, params) {
    const bodyMessages = [];
    if (systemPrompt && systemPrompt.trim()) {
        bodyMessages.push({ role: 'system', content: systemPrompt });
    }
    for (const msg of messages) {
        bodyMessages.push(msg);
    }

    const url = config.baseUrl || 'http://127.0.0.1:11434';
    const endpoint = `${url}/api/chat`;
    const modelName = config.modelName || 'qwen2.5:7b';

    if (params.stream) {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: modelName,
                messages: bodyMessages,
                temperature: params.temperature,
                top_p: params.top_p,
            }),
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Ollama 调用失败 (${response.status}): ${err}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let fullContent = '';

        async function* iterate() {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const data = JSON.parse(line);
                        const delta = data.message?.content || '';
                        if (delta) {
                            fullContent += delta;
                            yield delta;
                        }
                    } catch (e) {}
                }
            }
        }

        const promptTokens = estimateTokenCount(systemPrompt + bodyMessages.map(m => m.content).join(' '));
        return {
            stream: iterate(),
            getFinalStats: () => ({
                content: fullContent,
                totalTokens: promptTokens + estimateTokenCount(fullContent),
                promptTokens,
                completionTokens: estimateTokenCount(fullContent),
            }),
        };
    }

    // 非流式
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: modelName,
            messages: bodyMessages,
            temperature: params.temperature,
            top_p: params.top_p,
            stream: false,
        }),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Ollama 调用失败 (${response.status}): ${err}`);
    }

    const data = await response.json();
    const content = data.message?.content || data.response || '';
    return {
        content,
        totalTokens: estimateTokenCount(systemPrompt + content + bodyMessages.map(m => m.content).join(' ')),
        promptTokens: estimateTokenCount(systemPrompt + bodyMessages.map(m => m.content).join(' ')),
        completionTokens: estimateTokenCount(content),
    };
}

// ---------- Google Gemini 实现 ----------
async function callGoogle(config, systemPrompt, messages, params) {
    const apiKey = getApiKey(config);
    if (!apiKey) {
        throw new Error('缺少 GOOGLE_API_KEY 环境变量，或在 models.json 配置 apiKey');
    }

    const bodyMessages = messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
    }));

    const modelName = config.modelName || 'gemini-2.5-flash';
    const endpoint = `${config.baseUrl}/models/${modelName}:generateContent?key=${apiKey}`;

    const body = {
        contents: bodyMessages,
        generationConfig: {
            temperature: params.temperature,
            maxOutputTokens: params.max_tokens,
            topP: params.top_p,
        },
    };
    if (systemPrompt && systemPrompt.trim()) {
        body.systemInstruction = { role: 'system', parts: [{ text: systemPrompt }] };
    }

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Google API 调用失败 (${response.status}): ${err}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('') || '';
    return {
        content,
        totalTokens: data.usageMetadata?.totalTokenCount || estimateTokenCount(systemPrompt + content + bodyMessages.map(m => m.parts?.[0]?.text || '').join(' ')),
        promptTokens: data.usageMetadata?.promptTokenCount || estimateTokenCount(systemPrompt + bodyMessages.map(m => m.parts?.[0]?.text || '').join(' ')),
        completionTokens: data.usageMetadata?.candidatesTokenCount || estimateTokenCount(content),
    };
}

// ---------- Mock 模型（演示用，无需 API key）----------
// 生成一个基于用户输入的模拟回复，用于演示完整流程
function callMock(config, systemPrompt, messages, params) {
    const lastUserMsg = messages.length > 0 ? messages[messages.length - 1].content : '';
    const charName = config.name || 'MockAI';

    const templates = [
        `你好！我是 ${charName}。收到你的消息：「${lastUserMsg.slice(0, 30)}${lastUserMsg.length > 30 ? '...' : ''}」。让我来好好回答～`,
        `这是个很好的问题！关于「${lastUserMsg.slice(0, 20)}」，我可以从以下几个角度来思考：\n1. 首先要理解上下文\n2. 其次要结合实际场景\n3. 最后给出可行的建议`,
        `我注意到你提到了「${lastUserMsg.slice(0, 15)}」。根据我的理解，这是一个值得深入探讨的话题。以下是我的一些想法和建议。`,
        `作为一个角色卡虚拟助手，我理解你希望获得有趣且有意义的回应。让我为你生成一段富有洞察力的回答：\n\n你提出的「${lastUserMsg.slice(0, 20)}」反映出你对这件事很有自己的看法。从不同角度来看，可能有不同的解读方式。你希望我从哪个角度继续展开呢？`,
    ];
    const reply = templates[Math.floor(Math.random() * templates.length)];
    const promptTokens = estimateTokenCount((systemPrompt || '') + messages.map(m => m.content).join(' '));
    const completionTokens = estimateTokenCount(reply);

    if (params.stream) {
        // 模拟流式：按字符 / 词组逐块推送
        async function* stream() {
            const chunkSize = 4;
            for (let i = 0; i < reply.length; i += chunkSize) {
                const chunk = reply.substring(i, Math.min(i + chunkSize, reply.length));
                // 模拟异步延迟
                await new Promise(r => setTimeout(r, 30));
                yield chunk;
            }
        }
        return {
            stream: stream(),
            getFinalStats: () => ({
                content: reply,
                totalTokens: promptTokens + completionTokens,
                promptTokens,
                completionTokens,
            }),
        };
    }

    return {
        content: reply,
        totalTokens: promptTokens + completionTokens,
        promptTokens,
        completionTokens,
    };
}
