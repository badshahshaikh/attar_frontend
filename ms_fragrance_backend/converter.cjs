const fs = require('fs');
const path = require('path');

function processDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory()) {
            if (['node_modules', 'data', 'uploads'].includes(entry.name)) continue;
            processDir(path.join(dir, entry.name));
        } else if (entry.isFile() && entry.name.endsWith('.js') && entry.name !== 'converter.js') {
            processFile(path.join(dir, entry.name));
        }
    }
}

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // 1. Convert require to import
    // Note: this handles const x = require('y') and const {x} = require('y')
    // We also need to add .js to relative imports if missing
    content = content.replace(/(?:const|let|var)\s+([^=]+?)\s*=\s*require\((['"])(.*?)(['"])\);?/g, (match, vars, q1, reqPath, q2) => {
        let importPath = reqPath;
        if (importPath.startsWith('.')) {
            // Check if it already has an extension
            if (!importPath.endsWith('.js') && !importPath.endsWith('.json')) {
                importPath += '.js';
            }
        }
        
        let importVars = vars.trim();
        // If it's just object destructuring, it's import { ... } from ...
        // If it's a direct assignment, it's import ... from ...
        // Note: CJS to ESM default exports can be tricky if the module was a commonjs module (like 'express')
        // We'll leave it as default import, which works well in modern Node for CJS packages
        return `import ${importVars} from ${q1}${importPath}${q2};`;
    });

    // 2. Add .js to existing relative import and export from statements
    content = content.replace(/(import|export)\s+(.*?)\s+from\s+(['"])(.*?)(['"])/g, (match, type, vars, q1, reqPath, q2) => {
        let importPath = reqPath;
        if (importPath.startsWith('.')) {
            if (!importPath.endsWith('.js') && !importPath.endsWith('.json')) {
                importPath += '.js';
            }
        }
        return `${type} ${vars} from ${q1}${importPath}${q2}`;
    });

    content = content.replace(/import\s+(['"])(.*?)(['"])/g, (match, q1, reqPath, q2) => {
        let importPath = reqPath;
        if (importPath.startsWith('.')) {
            if (!importPath.endsWith('.js') && !importPath.endsWith('.json')) {
                importPath += '.js';
            }
        }
        return `import ${q1}${importPath}${q2}`;
    });

    // 3. Convert module.exports
    // module.exports = { a, b } -> export { a, b } (but this syntax only works if they are already declared)
    // Wait, export { a, b } requires a and b to be local variables, which they usually are in CJS.
    // If it's module.exports = expression, it should be export default expression
    content = content.replace(/module\.exports\s*=\s*{([^}]+)};?/g, (match, inner) => {
        return `export {\n  ${inner.trim()}\n};`;
    });

    content = content.replace(/module\.exports\s*=\s*(.+?);?/g, (match, expr) => {
        if (match.includes('{')) {
            // We already handled { a, b } above, but if there's module.exports = class ..., it will match here
            if (expr.startsWith('class') || expr.startsWith('function')) {
                return `export default ${expr}`;
            }
        }
        return `export default ${expr};`;
    });

    // Fix exports.foo = ... -> export const foo = ...
    content = content.replace(/exports\.([a-zA-Z0-9_$]+)\s*=\s*(.+?);?/g, (match, name, expr) => {
        return `export const ${name} = ${expr};`;
    });


    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Converted: ${filePath}`);
    }
}

processDir(__dirname);
