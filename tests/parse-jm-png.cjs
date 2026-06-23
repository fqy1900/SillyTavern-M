const fs = require('fs');

// 读取 JM_帝国 PNG 元数据
const pngPath = 'd:/project-codewhale/SillyTavern-trae/data/default-user/characters/JM_帝国.png';
const buffer = fs.readFileSync(pngPath);

// 解析 PNG 元数据
let offset = 8;
let charData = null;
while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.slice(offset + 4, offset + 8).toString('ascii');

    if (type === 'tEXt' || type === 'iTXt') {
        const data = buffer.slice(offset + 8, offset + 8 + length).toString('utf8');
        const nullIndex = data.indexOf('\0');
        if (nullIndex > -1) {
            const keyword = data.substring(0, nullIndex);
            const text = data.substring(nullIndex + 1);
            if (keyword === 'chara') {
                try {
                    charData = JSON.parse(Buffer.from(text, 'base64').toString('utf8'));
                } catch (e) {
                    console.log('parse error:', e.message);
                }
            }
        }
    } else if (type === 'IEND') {
        break;
    }

    offset += 12 + length;
}

if (charData) {
    console.log('=== 角色卡基础信息 ===');
    console.log('name:', charData.name);
    console.log('first_mes (前300字符):', charData.first_mes?.substring(0, 300));
    console.log('');

    if (charData.data) {
        console.log('=== data.first_mes (前300字符) ===');
        console.log(charData.data.first_mes?.substring(0, 300));
        console.log('');

        console.log('=== alternate_greetings 数量 ===');
        console.log(charData.data.alternate_greetings?.length || 0);
        
        if (charData.data.alternate_greetings && charData.data.alternate_greetings.length > 0) {
            console.log('\n=== alternate_greetings[0] (前500字符) ===');
            console.log(charData.data.alternate_greetings[0].substring(0, 500));
            
            // 检查是否包含 HTML
            console.log('\n=== HTML 标记检查 ===');
            charData.data.alternate_greetings.forEach((g, i) => {
                const hasStyle = g.includes('<style');
                const hasScript = g.includes('<script');
                const hasEra = g.includes('era_data');
                const hasStatus = g.includes('StatusPlaceHolder');
                console.log(`greeting[${i}]: len=${g.length}, <style>=${hasStyle}, <script>=${hasScript}, <era_data>=${hasEra}, <StatusPlaceHolder>=${hasStatus}`);
            });
        }
    }

    // 检查 first_mes 是否包含 HTML
    console.log('\n=== first_mes 完整内容检查 ===');
    const fm = charData.first_mes || charData.data?.first_mes;
    console.log('length:', fm.length);
    console.log('包含 <style>:', fm.includes('<style'));
    console.log('包含 <script>:', fm.includes('<script'));
    console.log('包含 <div>:', fm.includes('<div'));
    console.log('包含 era_data:', fm.includes('era_data'));
    console.log('包含 StatusPlaceHolder:', fm.includes('StatusPlaceHolder'));
    console.log('包含 <state1>:', fm.includes('<state1'));
    console.log('包含 setvar:', fm.includes('setvar'));
    console.log('完整内容 (前2000字符):');
    console.log(fm.substring(0, 2000));
    
    // 如果结尾不是完整的，打印更多
    if (fm.length > 2000) {
        console.log('\n...\n=== 完整内容最后1000字符 ===');
        console.log(fm.slice(-1000));
    }
}
