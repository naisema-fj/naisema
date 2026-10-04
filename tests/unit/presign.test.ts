import { describe, expect, it } from "vitest";
import { presignedGet, r2PresignedGet } from "~/lib/presign.server";

describe("pre-signed GET addresses (AWS Signature Version 4, query string)", () => {
  it("matches AWS's published example", async () => {
    // https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html
    const url = await presignedGet({
      host: "examplebucket.s3.amazonaws.com",
      path: "/test.txt",
      region: "us-east-1",
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      expiresSeconds: 86400,
      now: new Date("2013-05-24T00:00:00Z"),
    });
    expect(url).toBe(
      "https://examplebucket.s3.amazonaws.com/test.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20130524T000000Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host&X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404",
    );
  });

  it("addresses an object in an R2 bucket by its account's S3 endpoint", async () => {
    const url = new URL(
      await r2PresignedGet({
        accountId: "abc123",
        bucket: "naisema-staging-video-masters",
        key: "masters/a b+c",
        accessKeyId: "key",
        secretAccessKey: "secret",
        expiresSeconds: 3600,
        now: new Date("2026-10-04T08:00:00Z"),
      }),
    );
    expect(url.origin).toBe("https://abc123.r2.cloudflarestorage.com");
    expect(url.pathname).toBe("/naisema-staging-video-masters/masters/a%20b%2Bc");
    expect(url.searchParams.get("X-Amz-Credential")).toBe("key/20261004/auto/s3/aws4_request");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("3600");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
  });
});
