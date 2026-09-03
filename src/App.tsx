import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, Type as TypeIcon, BookOpen, ChevronLeft, Share2, Save, CheckCircle, Circle, 
  Loader2, Image as ImageIcon, Trash2, ArrowRight, LogOut, Lightbulb, Sun, Moon, 
  Search, X, Sparkles, Copy, Check, Volume2, VolumeX, AlertTriangle, RotateCcw, 
  CheckCircle2, Award, Compass, HelpCircle, ArrowUpRight, GitFork
} from 'lucide-react';
import { MermaidDiagram } from './components/MermaidDiagram';
import { analyzeQuestion } from './services/geminiService';
import { saveNote, getNotes, deleteNote } from './services/storageService';
import { Note, Quiz, ViewState } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { auth, signInWithGoogle, logOut } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function App() {
  const [view, setView] = useState<ViewState>('home');
  const [loadingText, setLoadingText] = useState('');
  const [currentResult, setCurrentResult] = useState<Note | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('studysnap_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('studysnap_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error(error);
      showToast("Failed to sign in.", "error");
    }
  };

  const handleLogout = async () => {
    try {
      await logOut();
      setNotes([]);
      setView('home');
    } catch (error) {
      console.error(error);
    }
  };

  const handleGoHome = () => {
    setView('home');
    setCurrentResult(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setView('loading');
    setLoadingText('Processing image...');

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      const mimeType = file.type;
      
      const img = new Image();
      img.src = base64;
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const compressedBase64 = canvas.toDataURL(mimeType, 0.7);

        setLoadingText('Analyzing image...');
        
        try {
          const result = await analyzeQuestion(undefined, compressedBase64, mimeType);
          const newNote: Note = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            questionImage: compressedBase64,
            userId: user?.uid || 'anonymous',
            ...result
          };
          setCurrentResult(newNote);
          setView('result');
        } catch (error) {
          console.error(error);
          showToast("Failed to analyze image. Please try again.", "error");
          setView('home');
        }
      };
    };
    reader.readAsDataURL(file);
  };

  const handleTextSubmit = async (text: string) => {
    if (!text.trim()) return;
    
    setView('loading');
    setLoadingText('Analyzing question...');
    
    try {
      const result = await analyzeQuestion(text);
      const newNote: Note = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        questionText: text,
        userId: user?.uid || 'anonymous',
        ...result
      };
      setCurrentResult(newNote);
      setView('result');
    } catch (error) {
      console.error(error);
      showToast("Failed to analyze text. Please try again.", "error");
      setView('home');
    }
  };

  const handleSaveNote = async () => {
    if (!user) {
      showToast("Please sign in to save notes.", "error");
      return;
    }
    if (currentResult) {
      try {
        await saveNote(currentResult);
        showToast("Note saved successfully!", "success");
      } catch (error) {
        console.error("Failed to save note", error);
        showToast("Failed to save note.", "error");
      }
    }
  };

  const handleOpenNotes = async () => {
    if (!user) {
      showToast("Please sign in to view notes.", "error");
      return;
    }
    setView('loading');
    setLoadingText('Loading notes...');
    try {
      const fetchedNotes = await getNotes();
      setNotes(fetchedNotes);
      setView('notes');
    } catch (error) {
      console.error(error);
      showToast("Failed to load notes.", "error");
      setView('home');
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-950 flex justify-center transition-colors duration-200">
        <div className="w-full max-w-md bg-white dark:bg-gray-900 min-h-screen shadow-2xl flex flex-col items-center justify-center p-6 border-x dark:border-gray-800 relative">
          <div className="absolute top-5 right-5">
            <ThemeToggleButton theme={theme} onToggle={toggleTheme} />
          </div>
          <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-500/20">
            <BookOpen className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">StudySnap AI</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-10 text-center">Sign in to save your notes, generate quizzes, and access your study history across devices.</p>
          <button 
            onClick={handleLogin}
            className="w-full bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:border-blue-600 dark:hover:border-blue-500 text-gray-800 dark:text-gray-100 p-4 rounded-2xl flex items-center justify-center shadow-sm transition-all active:scale-95 cursor-pointer font-semibold"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6 mr-3" />
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans flex justify-center transition-colors duration-200">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 min-h-screen shadow-2xl relative flex flex-col overflow-hidden border-x dark:border-gray-800">
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              className={`absolute top-4 left-4 right-4 z-50 p-4 rounded-xl shadow-lg text-white font-medium flex items-center justify-center ${
                toast.type === 'error' ? 'bg-red-500' : toast.type === 'success' ? 'bg-green-500' : 'bg-blue-500'
              }`}
            >
              {toast.message}
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <HomeView 
              key="home"
              user={user}
              theme={theme}
              onToggleTheme={toggleTheme}
              onLogout={handleLogout}
              onScanClick={() => fileInputRef.current?.click()}
              onTextClick={() => setView('text_input')}
              onNotesClick={handleOpenNotes}
            />
          )}
          {view === 'text_input' && (
            <TextInputView 
              key="text"
              theme={theme}
              onToggleTheme={toggleTheme}
              onBack={handleGoHome}
              onSubmit={handleTextSubmit}
            />
          )}
          {view === 'loading' && (
            <LoadingView key="loading" text={loadingText} />
          )}
          {view === 'result' && currentResult && (
            <ResultView 
              key="result"
              note={currentResult}
              theme={theme}
              onToggleTheme={toggleTheme}
              onBack={handleGoHome}
              onSave={handleSaveNote}
              onShowToast={showToast}
              onExploreTopic={handleTextSubmit}
            />
          )}
          {view === 'notes' && (
            <NotesListView 
              key="notes"
              notes={notes}
              theme={theme}
              onToggleTheme={toggleTheme}
              onBack={handleGoHome}
              onSelectNote={(note) => {
                setSelectedNote(note);
                setView('note_detail');
              }}
              onDeleteNote={async (id) => {
                await deleteNote(id);
                setNotes(await getNotes());
                showToast("Note deleted.", "success");
              }}
            />
          )}
          {view === 'note_detail' && selectedNote && (
            <ResultView 
              key="note_detail"
              note={selectedNote}
              theme={theme}
              onToggleTheme={toggleTheme}
              onBack={() => setView('notes')}
              isSaved={true}
              onShowToast={showToast}
              onExploreTopic={handleTextSubmit}
            />
          )}
        </AnimatePresence>

        <input 
          type="file" 
          accept="image/*" 
          capture="environment" 
          ref={fileInputRef}
          className="hidden"
          onChange={handleImageUpload}
        />
      </div>
    </div>
  );
}

