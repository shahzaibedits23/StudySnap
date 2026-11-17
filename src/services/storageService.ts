import { Note } from '../types';

const STORAGE_KEY = 'studysnap_saved_notes';

function getLocalNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Note[];
  } catch (e) {
    console.error("Failed to read notes from localStorage", e);
    return [];
  }
}

function saveLocalNote(note: Note): void {
  try {
    const existing = getLocalNotes();
    const filtered = existing.filter(n => n.id !== note.id);
    const updated = [note, ...filtered];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to save note to localStorage", e);
  }
}

function deleteLocalNote(id: string): void {
  try {
    const existing = getLocalNotes();
    const updated = existing.filter(n => n.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to delete note from localStorage", e);
  }
}

export async function getNotes(): Promise<Note[]> {
  return getLocalNotes();
}

export async function saveNote(note: Note): Promise<void> {
  saveLocalNote(note);
}

export async function deleteNote(id: string): Promise<void> {
  deleteLocalNote(id);
}
