const fs = require('fs');
let code = fs.readFileSync('src/pages/StudentDashboard.tsx', 'utf-8');

const correctEnding = `
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

code = code.replace(/\n\s*\}\)\}\s*<\/div>\s*\}\)\s*<\/div>\s*\}\)\s*<\/div>\s*\{\/\* Video Player Modal \*\/\}/g, 'THIS_WONT_MATCH');
// Actually, let's just use string slicing from `{/* Video Player Modal */}`

const videoModalIdx = code.indexOf('{/* Video Player Modal */}');
const beforeModal = code.substring(0, videoModalIdx);
const afterModal = code.substring(videoModalIdx);

// Find the last occurrence of activeTab === 'videos' block ending
const blockEndIdx = beforeModal.lastIndexOf('</div>\n            )}');

if (blockEndIdx !== -1) {
  const newBeforeModal = beforeModal.substring(0, blockEndIdx) + correctEnding;
  fs.writeFileSync('src/pages/StudentDashboard.tsx', newBeforeModal + afterModal);
}
