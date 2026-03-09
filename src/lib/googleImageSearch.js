/**
 * Google Custom Search API — image search for book covers.
 * Uses a Programmable Search Engine (CSE) configured to search the entire web.
 * Free tier: 100 queries/day.
 *
 * Requires two env vars:
 *   VITE_GOOGLE_CSE_API_KEY  — API key with Custom Search API enabled
 *   VITE_GOOGLE_CSE_CX       — Programmable Search Engine ID
 *
 * Falls back to the Firebase API key if VITE_GOOGLE_CSE_API_KEY is not set.
 */

const CSE_BASE = 'https://customsearch.googleapis.com/customsearch/v1';

/**
 * Normalize a title for better search results:
 * - Strip subtitle after : or — or –
 * - Remove format tags
 */
function normalizeTitle(title) {
  if (!title) return '';
  let t = title;
  t = t.split(/\s*[:\u2014\u2013]\s*/)[0];
  t = t.replace(/\s*[\[(][^\])]*(?:ed\.?|edition|edici[oó]n|revisad|spanish|english|kindle|ebook|pdf|epub)[\])]/gi, '');
  t = t.replace(/\s*\((?:kindle|ebook|pdf|epub|paperback|hardcover|tapa dura|tapa blanda)\)\s*$/gi, '');
  return t.trim();
}

/**
 * Search Google Images for book covers via Custom Search API.
 *
 * @param {string} title - Book title
 * @param {string} author - Book author
 * @param {string} isbn - ISBN (optional)
 * @param {string} lang - Language code (e.g. 'es', 'en')
 * @returns {Promise<Array<{url: string, source: string, label: string}>>}
 */
export async function searchCovers(title, author, isbn, lang = '') {
  const apiKey = import.meta.env.VITE_GOOGLE_CSE_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY;
  const cx = import.meta.env.VITE_GOOGLE_CSE_CX;

  if (!cx || !apiKey) {
    // CSE not configured — silently return empty
    return [];
  }

  const covers = [];
  const seen = new Set();

  const addCover = (url, label) => {
    if (!url || seen.has(url)) return;
    // Skip tiny placeholder images and data URIs
    if (url.startsWith('data:') || url.includes('1x1') || url.includes('pixel')) return;
    seen.add(url);
    covers.push({ url, source: 'google-images', label });
  };

  const cleanTitle = normalizeTitle(title);
  const langParam = lang ? `&lr=lang_${lang}` : '';

  try {
    // Strategy 1: Search by ISBN if available (most precise)
    if (isbn) {
      const clean = isbn.replace(/[-\s]/g, '');
      const q = `${clean} book cover`;
      const res = await fetch(
        `${CSE_BASE}?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(q)}&searchType=image&imgSize=large&num=3`
      );
      if (res.ok) {
        const data = await res.json();
        for (const item of (data.items || [])) {
          addCover(item.link, item.title || 'ISBN match');
        }
      }
    }

    // Strategy 2: Search by title + author + "portada" / "book cover"
    if (cleanTitle) {
      const coverWord = lang === 'es' ? 'portada libro' : 'book cover';
      const q = author
        ? `"${cleanTitle}" ${author} ${coverWord}`
        : `"${cleanTitle}" ${coverWord}`;
      const res = await fetch(
        `${CSE_BASE}?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(q)}&searchType=image&imgSize=large&num=5${langParam}`
      );
      if (res.ok) {
        const data = await res.json();
        for (const item of (data.items || [])) {
          addCover(item.link, item.title || '');
        }
      }
    }

    // Strategy 3: Broader fallback if few results
    if (covers.length < 2 && cleanTitle) {
      const q = author ? `${cleanTitle} ${author} cover` : `${cleanTitle} cover`;
      const res = await fetch(
        `${CSE_BASE}?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(q)}&searchType=image&imgSize=large&num=5`
      );
      if (res.ok) {
        const data = await res.json();
        for (const item of (data.items || [])) {
          addCover(item.link, item.title || '');
        }
      }
    }
  } catch (err) {
    console.warn('Google Image Search failed:', err);
  }

  return covers;
}
