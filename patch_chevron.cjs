const fs = require('fs');
let code = fs.readFileSync('src/pages/StudentDashboard.tsx', 'utf-8');
code = code.replace("import { Video, FileText, Lock, Loader2, PlayCircle, Download, MessageCircle, X, CheckSquare, BookOpen, Clock } from 'lucide-react';",
"import { Video, FileText, Lock, Loader2, PlayCircle, Download, MessageCircle, X, CheckSquare, BookOpen, Clock, ChevronLeft } from 'lucide-react';");
fs.writeFileSync('src/pages/StudentDashboard.tsx', code);
