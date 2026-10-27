const fs = require('fs');
const babel = require('@babel/core');

try {
  babel.transformFileSync('src/pages/StudentDashboard.tsx', {
    presets: ['@babel/preset-react', '@babel/preset-typescript']
  });
  console.log('Success');
} catch (e) {
  console.error(e.message);
}
