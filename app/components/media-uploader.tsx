import { type FormEvent, useRef, useState } from "react";
import { useRevalidator } from "react-router";
import { uploadFile } from "~/lib/media-upload";
import { acceptedExtensions, formatBytes } from "~/lib/upload-rules";

const MEDIA_HINT =
  "MP4 or MOV video up to 2 GB, MP3 or M4A audio up to 500 MB, PDF up to 50 MB, or a JPEG, PNG or WebP image up to 25 MB. Every file is scanned for viruses before anyone can use it.";

/**
 * Uploads one file: checked before it starts, sent in parts with progress, and resumable by
 * choosing the same file again after an interruption. The media library's by default; a
 * contributor's upload link passes its own endpoint.
 */
export function MediaUploader({
  endpoint,
  purpose = "media",
  heading = "Upload a file",
  hint = MEDIA_HINT,
  className = "article-form upload-form",
}: {
  endpoint?: string;
  purpose?: "media" | "submission";
  heading?: string;
  hint?: string;
  className?: string;
} = {}) {
  const input = useRef<HTMLInputElement>(null);
  const revalidator = useRevalidator();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ sent: number; total: number } | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = input.current?.files?.[0];
    setStatus("");
    setError("");
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }
    setBusy(true);
    setProgress({ sent: 0, total: file.size });
    const result = await uploadFile(file, {
      endpoint,
      purpose,
      onProgress: (sent) => setProgress({ sent, total: file.size }),
    });
    setBusy(false);
    setProgress(null);
    if (result.ok) {
      setStatus(
        `${file.name} is uploaded and being scanned for viruses. ${purpose === "media" ? "It shows as ready below once it passes." : "It's listed below."}`,
      );
      form.reset();
      revalidator.revalidate();
    } else {
      setError(result.error);
    }
  }

  return (
    <form method="post" onSubmit={upload} className={className} aria-labelledby="upload-heading">
      <h2 id="upload-heading">{heading}</h2>
      <label htmlFor="media-file">File</label>
      <p id="media-file-hint" className="hint">
        {hint}
      </p>
      <input
        id="media-file"
        ref={input}
        type="file"
        name="file"
        accept={acceptedExtensions(purpose)}
        aria-describedby={error ? "media-file-hint media-file-error" : "media-file-hint"}
        disabled={busy}
      />
      <button type="submit" disabled={busy}>
        {busy ? "Uploading…" : "Upload"}
      </button>
      {progress && (
        <p>
          <progress value={progress.sent} max={progress.total} aria-label="Upload progress" />{" "}
          {formatBytes(progress.sent)} of {formatBytes(progress.total)}
        </p>
      )}
      <p role="status">{status}</p>
      {error && (
        <p id="media-file-error" role="alert" className="field-error">
          {error}
        </p>
      )}
    </form>
  );
}
