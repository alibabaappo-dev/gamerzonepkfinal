import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  getDoc, 
  doc, 
  onSnapshot, 
  Firestore,
  DocumentData,
  QueryConstraint
} from 'firebase/firestore';

interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache: Record<string, CacheEntry> = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function getCachedDoc(db: Firestore, collectionName: string, docId: string) {
  const cacheKey = `${collectionName}/${docId}`;
  const now = Date.now();

  if (cache[cacheKey] && (now - cache[cacheKey].timestamp < CACHE_DURATION)) {
    return cache[cacheKey].data;
  }

  try {
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = { id: docSnap.id, ...docSnap.data() };
      cache[cacheKey] = { data, timestamp: now };
      return data;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching doc ${cacheKey}:`, error);
    throw error;
  }
}

export async function getCachedDocs(
  db: Firestore, 
  collectionName: string, 
  constraints: QueryConstraint[] = []
) {
  const cacheKey = `collection/${collectionName}`;
  const now = Date.now();

  if (cache[cacheKey] && (now - cache[cacheKey].timestamp < CACHE_DURATION)) {
    return cache[cacheKey].data;
  }

  try {
    const q = query(collection(db, collectionName), ...constraints);
    const querySnapshot = await getDocs(q);
    const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    cache[cacheKey] = { data, timestamp: now };
    return data;
  } catch (error) {
    console.error(`Error fetching collection ${collectionName}:`, error);
    throw error;
  }
}

export function listenToDoc(
  db: Firestore, 
  collectionName: string, 
  docId: string, 
  onUpdate: (data: any) => void,
  onError?: (error: any) => void
) {
  const docRef = doc(db, collectionName, docId);
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      onUpdate({ id: docSnap.id, ...docSnap.data() });
    } else {
      onUpdate(null);
    }
  }, (error) => {
    if (onError) onError(error);
  });
}

export function listenToCollection(
  db: Firestore, 
  collectionName: string, 
  constraints: QueryConstraint[], 
  onUpdate: (data: any[]) => void,
  onError?: (error: any) => void
) {
  const q = query(collection(db, collectionName), ...constraints);
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    onUpdate(data);
  }, (error) => {
    if (onError) onError(error);
  });
}

export function clearFirestoreCache() {
  Object.keys(cache).forEach(key => delete cache[key]);
  }
