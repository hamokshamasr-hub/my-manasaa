const fs = require('fs');
let code = fs.readFileSync('src/pages/StudentDashboard.tsx', 'utf-8');

const returnStartIdx = code.indexOf('return (');
const returnEndIdx = code.lastIndexOf(';');

// Let's just fix the mismatched brackets at line 510 by reading the specific block
code = code.replace(/\{activeTab === 'performance' \? \([\s\S]*?<\/\s*motion\.div>\s*\)\s*:\s*null\}\s*<\/div>\s*<\/div>\s*\)\s*:\s*\(\s*<div/m, 
`{activeTab === 'performance' ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <StudentPerformance />
              </motion.div>
            ) : null}
            </div>
          </div>
        )
      )}
    </div>
    {/* Video Player Modal`);

fs.writeFileSync('src/pages/StudentDashboard.tsx', code);
