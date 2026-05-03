import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'danger';
type ButtonSize = 'sm' | 'md';

interface ButtonProps {
    variant?: ButtonVariant;
    size?: ButtonSize;
    icon?: React.ReactNode;
    children?: React.ReactNode;
    onClick?: (e: React.MouseEvent) => void;
    disabled?: boolean;
    className?: string;
}

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
    primary: {
        background: 'var(--neon-cyan)',
        color: '#000',
        borderColor: 'var(--neon-cyan)',
    },
    secondary: {
        background: 'transparent',
        color: 'var(--neon-cyan)',
        borderColor: 'var(--neon-cyan)',
    },
    danger: {
        background: 'var(--vscode-errorForeground)',
        color: '#fff',
        border: 'none',
    },
    ghost: {
        background: 'transparent',
        color: '#ccc',
        borderColor: '#555',
    },
    success: {
        background: 'rgba(0, 255, 157, 0.08)',
        color: 'var(--neon-green)',
        borderColor: 'var(--neon-green)',
    },
};

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
    sm: { padding: '4px 10px', fontSize: '0.8rem' },
    md: { padding: '6px 14px', fontSize: '0.85rem' },
};

export const Button: React.FC<ButtonProps> = ({
    variant = 'ghost',
    size = 'md',
    icon,
    children,
    onClick,
    disabled = false,
    className = '',
}) => {
    const baseStyle: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        borderRadius: '6px',
        border: '1px solid',
        fontFamily: 'var(--font-heading)',
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease',
        opacity: disabled ? 0.5 : 1,
        ...sizeStyles[size],
        ...variantStyles[variant],
    };

    return (
        <button
            className={`hud-btn ${className}`}
            style={baseStyle}
            onClick={disabled ? undefined : onClick}
            disabled={disabled}
        >
            {icon}
            {children}
        </button>
    );
};
