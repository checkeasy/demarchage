const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002";

/**
 * Generate a tracking pixel HTML img tag
 */
export function generateTrackingPixel(trackingId: string): string {
  const url = `${APP_URL}/api/tracking/open/${trackingId}`;
  return `<img src="${url}" width="1" height="1" style="display:none;width:1px;height:1px;border:0;" alt="" />`;
}

/**
 * Inject tracking pixel into HTML email body
 */
export function injectTrackingPixel(
  htmlBody: string,
  trackingId: string
): string {
  const pixel = generateTrackingPixel(trackingId);

  // Insert before closing </body> tag if it exists
  if (htmlBody.includes("</body>")) {
    return htmlBody.replace("</body>", `${pixel}</body>`);
  }

  // Otherwise append at the end
  return htmlBody + pixel;
}

/**
 * Rewrite all links in HTML for click tracking
 * Converts: <a href="https://example.com">
 * To: <a href="APP_URL/api/tracking/click/TRACKING_ID?url=https%3A%2F%2Fexample.com">
 */
export function rewriteLinks(
  html: string,
  trackingId: string
): string {
  return html.replace(
    /<a\s+([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi,
    (_match, before: string, href: string, after: string) => {
      // Skip mailto links
      if (href.startsWith("mailto:")) {
        return _match;
      }

      // Skip unsubscribe links (preserve them)
      if (href.includes("unsubscribe")) {
        return _match;
      }

      // Skip javascript: and data: URLs (security)
      if (href.startsWith("javascript:") || href.startsWith("data:")) {
        return _match;
      }

      // Skip anchor links
      if (href.startsWith("#")) {
        return _match;
      }

      const encodedUrl = encodeURIComponent(href);
      const trackingUrl = `${APP_URL}/api/tracking/click/${trackingId}?url=${encodedUrl}`;

      return `<a ${before}href="${trackingUrl}"${after}>`;
    }
  );
}

/**
 * Process an email body: inject tracking pixel and rewrite links
 */
export function processEmailForTracking(
  htmlBody: string,
  trackingId: string,
  trackOpens: boolean,
  trackClicks: boolean
): string {
  let processed = htmlBody;

  if (trackClicks) {
    processed = rewriteLinks(processed, trackingId);
  }

  if (trackOpens) {
    processed = injectTrackingPixel(processed, trackingId);
  }

  return processed;
}
