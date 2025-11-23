import React from 'react';
import { NewsStory } from '../types';
import BiasBar from './BiasBar';
import { Clock, Newspaper } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface StoryCardProps {
  story: NewsStory;
  onClick: (story: NewsStory) => void;
  featured?: boolean;
  compact?: boolean;
}

const StoryCard: React.FC<StoryCardProps> = ({ story, onClick, featured = false, compact = false }) => {
  const isBlindspot = story.blindspot !== 'None';
  
  // Fallback gradient based on ID hash or simple logic
  const getGradient = (id: string) => {
     const colors = [
       'from-blue-900 to-slate-900',
       'from-slate-800 to-gray-900',
       'from-indigo-900 to-slate-900'
     ];
     const idx = id.length % colors.length;
     return colors[idx];
  };

  return (
    <div 
      onClick={() => onClick(story)}
      className={`bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer group border border-gray-100 flex flex-col h-full ${featured ? 'md:flex-row md:h-96' : ''}`}
    >
      {/* Image Section */}
      <div className={`relative bg-gray-200 overflow-hidden ${featured ? 'md:w-2/3 h-48 md:h-full' : compact ? 'h-32' : 'h-48'}`}>
        {story.imageUrl ? (
          <img 
            src={story.imageUrl} 
            alt={story.headline} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        
        {/* Fallback if no image or error */}
        <div className={`absolute inset-0 bg-gradient-to-br ${getGradient(story.id)} flex items-center justify-center p-6 ${story.imageUrl ? 'hidden' : ''}`}>
           <span className="text-white font-serif font-bold text-2xl opacity-20 select-none">{story.category}</span>
        </div>

        {/* Blindspot Badge */}
        {isBlindspot && (
          <div className={`absolute top-3 left-3 px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wide shadow-sm z-10 ${
            story.blindspot === 'Right' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
          }`}>
            {story.blindspot} Blindspot
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className={`flex flex-col p-5 ${featured ? 'md:w-1/3 justify-between' : 'flex-1 justify-between'}`}>
        <div>
          <div className="flex items-center gap-2 mb-2">
             <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{story.category}</span>
             <span className="text-[10px] text-gray-300">•</span>
             <span className="text-[10px] text-gray-400 flex items-center gap-1">
               <Clock size={10} />
               {formatDistanceToNow(new Date(story.lastUpdated))} ago
             </span>
          </div>

          <h3 className={`font-serif font-bold text-slate-900 group-hover:text-blue-700 transition-colors leading-tight mb-3 ${featured ? 'text-2xl md:text-3xl' : compact ? 'text-base' : 'text-lg'}`}>
            {story.headline}
          </h3>

          {!compact && (
            <p className="text-slate-500 text-sm leading-relaxed mb-4 line-clamp-3">
              {story.summary}
            </p>
          )}
        </div>

        <div className="mt-2">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium text-slate-500">Bias Distribution</span>
            <span className="flex items-center gap-1">
               <Newspaper size={12} /> {story.totalSources} Sources
            </span>
          </div>
          <BiasBar distribution={story.biasDistribution} showLabels={featured} />
        </div>
      </div>
    </div>
  );
};

export default StoryCard;