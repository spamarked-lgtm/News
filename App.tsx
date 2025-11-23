
import React, { useEffect, useState } from 'react';
import { NewsStory } from './types';
import { fetchTrendingStories } from './services/geminiService';
import Header from './components/Header';
import StoryCard from './components/StoryCard';
import DetailView from './components/DetailView';
import { Loader2, AlertCircle, TrendingUp, EyeOff } from 'lucide-react';

const App: React.FC = () => {
  const [stories, setStories] = useState<NewsStory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStory, setSelectedStory] = useState<NewsStory | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [showBlindspots, setShowBlindspots] = useState<boolean>(false);

  useEffect(() => {
    const loadNews = async () => {
      setLoading(true);
      try {
        const data = await fetchTrendingStories();
        if (data.length === 0) {
          // It might return empty if ingestion failed but no crash
          // Check if we have a subtle error or just no news
           console.log("No stories returned");
        }
        setStories(data);
      } catch (err: any) {
        console.error("App Load Error:", err);
        if (err.message && err.message.includes("API_KEY")) {
            setError("Missing API Key. Please create a .env file with API_KEY=your_key");
        } else {
            setError("Unable to analyze news. Please check your connection or API quota.");
        }
      } finally {
        setLoading(false);
      }
    };

    loadNews();
  }, []);

  const filteredStories = stories.filter(story => {
    if (activeCategory !== 'All' && story.category !== activeCategory) return false;
    if (showBlindspots && story.blindspot === 'None') return false;
    return true;
  });

  const topStory = filteredStories.length > 0 ? filteredStories[0] : null;
  const gridStories = filteredStories.length > 0 ? filteredStories.slice(1) : [];
  
  // Blindspot stories for sidebar (from full list to ensure we show something even if filtered)
  const blindspotStories = stories.filter(s => s.blindspot !== 'None').slice(0, 3);

  return (
    <div className="min-h-screen flex flex-col bg-[#f3f4f6]">
      <Header 
        activeCategory={activeCategory} 
        onCategoryChange={(cat) => {
          setActiveCategory(cat);
          setSelectedStory(null);
          setShowBlindspots(false);
        }}
        showBlindspotsOnly={showBlindspots}
        toggleBlindspots={() => setShowBlindspots(!showBlindspots)}
      />

      <main className="flex-1">
        <div className="container mx-auto px-4 lg:px-6 py-8">
          
          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
               <Loader2 size={48} className="animate-spin mb-4 text-blue-600" />
               <p className="text-lg font-medium text-slate-600">Analyzing Indian Media Landscape...</p>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center h-[50vh] text-red-500 text-center p-4">
              <AlertCircle size={48} className="mb-4" />
              <p className="text-lg font-bold mb-2">{error}</p>
              <p className="text-sm text-slate-500">Check console for details.</p>
            </div>
          )}

          {/* Content */}
          {!loading && !error && (
            <>
              {selectedStory ? (
                <DetailView 
                  story={selectedStory} 
                  onBack={() => setSelectedStory(null)} 
                />
              ) : (
                <div className="flex flex-col lg:flex-row gap-8">
                  
                  {/* Main Feed */}
                  <div className="flex-1">
                    {filteredStories.length === 0 ? (
                      <div className="text-center py-20 text-slate-500">
                        <p>No stories found.</p>
                      </div>
                    ) : (
                      <>
                        {/* Section Title */}
                        <div className="flex items-center gap-2 mb-6">
                           <TrendingUp className="text-blue-600" size={20} />
                           <h2 className="text-xl font-bold text-slate-900 uppercase tracking-wide">
                             {showBlindspots ? 'Blindspot Feed' : 'Top Stories'}
                           </h2>
                        </div>

                        {/* Hero Story (Only on All/Category view) */}
                        {topStory && !showBlindspots && (
                          <div className="mb-8">
                             <StoryCard 
                               story={topStory} 
                               onClick={setSelectedStory} 
                               featured={true}
                             />
                          </div>
                        )}

                        {/* Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {(showBlindspots ? filteredStories : gridStories).map((story) => (
                            <StoryCard 
                              key={story.id} 
                              story={story} 
                              onClick={setSelectedStory}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Sidebar (Desktop Only) */}
                  {!showBlindspots && (
                    <div className="hidden lg:block w-80 space-y-8">
                       {/* Blindspot Widget */}
                       <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                          <div className="flex items-center gap-2 mb-4 text-slate-900">
                             <EyeOff size={18} className="text-orange-500" />
                             <h3 className="font-bold uppercase text-sm tracking-wider">Blindspots</h3>
                          </div>
                          <p className="text-xs text-slate-500 mb-4">
                            Stories heavily covered by one side of the political spectrum but ignored by the other.
                          </p>
                          <div className="space-y-4">
                             {blindspotStories.map(story => (
                               <div key={story.id} className="group cursor-pointer" onClick={() => setSelectedStory(story)}>
                                  <div className="flex justify-between items-start mb-1">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${story.blindspot === 'Right' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                      {story.blindspot} Missed
                                    </span>
                                  </div>
                                  <h4 className="text-sm font-medium text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug mb-2">
                                    {story.headline}
                                  </h4>
                                  <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                     <div className="h-full bg-orange-400" style={{ width: '65%' }}></div>
                                  </div>
                               </div>
                             ))}
                             {blindspotStories.length === 0 && (
                               <p className="text-xs text-slate-400 italic">No major blindspots detected right now.</p>
                             )}
                          </div>
                          <button 
                            onClick={() => setShowBlindspots(true)}
                            className="w-full mt-4 py-2 text-xs font-bold text-center text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                          >
                            VIEW ALL BLINDSPOTS
                          </button>
                       </div>

                       {/* Factuality Promo */}
                       <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
                          <h3 className="font-bold text-blue-900 text-sm mb-2">Factuality Check</h3>
                          <p className="text-xs text-blue-800/70 mb-3">
                            Upgrade to see detailed fact-check ratings for every source.
                          </p>
                          <div className="flex gap-1">
                            <div className="h-2 w-full bg-green-400 rounded-full"></div>
                            <div className="h-2 w-full bg-yellow-400 rounded-full"></div>
                            <div className="h-2 w-full bg-red-400 rounded-full"></div>
                          </div>
                       </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <footer className="bg-[#1a1a1a] text-white py-12 mt-auto border-t border-gray-800">
        <div className="container mx-auto px-6 text-center md:text-left">
          <div className="flex flex-col md:flex-row justify-between items-center">
             <div className="mb-4 md:mb-0">
                <span className="font-serif font-bold text-xl">IndiView</span>
                <p className="text-gray-500 text-sm mt-1">Read between the lines.</p>
             </div>
             <div className="flex gap-6 text-sm text-gray-400">
               <a href="#" className="hover:text-white">About</a>
               <a href="#" className="hover:text-white">Methodology</a>
               <a href="#" className="hover:text-white">Privacy</a>
             </div>
          </div>
          <div className="mt-8 text-center text-xs text-gray-600">
            © {new Date().getFullYear()} IndiView. Modeled after Ground News.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
