import React from 'react';
import { NewsStory, Article, Factuality } from '../types';
import BiasBar from './BiasBar';
import { ArrowLeft, ExternalLink, Clock, Sparkles, ShieldCheck, AlertTriangle, Shield } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface DetailViewProps {
  story: NewsStory;
  onBack: () => void;
}

const ArticleItem: React.FC<{ article: Article }> = ({ article }) => {
  const factualityConfig = (f: Factuality) => {
    switch(f) {
      case Factuality.VERY_HIGH: return { color: 'text-green-600', bg: 'bg-green-50', icon: ShieldCheck };
      case Factuality.HIGH: return { color: 'text-green-600', bg: 'bg-green-50', icon: ShieldCheck };
      case Factuality.MIXED: return { color: 'text-yellow-600', bg: 'bg-yellow-50', icon: AlertTriangle };
      default: return { color: 'text-red-600', bg: 'bg-red-50', icon: Shield };
    }
  };

  const fConfig = factualityConfig(article.source.factuality);
  const Icon = fConfig.icon;

  return (
    <a 
      href={article.url} 
      target="_blank" 
      rel="noreferrer"
      className="block p-4 mb-3 bg-white border border-gray-100 rounded-lg shadow-sm hover:shadow-md hover:border-gray-300 transition-all group"
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
            {/* Fallback source icon */}
            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500 uppercase">
                {article.source.name.substring(0, 2)}
            </div>
            <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900">
              {article.source.name}
            </span>
        </div>
        {article.source.factuality !== Factuality.MIXED && (
            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${fConfig.bg} ${fConfig.color}`}>
               <Icon size={10} />
               <span className="hidden sm:inline">{article.source.factuality}</span>
            </div>
        )}
      </div>
      
      <h4 className="text-sm font-semibold text-slate-900 mb-3 leading-snug group-hover:text-blue-700 transition-colors">
          {article.title}
      </h4>
      
      <div className="flex items-center justify-between text-gray-400 text-[10px] uppercase tracking-wider border-t border-gray-50 pt-2">
         <span className="flex items-center gap-1">
            <Clock size={10} /> {formatDistanceToNow(new Date(article.publishedAt))} ago
         </span>
         <span className="flex items-center gap-1 group-hover:text-blue-600">
            Read <ExternalLink size={10} />
         </span>
      </div>
    </a>
  );
};

const CoverageColumn: React.FC<{ 
    title: string; 
    percent: number; 
    articles: Article[]; 
    theme: 'left' | 'center' | 'right';
}> = ({ title, percent, articles, theme }) => {
    
    const themeColors = {
        left: 'border-bias-left text-bias-left bg-blue-50',
        center: 'border-gray-400 text-gray-600 bg-gray-100',
        right: 'border-bias-right text-bias-right bg-red-50'
    };

    return (
        <div className="flex-1 flex flex-col">
            <div className={`flex items-center justify-between border-t-4 py-3 mb-2 ${themeColors[theme]} border-opacity-100`}>
                <h3 className={`font-bold text-sm uppercase tracking-widest ${theme === 'center' ? 'text-slate-600' : ''}`}>{title}</h3>
                <span className="text-lg font-black">{percent}%</span>
            </div>
            
            <div className="flex-1 bg-slate-50/50 rounded-xl p-2 space-y-2 min-h-[200px]">
                {articles.length === 0 ? (
                    <div className="h-32 flex flex-col items-center justify-center text-slate-400 text-center p-4 border border-dashed border-gray-200 rounded-lg">
                        <span className="text-xs font-medium italic">No articles found</span>
                    </div>
                ) : (
                    articles.map((art, i) => <ArticleItem key={i} article={art} />)
                )}
            </div>
        </div>
    );
};

const DetailView: React.FC<DetailViewProps> = ({ story, onBack }) => {
  const leftArticles = story.articles.filter(a => a.source.biasRating.includes('Left'));
  const centerArticles = story.articles.filter(a => a.source.biasRating.includes('Center') && !a.source.biasRating.includes('Left') && !a.source.biasRating.includes('Right'));
  const rightArticles = story.articles.filter(a => a.source.biasRating.includes('Right'));

  return (
    <div className="min-h-screen bg-white animate-in fade-in slide-in-from-bottom-4 duration-300">
       {/* Breadcrumb / Navigation */}
       <div className="sticky top-16 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm">
         <div className="container mx-auto max-w-6xl px-4 h-12 flex items-center justify-between">
            <button 
                onClick={onBack}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-medium text-xs uppercase tracking-wide"
            >
                <ArrowLeft size={14} /> Back to Feed
            </button>
            <div className="text-xs font-medium text-slate-400 hidden sm:block">
                Media Analysis Dashboard
            </div>
         </div>
       </div>

       <div className="container mx-auto max-w-6xl px-4 py-10">
          
          {/* HERO SECTION */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-12">
             {/* Left: Story Details */}
             <div className="lg:col-span-7 flex flex-col justify-center">
                {/* Metadata Tags */}
                <div className="flex flex-wrap items-center gap-3 mb-6">
                   <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-bold uppercase tracking-wider rounded-full">
                      {story.category}
                   </span>
                   <span className="text-gray-300">•</span>
                   <span className="text-gray-500 text-xs font-bold uppercase tracking-wide flex items-center gap-1">
                      <Clock size={12} /> {formatDistanceToNow(new Date(story.lastUpdated))} ago
                   </span>
                   
                   {story.blindspot !== 'None' && (
                       <span className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full text-white shadow-sm ${story.blindspot === 'Right' ? 'bg-bias-right' : 'bg-bias-left'}`}>
                           {story.blindspot} Blindspot
                       </span>
                   )}
                </div>

                <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-slate-900 leading-tight mb-8">
                   {story.headline}
                </h1>

                {/* Ground Summary Box */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                   <div className="bg-gradient-to-r from-slate-50 to-white px-6 py-3 border-b border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles size={16} className="text-blue-600" />
                        <h3 className="font-bold text-xs text-slate-800 uppercase tracking-widest">Neutral Ground Summary</h3>
                      </div>
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded">AI Generated</span>
                   </div>
                   <div className="p-6 bg-white">
                      <p className="text-slate-700 text-lg leading-relaxed font-serif">
                         {story.summary}
                      </p>
                   </div>
                </div>
             </div>

             {/* Right: Visuals & Bias */}
             <div className="lg:col-span-5 space-y-6">
                {/* Main Image */}
                <div className="rounded-2xl overflow-hidden shadow-sm border border-gray-100 aspect-video relative bg-slate-100 group">
                   {story.imageUrl ? (
                      <img src={story.imageUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt={story.headline} />
                   ) : (
                      <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                          <span className="text-white/20 font-serif text-4xl font-bold select-none">{story.category.charAt(0)}</span>
                      </div>
                   )}
                </div>

                {/* Bias Distribution Card */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                   <div className="flex items-center justify-between mb-4">
                      <div className="flex flex-col">
                        <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide">Bias Distribution</h3>
                        <span className="text-xs text-slate-500">{story.totalSources} sources analyzed</span>
                      </div>
                   </div>
                   
                   <BiasBar distribution={story.biasDistribution} showLabels={true} height="h-4" />
                   
                   <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between text-xs text-slate-400">
                      <span>Lean Left</span>
                      <span>Center</span>
                      <span>Lean Right</span>
                   </div>
                </div>
             </div>
          </div>

          {/* COVERAGE COLUMNS */}
          <div className="mb-8">
             <h2 className="text-xl font-serif font-bold text-slate-900 mb-6 flex items-center gap-2">
                Coverage Analysis
                <span className="h-px bg-gray-200 flex-1 ml-4"></span>
             </h2>
             
             <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                 <CoverageColumn 
                   title="From the Left" 
                   percent={story.biasDistribution.left} 
                   articles={leftArticles} 
                   theme="left"
                 />
                 <CoverageColumn 
                   title="From the Center" 
                   percent={story.biasDistribution.center} 
                   articles={centerArticles} 
                   theme="center"
                 />
                 <CoverageColumn 
                   title="From the Right" 
                   percent={story.biasDistribution.right} 
                   articles={rightArticles} 
                   theme="right"
                 />
             </div>
          </div>

       </div>
    </div>
  );
};

export default DetailView;