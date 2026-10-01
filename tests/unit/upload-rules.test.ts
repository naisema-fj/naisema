import { describe, expect, it } from "vitest";
import { checkContent, checkDeclared, MAX_BYTES } from "~/lib/upload-rules";

const MB = 1024 * 1024;
const text = (value: string) => new TextEncoder().encode(value);
const bytes = (...values: number[]) => new Uint8Array(values);
/** An ISO media file's first box: size, "ftyp", then the major brand. */
const isoMedia = (brand: string) => new Uint8Array([0, 0, 0, 0x20, ...text("ftyp"), ...text(brand), 0, 0, 0, 0]);

describe("checkDeclared: the allowlist, before an upload starts", () => {
  it.each([
    ["clip.mp4", "video/mp4", "video/mp4"],
    ["clip.MOV", "video/quicktime", "video/quicktime"],
    ["talk.mp3", "audio/mpeg", "audio/mpeg"],
    ["talk.m4a", "audio/x-m4a", "audio/mp4"],
    ["guide.pdf", "application/pdf", "application/pdf"],
    ["photo.jpeg", "image/jpeg", "image/jpeg"],
    ["photo.jpg", "", "image/jpeg"],
    ["photo.png", "image/png", "image/png"],
    ["photo.webp", "image/webp", "image/webp"],
  ])("accepts %s declared as %j", (name, type, accepted) => {
    expect(checkDeclared({ name, type, size: MB }, "media")).toEqual({ ok: true, type: accepted });
  });

  it.each([
    ["setup.exe", "application/x-msdownload"],
    ["archive.zip", "application/zip"],
    ["drawing.svg", "image/svg+xml"],
    ["page.html", "text/html"],
    ["animation.gif", "image/gif"],
    ["no-extension", ""],
  ])("refuses %s", (name, type) => {
    expect(checkDeclared({ name, type, size: MB }, "media")).toMatchObject({ ok: false });
  });

  it("refuses a file whose declared type contradicts its name", () => {
    expect(checkDeclared({ name: "photo.jpg", type: "image/png", size: MB }, "media")).toMatchObject({ ok: false });
    expect(checkDeclared({ name: "notes.pdf", type: "text/html", size: MB }, "media")).toMatchObject({ ok: false });
  });

  it("refuses empty files and files over their kind's limit", () => {
    expect(checkDeclared({ name: "a.png", type: "image/png", size: 0 }, "media")).toMatchObject({ ok: false });
    expect(checkDeclared({ name: "a.mp4", type: "video/mp4", size: MAX_BYTES.video }, "media")).toMatchObject({
      ok: true,
    });
    expect(checkDeclared({ name: "a.mp4", type: "video/mp4", size: MAX_BYTES.video + 1 }, "media")).toMatchObject({
      ok: false,
      error: expect.stringContaining("2 GB"),
    });
    expect(checkDeclared({ name: "a.png", type: "image/png", size: MAX_BYTES.image + 1 }, "media")).toMatchObject({
      ok: false,
    });
  });

  it("takes only PDFs and images, up to 10 MB, as rights evidence", () => {
    expect(checkDeclared({ name: "permission.pdf", type: "application/pdf", size: MB }, "evidence")).toMatchObject({
      ok: true,
    });
    expect(checkDeclared({ name: "permission.mp3", type: "audio/mpeg", size: MB }, "evidence")).toMatchObject({
      ok: false,
    });
    expect(
      checkDeclared({ name: "permission.pdf", type: "application/pdf", size: 10 * MB + 1 }, "evidence"),
    ).toMatchObject({ ok: false, error: expect.stringContaining("10 MB") });
  });
});

describe("checkContent: the file's first bytes must match its declared type", () => {
  it.each([
    ["video/mp4", isoMedia("isom")],
    ["video/mp4", isoMedia("mp42")],
    ["video/quicktime", isoMedia("qt  ")],
    ["video/quicktime", new Uint8Array([0, 0, 0, 8, ...text("wide")])],
    ["audio/mp4", isoMedia("M4A ")],
    ["audio/mp4", isoMedia("mp42")],
    ["audio/mpeg", text("ID3\u0004\u0000")],
    ["audio/mpeg", bytes(0xff, 0xfb, 0x90, 0x44)],
    ["application/pdf", text("%PDF-1.7\n")],
    ["image/jpeg", bytes(0xff, 0xd8, 0xff, 0xe0)],
    ["image/png", bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)],
    ["image/webp", text("RIFF\u0000\u0000\u0000\u0000WEBPVP8 ")],
  ] as const)("accepts %s content", (type, content) => {
    expect(checkContent(type, content)).toEqual({ ok: true });
  });

  it("blocks a renamed executable", () => {
    expect(checkContent("video/mp4", bytes(0x4d, 0x5a, 0x90, 0x00))).toMatchObject({ ok: false });
    expect(checkContent("application/pdf", bytes(0x7f, 0x45, 0x4c, 0x46))).toMatchObject({ ok: false });
    expect(checkContent("image/png", text("#!/bin/sh\nrm -rf /"))).toMatchObject({ ok: false });
  });

  it("blocks a file of one allowed kind named as another", () => {
    expect(checkContent("image/png", bytes(0xff, 0xd8, 0xff, 0xe0))).toMatchObject({ ok: false });
    expect(checkContent("audio/mpeg", text("%PDF-1.7"))).toMatchObject({ ok: false });
    expect(checkContent("video/mp4", text("ID3\u0004"))).toMatchObject({ ok: false });
  });

  it("blocks a web page, even one that starts like a PDF further in", () => {
    expect(checkContent("application/pdf", text("<html>%PDF-1.7"))).toMatchObject({ ok: false });
  });

  it("blocks an empty file", () => {
    expect(checkContent("application/pdf", new Uint8Array())).toMatchObject({ ok: false });
  });
});
