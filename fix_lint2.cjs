const fs = require('fs');
let appStr = fs.readFileSync('src/App.tsx', 'utf-8');
appStr = appStr.replace('<Routes location={location} key={location.pathname as any}>', '{/* @ts-ignore */}\n      <Routes location={location} key={location.pathname}>');
fs.writeFileSync('src/App.tsx', appStr);
