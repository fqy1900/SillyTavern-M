const fs = require('fs');

// 读取 PNG 文件
const pngPath = 'd:/project-codewhale/SillyTavern-trae/data/default-user/characters/JM_帝国.png';
const buffer = fs.readFileSync(pngPath);

// 查找 tEXt chunk
let offset = 8;
let charaData = null;
while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.slice(offset + 4, offset + 8).toString('ascii');

    if (type === 'tEXt') {
        const data = buffer.slice(offset + 8, offset + 8 + length).toString('utf8');
        const nullIndex = data.indexOf('\0');
        if (nullIndex > -1) {
            const keyword = data.substring(0, nullIndex);
            const text = data.substring(nullIndex + 1);
            if (keyword === 'chara') {
                try {
                    charaData = JSON.parse(Buffer.from(text, 'base64').toString('utf8'));
                } catch (e) {
                    console.log('Failed to parse chara:', e.message);
                }
                break;
            }
        }
    } else if (type === 'IEND') {
        break;
    }

    offset += 12 + length;
}

if (charaData) {
    console.log('=== Character Data ===');
    console.log('Name:', charaData.name);
    console.log('Spec:', charaData.spec);
    console.log('\n=== first_mes (first 1000 chars) ===');
    console.log(charaData.first_mes.substring(0, 1000));

    console.log('\n=== Check for HTML ===');
    const hasHtmlStyle = charaData.first_mes.includes('<style>');
    const hasHtmlDiv = charaData.first_mes.includes('<div');
    const hasHtmlCode = charaData.first_mes.includes('```html');
    console.log('Has <style>:', hasHtmlStyle);
    console.log('Has <div>:', hasHtmlDiv);
    console.log('Has ```html:', hasHtmlCode);

    if (charaData.data) {
        console.log('\n=== data.first_mes (first 1000 chars) ===');
        console.log(charaData.data.first_mes.substring(0, 1000));

        const dataHasHtmlStyle = charaData.data.first_mes.includes('<style>');
        const dataHasHtmlDiv = charaData.data.first_mes.includes('<div');
        const dataHasHtmlCode = charaData.data.first_mes.includes('```html');
        console.log('\n=== data.check for HTML ===');
        console.log('data.Has <style>:', dataHasHtmlStyle);
        console.log('data.Has <div>:', dataHasHtmlDiv);
        console.log('data.Has ```html:', dataHasHtmlCode);
    }

    // Also check alternate_greetings
    if (charaData.alternate_greetings && charaData.alternate_greetings.length > 0) {
        console.log('\n=== alternate_greetings[0] (first 1000 chars) ===');
        console.log(charaData.alternate_greetings[0].substring(0, 1000));
    }
} else {
    console.log('No chara data found');
}
