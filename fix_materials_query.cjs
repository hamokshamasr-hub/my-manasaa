const fs = require('fs');
let dash = fs.readFileSync('src/pages/StudentDashboard.tsx', 'utf-8');

const oldEffect = `    setLoading(true);
    let q = query(collection(db, 'materials'), where('courseId', '==', selectedCourseId));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Material[];
      
      data.sort((a, b) => (a.order || 0) - (b.order || 0));

      const typeFilter = activeTab === 'videos' ? 'video' : 'pdf';
      setMaterials(data.filter(m => m.type === typeFilter));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching materials:", error);
      setLoading(false);
    });

    return () => unsubscribe();`;

const newEffect = `    // Security Check
    if (selectedCourseId !== 'all' && !subscribedCourses.includes(selectedCourseId)) {
      setMaterials([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    // Fetch materials for backwards compatibility (courseId) AND new format (courseIds)
    const q1 = query(collection(db, 'materials'), where('courseId', '==', selectedCourseId));
    const q2 = query(collection(db, 'materials'), where('courseIds', 'array-contains', selectedCourseId));
    
    const fetchMaterials = async () => {
      try {
        const [snap1, snap2] = await Promise.all([
          import('firebase/firestore').then(m => m.getDocs(q1)),
          import('firebase/firestore').then(m => m.getDocs(q2))
        ]);
        
        const allData = new Map();
        snap1.docs.forEach(doc => allData.set(doc.id, { id: doc.id, ...doc.data() }));
        snap2.docs.forEach(doc => allData.set(doc.id, { id: doc.id, ...doc.data() }));
        
        const data = Array.from(allData.values()) as Material[];
        data.sort((a, b) => {
          if (a.createdAt && b.createdAt) return b.createdAt - a.createdAt; // Newer first
          return (a.order || 0) - (b.order || 0);
        });

        const typeFilter = activeTab === 'videos' ? 'video' : 'pdf';
        setMaterials(data.filter(m => m.type === typeFilter));
        setLoading(false);
      } catch (error) {
        console.error("Error fetching materials:", error);
        setLoading(false);
      }
    };
    
    fetchMaterials();
    // Since we are doing a compound OR, we fallback to getDocs instead of onSnapshot to avoid complex listener merging, 
    // or we can just fetch on mount/change.`;

dash = dash.replace(oldEffect, newEffect);
fs.writeFileSync('src/pages/StudentDashboard.tsx', dash);
