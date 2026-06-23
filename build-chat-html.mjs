import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, 'public');
const indexHtmlPath = path.join(publicDir, 'index.html');
const chatHtmlPath = path.join(publicDir, 'chat.html');

console.log('读取 index.html:', indexHtmlPath);
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf-8');
console.log('index.html 大小:', indexHtml.length, '字节');

const chatSpecificContent = `
    <!-- chat.html 特有功能：返回按钮 + 自动角色选择 -->
    <div id="chat-html-back-btn" class="chat-nav-btn" title="返回角色卡列表">
        <i class="fa-solid fa-arrow-left"></i>
        <span>返回</span>
    </div>
    <style>
        .chat-nav-btn {
            position: fixed;
            top: 50px;
            left: 20px;
            z-index: 99999;
            background: rgba(60, 60, 60, 0.9);
            color: #fff;
            padding: 10px 16px;
            border-radius: 8px;
            cursor: pointer;
            display: none;
            font-size: 14px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            transition: all 0.2s;
        }
        .chat-nav-btn:hover {
            background: rgba(80, 80, 80, 0.95);
            transform: translateX(2px);
        }
        .chat-nav-btn i { margin-right: 6px; }
    </style>
    <script>
    // chat.html 自动角色选择脚本（内联，避免 module 加载时序问题）
    (function() {
        const params = new URLSearchParams(window.location.search);
        const charId = params.get('char');
        const chatId = params.get('chat');

        if (!charId) {
            console.warn('[chat-html] 缺少角色卡参数，不进行自动选择');
            return;
        }

        console.log('[chat-html] 开始加载角色卡:', charId);

        // 返回按钮
        const backBtn = document.getElementById('chat-html-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', function() {
                window.location.href = '/app?view=characters';
            });
            setTimeout(function() {
                backBtn.style.display = 'block';
            }, 1000);
        }

        // 等待 SillyTavern 核心就绪
        function getCtx() {
            try {
                return globalThis.SillyTavern && globalThis.SillyTavern.getContext && globalThis.SillyTavern.getContext();
            } catch (e) {
                return null;
            }
        }

        function waitForSillyTavernReady() {
            return new Promise(function(resolve) {
                function check() {
                    const ctx = getCtx();
                    return ctx && ctx.eventSource && typeof ctx.eventSource.emit === 'function';
                }

                if (check()) return resolve();

                const interval = setInterval(function() {
                    if (check()) {
                        clearInterval(interval);
                        resolve();
                    }
                }, 200);

                setTimeout(function() {
                    clearInterval(interval);
                    resolve();
                }, 30000);
            });
        }

        // 等待角色卡数据加载完成
        function waitForCharacters() {
            return new Promise(function(resolve) {
                function check() {
                    const ctx = getCtx();
                    return ctx && ctx.characters && ctx.characters.length > 0;
                }

                if (check()) return resolve();

                const interval = setInterval(function() {
                    if (check()) {
                        clearInterval(interval);
                        resolve();
                    }
                }, 300);

                setTimeout(function() {
                    clearInterval(interval);
                    resolve();
                }, 15000);
            });
        }

        // 自动选择角色卡
        async function loadCharacter() {
            const ctx = getCtx();
            if (!ctx || !ctx.characters || ctx.characters.length === 0) {
                console.warn('[chat-html] 角色列表为空');
                return;
            }

            const chars = ctx.characters;
            const decodedCharId = decodeURIComponent(charId).trim();
            console.log('[chat-html] 尝试匹配角色:', decodedCharId);

            let character = chars.find(function(c) { return c.name === decodedCharId; })
                || chars.find(function(c) { return c.avatar === charId; })
                || chars.find(function(c) { return c.name === charId; })
                || (parseInt(charId, 10) >= 0 ? chars[parseInt(charId, 10)] : null);

            if (!character) {
                console.warn('[chat-html] 未找到角色卡:', decodedCharId);
                return;
            }

            console.log('[chat-html] 找到角色:', character.name, '头像:', character.avatar);

            try {
                const charIndex = chars.indexOf(character);
                if (ctx && typeof ctx.selectCharacterById === 'function' && charIndex >= 0) {
                    console.log('[chat-html] 使用 ctx.selectCharacterById, 索引:', charIndex);
                    await ctx.selectCharacterById(charIndex);
                    console.log('[chat-html] 角色卡加载成功');
                } else {
                    console.warn('[chat-html] 无法调用 selectCharacterById');
                }
            } catch (e) {
                console.warn('[chat-html] 选择角色卡出错:', e);
            }
        }

        // 主流程
        async function main() {
            console.log('[chat-html] 等待 SillyTavern 核心就绪...');
            await waitForSillyTavernReady();
            console.log('[chat-html] SillyTavern 就绪');

            console.log('[chat-html] 等待角色卡数据加载...');
            await waitForCharacters();
            console.log('[chat-html] 角色卡数据就绪');

            await loadCharacter();
            console.log('[chat-html] 自动加载角色卡完成');
        }

        // 启动（延迟一小段时间确保 script.js 已开始处理）
        setTimeout(main, 1500);
    })();
    </script>
`;

const newChatHtml = indexHtml.replace('</body>', chatSpecificContent + '\n    </body>');

fs.writeFileSync(chatHtmlPath, newChatHtml, 'utf-8');

console.log('');
console.log('================================================');
console.log('✅ chat.html 已基于 index.html 完整生成');
console.log('================================================');
console.log('  原始大小 (index.html):', indexHtml.length, '字节');
console.log('  新大小   (chat.html) :', newChatHtml.length, '字节');
console.log('  包含返回按钮:', newChatHtml.includes('chat-html-back-btn'));
console.log('  包含自动角色选择脚本:', newChatHtml.includes('[chat-html] 开始加载角色卡'));
console.log('  包含 script.js:', newChatHtml.includes('script.js'));
console.log('  包含 extensions.js:', newChatHtml.includes('scripts/extensions.js'));
console.log('  包含 right-nav-panel:', newChatHtml.includes('right-nav-panel'));
console.log('  包含 extensions_settings:', newChatHtml.includes('extensions_settings'));
console.log('  包含酒馆助手扩展支持:', newChatHtml.includes('JS-Slash-Runner'));
console.log('================================================');
