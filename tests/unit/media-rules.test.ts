import { describe, expect, it } from "vitest";
import {
  acceptedExtensions,
  checkContent,
  checkDeclared,
  EVIDENCE_MAX_BYTES,
  HEAD_BYTES,
  MAX_BYTES,
  type UploadType,
} from "~/lib/media-rules";

/**
 * The upload allowlist and content check (TECH-02). Only signed-in staff upload, and these two
 * checks are what stand in for the Phase 1a quarantine and virus scan (ADR-0015), so each rule is
 * pinned here.
 */

const MB = 1024 * 1024;
const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));
/** The first HEAD_BYTES of a file, padded with zeros, as the upload check reads them. */
const head = (...bytes: number[]) => {
  const out = new Uint8Array(HEAD_BYTES);
  out.set(bytes.slice(0, HEAD_BYTES));
  return out;
};
/** An ISO media file (MP4, M4A) opening with an `ftyp` box of the given major brand. */
const isoMedia = (brand: string) => head(0, 0, 0, 0x18, ...ascii("ftyp"), ...ascii(brand));

const SAMPLES: Record<UploadType, Uint8Array> = {
  "video/mp4": isoMedia("isom"),
  "audio/mpeg": head(...ascii("ID3"), 4, 0),
  "audio/mp4": isoMedia("M4A "),
  "application/pdf": head(...ascii("%PDF-1.7")),
  "image/jpeg": head(0xff, 0xd8, 0xff, 0xe0),
  "image/png": head(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
  "image/webp": head(...ascii("RIFF"), 0x24, 0, 0, 0, ...ascii("WEBP")),
};

describe("what a file says it is", () => {
  const file = (name: string, type = "", size = 1024) => ({ name, type, size });

  it("accepts each allowed kind by its extension, in any case, with or without a declared type", () => {
    expect(checkDeclared(file("market.mp4", "video/mp4"), "media")).toEqual({ ok: true, type: "video/mp4" });
    expect(checkDeclared(file("Market.M4V"), "media")).toEqual({ ok: true, type: "video/mp4" });
    expect(checkDeclared(file("talanoa.mp3", "audio/mpeg"), "media")).toEqual({ ok: true, type: "audio/mpeg" });
    expect(checkDeclared(file("talanoa.m4a", "audio/mp4"), "media")).toEqual({ ok: true, type: "audio/mp4" });
    expect(checkDeclared(file("guide.pdf", "application/pdf"), "media")).toEqual({
      ok: true,
      type: "application/pdf",
    });
    expect(checkDeclared(file("reef.JPEG"), "media")).toEqual({ ok: true, type: "image/jpeg" });
    expect(checkDeclared(file("reef.png", "image/png"), "media")).toEqual({ ok: true, type: "image/png" });
    expect(checkDeclared(file("reef.webp", "image/webp"), "media")).toEqual({ ok: true, type: "image/webp" });
  });

  it("accepts the other names browsers give the same types", () => {
    expect(checkDeclared(file("talanoa.mp3", "audio/mp3"), "media")).toMatchObject({ ok: true });
    expect(checkDeclared(file("talanoa.m4a", "audio/x-m4a"), "media")).toMatchObject({ ok: true });
    expect(checkDeclared(file("talanoa.m4a", "audio/m4a"), "media")).toMatchObject({ ok: true });
    expect(checkDeclared(file("reef.jpg", "image/jpg"), "media")).toMatchObject({ ok: true });
    expect(checkDeclared(file("reef.png", "IMAGE/PNG"), "media")).toMatchObject({ ok: true });
  });

  it("refuses anything not on the allowlist, including MOV, which v1 doesn't play", () => {
    for (const name of ["setup.exe", "page.html", "image.svg", "clip.mov", "song.wav", "photo.heic", "notes", ""]) {
      expect(checkDeclared(file(name), "media")).toEqual({
        ok: false,
        error: "Upload an MP4, MP3, M4A, PDF, JPEG, PNG or WebP file.",
      });
    }
    // Only the last extension counts, so a double extension can't sneak an executable in.
    expect(checkDeclared(file("clip.mp4.exe"), "media")).toMatchObject({ ok: false });
  });

  it("refuses a file whose declared type disagrees with its name", () => {
    const disagree = { ok: false, error: "The file's name and type don't agree. Check it is the right file." };
    expect(checkDeclared(file("clip.mp4", "application/x-msdownload"), "media")).toEqual(disagree);
    expect(checkDeclared(file("reef.png", "image/jpeg"), "media")).toEqual(disagree);
    expect(checkDeclared(file("guide.pdf", "text/html"), "media")).toEqual(disagree);
  });

  it("refuses an empty file, and one over its kind's limit", () => {
    expect(checkDeclared(file("clip.mp4", "video/mp4", 0), "media")).toEqual({
      ok: false,
      error: "That file is empty.",
    });
    expect(checkDeclared(file("clip.mp4", "video/mp4", MAX_BYTES.video), "media")).toMatchObject({ ok: true });
    expect(checkDeclared(file("clip.mp4", "video/mp4", MAX_BYTES.video + 1), "media")).toEqual({
      ok: false,
      error: "That file is too large: the limit is 95 MB.",
    });
    expect(checkDeclared(file("talanoa.mp3", "", MAX_BYTES.audio + 1), "media")).toMatchObject({ ok: false });
    expect(checkDeclared(file("guide.pdf", "", 50 * MB + 1), "media")).toEqual({
      ok: false,
      error: "That file is too large: the limit is 50 MB.",
    });
    expect(checkDeclared(file("reef.png", "", 25 * MB), "media")).toMatchObject({ ok: true });
    expect(checkDeclared(file("reef.png", "", 25 * MB + 1), "media")).toEqual({
      ok: false,
      error: "That file is too large: the limit is 25 MB.",
    });
  });

  it("takes only documents and pictures as Rights Record evidence, of at most 10 MB", () => {
    expect(checkDeclared(file("signed.pdf", "application/pdf"), "evidence")).toMatchObject({ ok: true });
    expect(checkDeclared(file("signed.jpg", "image/jpeg"), "evidence")).toMatchObject({ ok: true });
    for (const name of ["signed.mp4", "signed.mp3", "signed.m4a", "signed.docx"]) {
      expect(checkDeclared(file(name), "evidence")).toEqual({
        ok: false,
        error: "Evidence must be a PDF, JPEG, PNG or WebP file.",
      });
    }
    expect(checkDeclared(file("signed.pdf", "", EVIDENCE_MAX_BYTES), "evidence")).toMatchObject({ ok: true });
    expect(checkDeclared(file("signed.pdf", "", EVIDENCE_MAX_BYTES + 1), "evidence")).toEqual({
      ok: false,
      error: "That file is too large: the limit is 10 MB.",
    });
  });

  it("offers the file picker the same extensions it accepts", () => {
    expect(acceptedExtensions("media").split(",")).toEqual([
      ".mp4",
      ".m4v",
      ".mp3",
      ".m4a",
      ".pdf",
      ".jpg",
      ".jpeg",
      ".png",
      ".webp",
    ]);
    expect(acceptedExtensions("evidence").split(",")).toEqual([".pdf", ".jpg", ".jpeg", ".png", ".webp"]);
  });
});

describe("what a file's first bytes say it is", () => {
  const mismatch = {
    ok: false,
    error: "The file's contents don't match its type. It may be renamed or damaged, so it wasn't accepted.",
  };

  it("accepts each type when its first bytes are that type's", () => {
    for (const [type, bytes] of Object.entries(SAMPLES)) {
      expect(checkContent(type as UploadType, bytes), type).toEqual({ ok: true });
    }
  });

  it("refuses every type's bytes under any other type's name", () => {
    for (const [type, bytes] of Object.entries(SAMPLES)) {
      for (const other of Object.keys(SAMPLES) as UploadType[]) {
        if (other === type) continue;
        // An MP4 and an M4A can share a brand (mp42, isom), so audio-in-video is checked below.
        if (type.endsWith("/mp4") && other.endsWith("/mp4")) continue;
        expect(checkContent(other, bytes), `${type} named as ${other}`).toEqual(mismatch);
      }
    }
  });

  it("refuses programs, web pages and scripts renamed as media", () => {
    const disguises = [
      head(...ascii("MZ"), 0x90, 0), // a Windows program
      head(0x7f, ...ascii("ELF")), // a Linux program
      head(0xcf, 0xfa, 0xed, 0xfe), // a macOS program
      head(...ascii("<!DOCTYPE html>")),
      head(...ascii("<svg xmlns=")),
      head(...ascii("#!/bin/sh")),
      head(...ascii("PK"), 3, 4), // a zip, which is also how .docx and .apk files start
      new Uint8Array(HEAD_BYTES), // all zeros
      new Uint8Array(), // nothing at all
    ];
    for (const bytes of disguises) {
      for (const type of Object.keys(SAMPLES) as UploadType[]) expect(checkContent(type, bytes)).toEqual(mismatch);
    }
  });

  it("accepts MP4 video only with a video brand, and M4A audio only with an audio brand", () => {
    for (const brand of ["isom", "iso2", "mp41", "mp42", "avc1", "M4V ", "dash", "qt  "]) {
      expect(checkContent("video/mp4", isoMedia(brand)), brand).toEqual({ ok: true });
    }
    for (const brand of ["M4A ", "M4B ", "mp42", "isom"]) {
      expect(checkContent("audio/mp4", isoMedia(brand)), brand).toEqual({ ok: true });
    }
    // Other ISO media (HEIC and AVIF pictures, 3GP phone video) shares the layout but isn't accepted.
    for (const brand of ["heic", "mif1", "avif", "3gp4", "crx "]) {
      expect(checkContent("video/mp4", isoMedia(brand)), brand).toEqual(mismatch);
      expect(checkContent("audio/mp4", isoMedia(brand)), brand).toEqual(mismatch);
    }
    expect(checkContent("video/mp4", isoMedia("M4A "))).toEqual(mismatch);
    expect(checkContent("audio/mp4", isoMedia("avc1"))).toEqual(mismatch);
  });

  it("refuses an older QuickTime file that opens with a bare atom instead of a brand", () => {
    expect(checkContent("video/mp4", head(0, 0, 0, 8, ...ascii("moov")))).toEqual(mismatch);
    expect(checkContent("video/mp4", head(0, 0, 0, 8, ...ascii("mdat")))).toEqual(mismatch);
  });

  it("accepts MP3 audio with an ID3 tag or a valid frame header, and nothing that only looks like one", () => {
    expect(checkContent("audio/mpeg", head(...ascii("ID3"), 3, 0))).toEqual({ ok: true });
    // MPEG-1 Layer III, 128 kbps, 44.1 kHz.
    expect(checkContent("audio/mpeg", head(0xff, 0xfb, 0x90, 0x64))).toEqual({ ok: true });
    // The sync bits with a reserved version, layer, bitrate or sample rate aren't a frame.
    expect(checkContent("audio/mpeg", head(0xff, 0xeb, 0x90, 0x64))).toEqual(mismatch);
    expect(checkContent("audio/mpeg", head(0xff, 0xf9, 0x90, 0x64))).toEqual(mismatch);
    expect(checkContent("audio/mpeg", head(0xff, 0xfb, 0xf0, 0x64))).toEqual(mismatch);
    expect(checkContent("audio/mpeg", head(0xff, 0xfb, 0x9c, 0x64))).toEqual(mismatch);
    // A JPEG also opens with 0xFF, but isn't an MP3.
    expect(checkContent("audio/mpeg", SAMPLES["image/jpeg"])).toEqual(mismatch);
  });

  it("tells a WebP picture from other RIFF files, such as WAV audio", () => {
    expect(checkContent("image/webp", head(...ascii("RIFF"), 0x24, 0, 0, 0, ...ascii("WAVE")))).toEqual(mismatch);
    expect(checkContent("image/webp", head(...ascii("RIFF"), 0x24, 0, 0, 0, ...ascii("AVI ")))).toEqual(mismatch);
  });

  it("needs the whole signature, not just its start", () => {
    expect(checkContent("image/png", head(0x89, 0x50, 0x4e, 0x47))).toEqual(mismatch);
    expect(checkContent("application/pdf", head(...ascii("%PD")))).toEqual(mismatch);
    expect(checkContent("video/mp4", head(0, 0, 0, 0x18, ...ascii("ftyp")))).toEqual(mismatch);
  });
});
