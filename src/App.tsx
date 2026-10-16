import React, { useState, useEffect } from 'react';
import { 
  INITIAL_TRACKS, 
  INITIAL_CATEGORIES, 
  INITIAL_ORDERS, 
  INITIAL_KPI,
  STUDIO_WHATSAPP_NUMBER 
} from './data/mockData.ts';
import { Track, CategoryId, RhythmType, ThemeMode, AppView, OrderRequest, KPIData } from './types/index.ts';
import { audioEngine } from './services/audioEngine.ts';
import { filterTracks, calculateConversionRate, generateWhatsAppUrl } from './utils/trackLogic.ts';
import { Header } from './components/Header.tsx';
import { Hero } from './components/Hero.tsx';
import { CategoryGrid } from './components/CategoryGrid.tsx';
import { TrackCard } from './components/TrackCard.tsx';
import { TrackDetailsView } from './components/TrackDetailsView.tsx';
import { StickyAudioPlayer } from './components/StickyAudioPlayer.tsx';
import { OrderModal } from './components/OrderModal.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { SearchModal } from './components/SearchModal.tsx';
import { MobileBottomNav } from './components/MobileBottomNav.tsx';
import { AiConciergeModal } from './components/AiConciergeModal.tsx';
import { 
  Sparkles, 
  MessageCircle, 
  ShieldCheck, 
  Headphones, 
  CheckCircle, 
  Star, 
  ChevronLeft,
  Music,
  Heart,
  Bot
} from 'lucide-react';

