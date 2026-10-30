import { type InputHTMLAttributes } from "react";

// A labelled input with its error message, if any, read out with it.
const Field = ({
  id,
  label,
  error,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  error?: string;
  hint?: string;
}) => (
  <div>
    <label htmlFor={id}>{label}</label>
    <input
      id={id}
      aria-invalid={!!error}
      aria-describedby={
        [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") ||
        undefined
      }
      {...props}
    />
    {hint && <p id={`${id}-hint`}>{hint}</p>}
    {error && (
      <p id={`${id}-error`} role="alert">
        {error}
      </p>
    )}
  </div>
);

export default Field;
