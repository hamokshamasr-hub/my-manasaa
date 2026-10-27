const fs = require('fs');
let dash = fs.readFileSync('src/pages/StudentDashboard.tsx', 'utf-8');

const oldWatermark = `              <div className="absolute inset-0 pointer-events-none overflow-hidden z-20 flex items-center justify-center opacity-30 mix-blend-overlay">
                <motion.div
                  animate={{ x: [0, 300, 0, -300, 0], y: [0, 200, -200, 0, 200] }}
                  transition={{ duration: 30, ease: "linear", repeat: Infinity }}
                  className="text-white font-black text-4xl drop-shadow-lg select-none whitespace-nowrap"
                  dir="ltr"
                >
                  {appUser?.phone || appUser?.email}
                </motion.div>
              </div>`;

const newWatermark = `              <div className="absolute inset-0 pointer-events-none overflow-hidden z-20 flex items-center justify-center">
                <motion.div
                  animate={{ 
                    x: [0, 250, -250, 250, 0], 
                    y: [0, 150, -150, -150, 0],
                    rotate: [0, 15, -15, 10, 0]
                  }}
                  transition={{ duration: 25, ease: "linear", repeat: Infinity }}
                  className="text-white font-black text-3xl sm:text-5xl opacity-20 drop-shadow-2xl select-none whitespace-nowrap"
                  dir="ltr"
                  style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8), -2px -2px 4px rgba(0,0,0,0.8)' }}
                >
                  {appUser?.phone || appUser?.email}
                </motion.div>
                <motion.div
                  animate={{ 
                    x: [250, -250, 250, 0, 250], 
                    y: [150, -150, 150, -150, 150],
                    rotate: [15, -15, 10, 0, 15]
                  }}
                  transition={{ duration: 28, ease: "linear", repeat: Infinity }}
                  className="text-white font-black text-3xl sm:text-5xl opacity-20 drop-shadow-2xl select-none whitespace-nowrap absolute"
                  dir="ltr"
                  style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8), -2px -2px 4px rgba(0,0,0,0.8)' }}
                >
                  {appUser?.phone || appUser?.email}
                </motion.div>
              </div>`;

dash = dash.replace(oldWatermark, newWatermark);
fs.writeFileSync('src/pages/StudentDashboard.tsx', dash);
