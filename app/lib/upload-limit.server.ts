export class UploadTooLarge extends Error {}

/**
 * Reads a form upload, refusing it as soon as it passes `maxBytes`, so an oversized file is never
 * buffered in full (docs/phase-1a-defaults.md §1). A declared Content-Length over the limit is
 * refused before any of the body is read.
 */
export async function readLimitedFormData(request: Request, maxBytes: number): Promise<FormData> {
  if (Number(request.headers.get("Content-Length") ?? 0) > maxBytes) throw new UploadTooLarge();
  if (!request.body) return request.formData();
  let received = 0;
  const limited = request.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        received += chunk.byteLength;
        if (received > maxBytes) controller.error(new UploadTooLarge());
        else controller.enqueue(chunk);
      },
    }),
  );
  try {
    return await new Response(limited, {
      headers: { "Content-Type": request.headers.get("Content-Type") ?? "" },
    }).formData();
  } catch (error) {
    if (received > maxBytes) throw new UploadTooLarge();
    throw error;
  }
}
