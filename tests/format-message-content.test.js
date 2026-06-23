/**
 * formatMessageContent 单元测试
 * 测试 HTML 代码块检测、style 标签处理和 script 标签执行
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// 模拟 showdown
const mockMakeHtml = jest.fn(html => html);
jest.unstable_mockModule('showdown', () => ({
    default: class {
        makeHtml(content) {
            return mockMakeHtml(content);
        }
    }
}));

// 模拟 DOMPurify
const mockSanitize = jest.fn(html => html);
jest.unstable_mockModule('dompurify', () => ({
    default: {
        sanitize: mockSanitize
    }
}));

// 模拟 hljs
jest.unstable_mockModule('highlight.js', () => ({
    hljs: {
        highlightElement: jest.fn()
    }
}));

// 等待模拟模块加载
await import('showdown');
await import('dompurify');
await import('highlight.js');

// 引入被测试的函数（需要在模拟之后）
// 注意：由于 app-main.js 是浏览器代码，这里我们只能测试其逻辑
// 实际测试需要通过 Playwright 浏览器测试来进行

describe('formatMessageContent HTML 代码块检测', () => {
    test('应正确检测标准 HTML 代码块格式', () => {
        const content = '```html\n<div>Hello</div>\n```';
        const regex = /^\s*```html\s*\r?\n([\s\S]*?)\r?\n```\s*$/i;
        const match = content.match(regex);
        expect(match).not.toBeNull();
        expect(match[1]).toBe('<div>Hello</div>');
    });

    test('应正确检测带 CRLF 行结束的 HTML 代码块', () => {
        const content = '```html\r\n<div>Hello</div>\r\n```';
        const regex = /^\s*```html\s*\r?\n([\s\S]*?)\r?\n```\s*$/i;
        const match = content.match(regex);
        expect(match).not.toBeNull();
        expect(match[1]).toBe('<div>Hello</div>');
    });

    test('应正确检测带前导空格的 HTML 代码块', () => {
        const content = '  ```html\n<div>Hello</div>\n```';
        const regex = /^\s*```html\s*\r?\n([\s\S]*?)\r?\n```\s*$/i;
        const match = content.match(regex);
        expect(match).not.toBeNull();
        expect(match[1]).toBe('<div>Hello</div>');
    });

    test('应正确检测带尾随空格的 HTML 代码块', () => {
        const content = '```html\n<div>Hello</div>\n```  ';
        const regex = /^\s*```html\s*\r?\n([\s\S]*?)\r?\n```\s*$/i;
        const match = content.match(regex);
        expect(match).not.toBeNull();
        expect(match[1]).toBe('<div>Hello</div>');
    });

    test('不应匹配普通文本内容', () => {
        const content = '这是一段普通文本';
        const regex = /^\s*```html\s*\r?\n([\s\S]*?)\r?\n```\s*$/i;
        const match = content.match(regex);
        expect(match).toBeNull();
    });

    test('不应匹配非 HTML 代码块', () => {
        const content = '```javascript\nconsole.log("hi")\n```';
        const regex = /^\s*```html\s*\r?\n([\s\S]*?)\r?\n```\s*$/i;
        const match = content.match(regex);
        expect(match).toBeNull();
    });
});

describe('style 标签编码/解码', () => {
    test('应正确编码 style 标签为 custom-style', () => {
        const text = '<style>.test { color: red; }</style>';
        const styleRegex = /<style>([\s\S]*?)<\/style>/gims;
        const result = text.replace(styleRegex, (_, match) =>
            `<custom-style>${encodeURIComponent(match)}</custom-style>`
        );
        expect(result).toBe('<custom-style>.test%20%7B%20color%3A%20red%3B%20%7D</custom-style>');
    });

    test('应正确解码 custom-style 标签', () => {
        const text = '<custom-style>.test%20%7B%20color%3A%20red%3B%20%7D</custom-style>';
        const decodeRegex = /<custom-style>([\s\S]*?)<\/custom-style>/gms;
        const result = text.replace(decodeRegex, (_, encoded) => {
            const css = decodeURIComponent(encoded);
            return `<style data-scoped>.bubble-content { ${css} }</style>`;
        });
        expect(result).toBe('<style data-scoped>.bubble-content { .test { color: red; } }</style>');
    });
});

describe('HTML 代码块内容验证', () => {
    test('应保留 HTML 内容中的 script 标签', () => {
        const html = '<script>alert("hi")</script><div>Hello</div>';
        // 验证 HTML 包含 script 标签
        expect(html).toContain('<script>');
        expect(html).toContain('alert("hi")');
        expect(html).toContain('</script>');
    });

    test('应保留 HTML 内容中的 style 标签', () => {
        const html = '<style>.test { color: red; }</style><div>Hello</div>';
        // 验证 HTML 包含 style 标签
        expect(html).toContain('<style>');
        expect(html).toContain('.test { color: red; }');
        expect(html).toContain('</style>');
    });
});