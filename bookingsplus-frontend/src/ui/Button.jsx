import React from 'react';
import { clsx } from 'clsx';
// For Zoho UI we use normal tailwind-like utility or normal classNames. We'll stick to CSS classes from index.css

export const Button = ({ children, variant = 'primary', className, onClick, disabled, ...props }) => {
    return (
        <button 
            className={clsx('btn', `btn-${variant}`, className)}
            onClick={onClick}
            disabled={disabled}
            {...props}
        >
            {children}
        </button>
    );
};
