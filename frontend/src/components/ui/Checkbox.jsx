import React from 'react';
import { Check } from 'lucide-react';

export const Checkbox = ({
  id,
  checked,
  onChange,
  label,
  disabled = false,
  className = '',
}) => {
  return (
    <label
      htmlFor={id}
      className={`inline-flex items-center gap-2.5 cursor-pointer select-none text-xs font-medium text-slate-300 hover:text-slate-200 transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      <div className="relative flex items-center justify-center">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="sr-only peer"
        />
        <div className="w-4 h-4 rounded border border-slate-700 bg-vault-canvas peer-checked:bg-teal-500 peer-checked:border-teal-400 peer-focus-visible:ring-2 peer-focus-visible:ring-teal-400/50 transition-all duration-150 flex items-center justify-center">
          {checked && <Check size={12} className="text-slate-950 stroke-[3]" />}
        </div>
      </div>
      {label && <span>{label}</span>}
    </label>
  );
};
