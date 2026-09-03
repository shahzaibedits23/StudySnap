export interface Quiz {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation?: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
}

export interface DiagramData {
  type: string;
  title: string;
  code: string;
  description?: string;
}

export interface SearchSource {
  title: string;
  url: string;
}

export interface AIResponse {
  directAnswer?: string;
  keyTakeaways?: string[];
  explanation: string;
  stepByStep: string;
  eli10: string;
  commonMistakes?: string;
  quizzes: Quiz[];
  relatedTopics: string[];
  diagram?: DiagramData;
  searchSources?: SearchSource[];
  searchQueries?: string[];
}

export interface Note extends AIResponse {
  id: string;
  userId: string;
  timestamp: number;
  questionText?: string;
  questionImage?: string;
}

export type ViewState = 'home' | 'text_input' | 'loading' | 'result' | 'notes' | 'note_detail';

