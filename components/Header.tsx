import React from 'react';
import { Menu, Search, User, Bell } from 'lucide-react';
import { CATEGORIES } from '../constants';

interface HeaderProps {
  activeCategory: string;
  onCategoryChange: (cat: string) => void;
  showBlindspotsOnly: boolean;
  toggleBlindspots: () => void;
}

const Header: React.FC<HeaderProps> = ({ 
  activeCategory, 
  onCategoryChange, 
  showBlindspotsOnly, 
  toggleBlindspots 
}) => {
  return (
    <header className="sticky top-0 z-50 bg-[#1a1a1a] text-white border-b border-gray-800 shadow-md">
      <div className="container mx-auto px-4 lg:px-6">
        {/* Top Bar */}
        <div className="flex items-center justify-between h-16">
          {/* Left Side: Logo & Mobile Menu */}
          <div className="flex items-center gap-4">
            <button className="md:hidden text-gray-300 hover:text-white">
              <Menu size={24} />
            </button>
            
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => onCategoryChange('All')}>
              <div className="w-8 h-8 bg-white rounded flex items-center justify-center">
                <span className="text-[#1a1a1a] font-serif font-bold text-xl">I</span>
              </div>
              <span className="text-xl font-serif font-bold tracking-tight hidden sm:block">IndiView</span>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-6 ml-6">
              <button 
                onClick={() => onCategoryChange('All')}
                className={`text-sm font-medium hover:text-blue-400 transition-colors ${activeCategory === 'All' && !showBlindspotsOnly ? 'text-blue-400' : 'text-gray-300'}`}
              >
                My Feed
              </button>
              <button 
                onClick={toggleBlindspots}
                className={`text-sm font-medium hover:text-orange-400 transition-colors ${showBlindspotsOnly ? 'text-orange-400' : 'text-gray-300'}`}
              >
                Blindspotter
              </button>
            </nav>
          </div>

          {/* Right Side: Search & Actions */}
          <div className="flex items-center gap-4">
             <div className="hidden lg:flex items-center gap-2 bg-[#2d2d2d] rounded-full px-3 py-1.5 border border-gray-700 focus-within:border-gray-500 transition-colors">
                <Search size={16} className="text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search news..." 
                  className="bg-transparent border-none outline-none text-sm text-white placeholder-gray-500 w-48"
                />
             </div>
             
             <button className="text-gray-400 hover:text-white transition-colors">
               <Bell size={20} />
             </button>

             <button className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-medium text-sm hover:bg-blue-700 transition-colors">
               JD
             </button>
             
             <button className="hidden sm:block bg-white text-black px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide hover:bg-gray-200 transition-colors">
               Subscribe
             </button>
          </div>
        </div>
        
        {/* Secondary Nav / Categories */}
        <div className="flex overflow-x-auto py-2 gap-6 border-t border-gray-800 no-scrollbar text-xs uppercase tracking-wider font-semibold text-gray-400">
           {CATEGORIES.filter(c => c !== 'All').map(cat => (
              <button
                key={cat}
                onClick={() => onCategoryChange(cat)}
                className={`whitespace-nowrap hover:text-white transition-colors pb-1 ${
                  activeCategory === cat 
                    ? 'text-white border-b-2 border-blue-500' 
                    : ''
                }`}
              >
                {cat}
              </button>
            ))}
        </div>
      </div>
    </header>
  );
};

export default Header;