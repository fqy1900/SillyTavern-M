const fs = require('fs');

const filePath = 'd:/project-codewhale/SillyTavern-trae/data/default-user/chats/《道渊》v5.1/《道渊》v5.1 - 2026-06-20@14h46m18s493ms.jsonl';
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n').filter(l => l.trim());

console.log('=== 总行数:', lines.length);

// 第2行是第一条消息（开场白）
const msg = JSON.parse(lines[1]);
console.log('\n=== 第一条消息 swipe_id:', msg.swipe_id);
console.log('swipes count:', msg.swipes?.length || 0);

// 检查当前 swipe
const currentSwipe = msg.swipes[msg.swipe_id];
console.log('current swipe len:', currentSwipe.length);
console.log('\n--- 当前 swipe 前 1000 字符 ---');
console.log(currentSwipe.substring(0, 1000));

// 检查是否包含关键标签
console.log('\n--- 检查关键标签 ---');
console.log('包含 <style>:', currentSwipe.includes('<style'));
console.log('包含 <script>:', currentSwipe.includes('<script'));
console.log('包含 <div class="info-card">:', currentSwipe.includes('info-card'));
console.log('包含 era_data:', currentSwipe.includes('era_data'));
console.log('包含 StatusPlaceHolder:', currentSwipe.includes('StatusPlaceHolder'));
console.log('包含 setvar:', currentSwipe.includes('setvar'));
console.log('包含 <html>:', currentSwipe.includes('<html'));

// 检查 swipe[0]
const swipe0 = msg.swipes[0];
console.log('\n--- swipe[0] len:', swipe0.length);
console.log('swipe[0] 前 1000 字符:');
console.log(swipe0.substring(0, 1000));

// 检查所有 swipes
console.log('\n--- 所有 swipes 概览 ---');
msg.swipes.forEach((s, i) => {
    console.log(`swipe[${i}]: len=${s.length}, starts=${s.substring(0, 100).replace(/\n/g, '\\n')}`);
});
