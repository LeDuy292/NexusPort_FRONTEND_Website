import React from 'react';

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  hint?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  required = false,
  error,
  children,
  hint,
}) => {
  return (
    <div className="flex flex-col gap-1 w-full text-left">
      <label className="text-[13px] font-medium text-content-main flex items-center gap-1">
        <span>{label}</span>
        {required && <span className="text-status-redText">*</span>}
      </label>
      {children}
      {hint && !error && <span className="text-[12px] text-content-sub">{hint}</span>}
      {error && <span className="text-[12px] text-status-redText">{error}</span>}
    </div>
  );
};

