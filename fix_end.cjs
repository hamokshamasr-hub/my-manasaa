const fs = require('fs');
let code = fs.readFileSync('src/pages/StudentDashboard.tsx', 'utf-8');

const lines = code.split('\n');

const fixedEnd = `
                )}
              </div>
            )}
            </div>
          </div>
        )}
      </div>
    </div>
    {/* Video Player Modal */}
`;

let targetLineIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('{/* Video Player Modal */}')) {
    targetLineIdx = i;
    break;
  }
}

if (targetLineIdx !== -1) {
  // Find the closing bracket of `materials.length === 0` which is `)}` at 506
  lines.splice(targetLineIdx - 11, 12, fixedEnd);
  fs.writeFileSync('src/pages/StudentDashboard.tsx', lines.join('\n'));
}

