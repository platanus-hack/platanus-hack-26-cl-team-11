import { useState, type FormEvent } from 'react';
import { useAction } from './useAction';

interface TextFormProps {
  label: string;
  placeholder: string;
  action: string;
  maxLength: number;
  onSubmit: (text: string) => Promise<void>;
}

export function TextForm({ label, placeholder, action, maxLength, onSubmit }: TextFormProps) {
  const [value, setValue] = useState('');
  const { busy, error, run } = useAction();
  const text = value.trim();

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!text) return;
    void run(async () => {
      await onSubmit(text);
      setValue('');
    });
  }

  return (
    <>
      <form className="rd-actions" onSubmit={submit}>
        <input
          className="rd-input app-grow"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          aria-label={label}
          maxLength={maxLength}
          autoComplete="off"
        />
        <button className="rd-button rd-button--quiet" type="submit" disabled={busy || !text}>
          {action}
        </button>
      </form>
      {error && (
        <p className="rd-note" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
