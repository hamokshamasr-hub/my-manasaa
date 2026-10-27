const fs = require('fs');

let code = fs.readFileSync('src/pages/StudentDashboard.tsx', 'utf-8');

// I will extract the blocks and replace the render function body.
const newRender = `  return (
    <div className="flex-grow py-8 px-4 sm:px-6 lg:px-8 bg-slate-50 min-h-[calc(100vh-80px)]">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-slate-900 mb-2">منصتي التعليمية</h1>
          <p className="text-slate-500 font-medium">مرحباً بك {appUser?.name}، استكمل رحلة تفوقك من هنا.</p>
        </div>

        {subscribedCourses.length === 0 && coursesData.length === 0 ? (
          (appUser?.isCenterStudent || appUser?.registrationMethod === 'center') ? (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 sm:p-12 text-center max-w-2xl mx-auto">
              <div className="w-20 h-20 bg-amber-50 text-amber-600 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-sm border border-amber-100">
                <Clock className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-3">في انتظار تفعيل حساب السنتر</h2>
              <p className="text-slate-600 text-base mb-6 leading-relaxed">
                مرحباً بك يا بطل! حسابك مسجل لدينا كطالب سنتر، وهو الآن في قيد المراجعة والتفعيل من قبل السكرتارية. يرجى الانتظار أو التواصل مع السكرتارية لتسريع التفعيل.
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-600 mb-6 flex flex-col sm:flex-row items-center justify-between gap-3">
                <span>كود الطالب: <b className="font-mono text-indigo-600 text-sm">{appUser?.code || '-'}</b></span>
                <span>الصف الدراسي: <b>{appUser?.grade || '-'}</b></span>
              </div>
              {settings.whatsappNumber && (
                <a 
                  href={\`https://wa.me/\${settings.whatsappNumber}?text=\${encodeURIComponent(\`السلام عليكم، أنا الطالب \${appUser?.name || ''}، كود: \${appUser?.code || ''}، قمت بتسجيل الدخول في انتظار تفعيل كورس السنتر.\`)}\`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md shadow-emerald-100 text-sm"
                >
                  <MessageCircle className="w-4 h-4" />
                  تواصل مع السكرتارية لفتح الكورس
                </a>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 sm:p-12 text-center max-w-2xl mx-auto">
              <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-sm border border-indigo-100">
                <BookOpen className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-3">أهلاً بك في منصتك التعليمية!</h2>
              <p className="text-slate-600 text-base mb-6 leading-relaxed">
                لم يتم تفعيل أي كورس لحسابك حتى الآن. يرجى الاشتراك في الكورسات وتأكيد وسيلة الدفع لبدء المشاهدة والمذاكرة.
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Link 
                  to="/payment"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all text-sm"
                >
                  الاشتراك وتفعيل الكورسات
                </Link>
                {settings.whatsappNumber && (
                  <a 
                    href={\`https://wa.me/\${settings.whatsappNumber}\`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-3.5 rounded-xl font-bold transition-all text-sm"
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-600" />
                    الدعم الفني
                  </a>
                )}
              </div>
            </div>
          )
        ) : !selectedCourseId ? (
          <div className="space-y-12">
            <div>
              <h2 className="text-2xl font-black text-slate-800 mb-6">كورساتي المشترك بها:</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {coursesData.map(course => (
                  <motion.div
                    key={course.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => setSelectedCourseId(course.id)}
                    className="bg-white rounded-3xl shadow-md border border-slate-200 overflow-hidden cursor-pointer hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 group"
                  >
                    <div className="h-64 bg-slate-100 relative overflow-hidden">
                      {course.coverImageBase64 ? (
                        <img src={course.coverImageBase64} alt={course.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-indigo-50">
                          <BookOpen className="w-16 h-16 text-indigo-200" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                      <div className="absolute bottom-4 right-4 left-4">
                        <span className="bg-indigo-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg mb-2 inline-block shadow-sm">
                          {course.grade}
                        </span>
                        <h2 className="text-2xl font-black text-white line-clamp-1">{course.name}</h2>
                      </div>
                    </div>
                    <div className="p-5 flex items-center justify-between bg-white">
                      <span className="text-slate-500 font-bold text-sm flex items-center gap-2">
                        <BookOpen className="w-4 h-4" /> اضغط للدخول للمحتوى
                      </span>
                      <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                        <ChevronLeft className="w-5 h-5 text-indigo-600 group-hover:text-white transition-colors" />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
              <Leaderboard />
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[600px]">
                <StudentSupport />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Sidebar for Course Navigation */}
            <div className="w-full lg:w-72 flex-shrink-0">
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5 sticky top-24">
                <div className="mb-6 pb-6 border-b border-slate-100">
                  <button 
                    onClick={() => setSelectedCourseId(null)}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                    العودة للكورسات
                  </button>
                </div>
                
                <h3 className="text-xs font-black text-slate-400 mb-4 px-3 uppercase tracking-wider">محتويات الكورس</h3>
                
                <nav className="flex flex-col gap-2">
                  <button onClick={() => setActiveTab('videos')} className={\`flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold transition-all duration-300 \${activeTab === 'videos' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'}\`}>
                    <span className="text-xl">🎬</span><span>محاضرات</span>
                  </button>
                  <button onClick={() => setActiveTab('materials')} className={\`flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold transition-all duration-300 \${activeTab === 'materials' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' : 'text-slate-600 hover:bg-slate-50 hover:text-emerald-600'}\`}>
                    <span className="text-xl">📚</span><span>مذكرات</span>
                  </button>
                  <button onClick={() => setActiveTab('exams')} className={\`flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold transition-all duration-300 \${activeTab === 'exams' ? 'bg-amber-500 text-white shadow-md shadow-amber-200' : 'text-slate-600 hover:bg-slate-50 hover:text-amber-500'}\`}>
                    <span className="text-xl">📝</span><span>امتحانات</span>
                  </button>
                  <button onClick={() => setActiveTab('homework')} className={\`flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold transition-all duration-300 \${activeTab === 'homework' ? 'bg-teal-600 text-white shadow-md shadow-teal-200' : 'text-slate-600 hover:bg-slate-50 hover:text-teal-600'}\`}>
                    <span className="text-xl">🏠</span><span>واجبات وتسميع</span>
                  </button>
                  <button onClick={() => setActiveTab('performance')} className={\`flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold transition-all duration-300 \${activeTab === 'performance' ? 'bg-purple-600 text-white shadow-md shadow-purple-200' : 'text-slate-600 hover:bg-slate-50 hover:text-purple-600'}\`}>
                    <span className="text-xl">📈</span><span>تقارير المتابعة</span>
                  </button>
                </nav>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 min-w-0">
              {activeTab === 'performance' ? (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto">
                  <StudentPerformance subscribedCourses={selectedCourseId === 'all' ? subscribedCourses : [selectedCourseId]} />
                </motion.div>
              ) : (activeTab === 'exams' || activeTab === 'homework') ? (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto">
                  <StudentExams subscribedCourses={selectedCourseId === 'all' ? subscribedCourses : [selectedCourseId]} activeTab={activeTab} />
                </motion.div>
              ) : (
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px]">
                  {loading ? (
                    <div className="flex justify-center p-20"><Loader2 className="w-10 h-10 text-indigo-600 animate-spin" /></div>
                  ) : materials.length === 0 ? (
                    <div className="p-20 text-center flex flex-col items-center">
                      <div className="text-6xl mb-6 float-animation">
                        {activeTab === 'videos' ? '🎬' : '📚'}
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 mb-2">لا توجد محتويات حالياً</h3>
                      <p className="text-slate-500">سيتم إضافة المحتوى قريباً من قبل المعلم.</p>
                    </div>
                  ) : (
                    <div className="p-6">
                      {Array.from(new Set(materials.map(m => m.lessonName || 'محتوى عام'))).map(lesson => (
                        <div key={lesson} className="mb-10 last:mb-0">
                          <h3 className="text-lg font-black text-slate-800 mb-4 pb-2 border-b-2 border-slate-100 flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-indigo-600" />
                            {lesson}
                          </h3>
                          <div className="grid md:grid-cols-2 gap-4">
                            {materials.filter(m => (m.lessonName || 'محتوى عام') === lesson).map((item) => (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                key={item.id}
                                className="group bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl transition-all hover:border-indigo-200 flex flex-col"
                              >
                                {item.thumbnailBase64 && (
                                  <div className="h-40 overflow-hidden relative bg-black">
                                    <img src={item.thumbnailBase64} alt={item.title} className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500" />
                                    {activeTab === 'videos' && (
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center group-hover:bg-indigo-600 transition-colors duration-300">
                                          <PlayCircle className="w-6 h-6 text-white" />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                                <div className="p-5 flex-1 flex flex-col justify-between">
                                  <div>
                                    <h4 className="font-bold text-slate-800 mb-2 text-lg line-clamp-2">{item.title}</h4>
                                    {item.description && (
                                      <p className="text-sm text-slate-500 line-clamp-2 mb-4">{item.description}</p>
                                    )}
                                  </div>
                                  
                                  {activeTab === 'videos' ? (
                                    <button 
                                      onClick={() => setPlayingVideo(item)}
                                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all bg-indigo-100 text-indigo-700 hover:bg-indigo-600 hover:text-white"
                                    >
                                      <PlayCircle className="w-5 h-5" />
                                      تشغيل المحاضرة
                                    </button>
                                  ) : (
                                    <button 
                                      onClick={() => setPlayingVideo(item)}
                                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all bg-emerald-100 text-emerald-700 hover:bg-emerald-600 hover:text-white"
                                    >
                                      <Download className="w-5 h-5" />
                                      عرض المذكرة
                                    </button>
                                  )}
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {playingVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-black rounded-3xl overflow-hidden w-full max-w-5xl shadow-2xl relative border border-slate-800"
            >
              <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-10 flex justify-between items-center">
                <h3 className="text-white font-bold">{playingVideo.title}</h3>
                <button 
                  onClick={() => setPlayingVideo(null)}
                  className="text-white hover:text-rose-400 transition-colors bg-white/10 hover:bg-white/20 p-2 rounded-full"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
                
              <div className="absolute inset-0 pointer-events-none overflow-hidden z-20 flex items-center justify-center opacity-30 mix-blend-overlay">
                <motion.div
                  animate={{ x: [0, 300, 0, -300, 0], y: [0, 200, -200, 0, 200] }}
                  transition={{ duration: 30, ease: "linear", repeat: Infinity }}
                  className="text-white font-black text-4xl drop-shadow-lg select-none whitespace-nowrap"
                  dir="ltr"
                >
                  {appUser?.phone || appUser?.email}
                </motion.div>
              </div>

              {playingVideo.url ? (
                playingVideo.type === 'pdf' ? (
                  <iframe src={getEmbedUrl(playingVideo.url)} className="w-full h-[85vh] bg-white border-0 rounded-b-3xl"></iframe>
                ) : (
                  <iframe
                    src={getEmbedUrl(playingVideo.url)}
                    className="w-full h-[75vh] bg-black border-0 rounded-b-3xl"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  ></iframe>
                )
              ) : (
                <video 
                  src={playingVideo.videoBase64} 
                  controls 
                  autoPlay
                  controlsList="nodownload"
                  onContextMenu={e => e.preventDefault()}
                  className="w-full h-[75vh] object-contain rounded-b-3xl"
                >
                  متصفحك لا يدعم تشغيل الفيديو.
                </video>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );`;

// Find `return (` and replace everything after it.
const startIdx = code.indexOf('return (');
if (startIdx !== -1) {
  code = code.substring(0, startIdx) + newRender + '\n}';
  fs.writeFileSync('src/pages/StudentDashboard.tsx', code);
}