export default function App() {
  // Theme state with localStorage persistence
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('orchest_theme');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });

  // App navigation state
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(INITIAL_TRACKS[0]);
  const [tracks, setTracks] = useState<Track[]>(INITIAL_TRACKS);
  const [categories] = useState(INITIAL_CATEGORIES);
  const [orders, setOrders] = useState<OrderRequest[]>(INITIAL_ORDERS);
  const [kpi, setKpi] = useState<KPIData>(INITIAL_KPI);
  const [whatsappNumber, setWhatsappNumber] = useState<string>(() => {
    return localStorage.getItem('orchest_whatsapp') || STUDIO_WHATSAPP_NUMBER;
  });

  const handleUpdateWhatsAppNumber = (newNumber: string) => {
    setWhatsappNumber(newNumber);
    localStorage.setItem('orchest_whatsapp', newNumber);
  };

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('all');
  const [selectedRhythm, setSelectedRhythm] = useState<string>('all');

  // Favorites
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('orchest_favorites');
      return saved ? JSON.parse(saved) : ['orc-204', 'orc-305'];
    } catch {
      return ['orc-204', 'orc-305'];
    }
  });

  // Audio state synced from AudioEngine
  const [audioState, setAudioState] = useState(audioEngine.getState());

  // Modals state
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [orderModalTrack, setOrderModalTrack] = useState<Track>(INITIAL_TRACKS[0]);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isAiConciergeOpen, setIsAiConciergeOpen] = useState(false);

  // Sync theme to localStorage & body class
  useEffect(() => {
    localStorage.setItem('orchest_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.style.backgroundColor = '#0B0B0E';
      document.body.style.color = '#F3F4F6';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '#F9F9FB';
      document.body.style.color = '#111827';
    }
  }, [theme]);

  // Sync audio engine state
  useEffect(() => {
    const unsubscribe = audioEngine.subscribe((st) => {
      setAudioState(st);
    });
    return unsubscribe;
  }, []);

  // Save favorites to localStorage
  useEffect(() => {
    localStorage.setItem('orchest_favorites', JSON.stringify(favorites));
  }, [favorites]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const toggleFavorite = (trackId: string) => {
    setFavorites((prev) =>
      prev.includes(trackId) ? prev.filter((id) => id !== trackId) : [...prev, trackId]
    );
  };

  // Playback handlers
  const handleTogglePlay = (track: Track) => {
    if (audioState.isPlaying && audioState.trackId === track.id) {
      audioEngine.pause();
    } else {
      setSelectedTrack(track);
      audioEngine.play(track.id, track.duration, track.audioFreq || 261.63);
      // Increment stream count in KPI
      setKpi((prev) => ({
        ...prev,
        totalStreams: prev.totalStreams + 1,
      }));
    }
  };

  const handleNextTrack = () => {
    if (!selectedTrack) return;
    const currentIndex = tracks.findIndex((t) => t.id === selectedTrack.id);
    const nextTrack = tracks[(currentIndex + 1) % tracks.length];
    setSelectedTrack(nextTrack);
    audioEngine.play(nextTrack.id, nextTrack.duration, nextTrack.audioFreq || 261.63);
  };

  const handlePrevTrack = () => {
    if (!selectedTrack) return;
    const currentIndex = tracks.findIndex((t) => t.id === selectedTrack.id);
    const prevIndex = (currentIndex - 1 + tracks.length) % tracks.length;
    const prevTrack = tracks[prevIndex];
    setSelectedTrack(prevTrack);
    audioEngine.play(prevTrack.id, prevTrack.duration, prevTrack.audioFreq || 261.63);
  };

  // Order Handlers
  const openOrderModalForTrack = (track: Track) => {
    setOrderModalTrack(track);
    setIsOrderModalOpen(true);
  };

  const handleSubmitOrder = (order: OrderRequest) => {
    setOrders((prev) => [order, ...prev]);
    setKpi((prev) => {
      const newLeads = prev.whatsappLeads + 1;
      return {
        ...prev,
        whatsappLeads: newLeads,
        conversionRate: calculateConversionRate(newLeads, prev.totalVisits),
      };
    });
  };

  // Admin Handlers
  const handleAddTrack = (newTrack: Track) => {
    setTracks((prev) => [newTrack, ...prev]);
  };

  const handleDeleteTrack = (id: string) => {
    setTracks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleToggleTrend = (id: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isTrend: !t.isTrend } : t))
    );
  };

  // Filtered tracks for catalog and search
  const visibleTracks = filterTracks(tracks, searchQuery, selectedCategory, selectedRhythm);
  const trendingTracks = tracks.filter((t) => t.isTrend);
  const favoriteTracks = tracks.filter((t) => favorites.includes(t.id));

  const isDark = theme === 'dark';

  return (
    <div
      className={`min-h-screen flex flex-col font-['Alexandria',sans-serif] transition-colors duration-200 ${
        isDark ? 'bg-[#0B0B0E] text-[#F3F4F6]' : 'bg-[#F9F9FB] text-[#111827]'
      } pb-28 sm:pb-24`}
    >
      {/* 1. Header (Sticky) */}
      <Header
        theme={theme}
        onToggleTheme={toggleTheme}
        currentView={currentView}
        onNavigate={(view, catId) => {
          setCurrentView(view);
          if (catId) {
            setSelectedCategory(catId as CategoryId);
          }
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenSearch={() => setIsSearchModalOpen(true)}
        onQuickOrder={() => openOrderModalForTrack(selectedTrack || tracks[0])}
        favoritesCount={favorites.length}
      />

      {/* Main Content Router */}
      <main className="flex-1">
        {/* VIEW 1: HOME PAGE */}
        {currentView === 'home' && (
          <div>
            {/* Hero Section */}
            <Hero
              theme={theme}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              selectedCategory={selectedCategory}
              onSelectCategory={(catId) => {
                setSelectedCategory(catId);
                setCurrentView('catalog');
              }}
              onExploreClick={() => {
                const el = document.getElementById('trending-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
            />

            {/* Categories Section (أقسامنا) */}
            <CategoryGrid
              categories={categories}
              selectedCategory={selectedCategory}
              onSelectCategory={(catId) => {
                setSelectedCategory(catId);
                setCurrentView('catalog');
              }}
              theme={theme}
              onViewAll={() => setCurrentView('catalog')}
            />

            {/* Trending Tracks Section (الأعمال الرائجة) */}
            <section id="trending-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#D4AF37] animate-pulse" />
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                      الأعمال الرائجة والأكثر طلباً
                    </h2>
                  </div>
                  <p className={`text-xs sm:text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    أحدث الزفات والشيلات المنفذة بأعلى طلب من زبائن استوديو أوركست
                  </p>
                </div>

                <button
                  onClick={() => setCurrentView('catalog')}
                  className="flex items-center gap-1 text-xs sm:text-sm font-semibold text-[#D4AF37] hover:underline cursor-pointer"
                >
                  <span>عرض الكل ({tracks.length})</span>
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>

              {/* Grid of Track Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {trendingTracks.map((track) => (
                  <TrackCard
                    key={track.id}
                    track={track}
                    isPlaying={audioState.isPlaying && audioState.trackId === track.id}
                    onTogglePlay={(e) => {
                      e.stopPropagation();
                      handleTogglePlay(track);
                    }}
                    onOpenDetails={() => {
                      setSelectedTrack(track);
                      setCurrentView('track-details');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    onOrderClick={(e) => {
                      e.stopPropagation();
                      openOrderModalForTrack(track);
                    }}
                    isFavorite={favorites.includes(track.id)}
                    onToggleFavorite={(e) => {
                      e.stopPropagation();
                      toggleFavorite(track.id);
                    }}
                    theme={theme}
                  />
                ))}
              </div>
            </section>

            {/* Studio Features / Value Proposition */}
            <section className={`py-14 border-y ${isDark ? 'bg-[#16161C]/50 border-white/5' : 'bg-white border-black/5'}`}>
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center max-w-2xl mx-auto mb-10">
                  <span className="text-xs font-bold text-[#D4AF37] uppercase tracking-wider">
                    لماذا يختار العرسان أوركست؟
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-black mt-2">
                    فخامة النغمة وهيبة الحضور في ليلتك الكبرى
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className={`p-6 rounded-3xl border transition-all ${isDark ? 'bg-[#16161C] border-white/10' : 'bg-[#F9F9FB] border-black/10'}`}>
                    <div className="w-12 h-12 rounded-2xl bg-[#D4AF37]/15 text-[#D4AF37] flex items-center justify-center mb-4">
                      <Headphones className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-lg mb-2">تسجيل استوديو ماسترينغ نقي</h4>
                    <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      أعلى مستويات النقاء الصوتي (Lossless Studio Quality) المصممة خصيصاً لمكبرات صالات الأفراح وقصور الأفراح لضمان عدم وجود أي تشويش.
                    </p>
                  </div>

                  <div className={`p-6 rounded-3xl border transition-all ${isDark ? 'bg-[#16161C] border-white/10' : 'bg-[#F9F9FB] border-black/10'}`}>
                    <div className="w-12 h-12 rounded-2xl bg-[#D4AF37]/15 text-[#D4AF37] flex items-center justify-center mb-4">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-lg mb-2">تعديل خاص وحصري بالأسماء</h4>
                    <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      إمكانية إضافة أسماء العروسين وأهلهم، وتعديل الكلمات، وإضافة أبيات شعرية ترحيبية خاصة بأصوات ألمع منشدي الخليج.
                    </p>
                  </div>

                  <div className={`p-6 rounded-3xl border transition-all ${isDark ? 'bg-[#16161C] border-white/10' : 'bg-[#F9F9FB] border-black/10'}`}>
                    <div className="w-12 h-12 rounded-2xl bg-[#25D366]/15 text-[#25D366] flex items-center justify-center mb-4">
                      <MessageCircle className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-lg mb-2">طلب مباشر عبر واتساب الاستوديو</h4>
                    <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      بضغطة زر واحدة يتم تجهيز كود العمل ورابطه وتفاصيل طلبك، لتتواصل مع مهندس الصوت مباشرة وتبدأ التنفيذ دون تعقيدات.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* VIEW 2: FULL CATALOG */}
        {currentView === 'catalog' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
            {/* Header with Title & Filter Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight">جميع الأعمال الصوتية</h1>
                <p className={`text-xs sm:text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  استمع واكتشف أكثر من {tracks.length} عمل صوتي متوفر للطلب الفوري
                </p>
              </div>

              {/* Rhythm Filter Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-400">نوع الإيقاع:</span>
                <select
                  value={selectedRhythm}
                  onChange={(e) => setSelectedRhythm(e.target.value)}
                  className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold border outline-none cursor-pointer ${
                    isDark ? 'bg-[#16161C] border-white/10 text-white' : 'bg-white border-black/10 text-black'
                  }`}
                >
                  <option value="all">جميع الإيقاعات</option>
                  <option value="بدون موسيقى">بدون موسيقى</option>
                  <option value="دفوف">دفوف</option>
                  <option value="أوركسترا">أوركسترا</option>
                </select>
              </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 no-scrollbar">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap cursor-pointer transition-all ${
                  selectedCategory === 'all'
                    ? 'bg-[#D4AF37] text-black shadow-md'
                    : isDark
                    ? 'bg-[#16161C] border border-white/10 text-gray-300 hover:border-[#D4AF37]/50'
                    : 'bg-white border border-black/10 text-gray-700 hover:border-[#B89728]/50'
                }`}
              >
                الكل ({tracks.length})
              </button>

              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap cursor-pointer transition-all ${
                    selectedCategory === cat.id
                      ? 'bg-[#D4AF37] text-black shadow-md'
                      : isDark
                      ? 'bg-[#16161C] border border-white/10 text-gray-300 hover:border-[#D4AF37]/50'
                      : 'bg-white border border-black/10 text-gray-700 hover:border-[#B89728]/50'
                  }`}
                >
                  {cat.name} ({cat.count})
                </button>
              ))}
            </div>

            {/* Grid of Results */}
            {visibleTracks.length === 0 ? (
              <div className="text-center py-16">
                <Music className="w-12 h-12 text-gray-500 mx-auto mb-3 opacity-40" />
                <h3 className="font-bold text-lg mb-1">لا توجد أعمال تطابق الفلاتر المحددة</h3>
                <p className="text-xs text-gray-400">جرب تغيير نوع الإيقاع أو مسح البحث</p>
                <button
                  onClick={() => {
                    setSelectedCategory('all');
                    setSelectedRhythm('all');
                    setSearchQuery('');
                  }}
                  className="mt-4 px-4 py-2 rounded-xl bg-[#D4AF37] text-black font-semibold text-xs cursor-pointer"
                >
                  إعادة ضبط الفلاتر
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {visibleTracks.map((track) => (
                  <TrackCard
                    key={track.id}
                    track={track}
                    isPlaying={audioState.isPlaying && audioState.trackId === track.id}
                    onTogglePlay={(e) => {
                      e.stopPropagation();
                      handleTogglePlay(track);
                    }}
                    onOpenDetails={() => {
                      setSelectedTrack(track);
                      setCurrentView('track-details');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    onOrderClick={(e) => {
                      e.stopPropagation();
                      openOrderModalForTrack(track);
                    }}
                    isFavorite={favorites.includes(track.id)}
                    onToggleFavorite={(e) => {
                      e.stopPropagation();
                      toggleFavorite(track.id);
                    }}
                    theme={theme}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: TRACK DETAILS VIEW */}
        {currentView === 'track-details' && selectedTrack && (
          <TrackDetailsView
            track={selectedTrack}
            allTracks={tracks}
            isPlaying={audioState.isPlaying && audioState.trackId === selectedTrack.id}
            currentTime={audioState.trackId === selectedTrack.id ? audioState.currentTime : 0}
            duration={audioState.trackId === selectedTrack.id ? audioState.duration : selectedTrack.duration}
            volume={audioState.volume}
            isMuted={audioState.isMuted}
            onTogglePlay={() => handleTogglePlay(selectedTrack)}
            onSeek={(sec) => audioEngine.seek(sec)}
            onSkip={(sec) => audioEngine.skip(sec)}
            onVolumeChange={(vol) => audioEngine.setVolume(vol)}
            onToggleMute={() => audioEngine.toggleMute()}
            onOrderClick={() => openOrderModalForTrack(selectedTrack)}
            onBack={() => setCurrentView('catalog')}
            onSelectTrack={(t) => {
              setSelectedTrack(t);
              handleTogglePlay(t);
            }}
            isFavorite={favorites.includes(selectedTrack.id)}
            onToggleFavorite={() => toggleFavorite(selectedTrack.id)}
            theme={theme}
            onOrderOtherTrack={(t) => openOrderModalForTrack(t)}
            favorites={favorites}
            onToggleFavoriteTrack={(id) => toggleFavorite(id)}
          />
        )}

        {/* VIEW 4: FAVORITES */}
        {currentView === 'favorites' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
            <div className="mb-8">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2">
                <Heart className="w-6 h-6 text-rose-500 fill-rose-500" />
                <span>أعمالك المفضلة</span>
              </h1>
              <p className={`text-xs sm:text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                الأعمال التي قمت بحفظها للمقارنة واختيار زفة زفافك أو مناسبتك
              </p>
            </div>

            {favoriteTracks.length === 0 ? (
              <div className="text-center py-16">
                <Heart className="w-12 h-12 text-gray-500 mx-auto mb-3 opacity-30" />
                <h3 className="font-bold text-lg mb-1">قائمة المفضلة فارغة حالياً</h3>
                <p className="text-xs text-gray-400">
                  انقر على أيقونة القلب على أي زفة لحفظها والرجوع إليها لاحقاً
                </p>
                <button
                  onClick={() => setCurrentView('catalog')}
                  className="mt-4 px-4 py-2 rounded-xl bg-[#D4AF37] text-black font-semibold text-xs cursor-pointer"
                >
                  استعراض الأعمال
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {favoriteTracks.map((track) => (
                  <TrackCard
                    key={track.id}
                    track={track}
                    isPlaying={audioState.isPlaying && audioState.trackId === track.id}
                    onTogglePlay={(e) => {
                      e.stopPropagation();
                      handleTogglePlay(track);
                    }}
                    onOpenDetails={() => {
                      setSelectedTrack(track);
                      setCurrentView('track-details');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    onOrderClick={(e) => {
                      e.stopPropagation();
                      openOrderModalForTrack(track);
                    }}
                    isFavorite={true}
                    onToggleFavorite={(e) => {
                      e.stopPropagation();
                      toggleFavorite(track.id);
                    }}
                    theme={theme}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 5: ADMIN DASHBOARD */}
        {currentView === 'admin' && (
          <AdminDashboard
            tracks={tracks}
            orders={orders}
            categories={categories}
            kpi={kpi}
            whatsappNumber={whatsappNumber}
            onUpdateWhatsAppNumber={handleUpdateWhatsAppNumber}
            onAddTrack={handleAddTrack}
            onDeleteTrack={handleDeleteTrack}
            onToggleTrend={handleToggleTrend}
            theme={theme}
            onBackToStore={() => setCurrentView('home')}
          />
        )}
      </main>

      {/* 2. Persistent Floating Sticky Audio Player */}
      {selectedTrack && (
        <StickyAudioPlayer
          track={selectedTrack}
          isPlaying={audioState.isPlaying && audioState.trackId === selectedTrack.id}
          currentTime={audioState.trackId === selectedTrack.id ? audioState.currentTime : 0}
          duration={audioState.trackId === selectedTrack.id ? audioState.duration : selectedTrack.duration}
          volume={audioState.volume}
          isMuted={audioState.isMuted}
          onTogglePlay={() => handleTogglePlay(selectedTrack)}
          onSeek={(sec) => audioEngine.seek(sec)}
          onSkip={(sec) => audioEngine.skip(sec)}
          onNext={handleNextTrack}
          onPrev={handlePrevTrack}
          onVolumeChange={(vol) => audioEngine.setVolume(vol)}
          onToggleMute={() => audioEngine.toggleMute()}
          onOpenDetails={() => {
            setCurrentView('track-details');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onOrderClick={() => openOrderModalForTrack(selectedTrack)}
          onClose={() => {
            audioEngine.stop();
            setSelectedTrack(null);
          }}
          theme={theme}
        />
      )}

      {/* 3. Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        currentView={currentView}
        onNavigate={(view) => {
          setCurrentView(view);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        favoritesCount={favorites.length}
        onWhatsAppContact={() => {
          window.open(generateWhatsAppUrl(whatsappNumber, 'مرحباً استوديو أوركست، أود الاستفسار عن تفاصيل الزفات والشيلات'), '_blank');
        }}
        theme={theme}
      />

      {/* 4. Smart WhatsApp Order Modal (and Mobile Bottom Sheet) */}
      <OrderModal
        track={orderModalTrack}
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        onSubmitOrder={handleSubmitOrder}
        theme={theme}
        whatsappNumber={whatsappNumber}
      />

      {/* 5. Instant Search Modal */}
      <SearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        tracks={tracks}
        onSelectTrack={(t) => {
          setSelectedTrack(t);
          setCurrentView('track-details');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        theme={theme}
      />

      {/* 6. AI Concierge Floating Button & Chat Modal ("اسأل مساعد أوركست") */}
      <div className="fixed bottom-28 sm:bottom-24 left-4 z-40">
        <button
          onClick={() => setIsAiConciergeOpen(true)}
          aria-label="اسأل مساعد أوركست الذكي"
          className="group flex items-center gap-2.5 px-3.5 py-2.5 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB] text-black font-bold text-xs sm:text-sm shadow-xl hover:shadow-[0_0_25px_rgba(212,175,55,0.5)] active:scale-95 transition-all duration-300 cursor-pointer border border-white/30 backdrop-blur-md"
        >
          <div className="w-7 h-7 rounded-full bg-black/15 flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4 text-black group-hover:rotate-12 transition-transform" />
          </div>
          <span className="hidden sm:inline">مساعد أوركست الذكي 🎵</span>
          <span className="sm:hidden">اسأل المساعد</span>
          <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
        </button>
      </div>

      <AiConciergeModal
        isOpen={isAiConciergeOpen}
        onClose={() => setIsAiConciergeOpen(false)}
        tracks={tracks}
        onSelectTrack={(t) => {
          setSelectedTrack(t);
          handleTogglePlay(t);
        }}
        onOrderTrack={(t, note) => {
          setIsAiConciergeOpen(false);
          openOrderModalForTrack(t);
        }}
        activeTrackId={selectedTrack?.id || null}
        isPlaying={audioState.isPlaying}
        theme={theme}
      />
    </div>
  );
}
