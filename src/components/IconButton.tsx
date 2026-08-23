import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: ReactNode;
  active?: boolean;
  quiet?: boolean;
}

export function IconButton({ label, icon, active, quiet, className = '', ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`icon-button ${active ? 'is-active' : ''} ${quiet ? 'is-quiet' : ''} ${className}`}
      {...props}
    >
      {icon}
    </button>
  );
}
