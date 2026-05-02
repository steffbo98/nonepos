import { forwardRef, InputHTMLAttributes } from 'react';

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">{label}</label>
        <input
          ref={ref}
          className={`w-full px-4 py-3 bg-slate-50 border rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-slate-900 placeholder-slate-400 ${
            error ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-200'
          } ${className}`}
          {...props}
        />
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
      </div>
    );
  }
);

FormInput.displayName = 'FormInput';

interface FormButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: 'primary' | 'secondary';
  children: React.ReactNode;
}

export const FormButton = forwardRef<HTMLButtonElement, FormButtonProps>(
  ({ loading, variant = 'primary', className = '', children, ...props }, ref) => {
    const baseClasses = 'w-full flex items-center justify-center gap-3 py-3 px-6 font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed';
    const variantClasses = variant === 'primary'
      ? 'bg-slate-900 text-white hover:bg-slate-800'
      : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50';

    return (
      <button
        ref={ref}
        className={`${baseClasses} ${variantClasses} ${className}`}
        {...props}
      >
        {loading ? (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          children
        )}
      </button>
    );
  }
);

FormButton.displayName = 'FormButton';

interface AlertProps {
  type: 'error' | 'success' | 'info';
  message: string;
}

export const Alert = ({ type, message }: AlertProps) => {
  const styles = {
    error: 'bg-red-50 border-red-200 text-red-700',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    info: 'bg-blue-50 border-blue-200 text-blue-700'
  };

  return (
    <div className={`p-4 border rounded-lg text-sm ${styles[type]}`}>
      {message}
    </div>
  );
};