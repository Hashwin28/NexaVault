import React, { forwardRef } from 'react';

export const Input = forwardRef(({
  label,
  id,
  type = 'text',
  placeholder,
  value,
  onChange,
  error,
  icon: Icon,
  endAdornment,
  required = false,
  autoComplete,
  disabled = false,
  className = '',
  ...props
}, ref) => {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label 
          htmlFor={id} 
          className="block text-xs font-medium text-slate-300 tracking-wide select-none"
        >
          {label} {required && <span className="text-teal-400">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        {Icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 transition-colors group-focus-within:text-teal-400">
            <Icon size={18} strokeWidth={1.8} />
          </div>
        )}

        <input
          ref={ref}
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          className={`
            w-full bg-vault-canvas/90 text-vault-heading placeholder-slate-500 text-sm font-sans rounded-lg
            py-2.5 transition-all duration-150 outline-none
            ${Icon ? 'pl-10' : 'pl-3.5'}
            ${endAdornment ? 'pr-10' : 'pr-3.5'}
            border ${error ? 'border-rose-500/80 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/40' : 'border-vault-border hover:border-slate-700 focus:border-teal-500/80 focus:ring-2 focus:ring-teal-500/20 focus:bg-vault-canvas'}
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
          {...props}
        />

        {endAdornment && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center">
            {endAdornment}
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-rose-400 flex items-center gap-1 mt-1 font-medium">
          <span>{error}</span>
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
