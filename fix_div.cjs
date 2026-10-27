const fs = require('fs');
let code = fs.readFileSync('src/pages/StudentDashboard.tsx', 'utf-8');
code = code.replace(
  `              )}
            </div>
          </div>
        )}
      </div>`, 
  `              )}
            </div>
          </div>
          </div>
        )}
      </div>`
);
fs.writeFileSync('src/pages/StudentDashboard.tsx', code);
