import React from 'react';
import { BiasDistribution } from '../types';

interface BiasBarProps {
  distribution: BiasDistribution;
  showLabels?: boolean;
  height?: string; // Allow custom height (e.g., 'h-4')
}

const BiasBar: React.FC<BiasBarProps> = ({ distribution, showLabels = false, height = 'h-2' }) => {
  const { left, center, right } = distribution;

  // Ensure we have at least a sliver for visibility if non-zero
  const minVal = (val: number) => (val > 0 && val < 5) ? 5 : val;
  
  // Recalculate to normalize to 100% visual width with min values
  const l = minVal(left);
  const c = minVal(center);
  const r = minVal(right);
  const total = l + c + r;
  
  const leftWidth = (l / total) * 100;
  const centerWidth = (c / total) * 100;
  const rightWidth = (r / total) * 100;

  return (
    <div className="w-full">
      <div className={`flex w-full ${height} rounded-full overflow-hidden bg-gray-100`}>
        {left > 0 && (
          <div 
            style={{ width: `${leftWidth}%` }} 
            className="bg-bias-left h-full border-r border-white/20"
          />
        )}
        {center > 0 && (
          <div 
            style={{ width: `${centerWidth}%` }} 
            className="bg-gray-300 h-full border-r border-white/20"
          />
        )}
        {right > 0 && (
          <div 
            style={{ width: `${rightWidth}%` }} 
            className="bg-bias-right h-full"
          />
        )}
      </div>
      
      {showLabels && (
        <div className="flex justify-between text-[10px] text-gray-500 mt-2 font-medium uppercase tracking-wide">
          <span className="text-bias-left">{left}% Left</span>
          <span className="text-gray-500">{center}% Center</span>
          <span className="text-bias-right">{right}% Right</span>
        </div>
      )}
    </div>
  );
};

export default BiasBar;