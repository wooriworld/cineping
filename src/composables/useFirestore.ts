import {
  collection,
  doc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  type WhereFilterOp,
} from 'firebase/firestore';
import { db } from 'src/firebase.js';

export function useFirestore() {
  async function getAll<T>(collectionName: string): Promise<T[]> {
    const snap = await getDocs(collection(db, collectionName));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
  }

  async function getWhere<T>(
    collectionName: string,
    field: string,
    op: WhereFilterOp,
    value: unknown,
  ): Promise<T[]> {
    const q = query(collection(db, collectionName), where(field, op, value));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
  }

  async function create<T extends object>(
    collectionName: string,
    data: T,
    id?: string,
  ): Promise<string> {
    if (id) {
      await setDoc(doc(db, collectionName, id), data);
      return id;
    }
    const ref = await addDoc(collection(db, collectionName), data);
    return ref.id;
  }

  async function update(
    collectionName: string,
    id: string,
    data: Partial<Record<string, unknown>>,
  ): Promise<void> {
    await updateDoc(doc(db, collectionName, id), data);
  }

  async function remove(collectionName: string, id: string): Promise<void> {
    await deleteDoc(doc(db, collectionName, id));
  }

  return { getAll, getWhere, create, update, remove };
}
