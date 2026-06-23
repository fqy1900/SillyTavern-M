const cssLib = require('@adobe/css-tools');
const css = `@property --angle { syntax: '<angle>'; initial-value: 0deg; inherits: false; }`;
const ast = cssLib.parse(css);
console.log('Rule types:', ast.stylesheet.rules.map(r => ({ type: r.type, name: r.name })));
console.log(JSON.stringify(ast.stylesheet.rules, null, 2));