function ThemeToggleButton({ theme, onToggle }: { theme: 'light' | 'dark', onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-label="Toggle light/dark theme"
      title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
      className="p-2 rounded-full text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
    >
      {theme === 'dark' ? (
        <Sun className="w-5 h-5 text-amber-400 hover:rotate-45 transition-transform" />
      ) : (
        <Moon className="w-5 h-5 text-gray-600 hover:-rotate-12 transition-transform" />
      )}
    </button>
  );
}

function HomeView({ user, theme, onToggleTheme, onLogout, onScanClick, onTextClick, onNotesClick }: { user: User, theme: 'light' | 'dark', onToggleTheme: () => void, onLogout: () => void, onScanClick: () => void, onTextClick: () => void, onNotesClick: () => void }) {
  const [onboardingStep, setOnboardingStep] = useState(0);

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('studysnap_onboarding_complete');
    if (!hasSeenOnboarding) {
      const timer = setTimeout(() => setOnboardingStep(1), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const nextStep = () => {
    if (onboardingStep >= 3) {
      setOnboardingStep(0);
      localStorage.setItem('studysnap_onboarding_complete', 'true');
    } else {
      setOnboardingStep(prev => prev + 1);
    }
  };

  const skipOnboarding = () => {
    setOnboardingStep(0);
    localStorage.setItem('studysnap_onboarding_complete', 'true');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex-1 flex flex-col p-6 relative bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
    >
      <AnimatePresence>
        {onboardingStep > 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-900/60 z-40 backdrop-blur-sm"
            onClick={skipOnboarding}
          />
        )}
      </AnimatePresence>

      <div className="flex justify-between items-center mb-8 relative z-10">
        <div className="flex items-center">
          {user.photoURL ? (
            <img src={user.photoURL} alt="Profile" className="w-10 h-10 rounded-full border-2 border-blue-100 dark:border-blue-900" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-950/80 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
              {user.displayName?.charAt(0) || 'U'}
            </div>
          )}
          <div className="ml-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Welcome back,</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate max-w-[140px]">{user.displayName || 'Student'}</p>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <ThemeToggleButton theme={theme} onToggle={onToggleTheme} />
          <button 
            onClick={onLogout} 
            aria-label="Logout"
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full transition-colors cursor-pointer"
            title="Log out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="mt-4 mb-10 text-center">
        <div className="w-20 h-20 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-lg shadow-blue-500/20">
          <BookOpen className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">StudySnap AI</h1>
        <p className="text-gray-500 dark:text-gray-400">Your personal AI study assistant</p>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-3 rounded-full bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-[11px] font-semibold text-sky-700 dark:text-sky-300 shadow-2xs">
          <Search className="w-3 h-3 text-sky-500" />
          <span>Grounded with Google Search • Gemini 3.5</span>
        </div>
      </div>

      <div className="space-y-4 mt-4">
        <div className={`relative ${onboardingStep === 1 ? 'z-50' : 'z-10'}`}>
          <button 
            onClick={() => { if(onboardingStep === 0) onScanClick(); }}
            className={`w-full bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-2xl flex items-center shadow-md transition-all cursor-pointer ${onboardingStep === 1 ? 'ring-4 ring-blue-300 ring-opacity-50 scale-[1.02]' : 'active:scale-95'}`}
          >
            <div className="bg-blue-500/30 p-3 rounded-xl mr-4">
              <Camera className="w-6 h-6" />
            </div>
            <div className="text-left flex-1">
              <h3 className="font-semibold text-lg">Scan Question</h3>
              <p className="text-blue-100 text-sm">Take a photo to analyze</p>
            </div>
            <ArrowRight className="w-5 h-5 text-blue-200" />
          </button>
          <AnimatePresence>
            {onboardingStep === 1 && (
              <OnboardingTooltip 
                text="Take a photo of any question to get instant AI help and step-by-step solutions." 
                onNext={nextStep} 
                onSkip={skipOnboarding} 
              />
            )}
          </AnimatePresence>
        </div>

        <div className={`relative ${onboardingStep === 2 ? 'z-50' : 'z-10'}`}>
          <button 
            onClick={() => { if(onboardingStep === 0) onTextClick(); }}
            className={`w-full bg-white dark:bg-gray-800 border-2 hover:border-blue-100 dark:hover:border-blue-800 hover:bg-blue-50 dark:hover:bg-gray-750 text-gray-800 dark:text-gray-100 p-4 rounded-2xl flex items-center shadow-sm transition-all cursor-pointer ${onboardingStep === 2 ? 'ring-4 ring-blue-300 ring-opacity-50 scale-[1.02] border-transparent' : 'border-gray-100 dark:border-gray-700/80 active:scale-95'}`}
          >
            <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-xl mr-4 text-gray-600 dark:text-gray-300">
              <TypeIcon className="w-6 h-6" />
            </div>
            <div className="text-left flex-1">
              <h3 className="font-semibold text-lg">Enter Text</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Type or paste a question</p>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          </button>
          <AnimatePresence>
            {onboardingStep === 2 && (
              <OnboardingTooltip 
                text="Or type/paste your question directly here if you don't have an image." 
                onNext={nextStep} 
                onSkip={skipOnboarding} 
              />
            )}
          </AnimatePresence>
        </div>

        <div className={`relative ${onboardingStep === 3 ? 'z-50' : 'z-10'}`}>
          <button 
            onClick={() => { if(onboardingStep === 0) onNotesClick(); }}
            className={`w-full bg-white dark:bg-gray-800 border-2 hover:border-blue-100 dark:hover:border-blue-800 hover:bg-blue-50 dark:hover:bg-gray-750 text-gray-800 dark:text-gray-100 p-4 rounded-2xl flex items-center shadow-sm transition-all cursor-pointer ${onboardingStep === 3 ? 'ring-4 ring-blue-300 ring-opacity-50 scale-[1.02] border-transparent' : 'border-gray-100 dark:border-gray-700/80 active:scale-95'}`}
          >
            <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-xl mr-4 text-gray-600 dark:text-gray-300">
              <BookOpen className="w-6 h-6" />
            </div>
            <div className="text-left flex-1">
              <h3 className="font-semibold text-lg">My Notes</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Review saved explanations</p>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          </button>
          <AnimatePresence>
            {onboardingStep === 3 && (
              <OnboardingTooltip 
                text="Access all your saved explanations, quizzes, and study history here." 
                onNext={nextStep} 
                onSkip={skipOnboarding} 
                isLast 
                position="top"
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

function TextInputView({ theme, onToggleTheme, onBack, onSubmit }: { theme: 'light' | 'dark', onToggleTheme: () => void, onBack: () => void, onSubmit: (text: string) => void }) {
  const [text, setText] = useState('');

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
    >
      <div className="bg-white dark:bg-gray-900 px-4 py-4 flex items-center justify-between shadow-sm z-10 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center">
          <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 cursor-pointer">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h2 className="font-semibold text-lg ml-2 text-gray-900 dark:text-white">Enter Question</h2>
        </div>
        <ThemeToggleButton theme={theme} onToggle={onToggleTheme} />
      </div>

      <div className="flex-1 p-4 flex flex-col">
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Question or topic</span>
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 text-[10px] font-medium text-sky-700 dark:text-sky-300">
            <Search className="w-2.5 h-2.5 text-sky-500" />
            <span>Search Grounded</span>
          </div>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type or paste your study question here (e.g., 'Explain the Water Cycle with a flowchart diagram' or 'How does Photosynthesis work?')..."
          className="flex-1 w-full p-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 text-base sm:text-lg"
          autoFocus
        />

        {/* Quick Suggestion Chips */}
        <div className="mt-3">
          <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 mb-1.5 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            <span>Try an example or diagram request:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              "Explain Photosynthesis with a diagram",
              "Water Cycle process & flowchart",
              "Binary Search algorithm steps & diagram",
              "Cellular Respiration cycle",
              "Newton's 3 Laws of Motion"
            ].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setText(chip)}
                className="text-xs px-2.5 py-1 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-600 dark:hover:text-blue-400 transition-all cursor-pointer shadow-2xs"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        <button 
          onClick={() => onSubmit(text)}
          disabled={!text.trim()}
          className="mt-4 w-full bg-blue-600 disabled:bg-blue-300 dark:disabled:bg-blue-900/50 text-white py-3.5 sm:py-4 rounded-xl font-semibold text-base sm:text-lg shadow-md transition-all active:scale-95 cursor-pointer"
        >
          Analyze & Explain
        </button>
      </div>
    </motion.div>
  );
}

function LoadingView({ text }: { text: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-gray-900 p-6 text-center"
    >
      <div className="relative w-24 h-24 mb-8">
        <div className="absolute inset-0 border-4 border-blue-100 dark:border-gray-800 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center text-blue-600 dark:text-blue-400">
          <BookOpen className="w-8 h-8 animate-pulse" />
        </div>
      </div>
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">{text}</h2>
      <p className="text-gray-500 dark:text-gray-400">Our AI is crunching the numbers...</p>
    </motion.div>
  );
}

function ResultView({ 
  note, 
  theme, 
  onToggleTheme, 
  onBack, 
  onSave, 
  isSaved = false, 
  onShowToast,
  onExploreTopic
}: { 
  note: Note, 
  theme: 'light' | 'dark', 
  onToggleTheme: () => void, 
  onBack: () => void, 
  onSave?: () => void, 
  isSaved?: boolean, 
  onShowToast?: (msg: string, type: 'error'|'success'|'info') => void,
  onExploreTopic?: (topic: string) => void
}) {
  const [activeTab, setActiveTab] = useState<'explain' | 'step' | 'diagram' | 'eli10' | 'mistakes' | 'quiz' | 'topics'>('explain');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Stop audio speech synthesis on unmount or tab change
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggleAudio = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      if (onShowToast) onShowToast("Speech synthesis not supported in this browser.", "info");
      return;
    }

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
    } else {
      window.speechSynthesis.cancel();
      const textToRead = note.directAnswer 
        ? `${note.directAnswer}. ${note.explanation.replace(/[*#_`]/g, '')}`
        : note.explanation.replace(/[*#_`]/g, '');

      const utterance = new SpeechSynthesisUtterance(textToRead);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);
      window.speechSynthesis.speak(utterance);
      setIsPlayingAudio(true);
    }
  };

  const handleCopy = async () => {
    const fullText = [
      note.questionText ? `Question: ${note.questionText}\n` : '',
      note.directAnswer ? `Direct Answer:\n${note.directAnswer}\n` : '',
      note.keyTakeaways && note.keyTakeaways.length > 0 ? `Key Takeaways:\n${note.keyTakeaways.map(t => `• ${t}`).join('\n')}\n` : '',
      `Explanation:\n${note.explanation}\n`,
      `Step-by-Step Breakdown:\n${note.stepByStep}\n`,
      note.diagram ? `Diagram (${note.diagram.title}):\n\`\`\`mermaid\n${note.diagram.code}\n\`\`\`\n` : '',
      `Simple Analogy (ELI5):\n${note.eli10}`
    ].filter(Boolean).join('\n\n');

    try {
      await navigator.clipboard.writeText(fullText);
      setIsCopied(true);
      if (onShowToast) onShowToast("Study notes copied to clipboard!", "success");
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      if (onShowToast) onShowToast("Failed to copy notes.", "error");
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'StudySnap AI Note',
          text: `Check out this study breakdown:\n\n${note.directAnswer || note.explanation}`,
        });
      } catch (err) {
        console.error('Share failed:', err);
      }
    } else {
      handleCopy();
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-950 h-full text-gray-900 dark:text-gray-100"
    >
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 px-4 py-3 flex items-center justify-between shadow-sm z-10 shrink-0 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center">
          <button onClick={onBack} aria-label="Go back" className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 cursor-pointer">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="ml-1">
            <h2 className="font-semibold text-base sm:text-lg truncate max-w-[140px] sm:max-w-[200px] text-gray-900 dark:text-white">
              {isSaved ? 'Saved Note' : 'AI Study Guide'}
            </h2>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <button 
            onClick={toggleAudio}
            title={isPlayingAudio ? "Stop reading" : "Read aloud"}
            className={`p-2 rounded-full cursor-pointer transition-colors ${
              isPlayingAudio 
                ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 animate-pulse' 
                : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300'
            }`}
          >
            {isPlayingAudio ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>

          <button 
            onClick={handleCopy}
            title="Copy notes"
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 cursor-pointer transition-colors"
          >
            {isCopied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
          </button>

          <ThemeToggleButton theme={theme} onToggle={onToggleTheme} />

          <button 
            onClick={handleShare} 
            title="Share"
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 cursor-pointer"
          >
            <Share2 className="w-5 h-5" />
          </button>

          {!isSaved && onSave && (
            <button 
              onClick={onSave} 
              title="Save Note"
              className="p-2 rounded-full hover:bg-blue-50 dark:hover:bg-blue-950/60 text-blue-600 dark:text-blue-400 cursor-pointer"
            >
              <Save className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Question Preview Box */}
        <div className="bg-white dark:bg-gray-900 p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              Study Question
            </span>
          </div>
          {note.questionImage ? (
            <div className="relative max-h-48 w-full rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <img src={note.questionImage} alt="Scanned question" className="w-full h-full object-contain" />
            </div>
          ) : (
            <p className="text-gray-800 dark:text-gray-200 italic text-sm sm:text-base leading-relaxed bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
              &ldquo;{note.questionText}&rdquo;
            </p>
          )}
        </div>

        {/* Quick Answer Banner */}
        {note.directAnswer && (
          <div className="m-4 mb-2 p-4 rounded-2xl bg-linear-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/30 border border-blue-100 dark:border-blue-900/60 shadow-xs">
            <div className="flex items-center text-blue-700 dark:text-blue-400 text-xs font-bold uppercase tracking-wider mb-1.5">
              <Sparkles className="w-4 h-4 mr-1.5 text-blue-600 dark:text-blue-400 shrink-0" />
              Quick Answer / Core Result
            </div>
            <div className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white leading-snug">
              {note.directAnswer}
            </div>
          </div>
        )}

        {/* Key Takeaways */}
        {note.keyTakeaways && note.keyTakeaways.length > 0 && (
          <div className="mx-4 my-2 p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
            <div className="flex items-center text-emerald-800 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              High-Yield Takeaways
            </div>
            <ul className="space-y-1.5">
              {note.keyTakeaways.map((takeaway, idx) => (
                <li key={idx} className="flex items-start text-xs sm:text-sm text-emerald-900 dark:text-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 mr-2 shrink-0" />
                  <span>{takeaway}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Interactive Diagram Callout Banner (if diagram is available) */}
        {note.diagram && (
          <div 
            onClick={() => setActiveTab('diagram')}
            className="mx-4 my-2 p-3 rounded-2xl bg-linear-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800 flex items-center justify-between cursor-pointer group hover:border-blue-300 dark:hover:border-blue-700 transition-all shadow-2xs"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center shrink-0">
                <GitFork className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                  Interactive Diagram Available
                </div>
                <div className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white line-clamp-1">
                  {note.diagram.title || 'Visual Flow & Concept Map'}
                </div>
              </div>
            </div>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center group-hover:translate-x-0.5 transition-transform shrink-0 ml-2">
              View Diagram <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </span>
          </div>
        )}

        {/* Tabs Navigation */}
        <div className="flex overflow-x-auto hide-scrollbar bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10 px-2 mt-2">
          <TabButton active={activeTab === 'explain'} onClick={() => setActiveTab('explain')}>
            <span className="flex items-center gap-1.5">
              <BookOpen className="w-4 h-4" />
              Concept
            </span>
          </TabButton>
          <TabButton active={activeTab === 'step'} onClick={() => setActiveTab('step')}>
            <span className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4" />
              Steps
            </span>
          </TabButton>
          {note.diagram && (
            <TabButton active={activeTab === 'diagram'} onClick={() => setActiveTab('diagram')}>
              <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-semibold">
                <GitFork className="w-4 h-4" />
                Diagram
              </span>
            </TabButton>
          )}
          <TabButton active={activeTab === 'eli10'} onClick={() => setActiveTab('eli10')}>
            <span className="flex items-center gap-1.5">
              <span>💡</span>
              ELI5
            </span>
          </TabButton>
          {note.commonMistakes && (
            <TabButton active={activeTab === 'mistakes'} onClick={() => setActiveTab('mistakes')}>
              <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4" />
                Pitfalls
              </span>
            </TabButton>
          )}
          <TabButton active={activeTab === 'quiz'} onClick={() => setActiveTab('quiz')}>
            <span className="flex items-center gap-1.5">
              <Award className="w-4 h-4" />
              Quiz
              {note.quizzes && note.quizzes.length > 0 && (
                <span className="text-[11px] font-bold px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {note.quizzes.length}
                </span>
              )}
            </span>
          </TabButton>
          <TabButton active={activeTab === 'topics'} onClick={() => setActiveTab('topics')}>
            <span className="flex items-center gap-1.5">
              <Compass className="w-4 h-4" />
              Explore
            </span>
          </TabButton>
        </div>

        {/* Tab Content */}
        <div className="p-4 pb-20">
          <AnimatePresence mode="wait">
            {activeTab === 'explain' && (
              <motion.div key="explain" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 dark:border-gray-800">
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center">
                      <BookOpen className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
                      Detailed Conceptual Breakdown
                    </h3>
                  </div>
                  <div className="markdown-body text-gray-700 dark:text-gray-300 leading-relaxed">
                    <Markdown remarkPlugins={[remarkGfm]}>{note.explanation}</Markdown>
                  </div>
                  
                  {/* Google Search Grounding Sources */}
                  <SearchSourcesSection sources={note.searchSources} queries={note.searchQueries} />
                </div>
              </motion.div>
            )}
            
            {activeTab === 'step' && (
              <motion.div key="step" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 dark:border-gray-800">
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center">
                      <CheckCircle className="w-5 h-5 mr-2 text-green-600 dark:text-green-400" />
                      Step-by-Step Solution & Derivations
                    </h3>
                  </div>
                  <div className="markdown-body text-gray-700 dark:text-gray-300 leading-relaxed">
                    <Markdown remarkPlugins={[remarkGfm]}>{note.stepByStep}</Markdown>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'diagram' && note.diagram && (
              <motion.div key="diagram" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                <MermaidDiagram 
                  code={note.diagram.code}
                  title={note.diagram.title}
                  description={note.diagram.description}
                  type={note.diagram.type}
                  theme={theme}
                />
              </motion.div>
            )}

            {activeTab === 'eli10' && (
              <motion.div key="eli10" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 dark:border-gray-800">
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center">
                      <span className="text-xl mr-2">👶</span>
                      Explain Like I'm 10 (Analogy)
                    </h3>
                  </div>
                  <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 rounded-xl mb-4 text-xs sm:text-sm text-amber-800 dark:text-amber-300">
                    Simple, intuitive real-world comparisons to lock in the fundamentals.
                  </div>
                  <div className="markdown-body text-gray-700 dark:text-gray-300 leading-relaxed">
                    <Markdown remarkPlugins={[remarkGfm]}>{note.eli10}</Markdown>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'mistakes' && note.commonMistakes && (
              <motion.div key="mistakes" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-amber-200 dark:border-amber-900/60">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 dark:border-gray-800">
                    <h3 className="text-base sm:text-lg font-bold text-amber-600 dark:text-amber-400 flex items-center">
                      <AlertTriangle className="w-5 h-5 mr-2 text-amber-500" />
                      Common Pitfalls & Exam Traps
                    </h3>
                  </div>
                  <div className="markdown-body text-gray-700 dark:text-gray-300 leading-relaxed">
                    <Markdown remarkPlugins={[remarkGfm]}>{note.commonMistakes}</Markdown>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'quiz' && (
              <motion.div key="quiz" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                <QuizSection quizzes={note.quizzes} />
              </motion.div>
            )}

            {activeTab === 'topics' && (
              <motion.div key="topics" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 dark:border-gray-800">
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center">
                      <Lightbulb className="w-5 h-5 mr-2 text-yellow-500" />
                      Explore Related Concepts
                    </h3>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Deepen your knowledge by diving into adjacent topics and formulas:
                  </p>
                  <div className="space-y-2.5">
                    {note.relatedTopics?.map((topic, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => onExploreTopic && onExploreTopic(topic)}
                        className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 flex items-center justify-between group hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition-all cursor-pointer"
                      >
                        <div className="flex items-center">
                          <div className="w-2 h-2 rounded-full bg-blue-500 mr-3 shrink-0"></div>
                          <span className="font-medium text-sm sm:text-base group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {topic}
                          </span>
                        </div>
                        {onExploreTopic && (
                          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center shrink-0 ml-2 group-hover:translate-x-0.5 transition-transform">
                            Analyze <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean, onClick: () => void, children: React.ReactNode }) {
  return (
    <button 
      onClick={onClick}
      className={`px-3.5 py-3 whitespace-nowrap font-medium text-xs sm:text-sm transition-colors relative cursor-pointer ${
        active 
          ? 'text-blue-600 dark:text-blue-400 font-semibold' 
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
      }`}
    >
      {children}
      {active && (
        <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />
      )}
    </button>
  );
}

function QuizSection({ quizzes }: { quizzes: Quiz[] }) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [difficultyFilter, setDifficultyFilter] = useState<'All' | 'Easy' | 'Medium' | 'Hard'>('All');
  const [quizKey, setQuizKey] = useState(0);

  const handleSelect = (qIdx: number, optIdx: number) => {
    setAnswers(prev => ({ ...prev, [qIdx]: optIdx }));
  };

  const resetAll = () => {
    setAnswers({});
    setQuizKey(prev => prev + 1);
  };

  const totalAnswered = Object.keys(answers).length;
  const correctCount = Object.entries(answers).filter(([qIdx, optIdx]) => {
    return quizzes[Number(qIdx)]?.correctAnswerIndex === optIdx;
  }).length;

  const progressPercent = quizzes.length > 0 ? Math.round((totalAnswered / quizzes.length) * 100) : 0;

  // Filter quizzes if needed
  const availableDifficulties = Array.from(new Set(quizzes.map(q => q.difficulty).filter(Boolean)));
  const filteredQuizzes = quizzes.map((q, originalIdx) => ({ quiz: q, originalIdx })).filter(({ quiz }) => {
    if (difficultyFilter === 'All') return true;
    return quiz.difficulty === difficultyFilter;
  });

  return (
    <div key={quizKey} className="space-y-4">
      {/* Quiz Progress & Score Header */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h4 className="font-bold text-sm sm:text-base text-gray-900 dark:text-white">
                Practice & Mastery Quiz
              </h4>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                {quizzes.length} Questions
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {totalAnswered === 0 
                ? 'Test your retention, problem-solving, and edge-case handling' 
                : `Progress: ${totalAnswered} of ${quizzes.length} answered • ${correctCount} correct`}
            </p>
          </div>

          {totalAnswered > 0 && (
            <button 
              onClick={resetAll}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          )}
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-100 dark:bg-gray-800 h-2 rounded-full overflow-hidden mb-3">
          <div 
            className="bg-linear-to-r from-blue-500 to-indigo-600 h-full transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Quick Question Status Strip */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {quizzes.map((q, idx) => {
            const isAnswered = answers[idx] !== undefined;
            const isCorrect = answers[idx] === q.correctAnswerIndex;
            return (
              <a
                key={idx}
                href={`#quiz-q-${idx}`}
                className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center transition-all ${
                  !isAnswered
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    : isCorrect
                    ? 'bg-emerald-500 text-white shadow-xs'
                    : 'bg-red-500 text-white shadow-xs'
                }`}
              >
                {idx + 1}
              </a>
            );
          })}
        </div>

        {/* Difficulty Filter Tabs (if multiple difficulties exist) */}
        {availableDifficulties.length > 1 && (
          <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">Filter:</span>
            {(['All', 'Easy', 'Medium', 'Hard'] as const).map((diff) => {
              if (diff !== 'All' && !availableDifficulties.includes(diff)) return null;
              const isActive = difficultyFilter === diff;
              return (
                <button
                  key={diff}
                  onClick={() => setDifficultyFilter(diff)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {diff}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Celebration for 100% */}
      {totalAnswered === quizzes.length && correctCount === quizzes.length && (
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="p-4 rounded-2xl bg-linear-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-sm font-semibold flex items-center gap-3 shadow-xs"
        >
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <div className="font-bold">Outstanding! Perfect Score ({quizzes.length}/{quizzes.length})</div>
            <div className="text-xs font-normal opacity-90">You have completely mastered all core concepts and variations in this topic.</div>
          </div>
        </motion.div>
      )}

      {/* Quiz Cards */}
      {filteredQuizzes.map(({ quiz, originalIdx }) => (
        <div key={originalIdx} id={`quiz-q-${originalIdx}`} className="scroll-mt-16">
          <QuizCard 
            quiz={quiz} 
            index={originalIdx} 
            selected={answers[originalIdx] ?? null}
            onSelect={(optIdx) => handleSelect(originalIdx, optIdx)}
          />
        </div>
      ))}
    </div>
  );
}

function QuizCard({ 
  quiz, 
  index, 
  selected, 
  onSelect 
}: { 
  quiz: Quiz, 
  index: number, 
  selected: number | null, 
  onSelect: (optIdx: number) => void 
}) {
  const getDifficultyBadge = (diff?: string) => {
    switch (diff) {
      case 'Easy':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">Easy</span>;
      case 'Medium':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">Medium</span>;
      case 'Hard':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800">Hard</span>;
      default:
        return null;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 transition-all hover:border-gray-200 dark:hover:border-gray-700">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
          Question {index + 1}
        </span>
        {getDifficultyBadge(quiz.difficulty)}
      </div>

      <h4 className="font-bold text-sm sm:text-base text-gray-900 dark:text-white mb-3.5 leading-snug">
        {quiz.question}
      </h4>

      <div className="space-y-2">
        {quiz.options.map((opt, optIdx) => {
          const isSelected = selected === optIdx;
          const isCorrect = optIdx === quiz.correctAnswerIndex;
          const showResult = selected !== null;
          
          let btnClass = "w-full text-left p-3 rounded-xl border text-xs sm:text-sm transition-all flex items-center cursor-pointer ";
          
          if (!showResult) {
            btnClass += "border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/60 dark:hover:bg-blue-950/30 text-gray-700 dark:text-gray-300";
          } else {
            if (isCorrect) {
              btnClass += "border-green-500 bg-green-50 dark:bg-green-950/40 text-green-900 dark:text-green-200 font-medium";
            } else if (isSelected && !isCorrect) {
              btnClass += "border-red-500 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200";
            } else {
              btnClass += "border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-600 opacity-60";
            }
          }

          return (
            <button 
              key={optIdx}
              onClick={() => !showResult && onSelect(optIdx)}
              disabled={showResult}
              className={btnClass}
            >
              <div className="mr-3 shrink-0">
                {showResult ? (
                  isCorrect ? <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" /> : 
                  (isSelected ? <Circle className="w-5 h-5 text-red-500 fill-red-100 dark:fill-red-950/50" /> : <Circle className="w-5 h-5 text-gray-300 dark:text-gray-700" />)
                ) : (
                  <Circle className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                )}
              </div>
              <span className="flex-1 leading-snug">{opt}</span>
            </button>
          );
        })}
      </div>

      {/* Answer Explanation Reveal */}
      {selected !== null && quiz.explanation && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-3.5 p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-xs sm:text-sm text-gray-700 dark:text-gray-300 leading-relaxed"
        >
          <div className="font-bold text-gray-900 dark:text-white mb-1.5 flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            Answer Explanation:
          </div>
          {quiz.explanation}
        </motion.div>
      )}
    </div>
  );
}

function NotesListView({ notes, theme, onToggleTheme, onBack, onSelectNote, onDeleteNote }: { notes: Note[], theme: 'light' | 'dark', onToggleTheme: () => void, onBack: () => void, onSelectNote: (note: Note) => void, onDeleteNote: (id: string) => void }) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredNotes = notes.filter(note => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const matchQuestion = (note.questionText || '').toLowerCase().includes(q);
    const matchExplanation = (note.explanation || '').toLowerCase().includes(q);
    const matchStep = (note.stepByStep || '').toLowerCase().includes(q);
    const matchEli = (note.eli10 || '').toLowerCase().includes(q);
    const matchTopics = note.relatedTopics?.some(t => t.toLowerCase().includes(q)) ?? false;
    return matchQuestion || matchExplanation || matchStep || matchEli || matchTopics;
  });

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-950 h-full text-gray-900 dark:text-gray-100"
    >
      <div className="bg-white dark:bg-gray-900 px-4 py-4 flex items-center justify-between shadow-sm z-10 shrink-0 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center">
          <button onClick={onBack} aria-label="Go back" className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 cursor-pointer">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h2 className="font-semibold text-lg ml-2 text-gray-900 dark:text-white">My Notes</h2>
          {notes.length > 0 && (
            <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900">
              {notes.length}
            </span>
          )}
        </div>
        <ThemeToggleButton theme={theme} onToggle={onToggleTheme} />
      </div>

      {notes.length > 0 && (
        <div className="p-4 pb-1 bg-gray-50 dark:bg-gray-950 shrink-0">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-gray-400 dark:text-gray-500 absolute left-3.5 pointer-events-none" />
            <input 
              id="search-notes-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by question, keyword, or topic..."
              className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700/80 rounded-xl text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-xs"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                aria-label="Clear search query"
                className="absolute right-3 p-1 rounded-full text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {searchQuery && (
            <div className="flex justify-between items-center px-1 mt-2 text-xs text-gray-500 dark:text-gray-400">
              <span>Found {filteredNotes.length} {filteredNotes.length === 1 ? 'note' : 'notes'}</span>
              <button 
                onClick={() => setSearchQuery('')}
                className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Clear filter
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <BookOpen className="w-12 h-12 mb-4 text-gray-300 dark:text-gray-700" />
            <p className="font-medium text-gray-700 dark:text-gray-300">No saved notes yet.</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Scan or type a question to generate and save notes.</p>
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <Search className="w-10 h-10 text-gray-300 dark:text-gray-700 mb-3" />
            <p className="font-semibold text-gray-800 dark:text-gray-200">No matching notes found</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-4 max-w-[240px]">
              No notes match &ldquo;{searchQuery}&rdquo;. Try another term or topic keyword.
            </p>
            <button 
              onClick={() => setSearchQuery('')}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 cursor-pointer transition-colors"
            >
              Clear Search
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotes.map(note => (
              <div 
                key={note.id} 
                id={`note-card-${note.id}`}
                className="bg-white dark:bg-gray-900 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 flex items-start cursor-pointer hover:border-blue-100 dark:hover:border-blue-900/60 hover:shadow-md transition-all" 
                onClick={() => onSelectNote(note)}
              >
                <div className="w-12 h-12 rounded-lg bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center shrink-0 mr-4 overflow-hidden">
                  {note.questionImage ? (
                    <img src={note.questionImage} alt="thumb" className="w-full h-full object-cover" />
                  ) : (
                    <TypeIcon className="w-6 h-6 text-blue-500 dark:text-blue-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">
                    {new Date(note.timestamp).toLocaleDateString()} • {new Date(note.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </p>
                  <h4 className="font-medium text-gray-900 dark:text-white truncate">
                    {note.questionText || "Scanned Image Question"}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-1">
                    {note.explanation}
                  </p>
                  <div className="flex flex-wrap items-center gap-1 mt-2">
                    {note.diagram && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                        <GitFork className="w-2.5 h-2.5" />
                        Diagram
                      </span>
                    )}
                    {note.searchSources && note.searchSources.length > 0 && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800 flex items-center gap-1">
                        <Search className="w-2.5 h-2.5" />
                        Search Grounded
                      </span>
                    )}
                    {note.relatedTopics && note.relatedTopics.slice(0, 2).map((t, idx) => (
                      <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); onDeleteNote(note.id); }}
                  aria-label="Delete note"
                  className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg ml-2 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function SearchSourcesSection({ sources, queries }: { sources?: { title: string; url: string }[]; queries?: string[] }) {
  if ((!sources || sources.length === 0) && (!queries || queries.length === 0)) {
    return null;
  }

  return (
    <div className="mt-4 p-4 rounded-2xl bg-sky-50/80 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900/50">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center text-sky-800 dark:text-sky-300 text-xs font-bold uppercase tracking-wider">
          <Search className="w-3.5 h-3.5 mr-1.5 text-sky-600 dark:text-sky-400 shrink-0" />
          Grounded with Google Search
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
          Live Web Verified
        </span>
      </div>

      {queries && queries.length > 0 && (
        <div className="mb-3">
          <p className="text-[11px] text-gray-600 dark:text-gray-400 mb-1.5 font-medium">Search queries:</p>
          <div className="flex flex-wrap gap-1.5">
            {queries.map((q, idx) => (
              <span key={idx} className="inline-flex items-center text-xs px-2.5 py-1 rounded-lg bg-white dark:bg-gray-800 border border-sky-200 dark:border-sky-800 text-gray-700 dark:text-gray-300 shadow-2xs">
                <Search className="w-3 h-3 mr-1 text-sky-500" />
                {q}
              </span>
            ))}
          </div>
        </div>
      )}

      {sources && sources.length > 0 && (
        <div>
          <p className="text-[11px] text-gray-600 dark:text-gray-400 mb-1.5 font-medium">Web references & sources:</p>
          <div className="space-y-1.5">
            {sources.map((source, idx) => (
              <a
                key={idx}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-sky-400 dark:hover:border-sky-600 transition-all group shadow-2xs"
              >
                <div className="flex items-center min-w-0 pr-2">
                  <div className="w-2 h-2 rounded-full bg-sky-500 mr-2.5 shrink-0" />
                  <span className="text-xs sm:text-sm font-medium text-gray-800 dark:text-gray-200 truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                    {source.title}
                  </span>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-sky-600 dark:group-hover:text-sky-400 shrink-0 transition-colors" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OnboardingTooltip({ text, onNext, onSkip, isLast, position = 'bottom' }: { text: string, onNext: () => void, onSkip: () => void, isLast?: boolean, position?: 'top' | 'bottom' }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: position === 'bottom' ? -10 : 10 }} 
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: position === 'bottom' ? -10 : 10 }}
      className={`absolute left-0 right-0 ${position === 'bottom' ? 'top-full mt-4' : 'bottom-full mb-4'} bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-2xl border border-blue-100 dark:border-gray-700 z-50`}
    >
      <div className={`absolute ${position === 'bottom' ? '-top-2 border-t border-l' : '-bottom-2 border-b border-r'} left-8 w-4 h-4 bg-white dark:bg-gray-800 rotate-45 border-blue-100 dark:border-gray-700`}></div>
      <p className="text-gray-800 dark:text-gray-100 mb-4 relative z-10 font-medium text-base">{text}</p>
      <div className="flex justify-between items-center relative z-10">
        <button onClick={onSkip} className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 font-medium cursor-pointer">Skip tour</button>
        <button onClick={onNext} className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 cursor-pointer shadow-md transition-transform active:scale-95">
          {isLast ? 'Got it!' : 'Next'}
        </button>
      </div>
    </motion.div>
  );
}
