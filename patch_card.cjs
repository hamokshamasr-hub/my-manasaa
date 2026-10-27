const fs = require('fs');
let code = fs.readFileSync('src/components/AdminAssistants.tsx', 'utf-8');

if (!code.includes("import { QRCodeSVG } from 'qrcode.react';")) {
  code = code.replace("import { Loader2", "import { QRCodeSVG } from 'qrcode.react';\nimport { Loader2");
}

const cardStartIdx = code.indexOf('<div id="printable-student-card"');
const cardEndIdx = code.indexOf('</div>\n\n                {/* FAST COURSE ACCESS BUTTON */}');

if (cardStartIdx !== -1 && cardEndIdx !== -1) {
  // We can just replace the layout inside the card
  const newLayout = `
                <div className="flex justify-between items-start border-b border-indigo-700/60 pb-3">
                  <div>
                    <div className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">{settings.platformName || 'منصة التعليم'}</div>
                    <div className="text-sm font-black text-white">{settings.teacherName || 'بطاقة الطالب'}</div>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap justify-end">
                    <span className="bg-amber-400 text-slate-900 px-2 py-0.5 rounded-full text-[10px] font-black shadow-sm">
                      {foundStudent.isCenterStudent ? 'سنتر' : 'أونلاين'}
                    </span>
                    {foundStudent.banned && (
                      <span className="bg-rose-500 text-white px-2 py-0.5 rounded-full text-[10px] font-bold">
                        محظور
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-indigo-200 block mb-0.5">الاسم</span>
                        <span className="font-bold text-white text-sm block truncate pr-1">{foundStudent.name}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-indigo-200 block mb-0.5">الصف</span>
                        <span className="font-bold text-amber-300 block truncate pr-1">{foundStudent.grade || '-'}</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-indigo-200 block mb-0.5">كود الطالب</span>
                          <button 
                            onClick={() => handleUpdateCode(foundStudent.uid, foundStudent.code)}
                            className="text-[9px] text-indigo-300 hover:text-white underline print:hidden"
                          >
                            تعديل
                          </button>
                        </div>
                        <span className="font-mono font-black text-sm text-yellow-400 bg-black/30 px-1.5 py-0.5 rounded border border-yellow-400/30 inline-block">{foundStudent.code || '-'}</span>
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-indigo-200 block mb-0.5">كلمة المرور</span>
                          <button 
                            onClick={() => handleUpdatePassword(foundStudent.uid, foundStudent.password)}
                            className="text-[9px] text-indigo-300 hover:text-white underline print:hidden"
                          >
                            تعديل
                          </button>
                        </div>
                        <span className="font-mono font-bold text-sm text-emerald-300 bg-black/30 px-1.5 py-0.5 rounded border border-emerald-400/30 inline-block">{foundStudent.password || '-'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="w-16 h-16 bg-white p-1 rounded-xl shadow-inner flex items-center justify-center flex-shrink-0">
                    <QRCodeSVG 
                      value={\`\${window.location.origin}/report/\${foundStudent.code}\`} 
                      size={56} 
                      level="L"
                      includeMargin={false}
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-indigo-700/60 grid grid-cols-2 gap-2 text-[10px] text-indigo-200">
                  <div>طالب: <span className="text-white font-mono" dir="ltr">{foundStudent.phone || '-'}</span></div>
                  <div>ولي أمر: <span className="text-white font-mono" dir="ltr">{foundStudent.parentPhone || '-'}</span></div>
                </div>`;

  const beforeCard = code.substring(0, cardStartIdx + code.substring(cardStartIdx).indexOf('>') + 1);
  const afterCard = code.substring(cardEndIdx);
  
  fs.writeFileSync('src/components/AdminAssistants.tsx', beforeCard + '\n' + newLayout + '\n' + afterCard);
}
