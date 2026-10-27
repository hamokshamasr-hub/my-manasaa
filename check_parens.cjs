const fs = require('fs');
const code = fs.readFileSync('src/pages/StudentDashboard.tsx', 'utf-8');

let parenCount = 0;
let braceCount = 0;
let bracketCount = 0;

for (let i = 0; i < code.length; i++) {
  if (code[i] === '(') parenCount++;
  if (code[i] === ')') parenCount--;
  if (code[i] === '{') braceCount++;
  if (code[i] === '}') braceCount--;
  if (code[i] === '[') bracketCount++;
  if (code[i] === ']') bracketCount--;
}

console.log('Parens:', parenCount);
console.log('Braces:', braceCount);
console.log('Brackets:', bracketCount);
