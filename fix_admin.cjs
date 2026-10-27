const fs = require('fs');
let code = fs.readFileSync('src/components/AdminAssistants.tsx', 'utf-8');

code = code.replace("</div>\n\n                {/* FAST COURSE ACCESS BUTTON */}", "\n                {/* FAST COURSE ACCESS BUTTON */}");

fs.writeFileSync('src/components/AdminAssistants.tsx', code);
