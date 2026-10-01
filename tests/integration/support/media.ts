import { ADMIN, type Browser } from "./staff";

const json = { "Content-Type": "application/json", Origin: ADMIN };

/** The upload endpoints, called as the media library's browser code calls them. */
export function startUpload(browser: Browser, file: { name: string; type: string; size: number }) {
  return browser.fetch("/admin/media/uploads", { method: "POST", headers: json, body: JSON.stringify(file) });
}

export function sendPart(browser: Browser, id: string, number: number, bytes: Uint8Array) {
  return browser.fetch(`/admin/media/uploads/${id}/parts/${number}`, {
    method: "PUT",
    headers: { Origin: ADMIN },
    body: bytes.slice(),
  });
}

export function completeUpload(browser: Browser, id: string) {
  return browser.fetch(`/admin/media/uploads/${id}`, { method: "POST", headers: { Origin: ADMIN } });
}
