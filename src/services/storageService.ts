import { Note } from '../types';
import { db, auth } from '../firebase';
import { collection, doc, setDoc, deleteDoc, getDocs, query, where, orderBy } from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string;
    providerInfo?: any[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email || undefined,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId || undefined,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function getNotes(): Promise<Note[]> {
  if (!auth.currentUser) return [];
  const path = 'notes';
  try {
    const q = query(
      collection(db, path), 
      where('userId', '==', auth.currentUser.uid),
      orderBy('timestamp', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Note);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function saveNote(note: Note): Promise<void> {
  if (!auth.currentUser) throw new Error("Must be logged in to save notes");
  const path = `notes/${note.id}`;
  try {
    // Ensure userId is set to current user
    const noteToSave = { ...note, userId: auth.currentUser.uid };
    // We don't await setDoc here so that it resolves immediately for offline support.
    // Firestore will queue the write and sync it when online.
    setDoc(doc(db, 'notes', note.id), noteToSave).catch(error => {
      console.error("Background sync failed:", error);
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteNote(id: string): Promise<void> {
  if (!auth.currentUser) return;
  const path = `notes/${id}`;
  try {
    // We don't await deleteDoc here so that it resolves immediately for offline support.
    deleteDoc(doc(db, 'notes', id)).catch(error => {
      console.error("Background delete failed:", error);
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

