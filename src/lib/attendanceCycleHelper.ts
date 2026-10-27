export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  studentCode?: string;
  date: string; // e.g. "05/10/2026"
  time: string; // e.g. "04:30:15 م"
  timestamp: number;
  status: 'present' | 'absent' | 'late' | 'excused';
  sessionName?: string;
  notes?: string;
  isExtraSession?: boolean;
}

export interface CycleValidationResult {
  allowed: boolean;
  isDoubleScanToday: boolean;
  isCycleDuplicate: boolean;
  isAlternativeDay: boolean;
  existingRecord?: AttendanceRecord;
  title: string;
  message: string;
  suggestedAction?: 'block' | 'prompt_alternative' | 'allow';
  badgeColor?: 'red' | 'amber' | 'green';
}

const DAY_NAMES = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

/**
 * Returns the timestamp of Saturday 00:00:00 for the current week (Egyptian academic week starts on Saturday)
 */
export function getEgyptianWeekRange(now: Date = new Date()): { startOfWeek: number; endOfWeek: number } {
  const d = new Date(now);
  const day = d.getDay(); // 0 (Sun) to 6 (Sat)
  // Distance back to Saturday:
  // Sat(6)->0, Sun(0)->1, Mon(1)->2, Tue(2)->3, Wed(3)->4, Thu(4)->5, Fri(5)->6
  const diffToSat = (day + 1) % 7;
  
  const sat = new Date(d);
  sat.setDate(d.getDate() - diffToSat);
  sat.setHours(0, 0, 0, 0);

  const nextSat = new Date(sat);
  nextSat.setDate(sat.getDate() + 7);

  return {
    startOfWeek: sat.getTime(),
    endOfWeek: nextSat.getTime()
  };
}

/**
 * Validates whether a student can attend today according to:
 * 1. Double scan on same day prevention.
 * 2. Weekly cycle distribution (Cycle 1: Sat/Sun/Mon, Cycle 2: Tue/Wed/Thu).
 * 3. Missed day replacement (e.g. absent Sat -> can attend Sun as alternative).
 */
