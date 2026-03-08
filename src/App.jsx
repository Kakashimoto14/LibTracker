import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  BookOpen, Search, Sun, Moon, Plus, ArrowLeft, Loader2, X,
  Sparkles, Timer, Trophy, Play, Pause, RotateCcw, BookType, LogOut
} from 'lucide-react';

// ==========================================
// 🔗 BACKEND CONNECTION CONFIGURATION
// ==========================================
// Pointing to your deployed Render backend
const API_BASE_URL = 'https://library-api-do91.onrender.com/api';

// --- SHADCN UI MOCK COMPONENTS ---
const Card = ({ children, className = '', onClick }) => (
  <div onClick={onClick} className={`rounded-xl border border-slate-200 bg-white text-slate-950 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50 ${onClick ? 'cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-colors' : ''} ${className}`}>
    {children}
  </div>
);

const Button = ({ children, variant = 'default', size = 'default', className = '', ...props }) => {
  const base = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 disabled:pointer-events-none disabled:opacity-50 dark:focus-visible:ring-slate-300";
  const variants = {
    default: "bg-slate-900 text-slate-50 hover:bg-slate-900/90 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-50/90",
    outline: "border border-slate-200 bg-white hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-800 dark:hover:text-slate-50",
    ghost: "hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-50",
    secondary: "bg-slate-100 text-slate-900 hover:bg-slate-100/80 dark:bg-slate-800 dark:text-slate-50 dark:hover:bg-slate-800/80",
    ai: "bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600",
    danger: "bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
  };
  const sizes = { default: "h-10 px-4 py-2", sm: "h-9 rounded-md px-3", lg: "h-11 rounded-md px-8", icon: "h-10 w-10" };
  return <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>{children}</button>;
};

const Input = ({ className = '', ...props }) => (
  <input className={`flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus-visible:ring-slate-300 ${className}`} {...props} />
);

const Badge = ({ children, variant = 'default', className = '' }) => {
  const variants = {
    default: "border-transparent bg-slate-900 text-slate-50 dark:bg-slate-50 dark:text-slate-900",
    secondary: "border-transparent bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-50",
    ai: "border-transparent bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
  };
  return <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${variants[variant]} ${className}`}>{children}</div>;
};

const Progress = ({ value, className = "", indicatorClass = "bg-slate-900 dark:bg-slate-50" }) => {
  const safeValue = isNaN(value) ? 0 : Math.min(Math.max(value, 0), 100);
  return (
    <div className={`relative h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 ${className}`}>
      <div className={`h-full w-full flex-1 transition-all ${indicatorClass}`} style={{ transform: `translateX(-${100 - safeValue}%)` }} />
    </div>
  );
};

// --- GEMINI API HELPER ---
const fetchGeminiResponse = async (prompt, asJson = false) => {
  let apiKey = "";
  try {
    const metaEnv = typeof import.meta !== 'undefined' ? import.meta.env : {};
    apiKey = metaEnv?.VITE_GEMINI_API_KEY || "";
  } catch (e) {
    apiKey = "";
  }

  if (!apiKey) {
    throw new Error("API Key missing. Please ensure VITE_GEMINI_API_KEY is configured in your Vercel Environment Variables.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: "You are an expert librarian and book recommender. Provide high-quality, engaging insights." }] }
  };

  if (asJson) {
    payload.generationConfig = {
      responseMimeType: "application/json",
      responseSchema: {
        type: "ARRAY",
        items: { type: "STRING" },
        description: "List of exactly 5 book titles with authors (e.g., 'Project Hail Mary by Andy Weir')"
      }
    };
  }

  const delays = [1000, 2000, 4000, 8000, 16000];
  for (let i = 0; i < 5; i++) {
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error?.message || `HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text;
    } catch (err) {
      if (i === 4) throw err;
      await new Promise(r => setTimeout(r, delays[i]));
    }
  }
};

// --- VIEW COMPONENTS ---

