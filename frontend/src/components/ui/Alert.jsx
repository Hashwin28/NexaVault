import React from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

export const Alert = ({
  type = 'error',
  title,
  message,
  className = '',
}) => {
  const styles = {
    error: {
      bg: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
      icon: AlertCircle,
      iconColor: 'text-rose-400',
    },
    success: {
      bg: 'bg-teal-500/10 border-teal-500/30 text-teal-300',
      icon: CheckCircle2,
      iconColor: 'text-teal-400',
    },
    info: {
      bg: 'bg-sky-500/10 border-sky-500/30 text-sky-300',
      icon: Info,
      iconColor: 'text-sky-400',
    },
  };

  const currentStyle = styles[type] || styles.error;
  const IconComponent = currentStyle.icon;

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border text-xs leading-relaxed transition-all duration-200 ${currentStyle.bg} ${className}`}>
      <IconComponent size={16} className={`shrink-0 mt-0.5 ${currentStyle.iconColor}`} />
      <div>
        {title && <h4 className="font-semibold mb-0.5">{title}</h4>}
        {message && <p className="opacity-90">{message}</p>}
      </div>
    </div>
  );
};
