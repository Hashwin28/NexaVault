import React from 'react';

export const HeroVaultGraphic = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      {/* Dark Grid Lines Overlay */}
      <div className="absolute inset-0 vault-grid-bg opacity-40" />

      {/* Radial Gradient Spotlight in Deep Teal */}
      <div 
        className="absolute top-1/2 -left-1/4 w-[800px] h-[800px] -translate-y-1/2 rounded-full opacity-20 filter blur-[120px]"
        style={{
          background: 'radial-gradient(circle, rgba(20, 184, 166, 0.35) 0%, rgba(13, 148, 136, 0.1) 45%, transparent 70%)'
        }}
      />

      {/* Technical SVG Vault Structure Overlay */}
      <svg
        className="absolute inset-0 w-full h-full text-teal-500/20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(45, 212, 191, 0.3)" />
            <stop offset="50%" stopColor="rgba(20, 184, 166, 0.15)" />
            <stop offset="100%" stopColor="rgba(13, 148, 136, 0.02)" />
          </linearGradient>
        </defs>

        {/* Large Concentric Vault Arc (Matches user reference image) */}
        <circle
          cx="20%"
          cy="50%"
          r="42%"
          fill="none"
          stroke="url(#arcGrad)"
          strokeWidth="1.5"
          strokeDasharray="4 2"
        />

        <circle
          cx="20%"
          cy="50%"
          r="38%"
          fill="none"
          stroke="rgba(20, 184, 166, 0.12)"
          strokeWidth="1"
        />

        {/* Grid Axis Coordinate Lines */}
        <line x1="8%" y1="0" x2="8%" y2="100%" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="1" />
        <line x1="48%" y1="0" x2="48%" y2="100%" stroke="rgba(20, 184, 166, 0.08)" strokeWidth="1" />
        <line x1="0" y1="32%" x2="100%" y2="32%" stroke="rgba(20, 184, 166, 0.08)" strokeWidth="1" />
        <line x1="0" y1="72%" x2="100%" y2="72%" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="1" />

        {/* Technical Target / Node Markers */}
        <g stroke="#2DD4BF" strokeWidth="1.5" opacity="0.6">
          <circle cx="48%" cy="32%" r="3" fill="#14B8A6" />
          <circle cx="48%" cy="32%" r="8" fill="none" stroke="rgba(45, 212, 191, 0.3)" />
          
          <circle cx="92%" cy="72%" r="2.5" fill="#14B8A6" />
        </g>
      </svg>
    </div>
  );
};
