import React from 'react';

export const HeroVaultGraphic = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none opacity-40">
      {/* Dark Grid Lines Overlay */}
      <div className="absolute inset-0 vault-grid-bg" />

      {/* Technical SVG Vault Structure Overlay */}
      <svg
        className="absolute inset-0 w-full h-full text-teal-500/10"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="20%"
          cy="50%"
          r="42%"
          fill="none"
          stroke="rgba(20, 184, 166, 0.12)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <circle
          cx="20%"
          cy="50%"
          r="38%"
          fill="none"
          stroke="rgba(20, 184, 166, 0.08)"
          strokeWidth="1"
        />

        {/* Grid Axis Coordinate Lines */}
        <line x1="8%" y1="0" x2="8%" y2="100%" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="1" />
        <line x1="48%" y1="0" x2="48%" y2="100%" stroke="rgba(20, 184, 166, 0.06)" strokeWidth="1" />
        <line x1="0" y1="32%" x2="100%" y2="32%" stroke="rgba(20, 184, 166, 0.06)" strokeWidth="1" />
        <line x1="0" y1="72%" x2="100%" y2="72%" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="1" />

        {/* Subtle Static Target Node Markers */}
        <g fill="#14B8A6" opacity="0.4">
          <circle cx="48%" cy="32%" r="2" />
          <circle cx="92%" cy="72%" r="2" />
        </g>
      </svg>
    </div>
  );
};

export default HeroVaultGraphic;