export function validateStudentAttendanceCycle(
  student: { uid: string; name: string; centerGroup?: string; centerGroups?: string[] },
  attendanceList: AttendanceRecord[],
  currentDate: Date = new Date()
): CycleValidationResult {
  const todayDay = currentDate.getDay(); // 0 to 6
  const todayDateStr = currentDate.toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const todayDayName = DAY_NAMES[todayDay];

  // 1. Check double attendance TODAY
  const todayAttended = attendanceList.find(a => 
    a.studentId === student.uid && 
    a.date === todayDateStr && 
    (a.status === 'present' || a.status === 'late')
  );

  if (todayAttended) {
    return {
      allowed: false,
      isDoubleScanToday: true,
      isCycleDuplicate: true,
      isAlternativeDay: false,
      existingRecord: todayAttended,
      title: '⛔ تكرار حضور في نفس اليوم!',
      message: `الطالب [${student.name}] سجل حضوره مسبقاً اليوم (${todayDayName}) الساعة ${todayAttended.time || 'مبكراً'}. وفقاً لنظام السنتر: يمنع منعاً باتاً تسجيل حضور الطالب مرتين في نفس اليوم.`,
      suggestedAction: 'block',
      badgeColor: 'red'
    };
  }

  // 2. Get all attendances of this student in the current week (Saturday to Friday)
  const { startOfWeek, endOfWeek } = getEgyptianWeekRange(currentDate);
  const weekRecords = attendanceList.filter(a =>
    a.studentId === student.uid &&
    (a.status === 'present' || a.status === 'late') &&
    a.timestamp >= startOfWeek &&
    a.timestamp < endOfWeek
  );

  // Helper to test which cycle a day belongs to:
  // Cycle 1: Sat (6), Sun (0), Mon (1) -> First lecture of the week
  // Cycle 2: Tue (2), Wed (3), Thu (4) -> Second lecture of the week
  // Cycle Friday: Fri (5) -> Special / Revision
  const isCycle1 = (dayIdx: number) => dayIdx === 6 || dayIdx === 0 || dayIdx === 1;
  const isCycle2 = (dayIdx: number) => dayIdx === 2 || dayIdx === 3 || dayIdx === 4;

  const cycle1Record = weekRecords.find(r => {
    const recDay = new Date(r.timestamp).getDay();
    return isCycle1(recDay);
  });

  const cycle2Record = weekRecords.find(r => {
    const recDay = new Date(r.timestamp).getDay();
    return isCycle2(recDay);
  });

  // Collect student registered groups to detect official days
  const studentGroups: string[] = [];
  if (student.centerGroup) studentGroups.push(student.centerGroup);
  if (Array.isArray(student.centerGroups)) studentGroups.push(...student.centerGroups);
  const groupText = studentGroups.join(' ').toLowerCase();

  const isOfficialSat = groupText.includes('سبت');
  const isOfficialSun = groupText.includes('أحد') || groupText.includes('احد') || groupText.includes('حد');
  const isOfficialMon = groupText.includes('إثنين') || groupText.includes('اثنين') || groupText.includes('اتنين');
  const isOfficialTue = groupText.includes('ثلاثاء') || groupText.includes('تلات');
  const isOfficialWed = groupText.includes('أربعاء') || groupText.includes('اربعاء') || groupText.includes('اربع');
  const isOfficialThu = groupText.includes('خميس');
  const isOfficialFri = groupText.includes('جمعة') || groupText.includes('جمعه');

  // CASE 3: TODAY IS IN CYCLE 1 (السبت، الأحد، الإثنين)
  if (isCycle1(todayDay)) {
    if (cycle1Record) {
      const recDay = new Date(cycle1Record.timestamp).getDay();
      const recDayName = DAY_NAMES[recDay];
      return {
        allowed: false,
        isDoubleScanToday: false,
        isCycleDuplicate: true,
        isAlternativeDay: false,
        existingRecord: cycle1Record,
        title: '⛔ تكرار حضور حصة أول الأسبوع (مخالفة الدورة)!',
        message: `الطالب حضر حصة أول الأسبوع بالفعل يوم (${recDayName} - ${cycle1Record.date} الساعة ${cycle1Record.time})! وفقاً للائحة السنتر: لو حضر السبت لا يجوز له حضور الأحد أو الإثنين، وتكرار نفس الحصة مرفوض.`,
        suggestedAction: 'block',
        badgeColor: 'red'
      };
    }

    // Student has NOT attended Cycle 1 yet this week!
    // Check if today matches student's official day:
    const isTodayOfficial = 
      (todayDay === 6 && isOfficialSat) ||
      (todayDay === 0 && isOfficialSun) ||
      (todayDay === 1 && isOfficialMon);

    if (!isTodayOfficial && (isOfficialSat || isOfficialSun || isOfficialMon)) {
      // Missed official day, entering as substitute/alternative
      const expectedDay = isOfficialSat ? 'السبت' : (isOfficialSun ? 'الأحد' : 'الإثنين');
      return {
        allowed: true,
        isDoubleScanToday: false,
        isCycleDuplicate: false,
        isAlternativeDay: true,
        title: '⚠️ دخول استثنائي تعويضي (بديل لموعد المجموعة)',
        message: `مجموعة الطالب الرسمية هي (${student.centerGroup || 'غير محددة'}) وموعدها الأساسي يوم [${expectedDay}]. نظراً لغياب الطالب يوم ${expectedDay}، متاح تسجيله الآن كـ [حضور استثنائي تعويضي لحصة أول الأسبوع].`,
        suggestedAction: 'prompt_alternative',
        badgeColor: 'amber'
      };
    }
  }

  // CASE 4: TODAY IS IN CYCLE 2 (الثلاثاء، الأربعاء، الخميس)
  if (isCycle2(todayDay)) {
    if (cycle2Record) {
      const recDay = new Date(cycle2Record.timestamp).getDay();
      const recDayName = DAY_NAMES[recDay];
      return {
        allowed: false,
        isDoubleScanToday: false,
        isCycleDuplicate: true,
        isAlternativeDay: false,
        existingRecord: cycle2Record,
        title: '⛔ تكرار حضور حصة نصف الأسبوع (مخالفة الدورة)!',
        message: `الطالب حضر حصة وسط الأسبوع بالفعل يوم (${recDayName} - ${cycle2Record.date} الساعة ${cycle2Record.time})! وفقاً للائحة السنتر: لو حضر الثلاثاء لا يجوز له حضور الأربعاء أو الخميس، وتكرار نفس الحصة مرفوض.`,
        suggestedAction: 'block',
        badgeColor: 'red'
      };
    }

    // Student has NOT attended Cycle 2 yet this week!
    const isTodayOfficial = 
      (todayDay === 2 && isOfficialTue) ||
      (todayDay === 3 && isOfficialWed) ||
      (todayDay === 4 && isOfficialThu);

    if (!isTodayOfficial && (isOfficialTue || isOfficialWed || isOfficialThu)) {
      const expectedDay = isOfficialTue ? 'الثلاثاء' : (isOfficialWed ? 'الأربعاء' : 'الخميس');
      return {
        allowed: true,
        isDoubleScanToday: false,
        isCycleDuplicate: false,
        isAlternativeDay: true,
        title: '⚠️ دخول استثنائي تعويضي (بديل لموعد المجموعة)',
        message: `مجموعة الطالب الرسمية هي (${student.centerGroup || 'غير محددة'}) وموعدها الأساسي يوم [${expectedDay}]. نظراً لغياب الطالب يوم ${expectedDay}، متاح تسجيله الآن كـ [حضور استثنائي تعويضي لحصة نصف الأسبوع].`,
        suggestedAction: 'prompt_alternative',
        badgeColor: 'amber'
      };
    }
  }

  // CASE 5: TODAY IS FRIDAY (حصة خاصة / مراجعة)
  if (todayDay === 5) {
    if (!isOfficialFri && groupText.length > 0) {
      return {
        allowed: true,
        isDoubleScanToday: false,
        isCycleDuplicate: false,
        isAlternativeDay: true,
        title: 'ℹ️ حضور يوم الجمعة (حصة إضافية أو مراجعة)',
        message: `اليوم الجمعة، ومجموعة الطالب الرسمية (${student.centerGroup || '-'}). سيتم تسجيل الطالب لحضور حصة الجمعة الخاصة.`,
        suggestedAction: 'allow',
        badgeColor: 'green'
      };
    }
  }

  // Regular attendance
  return {
    allowed: true,
    isDoubleScanToday: false,
    isCycleDuplicate: false,
    isAlternativeDay: false,
    title: '✅ الموعد متطابق ومصرح بالدخول',
    message: `موعد الطالب متطابق تماماً مع مجموعته (${student.centerGroup || 'عامة'}).`,
    suggestedAction: 'allow',
    badgeColor: 'green'
  };
}
