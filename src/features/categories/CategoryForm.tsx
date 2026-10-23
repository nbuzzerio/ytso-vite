import { useId, useState, type FormEvent } from "react";

interface CategoryFormProps {
  initialName?: string;
  existingNames: string[];
  submitLabel: string;
  pending: boolean;
  disabled?: boolean;
  onSubmit: (name: string) => Promise<unknown>;
  onCancel?: () => void;
}

export default function CategoryForm({
  initialName = "",
  existingNames,
  submitLabel,
  pending,
  disabled,
  onSubmit,
  onCancel,
}: CategoryFormProps) {
  const id = useId();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed.length) {
      setError("Enter a category name.");
      return;
    }
    if (
      existingNames.some(
        (existing) =>
          existing.toLocaleLowerCase() === trimmed.toLocaleLowerCase(),
      )
    ) {
      setError("A category with this name already exists.");
      return;
    }
    setError("");
    try {
      await onSubmit(trimmed);
      if (!initialName) setName("");
    } catch {
      // The mutation's error is displayed by the parent, beside the form.
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div className="field">
        <label className="field-label" htmlFor={id}>
          Category name
        </label>
        <input
          id={id}
          className="input"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError("");
          }}
          required
          minLength={1}
          maxLength={80}
          placeholder="e.g. Learn something new"
          autoFocus={!!initialName}
          disabled={pending || disabled}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {error && (
          <p id={`${id}-error`} className="text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={pending || disabled}
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={pending || disabled}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
