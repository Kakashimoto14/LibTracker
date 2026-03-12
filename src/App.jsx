import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  BookOpen, Search, Library, LayoutDashboard, 
  Moon, Sun, Plus, Check, ChevronRight, 
  Star, ArrowLeft, Loader2, MapPin, X, BookMarked,
  Sparkles, Timer, Trophy, Play, Square, Pause, RotateCcw,
  Tags, BookType, LogOut, User as UserIcon, Maximize, Minimize,
  Filter, TrendingUp, BarChart3, BellRing, Award, Heart
} from 'lucide-react';
import ReactMarkdown from "react-markdown";

// --- CONFIGURATION ---
// IMPORTANT: Once your Vercel backend is deployed, replace this URL with your new Vercel API URL.
// Example: const API_BASE_URL = 'https://library-backend-your-id.vercel.app/api';
const API_BASE_URL = 'https://library-backend-three-delta.vercel.app/api';

// --- UTILITIES ---
// Strictly bound progress between 0 and 100 to prevent layout breakage
const calcProgress = (read, total) => {
  if (!total || total === 0) return 0;
  return Math.min(100, Math.max(0, Math.round((Number(read) / Number(total)) * 100)));
};

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

const Badge = ({ children, variant = 'default', className = '', onClick }) => {
  const variants = {
    default: "border-transparent bg-slate-900 text-slate-50 dark:bg-slate-50 dark:text-slate-900",
    secondary: "border-transparent bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-50",
    ai: "border-transparent bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300",
    active: "border-transparent bg-indigo-600 text-white dark:bg-indigo-500 shadow-md"
  };
  return <div onClick={onClick} className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${onClick ? 'cursor-pointer hover:opacity-80 transition-all' : ''} ${variants[variant]} ${className}`}>{children}</div>;
};

const Progress = ({ value, className = "", indicatorClass = "bg-slate-900 dark:bg-slate-50" }) => (
  <div className={`relative h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800 ${className}`}>
    <div className={`h-full w-full flex-1 transition-all duration-1000 ease-out ${indicatorClass}`} style={{ transform: `translateX(-${100 - (value || 0)}%)` }} />
  </div>
);

// --- GLOBAL TOAST NOTIFICATION COMPONENT ---
const Toast = ({ message, type, isVisible }) => {
  if (!isVisible) return null;
  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center p-4 rounded-xl shadow-2xl transition-all duration-300 animate-in slide-in-from-bottom-8 ${type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'}`}>
      {type === 'success' ? <Check className="w-5 h-5 mr-3 text-emerald-400 dark:text-emerald-600" /> : <BellRing className="w-5 h-5 mr-3" />}
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
};

