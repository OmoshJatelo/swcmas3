import React from 'react';

/**
 * Reusable form field wrapper with inline validation.
 *
 * Props:
 *   id, label, error, hint, children (the actual <input>/<select>/<textarea>)
 */
const FormField = ({ id, label, error, hint, required, children }) => {
  return (
    <div className="space-y-1">
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </label>
      )}

      {/* Clone child to inject error border when needed */}
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        return React.cloneElement(child, {
          id: child.props.id || id,
          'aria-describedby': error ? `${id}-error` : hint ? `${id}-hint` : undefined,
          'aria-invalid': error ? 'true' : undefined,
          className: [
            child.props.className || '',
            error
              ? 'border-red-400 dark:border-red-500 focus:ring-red-500 focus:border-red-500'
              : '',
          ]
            .join(' ')
            .trim(),
        });
      })}

      {/* Inline error */}
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1 animate-fade-in"
        >
          <svg className="w-3 h-3 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}

      {/* Hint text (shown when no error) */}
      {!error && hint && (
        <p id={`${id}-hint`} className="text-xs text-gray-500 dark:text-gray-400">
          {hint}
        </p>
      )}
    </div>
  );
};

export default FormField;
