const fs = require('fs');
let code = fs.readFileSync('src/pages/StudentDashboard.tsx', 'utf-8');

const missingHooks = `
      return () => unsubscribePayments();
    });
    return () => unsubscribeAllCourses();
  }, [user, appUser]);

  useEffect(() => {
    if (subscribedCourses.length === 0) {
      setCoursesData([]);
      return;
    }
    const q = query(collection(db, 'courses'));
    const unsub = onSnapshot(q, (snapshot) => {
      const allCourses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const relevant = allCourses.filter(c => subscribedCourses.includes(c.id));
      setCoursesData(relevant);
      
      if (relevant.length === 1 && !selectedCourseId) {
        setSelectedCourseId(relevant[0].id);
      }
    });
    return () => unsub();
  }, [subscribedCourses, selectedCourseId]);

  useEffect(() => {
    if ((!user && !appUser) || !selectedCourseId || activeTab === 'support' || activeTab === 'exams' || activeTab === 'homework' || activeTab === 'performance') {
      if (activeTab === 'support' || activeTab === 'exams' || activeTab === 'homework' || activeTab === 'performance') setLoading(false);
      return;
    }
    
    setLoading(true);
    let q = query(collection(db, 'materials'), where('courseId', '==', selectedCourseId));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      data.sort((a, b) => (a.order || 0) - (b.order || 0));

      const typeFilter = activeTab === 'videos' ? 'video' : 'pdf';
      setMaterials(data.filter(m => m.type === typeFilter));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching materials:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, appUser, selectedCourseId, activeTab]);

  if (authLoading || checkingSub) {
    return <div className="flex-grow flex items-center justify-center"><Loader2 className="w-12 h-12 text-indigo-600 animate-spin" /></div>;
  }

  if (!user && !appUser) {
    return <Navigate to="/" replace />;
  }
`;

const lines = code.split('\n');
const injectIdx = lines.findIndex(l => l.includes('setCheckingSub(false);')) + 2; // this is at line 114
lines.splice(114, 0, missingHooks);

fs.writeFileSync('src/pages/StudentDashboard.tsx', lines.join('\n'));
