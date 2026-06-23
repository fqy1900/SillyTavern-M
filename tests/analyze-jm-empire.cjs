const fs = require('fs');

const filePath = 'd:/project-codewhale/SillyTavern-trae/data/default-user/chats/JM_帝国/JM_帝国 - 2026-06-20@00h09m31s842ms.jsonl';
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n').filter(l => l.trim());

console.log('=== 总行数 ===');
console.log(lines.length);

console.log('\n=== 第2行 (first message) ===');
const msg = JSON.parse(lines[1]);
console.log('swipe_id:', msg.swipe_id);
console.log('swipes count:', msg.swipes?.length || 0);
console.log('\n--- swipe[0] (前500字符) ---');
console.log(msg.swipes[0].substring(0, 500));
console.log('\n--- swipe[0] 后500字符 ---');
console.log(msg.swipes[0].slice(-500));

if (msg.swipes && msg.swipes.length > 1) {
    console.log('\n--- swipe[1] (前500字符) ---');
    console.log(msg.swipes[1].substring(0, 500));
    console.log('\n--- swipe[1] 长度 ---');
    console.log(msg.swipes[1].length, 'chars');
    // 检查是否包含 HTML
    console.log('\n--- 检查 HTML 标记 ---');
    console.log('Contains <style>:', msg.swipes[1].includes('<style'));
    console.log('Contains <div class="info-card">:', msg.swipes[1].includes('info-card'));
    console.log('Contains <script>:', msg.swipes[1].includes('<script'));
    console.log('Contains HTML tags:', /<[a-z][\s\S]*>/i.test(msg.swipes[1]));
}

// 检查 swipes 的总数量
if (msg.swipes) {
    console.log('\n=== 所有 swipes 概览 ===');
    msg.swipes.forEach((s, i) => {
        console.log(`swipe[${i}]: length=${s.length}, starts with="${s.substring(0, 80).replace(/\n/g, '\\n')}"`);
    });
}
