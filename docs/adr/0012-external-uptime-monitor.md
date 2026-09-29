# Uptime is monitored from outside Cloudflare

All application infrastructure runs on Cloudflare (ADR-0004), but uptime is checked by an external monitoring service. A monitor hosted on the same platform it watches goes silent during exactly the outages it exists to report, and Cloudflare's own health checks are not on the plan we use. This is the one deliberate exception to the single-vendor rule; the monitor holds no personal data and only requests public URLs.
