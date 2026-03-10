import React from 'react';
import { clsx } from 'clsx';

export const Input = ({ label, type = 'text', className, required, ...props }) => {
    return (
        <div className={clsx('form-group', className)}>
            {label && <label>{label} {required && <span className="text-red-500">*</span>}</label>}
            <input 
                type={type}
                className="input"
                required={required}
                {...props}
            />
        </div>
    );
};
