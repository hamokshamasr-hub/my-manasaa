const fs = require('fs');
let code = fs.readFileSync('src/components/Leaderboard.tsx', 'utf-8');

const newLeaderboardRender = `
  if (loading) return null;

  const top3 = topStudents.slice(0, 3);
  const restList = topStudents.slice(3, 20);

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 overflow-hidden relative">
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -z-10 opacity-50"></div>
      
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner">
          <Trophy className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-900">لوحة الشرف والتصنيف</h2>
          <p className="text-sm text-slate-500 font-medium">ترتيب الأبطال على مستوى المنصة</p>
        </div>
      </div>

      {topStudents.length === 0 ? (
        <div className="text-center py-8 text-slate-400 font-medium">لم يتم تسجيل أي نقاط بعد.</div>
      ) : (
        <div className="space-y-8">
          {/* PODIUM FOR TOP 3 */}
          {top3.length > 0 && (
            <div className="flex items-end justify-center gap-2 sm:gap-6 pt-10 pb-4 border-b border-slate-100">
              {/* Rank 2 */}
              {top3[1] && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex flex-col items-center flex-1">
                  <div className="relative mb-3">
                    <div className="w-14 h-14 bg-slate-200 rounded-full flex items-center justify-center border-4 border-white shadow-lg z-10 relative">
                      <span className="text-xl font-black text-slate-500">2</span>
                    </div>
                    <div className="absolute -top-3 -right-3">
                      <Medal className="w-6 h-6 text-slate-400" />
                    </div>
                  </div>
                  <h3 className="font-bold text-slate-800 text-xs sm:text-sm text-center line-clamp-1 mb-1">{top3[1].name}</h3>
                  <span className="text-[10px] sm:text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{top3[1].totalPoints} ن</span>
                  <div className="w-full h-16 sm:h-24 bg-gradient-to-t from-slate-200 to-slate-100 rounded-t-xl mt-3 border border-slate-200/50 border-b-0 shadow-inner flex items-end justify-center pb-2">
                    <span className="text-[10px] text-slate-400 font-bold">{getLevel(top3[1].totalPoints).name}</span>
                  </div>
                </motion.div>
              )}
              
              {/* Rank 1 */}
              {top3[0] && (
                <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex flex-col items-center flex-1 relative -top-4">
                  <div className="absolute -top-8 text-yellow-400 animate-bounce">
                    <Crown className="w-8 h-8 drop-shadow-md" />
                  </div>
                  <div className="relative mb-3">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-yellow-400 rounded-full flex items-center justify-center border-4 border-white shadow-xl z-10 relative">
                      <span className="text-2xl sm:text-3xl font-black text-white drop-shadow-md">1</span>
                    </div>
                  </div>
                  <h3 className="font-black text-slate-900 text-sm sm:text-base text-center line-clamp-1 mb-1">{top3[0].name}</h3>
                  <span className="text-xs sm:text-sm font-black text-amber-600 bg-amber-50 border border-amber-100 px-3 py-1 rounded-full shadow-sm">{top3[0].totalPoints} ن</span>
                  <div className="w-full h-24 sm:h-32 bg-gradient-to-t from-yellow-200 to-yellow-50 rounded-t-2xl mt-3 border border-yellow-200/50 border-b-0 shadow-inner flex items-end justify-center pb-2">
                    <span className="text-[10px] text-amber-600 font-black">{getLevel(top3[0].totalPoints).name}</span>
                  </div>
                </motion.div>
              )}

              {/* Rank 3 */}
              {top3[2] && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex flex-col items-center flex-1">
                  <div className="relative mb-3">
                    <div className="w-14 h-14 bg-amber-700 rounded-full flex items-center justify-center border-4 border-white shadow-lg z-10 relative">
                      <span className="text-xl font-black text-amber-200">3</span>
                    </div>
                    <div className="absolute -top-3 -right-3">
                      <Award className="w-6 h-6 text-amber-600" />
                    </div>
                  </div>
                  <h3 className="font-bold text-slate-800 text-xs sm:text-sm text-center line-clamp-1 mb-1">{top3[2].name}</h3>
                  <span className="text-[10px] sm:text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{top3[2].totalPoints} ن</span>
                  <div className="w-full h-12 sm:h-16 bg-gradient-to-t from-amber-100 to-orange-50 rounded-t-xl mt-3 border border-amber-200/50 border-b-0 shadow-inner flex items-end justify-center pb-2">
                    <span className="text-[10px] text-amber-800 font-bold">{getLevel(top3[2].totalPoints).name}</span>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* LIST FOR THE REST */}
          <div className="space-y-3">
            {restList.map((student, idx) => {
              const level = getLevel(student.totalPoints);
              const Icon = level.icon;
              const isMe = appUser?.uid === student.id;
              
              return (
                <motion.div 
                  key={student.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={\`flex items-center justify-between p-3 rounded-2xl border \${isMe ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-slate-50 border-slate-100 hover:bg-white transition-colors'}\`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm bg-slate-200 text-slate-500 shadow-inner">
                      {idx + 4}
                    </div>
                    <div>
                      <h3 className={\`font-bold \${isMe ? 'text-indigo-800' : 'text-slate-800'}\`}>
                        {student.name} {isMe && <span className="text-indigo-500 text-xs">(أنت)</span>}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={\`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 \${level.bg} \${level.color}\`}>
                          <Icon className="w-3 h-3" /> {level.name}
                        </span>
                        <span className="text-[10px] text-slate-400">{student.grade}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-left bg-white px-3 py-1.5 rounded-xl border border-slate-100 shadow-sm">
                    <span className="font-black text-indigo-600 block leading-none">{student.totalPoints}</span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">نقطة</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
`;

const startIdx = code.indexOf('  if (loading) return null;');
if (startIdx !== -1) {
  code = code.substring(0, startIdx) + newLeaderboardRender;
  fs.writeFileSync('src/components/Leaderboard.tsx', code);
}
