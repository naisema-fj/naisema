import { Container } from "@cloudflare/containers";

/**
 * The ClamAV scanner (ADR-0010): a Cloudflare Container built from containers/scanner, reached
 * through this Durable Object. It answers POST /scan with a verdict on the bytes sent to it.
 */
export class Scanner extends Container<Env> {
  defaultPort = 8080;
  // clamd takes a while to load its signatures, so keep a warm scanner between uploads.
  sleepAfter = "15m";
}
