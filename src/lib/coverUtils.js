/**
 * Cover image validation utilities.
 * Detects placeholder/broken cover images from Google Books and Open Library.
 */

/**
 * Validate that a cover URL points to a real image, not a placeholder.
 * Uses HEAD request to check content-type and file size.
 *
 * Google Books "image not available" placeholders are typically ~4-8 KB.
 * Open Library returns 1x1 transparent pixels or tiny placeholders (< 1 KB).
 * Real book covers are almost always > 15 KB.
 *
 * @param {string} url
 * @param {number} minBytes - Minimum file size to consider valid (default: 15000)
 * @returns {Promise<boolean>}
 */
export async function isValidCover(url, minBytes = 15000) {
  if (!url) return false;

  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (!res.ok) return false;

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return false;

    const cl = parseInt(res.headers.get('content-length') || '0', 10);
    // content-length may be 0 or missing if server doesn't report it —
    // in that case, give it the benefit of the doubt
    if (cl > 0 && cl < minBytes) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * From a list of cover URLs, return the first one that passes validation.
 * Checks sequentially (not parallel) to minimize unnecessary requests.
 * @param {string[]} urls
 * @returns {Promise<string>} First valid URL or empty string
 */
export async function pickFirstValidCover(urls) {
  for (const url of urls) {
    if (await isValidCover(url)) return url;
  }
  return '';
}