// --- GEMINI API HELPER ---
const fetchGeminiResponse = async (prompt, asJson = false) => {
  let apiKey = "";
  try {
    const metaEnv = typeof import.meta !== 'undefined' ? import.meta.env : {};
    apiKey = metaEnv?.VITE_GEMINI_API_KEY || "";
  } catch (e) { apiKey = ""; }

  if (!apiKey) throw new Error("API Key missing. Please ensure VITE_GEMINI_API_KEY is configured.");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
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

  for (let i = 0; i < 5; i++) {
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text;
    } catch (err) {
      if (i === 4) throw err;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
};

// --- VIEW COMPONENTS ---
const BookCard = ({ book, getLibraryBook, addToLibrary, onSelectBook, favorites, toggleFavorite }) => {
  const isFav = favorites.some(fav => (fav.id || fav.api_id) === (book.id || book.api_id));
  
  return (
    <Card onClick={() => onSelectBook(book)} className="flex flex-col h-full overflow-hidden group hover:shadow-xl transition-all duration-500 transform hover:-translate-y-1 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 cursor-pointer">
      <div className="relative aspect-[2/3] w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
        {/* Heart Favorite Button */}
        <button 
          onClick={(e) => toggleFavorite(book, e)}
          className="absolute top-2 right-2 p-2 bg-black/30 hover:bg-black/50 backdrop-blur-md rounded-full transition-all z-20"
        >
          <Heart className={`w-4 h-4 ${isFav ? 'fill-red-500 text-red-500 scale-110' : 'text-white'} transition-transform`} />
        </button>

        {book.thumbnail || book.cover_image ? (
          <img src={book.thumbnail || book.cover_image} alt={book.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        ) : (
          <BookOpen className="w-12 h-12 text-slate-400" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
      <div className="p-4 flex flex-col flex-grow">
        <h3 className="font-semibold text-sm line-clamp-2 mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{book.title}</h3>
        <p className="text-xs text-slate-500 line-clamp-1 mb-2">{book.authors?.[0] || 'Unknown Author'}</p>
        <div className="mt-auto pt-2 border-t border-slate-100 dark:border-slate-800">
          {getLibraryBook(book.id || book.api_id) ? (
            <div className="flex items-center justify-center text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 py-2 rounded-md w-full">
              <Check className="w-3 h-3 mr-1" /> In Library
            </div>
          ) : (
            <Button variant="outline" size="sm" className="w-full text-xs py-2 hover:border-indigo-300 dark:hover:border-indigo-700" onClick={(e) => { e.stopPropagation(); addToLibrary(book); }}>
              <Plus className="w-3 h-3 mr-1" /> Add to Library
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

const DashboardView = ({ user, library, readingGoal, discoverBooks, trendingTopic, onSelectBook, getLibraryBook, addToLibrary, favorites, toggleFavorite }) => {
  const readingBooks = library.filter(b => b.status === 'reading');
  const wantToReadBooks = library.filter(b => b.status === 'want_to_read');
  const completedBooks = library.filter(b => b.status === 'completed');
  const challengeProgress = Math.min((completedBooks.length / readingGoal) * 100, 100);
  
  // Advanced Analytics Calculation: Strictly casts pagesRead to Numbers to ensure the math always works
  const totalPagesRead = library.reduce((total, book) => total + (Number(book.pagesRead) || 0), 0);

  return (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500 fill-mode-both">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Main Welcome & Active Reading Panel */}
        <Card className="p-6 md:col-span-8 flex flex-col justify-center bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/30 dark:to-slate-900 border-indigo-100 dark:border-indigo-900/50 shadow-md">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-1 flex items-center">
                Welcome back, {user?.name || 'Reader'}! <Sparkles className="w-5 h-5 ml-2 text-indigo-500 animate-pulse" />
              </h2>
              <p className="text-slate-500 dark:text-slate-400">Your literary journey continues.</p>
            </div>
          </div>
          
          {readingBooks.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-4 snap-x scrollbar-hide">
              {readingBooks.map((book, idx) => {
                const progress = calcProgress(book.pagesRead, book.pageCount);
                return (
                  <div key={`${book.id || book.api_id}-reading-${idx}`} onClick={() => onSelectBook(book)} className="snap-start flex gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm min-w-[260px] md:min-w-[300px] cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500 transition-all hover:shadow-md transform hover:-translate-y-1">
                    <img src={book.thumbnail || book.cover_image} className="w-16 h-24 object-cover rounded-md shadow-sm" />
                    <div className="flex-1 flex flex-col justify-center">
                      <h4 className="font-semibold text-sm line-clamp-2 mb-1">{book.title}</h4>
                      <p className="text-xs text-slate-500 mb-3">{book.authors?.[0] || 'Unknown'}</p>
                      <div className="mt-auto">
                        <div className="flex justify-between text-xs font-bold mb-1.5">
                          <span className="text-indigo-600 dark:text-indigo-400">{progress}%</span>
                          <span className="text-slate-400 font-medium">{book.pagesRead} / {book.pageCount} p</span>
                        </div>
                        <Progress value={progress} indicatorClass="bg-indigo-600 dark:bg-indigo-400" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : wantToReadBooks.length > 0 ? (
            <div className="space-y-3 animate-in fade-in">
              <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 flex items-center"><BookMarked className="w-4 h-4 mr-2"/> Up Next on Your Bookshelf</p>
              <div className="flex gap-4 overflow-x-auto pb-4 snap-x scrollbar-hide">
                {wantToReadBooks.map((book, idx) => (
                  <div key={`${book.id || book.api_id}-want-${idx}`} onClick={() => onSelectBook(book)} className="snap-start flex gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm min-w-[260px] md:min-w-[300px] cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500 transition-all hover:shadow-md transform hover:-translate-y-1">
                    <img src={book.thumbnail || book.cover_image} className="w-16 h-24 object-cover rounded-md shadow-sm" />
                    <div className="flex-1 flex flex-col justify-center">
                      <h4 className="font-semibold text-sm line-clamp-2 mb-1">{book.title}</h4>
                      <p className="text-xs text-slate-500 mb-3">{book.authors?.[0] || 'Unknown'}</p>
                      <Button variant="secondary" size="sm" className="mt-auto w-full text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300">Start Reading</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center bg-slate-50/50 dark:bg-slate-900/50">
              <BookOpen className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-slate-500 font-medium">Your library is currently empty.</p>
              <p className="text-sm text-slate-400 mb-4">Discover your next favorite book below!</p>
            </div>
          )}
        </Card>

        {/* Deep Stats Panel */}
        <div className="md:col-span-4 space-y-6 flex flex-col">
          <Card className="p-6 flex flex-col items-center justify-center text-center relative overflow-hidden flex-1 shadow-md bg-white dark:bg-slate-900 border-yellow-100 dark:border-yellow-900/20">
            <div className="absolute top-0 right-0 p-4 opacity-5 transform translate-x-4 -translate-y-4 rotate-12"><Trophy className="w-32 h-32" /></div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-full mb-3">
              <Trophy className="w-8 h-8 text-yellow-500" />
            </div>
            <h3 className="font-bold text-lg mb-1">2026 Reading Goal</h3>
            <p className="text-4xl font-black text-slate-900 dark:text-white mb-3">
              {completedBooks.length} <span className="text-xl font-medium text-slate-400">/ {readingGoal}</span>
            </p>
            <Progress value={challengeProgress} className="mb-3 h-3" indicatorClass="bg-yellow-500" />
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Books Finished</p>
          </Card>

          <div className="p-5 flex items-center gap-4 bg-slate-900 dark:bg-slate-800 rounded-xl shadow-md border border-slate-800">
            <div className="bg-white/10 p-3 rounded-lg">
              <BarChart3 className="w-6 h-6 text-indigo-300" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-0.5">Total Pages Read</p>
              <p className="text-2xl font-black text-white">{totalPagesRead.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between mb-6 border-b border-slate-200 dark:border-slate-800 pb-2">
          <h2 className="text-xl font-bold tracking-tight flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-indigo-500" /> 
            Trending in <span className="capitalize ml-1 text-indigo-600 dark:text-indigo-400">{trendingTopic}</span>
          </h2>
        </div>
        
        {discoverBooks.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 lg:gap-6">
            {discoverBooks.slice(0, 6).map((book, idx) => (
              <BookCard key={`${book.id || book.api_id}-discover-${idx}`} book={book} getLibraryBook={getLibraryBook} addToLibrary={addToLibrary} onSelectBook={onSelectBook} favorites={favorites} toggleFavorite={toggleFavorite} />
            ))}
          </div>
        ) : (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
        )}
      </section>
    </div>
  );
};

const SearchView = ({ searchMode, searchQuery, isSearching, searchResults, activeCategory, onCategoryChange, onSelectBook, getLibraryBook, addToLibrary, library, favorites, toggleFavorite, navigateTo, discoverBooks }) => {
  const CATEGORIES = ['All', 'Favorites', 'Fiction', 'Non-Fiction', 'Fantasy', 'Sci-Fi', 'Mystery', 'Romance', 'History', 'Self-Help', 'Thriller'];

  // Smart Filtering Logic:
  // If Category is 'Favorites', pull the stored book objects from favorites state directly.
  // If Category is 'All' and Query is Empty, fallback to the robust discoverBooks array.
  // Otherwise, use the live API searchResults.
  const displayedBooks = activeCategory === 'Favorites' 
    ? favorites
    : (!searchQuery && activeCategory === 'All')
      ? discoverBooks 
      : searchResults;

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500 fill-mode-both">
      <Button variant="ghost" onClick={() => navigateTo('dashboard')} className="-ml-4 mb-2 hover:bg-transparent hover:text-indigo-600 transition-colors">
        <ArrowLeft className="w-5 h-5 mr-2" /> Back to Dashboard
      </Button>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {searchMode === 'vibe' ? 'AI Vibe Recommendations' : 'Discover & Search'}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {searchMode === 'vibe' ? 'Powered by Google Gemini' : (searchQuery ? `Results for "${searchQuery}"` : 'Browse by category or search term')}
          </p>
        </div>
      </div>

      {/* Filter Pills - Scrollable horizontally on mobile */}
      {searchMode !== 'vibe' && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide w-full max-w-full">
          <Filter className="w-4 h-4 text-slate-400 shrink-0 mr-2" />
          {CATEGORIES.map(cat => (
            <Badge 
              key={cat} 
              variant={activeCategory === cat ? 'active' : 'secondary'}
              onClick={() => onCategoryChange(cat)}
              className={`whitespace-nowrap px-4 py-1.5 text-sm ${cat === 'Favorites' ? 'flex items-center gap-1' : ''}`}
            >
              {cat === 'Favorites' && <Heart className={`w-3 h-3 ${activeCategory === 'Favorites' ? 'fill-white' : 'fill-slate-400 text-slate-400'}`} />} {cat}
            </Badge>
          ))}
        </div>
      )}
      
      {isSearching ? (
        <div className="flex flex-col justify-center items-center py-32 space-y-4 animate-in fade-in duration-300">
          <div className="relative">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
            {searchMode === 'vibe' && <Sparkles className="w-4 h-4 absolute top-0 right-0 text-yellow-400 animate-ping" />}
          </div>
          <p className="text-sm font-medium text-slate-500 animate-pulse">
            {searchMode === 'vibe' ? 'Analyzing vibes and curating recommendations...' : 'Searching the global database...'}
          </p>
        </div>
      ) : displayedBooks.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 lg:gap-6">
          {displayedBooks.map((book, idx) => (
            <BookCard key={`${book.id || book.api_id}-search-${idx}`} book={book} getLibraryBook={getLibraryBook} addToLibrary={addToLibrary} onSelectBook={onSelectBook} favorites={favorites} toggleFavorite={toggleFavorite} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-32 text-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 px-4 animate-in fade-in duration-500">
          {activeCategory === 'Favorites' ? (
            <>
              <Heart className="w-12 h-12 text-slate-300 mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">No favorites yet</h3>
              <p className="text-slate-500 max-w-md">Click the heart icon on any book to add it to your personal favorites collection.</p>
            </>
          ) : (
            <>
              <Search className="w-12 h-12 text-slate-300 mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">No books found</h3>
              <p className="text-slate-500 max-w-md">
                {searchMode === 'vibe' 
                  ? "Describe the mood, setting, or feeling you want, and let AI find the perfect match!" 
                  : "Try adjusting your search terms or selecting a different category filter."}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// --- NEW COMPONENT: MY LIBRARY VIEW ---
const LibraryView = ({ library, getLibraryBook, addToLibrary, onSelectBook, favorites, toggleFavorite, navigateTo }) => {
  const [filter, setFilter] = useState('all'); 
  
  const filteredLibrary = library.filter(b => filter === 'all' || b.status === filter);

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500 fill-mode-both">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight flex items-center">
            <Library className="w-8 h-8 mr-3 text-indigo-600 dark:text-indigo-400" />
            My Library
          </h2>
          <p className="text-sm text-slate-500 mt-1 md:ml-11">Manage and track your entire collection of {library.length} books.</p>
        </div>
      </div>
      
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <Badge variant={filter === 'all' ? 'active' : 'secondary'} onClick={() => setFilter('all')} className="px-4 py-1.5 text-sm">All Books</Badge>
        <Badge variant={filter === 'want_to_read' ? 'active' : 'secondary'} onClick={() => setFilter('want_to_read')} className="px-4 py-1.5 text-sm">📌 Plan to Read</Badge>
        <Badge variant={filter === 'reading' ? 'active' : 'secondary'} onClick={() => setFilter('reading')} className="px-4 py-1.5 text-sm">📖 Currently Reading</Badge>
        <Badge variant={filter === 'completed' ? 'active' : 'secondary'} onClick={() => setFilter('completed')} className="px-4 py-1.5 text-sm">🏆 Completed</Badge>
      </div>

      {filteredLibrary.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 lg:gap-6">
          {filteredLibrary.map((book, idx) => (
            <BookCard key={`${book.id || book.api_id}-lib-${idx}`} book={book} getLibraryBook={getLibraryBook} addToLibrary={addToLibrary} onSelectBook={onSelectBook} favorites={favorites} toggleFavorite={toggleFavorite} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <BookMarked className="w-12 h-12 text-slate-300 mb-3" />
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-1">No books found in this section</h3>
          <p className="text-slate-500 mb-6">Looks like your shelf is empty for this category.</p>
          <Button onClick={() => navigateTo('search')}>
            <Search className="w-4 h-4 mr-2" /> Discover Books
          </Button>
        </div>
      )}
    </div>
  );
};

const ReaderView = ({ selectedBook, navigateTo }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  if (!selectedBook) return null;
  const bookId = selectedBook.api_id || selectedBook.id; 
  
  // Toggle body scroll when fullscreen
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isFullscreen]);

  return (
    <div className={`transition-all duration-500 ease-in-out ${isFullscreen ? 'fixed inset-0 z-[200] bg-slate-950 flex flex-col p-4 md:p-8 animate-in zoom-in-95' : 'flex flex-col h-[85vh] w-full animate-in fade-in zoom-in-95 fill-mode-both'}`}>
      <div className={`flex justify-between items-center ${isFullscreen ? 'mb-6' : 'mb-4'}`}>
        <div>
          <h2 className={`font-bold ${isFullscreen ? 'text-2xl text-white' : 'text-xl text-slate-900 dark:text-white'}`}>{selectedBook.title}</h2>
          <p className={`text-sm ${isFullscreen ? 'text-slate-400' : 'text-slate-500'}`}>Interactive Reading Mode</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant={isFullscreen ? 'secondary' : 'outline'} size="sm" onClick={() => setIsFullscreen(!isFullscreen)}>
            {isFullscreen ? <><Minimize className="w-4 h-4 mr-2" /> Exit Theater Mode</> : <><Maximize className="w-4 h-4 mr-2" /> Theater Mode</>}
          </Button>
          <Button variant="danger" size="icon" onClick={() => navigateTo('book_detail')}>
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>
      
      <div className={`flex-grow rounded-xl overflow-hidden shadow-2xl relative ${isFullscreen ? 'border-2 border-slate-800 bg-slate-900' : 'border border-slate-200 dark:border-slate-800 bg-white'}`}>
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
    </div>
  );
};

const BookDetailView = ({ selectedBook, getLibraryBook, updateLibraryBook, removeFromLibrary, addToLibrary, navigateTo, showToast }) => {
  if (!selectedBook) return null;
  const libBook = getLibraryBook(selectedBook.id || selectedBook.api_id);
  const bookToUse = libBook || selectedBook;

  const [tempPages, setTempPages] = useState(bookToUse.pagesRead || 0);
  const [aiSummary, setAiSummary] = useState(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  
  // Track if we've auto-fetched for this specific book to avoid loops
  const fetchedSummaryForRef = useRef(null);

  // Sync temp pages when book updates
  useEffect(() => {
    setTempPages(Number(bookToUse.pagesRead) || 0);
  }, [bookToUse.pagesRead]);

  // Timer logic
  useEffect(() => {
    let interval = null;
    if (isTimerRunning) {
      interval = setInterval(() => setTimerSeconds(s => s + 1), 1000);
    } else if (!isTimerRunning && timerSeconds !== 0) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  // --- AUTO REVEAL AI INSIGHTS ---
  useEffect(() => {
    const fetchAutoSummary = async () => {
      const currentId = bookToUse.id || bookToUse.api_id;
      if (currentId !== fetchedSummaryForRef.current && bookToUse.title) {
        fetchedSummaryForRef.current = currentId;
        setIsGeneratingSummary(true);
        setAiSummary(null);
        
        try {
          const author = bookToUse.authors ? bookToUse.authors[0] : 'Unknown';
          const text = await fetchGeminiResponse(`Provide a concise, spoiler-free 3-sentence summary and exactly 3 key thematic bullet points for: "${bookToUse.title}" by ${author}. Format it beautifully.`);
          setAiSummary(text || "No insights available currently.");
        } catch (err) {
          // Changed to console.warn to clean up the console for unconfigured keys
          console.warn("AI Insights unavailable:", err.message);
          setAiSummary(`Insights temporarily unavailable. Ensure your AI API Key is configured.`);
        } finally {
          setIsGeneratingSummary(false);
        }
      }
    };
    
    const timeout = setTimeout(() => {
      fetchAutoSummary();
    }, 600);
    
    return () => clearTimeout(timeout);
  }, [bookToUse.id, bookToUse.api_id, bookToUse.title, bookToUse.authors]);

  const formatTime = (totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleStatusChange = async (newStatus) => {
    await updateLibraryBook(libBook.id || libBook.api_id, { status: newStatus });
    if (newStatus === 'completed') {
      showToast("Book marked as completed! Congratulations! 🎉", "success");
    } else {
      showToast("Reading status updated", "success");
    }
  };

  const handleSaveProgress = async () => {
    let newStatus = libBook.status;
    let parsedPages = Number(tempPages);
    
    // Safety cap to total pages to prevent >100% bug
    const maxPages = Number(bookToUse.pageCount || 0);
    if (maxPages > 0 && parsedPages >= maxPages) {
      parsedPages = maxPages;
      setTempPages(maxPages);
    }
    
    let message = `Progress saved: Page ${parsedPages}`;
    
    // Automatically flag as completed if pages meet or exceed total page count
    if (maxPages > 0 && parsedPages >= maxPages) {
      newStatus = 'completed';
      message = "100% Reached! Book marked as completed! 🎉";
    }

    await updateLibraryBook(libBook.id || libBook.api_id, { pagesRead: parsedPages, status: newStatus });
    showToast(message, "success");
    if (timerSeconds > 0) setTimerSeconds(0);
  };

  const progressPercentage = calcProgress(libBook?.pagesRead || 0, bookToUse.pageCount);

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-500 fill-mode-both pb-20">
      <Button variant="ghost" onClick={() => navigateTo('dashboard')} className="-ml-4 mb-2 hover:bg-transparent hover:text-indigo-600 transition-colors">
        <ArrowLeft className="w-5 h-5 mr-2" /> Back to Dashboard
      </Button>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-10">
        {/* Left Column: Cover & Controls */}
        <div className="md:col-span-4 lg:col-span-3 space-y-4">
          <div className="aspect-[2/3] w-full rounded-2xl shadow-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 relative group">
            {bookToUse.thumbnail || bookToUse.cover_image ? (
              <img src={(bookToUse.thumbnail || bookToUse.cover_image).replace('zoom=1', 'zoom=0')} alt={bookToUse.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><BookOpen className="w-16 h-16 text-slate-300" /></div>
            )}
            
            {/* Quick Read Overlay */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-sm">
               <Button variant="success" className="shadow-lg transform scale-95 group-hover:scale-100 transition-transform duration-300" onClick={() => navigateTo('reader')}>
                 <Maximize className="w-4 h-4 mr-2" /> Read Now
               </Button>
            </div>
          </div>
          
          <Button variant="outline" className="w-full shadow-sm md:hidden" onClick={() => navigateTo('reader')}>
            <BookOpen className="w-4 h-4 mr-2" /> Open Reader Preview
          </Button>

          {libBook ? (
            <Card className="p-5 space-y-5 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 border-indigo-100 dark:border-indigo-900/30 shadow-md">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Status</label>
                <div className="relative">
                  <select 
                    className="w-full h-11 px-3 appearance-none rounded-lg border border-slate-200 bg-white font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all cursor-pointer"
                    value={libBook.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                  >
                    <option value="want_to_read">📌 Plan to Read</option>
                    <option value="reading">📖 Currently Reading</option>
                    <option value="completed">🏆 Completed</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                    <ChevronRight className="w-4 h-4 rotate-90" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center"><BookType className="w-3 h-3 mr-1"/> Format</label>
                <select 
                  className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm dark:border-slate-700 dark:bg-slate-900 text-slate-600 dark:text-slate-300 outline-none"
                  value={libBook.format || 'Physical'}
                  onChange={(e) => {
                    updateLibraryBook(libBook.id || libBook.api_id, { format: e.target.value });
                    showToast(`Format changed to ${e.target.value}`, "success");
                  }}
                >
                  <option value="Physical">Physical Book</option>
                  <option value="E-book">Digital E-book</option>
                  <option value="Audiobook">Audiobook</option>
                </select>
              </div>

              <div className="pt-2">
                <Button variant="ghost" className="w-full text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30 transition-colors" onClick={() => removeFromLibrary(libBook.id || libBook.api_id)}>
                  Remove from Library
                </Button>
              </div>
            </Card>
          ) : (
            <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-md h-12 text-base transition-all transform hover:scale-[1.02]" onClick={() => addToLibrary(selectedBook)}>
              <Plus className="w-5 h-5 mr-2" /> Add to Library
            </Button>
          )}
        </div>

        {/* Right Column: Details & Insights */}
        <div className="md:col-span-8 lg:col-span-9 space-y-8">
          <div>
            <div className="flex flex-wrap gap-2 mb-4">
              {(bookToUse.categories || []).slice(0, 3).map(cat => (
                <Badge key={cat} variant="secondary" className="px-3 py-1 text-xs">{cat}</Badge>
              ))}
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-3 tracking-tight leading-tight">
              {bookToUse.title}
            </h1>
            <p className="text-xl md:text-2xl font-medium text-slate-600 dark:text-slate-400">
              by <span className="text-indigo-600 dark:text-indigo-400">{bookToUse.authors?.join(', ') || 'Unknown Author'}</span>
            </p>
          </div>

          {libBook && libBook.status === 'reading' && (
            <div className="p-6 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-950/20 dark:to-slate-900 shadow-sm relative overflow-hidden">
              <div className="absolute -right-10 -top-10 text-indigo-100 dark:text-indigo-900/20"><Timer className="w-40 h-40" /></div>
              
              <h3 className="font-bold text-lg mb-4 flex items-center relative z-10">
                <Award className="w-5 h-5 mr-2 text-indigo-500" /> Reading Session
              </h3>
              
              <div className="flex flex-col lg:flex-row gap-6 items-center relative z-10">
                {/* Timer Block */}
                <div className="flex-1 w-full flex items-center justify-between gap-4 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-full transition-colors duration-500 ${isTimerRunning ? 'bg-indigo-100 text-indigo-600 shadow-inner' : 'bg-slate-100 text-slate-500 dark:bg-slate-900'}`}>
                      <Timer className={`w-6 h-6 ${isTimerRunning ? 'animate-pulse' : ''}`} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-0.5">Elapsed</p>
                      <p className="text-3xl font-mono font-black text-slate-900 dark:text-white tracking-wider">{formatTime(timerSeconds)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!isTimerRunning ? (
                      <Button size="icon" onClick={() => setIsTimerRunning(true)} className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full shadow-md transform hover:scale-105 transition-all w-12 h-12">
                        <Play className="w-5 h-5 ml-1" />
                      </Button>
                    ) : (
                      <Button size="icon" onClick={() => setIsTimerRunning(false)} className="bg-amber-500 hover:bg-amber-600 text-white rounded-full shadow-md w-12 h-12">
                        <Pause className="w-5 h-5" />
                      </Button>
                    )}
                    {timerSeconds > 0 && !isTimerRunning && (
                      <Button size="icon" variant="outline" onClick={() => setTimerSeconds(0)} className="rounded-full w-12 h-12 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300">
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Progress Block */}
                <div className="flex-[1.5] w-full space-y-3">
                  <div className="flex justify-between text-sm font-bold">
                    <span className="text-slate-700 dark:text-slate-300">Completion</span>
                    <span className="text-indigo-600 dark:text-indigo-400 text-lg">{progressPercentage}%</span>
                  </div>
                  <Progress value={progressPercentage} className="h-4" indicatorClass="bg-gradient-to-r from-indigo-500 to-purple-500" />
                  <div className="flex items-center gap-3 pt-2">
                    <div className="relative flex-1">
                      <Input 
                        type="number" 
                        value={tempPages} 
                        onChange={(e) => setTempPages(Number(e.target.value))}
                        className="w-full font-mono text-lg font-bold pl-4 pr-16 h-12"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium whitespace-nowrap">
                        / {bookToUse.pageCount || '?'} p
                      </span>
                    </div>
                    <Button onClick={handleSaveProgress} className="h-12 px-6 bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md transition-transform hover:scale-105">
                      Log Progress
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AI Auto-Reveal Section */}
          <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
            <h3 className="text-xl font-bold mb-4 flex items-center text-indigo-700 dark:text-indigo-400">
              <Sparkles className="w-6 h-6 mr-2" /> 
              AI Smart Insights
            </h3>
            
            {isGeneratingSummary ? (
              <div className="p-8 rounded-2xl border border-indigo-100 bg-indigo-50/50 dark:bg-indigo-950/20 dark:border-indigo-900/30 flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                <p className="text-indigo-600 dark:text-indigo-300 font-medium animate-pulse">Gemini is analyzing the text and extracting themes...</p>
              </div>
            ) : aiSummary ? (
              <div className="p-6 md:p-8 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/30 dark:to-slate-900 dark:border-indigo-900/30 shadow-sm animate-in fade-in zoom-in-95 duration-500">
                <ReactMarkdown
                  className="prose prose-slate dark:prose-invert 
                  prose-h3:text-indigo-700 
                  prose-strong:text-slate-900 
                  prose-li:marker:text-indigo-500 
                  max-w-none text-[15px]"
                >
                  {aiSummary}
                </ReactMarkdown>
              </div>
            ) : null}
          </div>

          <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
            <h3 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Synopsis</h3>
            <div className="prose prose-slate dark:prose-invert max-w-none prose-p:leading-relaxed prose-lg text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 p-6 md:p-8 rounded-2xl border border-slate-100 dark:border-slate-800" dangerouslySetInnerHTML={{ __html: bookToUse.description || "No official synopsis provided by the publisher." }} />
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
  
  // Global Toast State
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Favorites Local State 
  const [favorites, setFavorites] = useState(() => {
    try { 
      const stored = JSON.parse(localStorage.getItem('libtracker_favs')) || []; 
      // Migrate old string IDs to object arrays gracefully
      return stored.filter(item => typeof item === 'object' && item !== null);
    } 
    catch(e) { return []; }
  });

  const toggleFavorite = useCallback((book, e) => {
    if (e) e.stopPropagation();
    setFavorites(prev => {
      const isFav = prev.some(b => (b.id || b.api_id) === (book.id || book.api_id));
      let next;
      if (isFav) {
        next = prev.filter(b => (b.id || b.api_id) !== (book.id || book.api_id));
      } else {
        next = [...prev, book]; // Store entire object so it can render offline!
      }
      localStorage.setItem('libtracker_favs', JSON.stringify(next));
      return next;
    });
  }, []);

  // Search & Discovery State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMode, setSearchMode] = useState('standard');
  const [activeCategory, setActiveCategory] = useState('All');
  
  const [selectedBook, setSelectedBook] = useState(null);
  const [discoverBooks, setDiscoverBooks] = useState([]);
  const [trendingTopic, setTrendingTopic] = useState('fiction');
  
  // User Data State
  const [library, setLibrary] = useState([]);
  const [readingGoal, setReadingGoal] = useState(50);

  const searchTimeout = useRef(null);
  
  // Toast Helper
  const showToast = useCallback((message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  }, []);

  // View Navigation Helper with Premium View Transitions (Protected from multi-click)
  const navigateTo = useCallback((view, book = null) => {
    setCurrentView(prevView => {
      if (prevView === view && !book) return prevView; // Skip if we're already there

      if (document.startViewTransition) {
        document.startViewTransition(() => {
          setCurrentView(view);
          if (book !== null) setSelectedBook(book);
          window.scrollTo(0,0);
        });
        return prevView; // keep prev state temporarily while transition hooks in
      } else {
        setCurrentView(view);
        if (book !== null) setSelectedBook(book);
        window.scrollTo(0,0);
        return view;
      }
    });
  }, []);

  // --- DYNAMIC TRENDING ENGINE ---
  const fetchTrendingBooks = useCallback(async () => {
    // BUG FIX: Simplified genres so Google API never returns 0 results
    const genres = [
      'fantasy', 
      'science fiction', 
      'mystery', 
      'thriller', 
      'historical',
      'fiction',
      'romance'
    ];
    const randomTopic = genres[Math.floor(Math.random() * genres.length)];
    setTrendingTopic(randomTopic);
    
    try {
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=subject:${encodeURIComponent(randomTopic)}&orderBy=relevance&maxResults=18`);
      const data = await res.json();
      const formatted = (data.items || []).map(item => ({
        id: item.id,
        title: item.volumeInfo?.title || 'Unknown Title',
        authors: item.volumeInfo?.authors || ['Unknown Author'],
        description: item.volumeInfo?.description || 'No description available.',
        thumbnail: item.volumeInfo?.imageLinks?.thumbnail?.replace('http:', 'https:') || null,
        pageCount: item.volumeInfo?.pageCount || 0,
        categories: item.volumeInfo?.categories || [],
      }));
      setDiscoverBooks(formatted);
    } catch (err) {
      console.error("Trending fetch failed:", err);
    }
  }, []);

  useEffect(() => {
    fetchTrendingBooks();
  }, [fetchTrendingBooks]);

  useEffect(() => {
    if (token) fetchLibrary();
  }, [token]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  // --- ADVANCED SEARCH LOGIC ---
  const executeSearch = useCallback(async (query, category) => {
    if (category === 'Favorites' || (!query && category === 'All')) {
      setIsSearching(false);
      return; 
    }

    setIsSearching(true);
    try {
      let apiQuery = query ? encodeURIComponent(query) : '';
      if (category && category !== 'All') {
        apiQuery += query ? `+subject:${encodeURIComponent(category)}` : `subject:${encodeURIComponent(category)}`;
      }
      
      if (!apiQuery) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${apiQuery}&maxResults=18&orderBy=relevance`);
      const data = await res.json();
      const formatted = (data.items || []).map(item => ({
        id: item.id,
        title: item.volumeInfo?.title || 'Unknown Title',
        authors: item.volumeInfo?.authors || ['Unknown Author'],
        description: item.volumeInfo?.description || 'No description available.',
        thumbnail: item.volumeInfo?.imageLinks?.thumbnail?.replace('http:', 'https:') || null,
        pageCount: item.volumeInfo?.pageCount || 0,
        categories: item.volumeInfo?.categories || [],
      }));
      setSearchResults(formatted);
    } catch (err) {
      console.error(err);
      showToast("Search failed. Please try again.", "error");
    } finally { 
      setIsSearching(false); 
    }
  }, [showToast]);

  // Handle Search Input & Category Changes (Debounced)
  useEffect(() => {
    if (searchMode !== 'standard' || currentView !== 'search') return;
    
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    
    searchTimeout.current = setTimeout(() => {
      executeSearch(searchQuery, activeCategory);
    }, 600);
    
    return () => clearTimeout(searchTimeout.current);
  }, [searchQuery, activeCategory, searchMode, currentView, executeSearch]);

  const handleCategoryChange = (cat) => {
    setActiveCategory(cat);
    navigateTo('search');
  };

  // --- AUTHENTICATION METHODS ---
  const handleLogout = useCallback(() => {
    localStorage.removeItem('libtracker_token');
    localStorage.removeItem('libtracker_user');
    setToken(null);
    setUser(null);
    setLibrary([]);
    showToast("Logged out successfully", "success");
  }, [showToast]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Authentication failed');
      
      localStorage.setItem('libtracker_token', data.token);
      localStorage.setItem('libtracker_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      showToast(`Welcome ${authMode === 'login' ? 'back' : 'to Library Tracker'}!`, "success");
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleAuthError = useCallback((res) => {
    if (res.status === 401 || res.status === 403) {
      handleLogout();
      throw new Error("Session expired. Please log in again.");
    }
  }, [handleLogout]);

  // --- DATABASE METHODS ---
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
          pageCount: Number(dbBook.page_count) || 0,
          status: dbBook.status,
          pagesRead: Number(dbBook.pagesRead) || 0,
          addedAt: dbBook.addedAt,
          format: dbBook.format || 'Physical'
        }));
        setLibrary(normalizedLibrary);
      }
    } catch (err) {
      console.error(err);
    }
  }, [token, handleAuthError]);

  const addToLibrary = async (book, status = 'want_to_read') => {
    if (!library.find(b => b.id === (book.id || book.api_id))) {
      setLibrary(prev => [...prev, { ...book, status, pagesRead: 0, addedAt: Date.now(), format: 'Physical', id: book.id || book.api_id }]);
      showToast(`"${book.title}" added to your library!`, "success");
      
      try {
        const res = await fetch(`${API_BASE_URL}/library`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            id: book.id || book.api_id, title: book.title, authors: book.authors, description: book.description,
            thumbnail: book.thumbnail || book.cover_image, pageCount: book.pageCount, status: status, format: 'Physical'
          })
        });
        handleAuthError(res);
      } catch (error) { 
        console.error(error); 
        showToast("Error saving to cloud database", "error");
      }
    }
  };

  const updateLibraryBook = async (bookId, updates) => {
    setLibrary(prev => prev.map(b => (b.id === bookId || b.api_id === bookId) ? { ...b, ...updates } : b));
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
    setLibrary(prev => prev.filter(b => b.id !== bookId && b.api_id !== bookId));
    showToast("Book removed from library", "success");
    try {
      const res = await fetch(`${API_BASE_URL}/library/${bookId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      handleAuthError(res);
      if (currentView === 'book_detail') navigateTo('dashboard');
    } catch (error) { console.error(error); }
  };

  const handleVibeSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim() || searchMode !== 'vibe') return;
    navigateTo('search');
    setIsSearching(true);
    setSearchResults([]);

    try {
      const jsonResponse = await fetchGeminiResponse(`Recommend 5 specific and brilliant book titles for this exact vibe: "${searchQuery}". Ensure they are real, published books.`, true);
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
      showToast("AI Vision failed. Please check your API key.", "error");
      console.warn("Vibe Search Error:", error);
    } finally { setIsSearching(false); }
  };

  const getLibraryBook = (bookId) => library.find(b => b.id === bookId || b.api_id === bookId);
  const handleSelectBook = (book) => { navigateTo('book_detail', book); };

  // --- RENDER AUTH SCREEN IF NOT LOGGED IN ---
  if (!token) {
    return (
      <div className={`min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 transition-colors ${isDarkMode ? 'dark' : ''}`}>
        <Card className="w-full max-w-md p-8 shadow-2xl border-indigo-100 dark:border-indigo-900/30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl animate-in fade-in zoom-in duration-500">
          <div className="flex justify-center mb-8">
            <div className="bg-gradient-to-tr from-indigo-600 to-purple-500 p-4 rounded-2xl shadow-lg transform rotate-3"><BookOpen className="w-10 h-10 text-white transform -rotate-3" /></div>
          </div>
          <h1 className="text-3xl font-black text-center mb-2 tracking-tight text-slate-900 dark:text-white">Library Tracker</h1>
          <p className="text-center text-slate-500 mb-8 font-medium">{authMode === 'login' ? 'Sign in to access your digital bookshelf' : 'Create an account to track your journey'}</p>
          
          {authError && <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm mb-6 border border-red-100 flex items-center"><X className="w-4 h-4 mr-2" />{authError}</div>}
          
          <form onSubmit={handleAuthSubmit} className="space-y-5">
            {authMode === 'register' && (
              <div className="animate-in fade-in slide-in-from-top-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">Full Name</label>
                <Input required value={authForm.name} onChange={e => setAuthForm({...authForm, name: e.target.value})} placeholder="John Doe" className="h-12" />
              </div>
            )}
            <div>
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">Email Address</label>
              <Input required type="email" value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} placeholder="reader@example.com" className="h-12" />
            </div>
            <div>
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">Password</label>
              <Input required type="password" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} placeholder="••••••••" className="h-12" />
            </div>
            <Button className="w-full bg-slate-900 hover:bg-indigo-600 dark:bg-white dark:text-slate-900 dark:hover:bg-indigo-500 text-white mt-6 h-12 text-base font-bold shadow-md transition-all duration-300" type="submit">
              {authMode === 'login' ? 'Sign In Securely' : 'Create Free Account'}
            </Button>
          </form>
          
          <div className="mt-8 text-center text-sm font-medium">
            <span className="text-slate-500">{authMode === 'login' ? "New here? " : "Already reading with us? "}</span>
            <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">
              {authMode === 'login' ? 'Join the Club' : 'Log In'}
            </button>
          </div>
        </Card>
      </div>
    );
  }

  // --- MAIN APP RENDER ---
  return (
    <div className={`min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 transition-colors duration-300 flex flex-col font-sans ${isDarkMode ? 'dark' : ''}`}>
      {/* View Transition CSS injection for OS-level smooth crossfade */}
      <style>{`
        ::view-transition-old(root) { animation: 350ms ease-in-out both fade-out, 350ms ease-in-out both scale-down; }
        ::view-transition-new(root) { animation: 350ms ease-in-out both fade-in, 350ms ease-in-out both scale-up; }
        @keyframes fade-out { to { opacity: 0; } }
        @keyframes fade-in { from { opacity: 0; } }
        @keyframes scale-down { to { transform: scale(0.98); } }
        @keyframes scale-up { from { transform: scale(1.02); } }
      `}</style>
      
      <Toast message={toast.message} type={toast.type} isVisible={toast.show} />
      
      {/* MOBILE OPTIMIZED HEADER */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-lg dark:border-slate-800/80 dark:bg-slate-950/80 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-y-3 gap-x-4">
          
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigateTo('dashboard')}>
            <div className="bg-gradient-to-tr from-indigo-600 to-purple-500 p-2 rounded-xl shadow-md group-hover:rotate-6 transition-transform duration-300">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="font-black text-xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300">LibTracker</span>
          </div>

          {/* Quick Actions (Moves to right on mobile, stays right on desktop) */}
          <nav className="flex items-center gap-1 sm:gap-2 shrink-0 order-2 md:order-3">
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => navigateTo('library')}>
              <Library className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setIsDarkMode(!isDarkMode)}>
              {isDarkMode ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-slate-600 dark:text-slate-300" />}
            </Button>
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block"></div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 font-semibold rounded-full px-2 sm:px-4 transition-colors">
              <LogOut className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Logout</span>
            </Button>
          </nav>

          {/* Search Bar (Full width on mobile, centers on desktop) */}
          <div className="w-full order-3 md:order-2 md:flex-1 md:max-w-2xl flex flex-col sm:flex-row gap-3 items-center">
            <div className="relative w-full shadow-sm rounded-lg group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              {searchMode === 'vibe' && <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 animate-pulse" />}
              <form onSubmit={searchMode === 'vibe' ? handleVibeSearch : (e) => e.preventDefault()} className="w-full">
                <Input 
                  type="text" 
                  placeholder={searchMode === 'vibe' ? "Describe the mood: 'A cozy fantasy mystery...'" : "Search titles, authors, or subjects..."} 
                  className={`w-full h-11 pl-10 pr-9 border-slate-200 dark:border-slate-700 transition-all duration-300 focus:ring-4 focus:ring-indigo-500/20 ${searchMode === 'vibe' ? 'bg-indigo-50/50 border-indigo-200 focus-visible:ring-indigo-500 dark:bg-indigo-900/20 dark:border-indigo-800' : 'bg-slate-100/50 focus-visible:bg-white dark:bg-slate-900/50 dark:focus-visible:bg-slate-900'}`} 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  onFocus={() => {
                    // BUG FIX: Only trigger view transition if NOT currently on the search screen. 
                    if (currentView !== 'search') navigateTo('search');
                  }}
                />
              </form>
            </div>
            <div className="flex w-full sm:w-auto items-center bg-slate-100/80 dark:bg-slate-900 rounded-lg p-1 shrink-0 border border-slate-200 dark:border-slate-800 shadow-inner">
              <button onClick={() => setSearchMode('standard')} className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-md transition-all duration-300 ${searchMode === 'standard' ? 'bg-white shadow-sm dark:bg-slate-800 text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Standard</button>
              <button onClick={() => setSearchMode('vibe')} className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-md transition-all duration-300 flex items-center justify-center ${searchMode === 'vibe' ? 'bg-indigo-600 shadow-md text-white' : 'text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400'}`}><Sparkles className="w-3 h-3 mr-1" /> Vibe AI</button>
            </div>
          </div>

        </div>
      </header>

      <main className="flex-grow container mx-auto px-4 py-8">
        {currentView === 'dashboard' && <DashboardView user={user} library={library} readingGoal={readingGoal} discoverBooks={discoverBooks} trendingTopic={trendingTopic} onSelectBook={handleSelectBook} getLibraryBook={getLibraryBook} addToLibrary={addToLibrary} favorites={favorites} toggleFavorite={toggleFavorite} />}
        {currentView === 'search' && <SearchView searchMode={searchMode} searchQuery={searchQuery} isSearching={isSearching} searchResults={searchResults} activeCategory={activeCategory} onCategoryChange={handleCategoryChange} onSelectBook={handleSelectBook} getLibraryBook={getLibraryBook} addToLibrary={addToLibrary} library={library} favorites={favorites} toggleFavorite={toggleFavorite} navigateTo={navigateTo} discoverBooks={discoverBooks} />}
        {currentView === 'library' && <LibraryView library={library} getLibraryBook={getLibraryBook} addToLibrary={addToLibrary} onSelectBook={handleSelectBook} favorites={favorites} toggleFavorite={toggleFavorite} navigateTo={navigateTo} />}
        {currentView === 'book_detail' && selectedBook && <BookDetailView selectedBook={selectedBook} getLibraryBook={getLibraryBook} updateLibraryBook={updateLibraryBook} removeFromLibrary={removeFromLibrary} addToLibrary={addToLibrary} navigateTo={navigateTo} showToast={showToast} />}
        {currentView === 'reader' && selectedBook && <ReaderView selectedBook={selectedBook} navigateTo={navigateTo} />}
      </main>
    </div>
  );
}
