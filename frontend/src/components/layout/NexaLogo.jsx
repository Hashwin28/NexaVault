import React from 'react';
import logoOfficial from '../../assets/images/nexavault-logo-official.png';
import logoDark from '../../assets/images/nexavault-logo-dark.png';
import logoLight from '../../assets/images/nexavault-logo-light.png';
import iconImg from '../../assets/images/nexavault-icon.png';
import { useTheme } from '../../context/ThemeContext';

export const NexaLogo = ({ className = '', size = 'md', iconOnly = false, alt = 'NexaVault', forceTheme }) => {
  const { isDark } = useTheme();
  const currentDark = forceTheme ? forceTheme === 'dark' : isDark;

  // Prominent sizing scale for crisp visibility
  const sizeClasses = {
    sm: 'h-8 sm:h-9',
    md: 'h-11 sm:h-12',
    lg: 'h-14 sm:h-16',
    xl: 'h-20 sm:h-24',
  };

  const hasCustomHeight = /\bh-\w+/.test(className);
  const heightClass = hasCustomHeight ? '' : (sizeClasses[size] || 'h-11 sm:h-12');

  if (iconOnly) {
    return (
      <div className={`inline-flex items-center justify-center select-none ${heightClass} ${className}`}>
        <img
          src={iconImg}
          alt={alt}
          className="h-full w-auto object-contain transition-transform duration-200 hover:scale-[1.03]"
          loading="eager"
        />
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center select-none ${heightClass} ${className}`}>
      {currentDark ? (
        <img
          src={logoOfficial}
          alt={alt}
          className="h-full w-auto object-contain transition-transform duration-200 hover:scale-[1.02] mix-blend-screen drop-shadow-[0_0_20px_rgba(20,184,166,0.35)]"
          loading="eager"
        />
      ) : (
        <img
          src={logoLight}
          alt={alt}
          className="h-full w-auto object-contain transition-transform duration-200 hover:scale-[1.02] drop-shadow-sm"
          loading="eager"
        />
      )}
    </div>
  );
};

export default NexaLogo;
