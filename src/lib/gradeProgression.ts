export const GRADE_PROGRESSION: Record<string, string> = {
  'الصف الأول الإعدادي': 'الصف الثاني الإعدادي',
  'الصف الثاني الإعدادي': 'الصف الثالث الإعدادي',
  'الصف الثالث الإعدادي': 'الصف الأول الثانوي',
  'الصف الأول الثانوي': 'الصف الثاني الثانوي',
  'الصف الثاني الثانوي': 'الصف الثالث الثانوي',
  'الصف الثالث الثانوي': 'خريج (إتمام الثانوية العامة)',
  'الصف الأول بكالوريا': 'الصف الثاني بكالوريا',
  'الصف الثاني بكالوريا': 'الصف الثالث بكالوريا',
  'الصف الثالث بكالوريا': 'خريج (إتمام البكالوريا)'
};

export const getNextGrade = (currentGrade?: string): string | null => {
  if (!currentGrade) return null;
  return GRADE_PROGRESSION[currentGrade.trim()] || null;
};

export const canPromoteGrade = (currentGrade?: string): boolean => {
  const next = getNextGrade(currentGrade);
  return next !== null && !next.includes('خريج');
};
