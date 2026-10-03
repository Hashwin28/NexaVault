import React from 'react';

export const NexaLogo = ({ className = '', size = 'md' }) => {
  const iconSizes = {
    sm: 24,
    md: 32,
    lg: 40,
  };

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Geometric 'N' Logo Icon */}
      <div className="relative flex items-center justify-center">
        <svg
          width={iconSizes[size] || 32}
          height={iconSizes[size] || 32}
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-teal-400"
        >
          {/* Subtle background glow circle */}
          <circle cx="20" cy="20" r="18" fill="rgba(20, 184, 166, 0.08)" stroke="rgba(20, 184, 166, 0.2)" strokeWidth="1" />
          
          {/* Left Vertical Pillar */}
          <path
            d="M12 10V30"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          
          {/* Right Vertical Pillar */}
          <path
            d="M28 10V30"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          
          {/* Diagonal Vault Connector */}
          <path
            d="M12 11L28 29"
            stroke="#5EEAD4"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          {/* Node intersection dot */}
          <circle cx="20" cy="20" r="2.5" fill="#14B8A6" />
        </svg>
      </div>

      {/* Brand Wordmark */}
      <div className="flex flex-col">
        <span className="font-bold tracking-wider text-vault-heading uppercase text-lg leading-none font-sans">
          NEXA<span className="text-teal-400">VAULT</span>
        </span>
      </div>
    </div>
  );
};
