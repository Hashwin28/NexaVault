import React from 'react';
import { Loader2 } from 'lucide-react';

export const Button = ({
  children,
  type = 'button',
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  onClick,
  icon: Icon,
  endIcon: EndIcon,
  className = '',
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium transition-all duration-150 rounded-lg select-none outline-none focus-visible:ring-2 focus-visible:ring-teal-400/50 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.995]';

  const variants = {
    primary: 'bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold shadow-sm hover:shadow-teal-glow border border-teal-400/30',
    secondary: 'bg-vault-elevated hover:bg-vault-surface text-slate-200 border border-vault-border hover:border-slate-700',
    outline: 'bg-transparent hover:bg-vault-canvas text-slate-300 hover:text-white border border-vault-border hover:border-slate-600',
    ghost: 'bg-transparent hover:bg-vault-elevated text-slate-400 hover:text-slate-200',
  };

  const sizes = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2.5 gap-2',
    lg: 'text-base px-5 py-3 gap-2.5',
  };

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      onClick={onClick}
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="animate-spin text-current" size={size === 'sm' ? 14 : 18} />
          <span>Signing in...</span>
        </>
      ) : (
        <>
          {Icon && <Icon size={size === 'sm' ? 14 : 18} />}
          <span>{children}</span>
          {EndIcon && <EndIcon size={size === 'sm' ? 14 : 18} />}
        </>
      )}
    </button>
  );
};
