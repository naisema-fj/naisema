/** The 6-digit authenticator code input, with its error announced to screen readers. */
export function CodeField({ label, error }: { label: string; error?: string | null }) {
  return (
    <>
      <label htmlFor="code">{label}</label>
      <input
        id="code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        required
        aria-describedby={error ? "code-error" : undefined}
      />
      {error && (
        <p id="code-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
