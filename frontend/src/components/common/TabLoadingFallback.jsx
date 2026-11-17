import React from 'react';

export const TabLoadingFallback = ({ message = 'Loading view...' }) => {
  return (
    <div className="flex items-center justify-center p-16 text-slate-400 font-mono text-xs">
      <div className="flex items-center gap-3">
        <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        <span>{message}</span>
      </div>
    </div>
  );
};

export default TabLoadingFallback;