const BookCard = ({ book, getLibraryBook, addToLibrary, onSelectBook }) => (
  <Card onClick={() => onSelectBook(book)} className="flex flex-col h-full overflow-hidden group">
    <div className="relative aspect-[2/3] w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
      {book.thumbnail ? (
        <img src={book.thumbnail} alt={book.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
      ) : (
        <BookOpen className="w-12 h-12 text-slate-400" />
      )}
    </div>
    <div className="p-4 flex flex-col flex-grow">
      <h3 className="font-semibold text-sm line-clamp-2 mb-1">{book.title}</h3>
      <p className="text-xs text-slate-500 line-clamp-1 mb-2">{book.authors?.[0] || 'Unknown Author'}</p>
      <div className="mt-auto">
        {getLibraryBook(book.id || book.api_id) ? (
          <Badge variant="secondary" className="w-full justify-center">In Library</Badge>
        ) : (
          <Button variant="outline" size="sm" className="w-full text-xs" onClick={(e) => { e.stopPropagation(); addToLibrary(book); }}>
            <Plus className="w-3 h-3 mr-1" /> Add
          </Button>
        )}
      </div>
    </div>
  </Card>
);

const DashboardView = ({ user, library, readingGoal, discoverBooks, onSelectBook, getLibraryBook, addToLibrary }) => {
  const readingBooks = library.filter(b => b.status === 'reading');
  const completedBooks = library.filter(b => b.status === 'completed').length;
  const challengeProgress = Math.min((completedBooks / readingGoal) * 100, 100);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 md:col-span-2 flex flex-col justify-center bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/20 dark:to-slate-900 border-indigo-100 dark:border-indigo-900/50">
          <h2 className="text-2xl font-bold tracking-tight mb-2 flex items-center">
            Welcome back, {user?.name || 'Reader'}! <Sparkles className="w-5 h-5 ml-2 text-indigo-500" />
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">You're currently tracking {readingBooks.length} books. Keep up the momentum!</p>
          
          {readingBooks.length > 0 && (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {readingBooks.map(book => (
                <div key={book.id || book.api_id} onClick={() => onSelectBook(book)} className="flex gap-3 bg-white dark:bg-slate-800 p-3 rounded-lg border shadow-sm min-w-[280px] cursor-pointer hover:border-indigo-300 transition-colors">
                  <img src={book.thumbnail || book.cover_image} className="w-12 h-16 object-cover rounded shadow-sm" />
                  <div className="flex-1">
                    <h4 className="font-medium text-sm line-clamp-1">{book.title}</h4>
                    <p className="text-xs text-slate-500 mb-2">{Math.round((book.pagesRead / (book.pageCount || 1)) * 100)}% Complete</p>
                    <Progress value={(book.pagesRead / (book.pageCount || 1)) * 100} indicatorClass="bg-indigo-600 dark:bg-indigo-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6 flex flex-col items-center justify-center text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Trophy className="w-24 h-24" /></div>
          <Trophy className="w-8 h-8 text-yellow-500 mb-3" />
          <h3 className="font-bold text-lg mb-1">2026 Reading Goal</h3>
          <p className="text-3xl font-black text-slate-900 dark:text-white mb-2">
            {completedBooks} <span className="text-lg font-medium text-slate-500">/ {readingGoal}</span>
          </p>
          <Progress value={challengeProgress} className="mb-2 h-3" indicatorClass="bg-yellow-500" />
          <p className="text-xs text-slate-500">{completedBooks} books finished this year</p>
        </Card>
      </div>

      <section>
        <h2 className="text-xl font-bold tracking-tight mb-4 flex items-center">
          <Sparkles className="w-5 h-5 mr-2 text-indigo-500" /> Trending & Recommendations
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 lg:gap-6">
          {discoverBooks.map(book => <BookCard key={book.id} book={book} getLibraryBook={getLibraryBook} addToLibrary={addToLibrary} onSelectBook={onSelectBook} />)}
        </div>
      </section>
    </div>
  );
};

const SearchView = ({ searchMode, searchQuery, isSearching, searchResults, onSelectBook, getLibraryBook, addToLibrary }) => (
  <div className="space-y-6 animate-in fade-in duration-500">
    <div className="flex items-center justify-between">
      <h2 className="text-2xl font-bold tracking-tight">
        {searchMode === 'vibe' ? 'AI Vibe Recommendations' : 'Search Results'}
      </h2>
      <span className="text-sm text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
        {searchMode === 'vibe' ? 'Powered by Gemini AI' : `for "${searchQuery}"`}
      </span>
    </div>
    
    {isSearching ? (
      <div className="flex flex-col justify-center items-center py-20 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        {searchMode === 'vibe' && <p className="text-sm text-slate-500 animate-pulse">AI is searching for the perfect books based on your vibe...</p>}
      </div>
    ) : searchResults.length > 0 ? (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 lg:gap-6">
        {searchResults.map(book => <BookCard key={book.id} book={book} getLibraryBook={getLibraryBook} addToLibrary={addToLibrary} onSelectBook={onSelectBook} />)}
      </div>
    ) : (
      <div className="text-center py-20 text-slate-500">
        {searchMode === 'vibe' ? "Describe the mood or setting you want, and let AI find books!" : "No books found. Try searching for a specific title or author."}
      </div>
    )}
  </div>
);

const ReaderView = ({ selectedBook, setCurrentView }) => {
  if (!selectedBook) return null;
  const bookId = selectedBook.api_id || selectedBook.id; 
  
  return (
    <div className="flex flex-col h-[85vh] w-full animate-in zoom-in duration-300">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold">{selectedBook.title}</h2>
          <p className="text-sm text-slate-500">Embedded Reader View</p>
        </div>
        <Button variant="outline" onClick={() => setCurrentView('book_detail')}>
          <X className="w-4 h-4 mr-2" /> Exit Reader
        </Button>
      </div>
      <div className="flex-grow rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white shadow-inner relative">
        <iframe
          src={`https://books.google.com/books?id=${bookId}&lpg=PP1&pg=PP1&output=embed`}
          width="100%"
          height="100%"
          frameBorder="0"
          scrolling="no"
          title="Google Books Preview"
          className="absolute top-0 left-0 w-full h-full"
        ></iframe>
      </div>
      <p className="text-xs text-slate-500 mt-3 text-center">
        Access provided by Google Books. Licensed content often provides a high-quality preview, while public domain works are available in full.
      </p>
    </div>
  );
};

const BookDetailView = ({ selectedBook, getLibraryBook, updateLibraryBook, removeFromLibrary, addToLibrary, setCurrentView }) => {
  const bookIdentifier = selectedBook?.api_id || selectedBook?.id;
  const libBook = getLibraryBook(bookIdentifier);
  const bookToUse = libBook || selectedBook || {};

  const [tempPages, setTempPages] = useState(bookToUse.pagesRead || 0);
  const [aiSummary, setAiSummary] = useState(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);

  useEffect(() => {
    setTempPages(bookToUse.pagesRead || 0);
  }, [bookToUse.pagesRead]);

  useEffect(() => {
    let interval = null;
    if (isTimerRunning) {
      interval = setInterval(() => setTimerSeconds(s => s + 1), 1000);
    } else if (!isTimerRunning && timerSeconds !== 0) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  if (!selectedBook) return null;

  const formatTime = (totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleGetSummary = async () => {
    setIsGeneratingSummary(true);
    setAiSummary(null);
    try {
      const author = bookToUse.authors ? bookToUse.authors[0] : (bookToUse.author || 'Unknown');
      const text = await fetchGeminiResponse(`Provide a concise, spoiler-free 3-sentence summary and 3 key themes for: "${bookToUse.title}" by ${author}.`);
      if (!text) throw new Error("No response received.");
      setAiSummary(text);
    } catch (err) {
      console.error(err);
      setAiSummary(`Could not generate summary: ${err.message}. Ensure your AI API Key is correctly configured.`);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleUpdate = async (updates) => {
    setIsUpdating(true);
    await updateLibraryBook(bookIdentifier, updates);
    setIsUpdating(false);
  };

  const displayThumbnail = bookToUse.thumbnail || bookToUse.cover_image;
  const displayAuthors = bookToUse.authors ? bookToUse.authors.join(', ') : (bookToUse.author || 'Unknown');

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-20">
      <Button variant="ghost" onClick={() => setCurrentView('dashboard')} className="-ml-4 mb-2">
        <ArrowLeft className="w-4 h-4 mr-2" /> Return
      </Button>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        <div className="md:col-span-4 lg:col-span-3 space-y-4">
          <div className="aspect-[2/3] w-full rounded-xl shadow-lg overflow-hidden bg-slate-100 dark:bg-slate-800 border dark:border-slate-700">
            {displayThumbnail ? (
              <img src={displayThumbnail.replace('zoom=1', 'zoom=0')} alt={bookToUse.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><BookOpen className="w-16 h-16 text-slate-300" /></div>
            )}
          </div>
          
          <Button variant="success" className="w-full shadow-sm" onClick={() => setCurrentView('reader')}>
            <BookOpen className="w-4 h-4 mr-2" /> Read Preview
          </Button>

          {libBook ? (
            <Card className="p-4 space-y-4 bg-slate-50/50 dark:bg-slate-900/50 border-indigo-50 dark:border-indigo-900/20">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Reading Status</label>
                <select 
                  disabled={isUpdating}
                  className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm dark:border-slate-700 dark:bg-slate-950 disabled:opacity-50"
                  value={libBook.status}
                  onChange={(e) => handleUpdate({ status: e.target.value })}
                >
                  <option value="want_to_read">Plan to Read</option>
                  <option value="reading">Currently Reading</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center"><BookType className="w-3 h-3 mr-1"/> Format</label>
                <select 
                  disabled={isUpdating}
                  className="w-full h-9 px-3 rounded-md border border-slate-200 bg-white text-sm dark:border-slate-700 dark:bg-slate-950 disabled:opacity-50"
                  value={libBook.format || 'Physical'}
                  onChange={(e) => handleUpdate({ format: e.target.value })}
                >
                  <option value="Physical">Physical</option>
                  <option value="E-book">E-book</option>
                  <option value="Audiobook">Audiobook</option>
                </select>
              </div>

              <Button disabled={isUpdating} variant="outline" className="w-full text-red-600 hover:bg-red-50 dark:border-red-900/30 dark:hover:bg-red-950/30" onClick={() => removeFromLibrary(bookIdentifier)}>
                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Remove from Library'}
              </Button>
            </Card>
          ) : (
            <Button variant="outline" className="w-full border-slate-300 dark:border-slate-700" onClick={() => addToLibrary(selectedBook)}>
              <Plus className="w-4 h-4 mr-2" /> Add to Library
            </Button>
          )}
        </div>

        <div className="md:col-span-8 lg:col-span-9 space-y-6">
          <div>
            <div className="flex flex-wrap gap-2 mb-3">
              {(bookToUse.categories || []).slice(0, 3).map(cat => (
                <Badge key={cat} variant="secondary">{cat}</Badge>
              ))}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-50 mb-2 leading-tight">
              {bookToUse.title}
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-400">
              by {displayAuthors}
            </p>
          </div>

          {libBook && libBook.status === 'reading' && (
            <Card className="p-5 border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/30 dark:bg-indigo-950/10">
              <div className="flex flex-col lg:flex-row gap-6 items-center">
                <div className="flex-1 w-full flex items-center justify-between lg:justify-start gap-4 p-4 bg-white dark:bg-slate-900 rounded-xl border shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-full ${isTimerRunning ? 'bg-indigo-100 text-indigo-600 animate-pulse' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                      <Timer className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Session Time</p>
                      <p className="text-2xl font-mono font-bold">{formatTime(timerSeconds)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!isTimerRunning ? (
                      <Button size="icon" onClick={() => setIsTimerRunning(true)} className="bg-green-600 hover:bg-green-700 text-white rounded-full">
                        <Play className="w-5 h-5 ml-1" />
                      </Button>
                    ) : (
                      <Button size="icon" onClick={() => setIsTimerRunning(false)} variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 rounded-full">
                        <Pause className="w-5 h-5" />
                      </Button>
                    )}
                    {timerSeconds > 0 && !isTimerRunning && (
                      <Button size="icon" variant="ghost" onClick={() => setTimerSeconds(0)} className="rounded-full">
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex-1 w-full space-y-3">
                  <div className="flex justify-between text-sm font-medium">
                    <span>Reading Progress</span>
                    <span>{Math.round((libBook.pagesRead / (bookToUse.pageCount || bookToUse.page_count || 1)) * 100)}%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Input 
                      type="number" 
                      value={tempPages} 
                      onChange={(e) => setTempPages(Number(e.target.value))}
                      className="w-24 text-center font-mono"
                    />
                    <span className="text-sm text-slate-500 whitespace-nowrap">/ {bookToUse.pageCount || bookToUse.page_count || '?'} pages</span>
                    <Button 
                      disabled={isUpdating}
                      onClick={() => {
                        handleUpdate({ pagesRead: tempPages });
                        if (timerSeconds > 0) setTimerSeconds(0);
                      }} 
                      className="w-full"
                    >
                      {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                    </Button>
                  </div>
                  <Progress value={(libBook.pagesRead / (bookToUse.pageCount || bookToUse.page_count || 1)) * 100} indicatorClass="bg-indigo-600" />
                </div>
              </div>
            </Card>
          )}

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center"><Sparkles className="w-5 h-5 mr-2 text-indigo-500" /> AI Story Insights</h3>
              {!aiSummary && !isGeneratingSummary && (
                <Button variant="ai" size="sm" onClick={handleGetSummary}>
                  <Sparkles className="w-4 h-4 mr-2" /> Ask AI
                </Button>
              )}
            </div>
            
            {isGeneratingSummary ? (
              <div className="p-6 rounded-xl border border-indigo-100 bg-indigo-50/50 dark:bg-indigo-950/20 dark:border-indigo-900/30 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mr-3" />
                <span className="text-indigo-700 dark:text-indigo-300 font-medium">AI is generating insights...</span>
              </div>
            ) : aiSummary ? (
              <div className="p-6 rounded-xl border border-indigo-100 bg-indigo-50/50 dark:bg-indigo-950/20 dark:border-indigo-900/30">
                <div className="prose prose-slate dark:prose-invert prose-sm max-w-none whitespace-pre-line text-slate-700 dark:text-slate-300">
                  {aiSummary}
                </div>
              </div>
            ) : null}
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-semibold mb-3">About this Book</h3>
            <div 
              className="prose prose-slate dark:prose-invert max-w-none prose-p:leading-relaxed text-slate-600 dark:text-slate-400"
              dangerouslySetInnerHTML={{ __html: bookToUse.description || "No description provided." }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const getStoredUser = () => {
  try {
    const item = localStorage.getItem('libtracker_user');
    return item && item !== 'undefined' ? JSON.parse(item) : null;
  } catch (err) {
    return null;
  }
};

// --- MAIN APP COMPONENT ---
export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard');
  
  // Auth State
  const [token, setToken] = useState(localStorage.getItem('libtracker_token'));
  const [user, setUser] = useState(getStoredUser());
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false); // NEW STATE FOR LOADING

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMode, setSearchMode] = useState('standard');
  
  const [selectedBook, setSelectedBook] = useState(null);
  const [discoverBooks, setDiscoverBooks] = useState([]);
  const [library, setLibrary] = useState([]);
  const [readingGoal, setReadingGoal] = useState(25);

  const searchTimeout = useRef(null);

  // --- AUTHENTICATION METHODS ---
  const handleLogout = useCallback(() => {
    localStorage.removeItem('libtracker_token');
    localStorage.removeItem('libtracker_user');
    setToken(null);
    setUser(null);
    setLibrary([]);
  }, []);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthLoading(true); // START LOADING SPINNER

    try {
      const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });
      
      let data;
      try {
        data = await res.json();
      } catch (err) {
        throw new Error('Server returned an invalid response. Ensure your backend is running.');
      }
      
      if (!res.ok) throw new Error(data.error || 'Authentication failed');
      
      localStorage.setItem('libtracker_token', data.token);
      localStorage.setItem('libtracker_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
    } catch (err) {
      console.error("Auth Request Failed:", err);
      setAuthError(err.message);
    } finally {
      setIsAuthLoading(false); // STOP LOADING SPINNER
    }
  };

  const handleAuthError = useCallback((res) => {
    if (res.status === 401 || res.status === 403) {
      handleLogout();
      throw new Error("Session expired. Please log in again.");
    }
  }, [handleLogout]);

  // --- DATABASE & API METHODS ---
  const fetchLibrary = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/library`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      handleAuthError(res);
      const data = await res.json();
      
      if (Array.isArray(data)) {
        const normalizedLibrary = data.map(dbBook => ({
          id: dbBook.api_id,
          title: dbBook.title,
          authors: [dbBook.author], 
          description: dbBook.description,
          thumbnail: dbBook.cover_image,
          pageCount: dbBook.page_count,
          status: dbBook.status,
          pagesRead: dbBook.pagesRead || 0,
          addedAt: dbBook.addedAt,
          format: dbBook.format || 'Physical'
        }));
        setLibrary(normalizedLibrary);
      } else {
        console.error("API did not return a valid array:", data);
      }
    } catch (err) {
      console.error(err);
    }
  }, [token, handleAuthError]);

  const fetchGoogleBooks = useCallback(async (query, setter, maxResults = 12) => {
    setIsSearching(true);
    try {
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=${maxResults}`);
      const data = await res.json();
      const formatted = (data.items || []).map(item => ({
        id: item.id,
        title: item.volumeInfo?.title || 'Unknown Title',
        authors: item.volumeInfo?.authors || ['Unknown Author'],
        description: item.volumeInfo?.description || 'No description available.',
        thumbnail: item.volumeInfo?.imageLinks?.thumbnail?.replace('http:', 'https:') || null,
        pageCount: item.volumeInfo?.pageCount || 0,
        publishedDate: item.volumeInfo?.publishedDate,
        categories: item.volumeInfo?.categories || [],
      }));
      setter(formatted);
    } catch (err) {
      console.error(err);
    } finally { 
      setIsSearching(false); 
    }
  }, []);

  const addToLibrary = async (book, status = 'want_to_read') => {
    if (!library.find(b => b.id === book.id)) {
      setLibrary(prev => [...prev, { ...book, status, pagesRead: 0, addedAt: Date.now(), format: 'Physical' }]);
      try {
        const res = await fetch(`${API_BASE_URL}/library`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            id: book.id, title: book.title, authors: book.authors, description: book.description,
            thumbnail: book.thumbnail, pageCount: book.pageCount, status: status, format: 'Physical'
          })
        });
        handleAuthError(res);
      } catch (error) { console.error(error); }
    }
  };

  const updateLibraryBook = async (bookId, updates) => {
    setLibrary(prev => prev.map(b => b.id === bookId ? { ...b, ...updates } : b));
    try {
      const res = await fetch(`${API_BASE_URL}/library/${bookId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(updates)
      });
      handleAuthError(res);
    } catch (error) { console.error(error); }
  };

  const removeFromLibrary = async (bookId) => {
    setLibrary(prev => prev.filter(b => b.id !== bookId));
    try {
      const res = await fetch(`${API_BASE_URL}/library/${bookId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      handleAuthError(res);
      if (currentView === 'book_detail') setCurrentView('dashboard');
    } catch (error) { console.error(error); }
  };

  const handleVibeSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim() || searchMode !== 'vibe') return;
    setCurrentView('search');
    setIsSearching(true);
    setSearchResults([]);

    try {
      const jsonResponse = await fetchGeminiResponse(`Recommend 5 specific book titles for this vibe: "${searchQuery}".`, true);
      const cleanJson = jsonResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      const recommendedTitles = JSON.parse(cleanJson);
      
      const bookPromises = recommendedTitles.map(title => 
        fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent('intitle:' + title)}&maxResults=1`).then(res => res.json())
      );
      
      const results = await Promise.all(bookPromises);
      const finalBooks = results.filter(data => data.items && data.items.length > 0).map(data => {
          const item = data.items[0];
          return {
            id: item.id, title: item.volumeInfo?.title || 'Unknown', authors: item.volumeInfo?.authors || ['Unknown'],
            description: item.volumeInfo?.description || '', thumbnail: item.volumeInfo?.imageLinks?.thumbnail?.replace('http:', 'https:') || null,
            pageCount: item.volumeInfo?.pageCount || 0, categories: item.volumeInfo?.categories || [],
          };
        });
      setSearchResults(finalBooks);
    } catch (error) {
      alert("AI Search failed. Please check your environment configuration.");
      console.error(error);
    } finally { setIsSearching(false); }
  };

  const getLibraryBook = (bookId) => library.find(b => b.id === bookId || b.api_id === bookId);
  const handleSelectBook = (book) => { setSelectedBook(book); setCurrentView('book_detail'); };

  // --- EFFECTS ---
  useEffect(() => {
    fetchGoogleBooks('subject:fiction bestseller', setDiscoverBooks, 6);
  }, [fetchGoogleBooks]);

  useEffect(() => {
    if (token) fetchLibrary();
  }, [token, fetchLibrary]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    if (searchMode !== 'standard') return;
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (searchQuery.trim().length > 2) {
      searchTimeout.current = setTimeout(() => {
        setCurrentView('search');
        fetchGoogleBooks(searchQuery, setSearchResults);
      }, 500);
    } else if (searchQuery.trim().length === 0) {
      setSearchResults([]);
    }
    return () => clearTimeout(searchTimeout.current);
  }, [searchQuery, searchMode, fetchGoogleBooks]);

  // --- RENDER AUTH SCREEN IF NOT LOGGED IN ---
  if (!token) {
    return (
      <div className={`min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 transition-colors ${isDarkMode ? 'dark' : ''}`}>
        <Card className="w-full max-w-md p-8 shadow-xl border-indigo-100 dark:border-indigo-900/30">
          <div className="flex justify-center mb-6">
            <div className="bg-indigo-600 p-3 rounded-xl shadow-md"><BookOpen className="w-8 h-8 text-white" /></div>
          </div>
          <h1 className="text-2xl font-bold text-center mb-2">Library Tracker</h1>
          <p className="text-center text-slate-500 mb-8">{authMode === 'login' ? 'Sign in to access your library' : 'Create an account to start tracking'}</p>
          
          {authError && <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-4 border border-red-100">{authError}</div>}
          
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode === 'register' && (
              <div>
                <label className="text-sm font-medium mb-1 block">Full Name</label>
                <Input required value={authForm.name} onChange={e => setAuthForm({...authForm, name: e.target.value})} placeholder="John Doe" disabled={isAuthLoading} />
              </div>
            )}
            <div>
              <label className="text-sm font-medium mb-1 block">Email</label>
              <Input required type="email" value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} placeholder="john@example.com" disabled={isAuthLoading} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Password</label>
              <Input required type="password" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} placeholder="••••••••" disabled={isAuthLoading} />
            </div>
            
            <Button disabled={isAuthLoading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white mt-6 transition-all" type="submit">
              {isAuthLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isAuthLoading ? 'Please wait...' : (authMode === 'login' ? 'Sign In' : 'Create Account')}
            </Button>
          </form>
          
          <div className="mt-6 text-center text-sm">
            <span className="text-slate-500">{authMode === 'login' ? "Don't have an account? " : "Already have an account? "}</span>
            <button disabled={isAuthLoading} onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="text-indigo-600 font-semibold hover:underline disabled:opacity-50">
              {authMode === 'login' ? 'Sign up' : 'Log in'}
            </button>
          </div>
        </Card>
      </div>
    );
  }

  // --- MAIN APP RENDER ---
  return (
    <div className={`min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 transition-colors duration-300 flex flex-col font-sans ${isDarkMode ? 'dark' : ''}`}>
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setCurrentView('dashboard')}>
            <div className="bg-indigo-600 p-1.5 rounded-lg dark:bg-indigo-500 group-hover:rotate-12 transition-transform">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg hidden sm:block tracking-tight">LibTracker</span>
          </div>

          <div className="flex-1 max-w-2xl flex flex-col sm:flex-row gap-2 items-center">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              {searchMode === 'vibe' && <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 animate-pulse" />}
              <form onSubmit={searchMode === 'vibe' ? handleVibeSearch : (e) => e.preventDefault()}>
                <Input type="text" placeholder={searchMode === 'vibe' ? "Describe the mood: 'A cozy fantasy mystery...'" : "Title, author, or ISBN..."} className={`w-full pl-9 pr-9 transition-colors ${searchMode === 'vibe' ? 'bg-indigo-50 border-indigo-200 focus-visible:ring-indigo-500 dark:bg-indigo-950/30 dark:border-indigo-800' : 'bg-slate-100 border-transparent focus-visible:bg-white dark:bg-slate-900 dark:focus-visible:bg-slate-950'}`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </form>
            </div>
            <div className="flex items-center bg-slate-100 dark:bg-slate-900 rounded-lg p-1 shrink-0 border dark:border-slate-800">
              <button onClick={() => setSearchMode('standard')} className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${searchMode === 'standard' ? 'bg-white shadow-sm dark:bg-slate-800 text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}>Standard</button>
              <button onClick={() => setSearchMode('vibe')} className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center ${searchMode === 'vibe' ? 'bg-indigo-600 shadow-sm text-white' : 'text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400'}`}><Sparkles className="w-3 h-3 mr-1" /> Vibe AI</button>
            </div>
          </div>

          <nav className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="icon" onClick={() => setIsDarkMode(!isDarkMode)}>
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1"></div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-500 hover:text-red-600">
              <LogOut className="w-4 h-4 mr-2" /> <span className="hidden sm:inline">Logout</span>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-4 py-8">
        {currentView === 'dashboard' && <DashboardView user={user} library={library} readingGoal={readingGoal} discoverBooks={discoverBooks} onSelectBook={handleSelectBook} getLibraryBook={getLibraryBook} addToLibrary={addToLibrary} />}
        {currentView === 'search' && <SearchView searchMode={searchMode} searchQuery={searchQuery} isSearching={isSearching} searchResults={searchResults} onSelectBook={handleSelectBook} getLibraryBook={getLibraryBook} addToLibrary={addToLibrary} />}
        {currentView === 'book_detail' && selectedBook && <BookDetailView selectedBook={selectedBook} getLibraryBook={getLibraryBook} updateLibraryBook={updateLibraryBook} removeFromLibrary={removeFromLibrary} addToLibrary={addToLibrary} setCurrentView={setCurrentView} />}
        {currentView === 'reader' && selectedBook && <ReaderView selectedBook={selectedBook} setCurrentView={setCurrentView} />}
      </main>
    </div>
  );
}
