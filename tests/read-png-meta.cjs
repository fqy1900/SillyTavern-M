const fs = require('fs');

// 读取 PNG 文件
const pngPath = 'd:/project-codewhale/SillyTavern-trae/data/default-user/characters/JM_帝国.png';
const buffer = fs.readFileSync(pngPath);

// 检查 PNG 签名
const signature = buffer.slice(0, 8).toString('hex');
console.log('PNG Signature:', signature);

// 查找 tEXt chunk
let offset = 8;
let chunks = [];
while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.slice(offset + 4, offset + 8).toString('ascii');

    if (type === 'tEXt' || type === 'iTXt') {
        const data = buffer.slice(offset + 8, offset + 8 + length);
        chunks.push({ type, length, data: data.toString('utf8') });
    } else if (type === 'IEND') {
        break;
    }

    offset += 12 + length;
}

console.log(`Found ${chunks.length} text chunks`);
for (const chunk of chunks) {
    console.log(`\n=== ${chunk.type} (${chunk.length} bytes) ===`);
    // iTXt 格式更复杂，尝试解析
    if (chunk.type === 'iTXt') {
        // iTXt 格式: keyword\0compression_flag\0language_tag\0translated_keyword\0text
        const nullIndex = chunk.data.indexOf('\0');
        if (nullIndex > -1) {
            const keyword = chunk.data.substring(0, nullIndex);
            console.log('Keyword:', keyword);
            let remaining = chunk.data.substring(nullIndex + 1);
            // 跳过 compression_flag, language_tag, translated_keyword
            let parts = remaining.split('\0');
            console.log('Parts count:', parts.length);
            if (parts.length >= 4) {
                console.log('Text length:', parts[3].length);
                console.log('Text preview (500 chars):', parts[3].substring(0, 500));
            }
        }
    } else {
        // tEXt 格式: keyword\0text
        const nullIndex = chunk.data.indexOf('\0');
        if (nullIndex > -1) {
            const keyword = chunk.data.substring(0, nullIndex);
            const text = chunk.data.substring(nullIndex + 1);
            console.log('Keyword:', keyword);
            console.log('Text length:', text.length);
            console.log('Text preview (500 chars):', text.substring(0, 500));
        }
    }
}
