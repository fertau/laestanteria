import JSZip from 'jszip';

/**
 * Parse an EPUB file and extract metadata from the OPF + cover image.
 * EPUBs are ZIP archives containing:
 *   META-INF/container.xml → points to the OPF file
 *   *.opf → Dublin Core metadata (title, author, ISBN, description, language, date, subjects)
 *   cover image → referenced in the OPF manifest
 *
 * @param {File} file - The EPUB file
 * @returns {Promise<{title, author, isbn, description, language, date, subjects, coverObjectUrl}>}
 */
export async function parseEpub(file) {
  const zip = await JSZip.loadAsync(file);

  // 1. Find the OPF file path from container.xml
  const containerXml = await zip.file('META-INF/container.xml')?.async('text');
  if (!containerXml) {
    console.warn('No container.xml found in EPUB');
    return null;
  }

  const parser = new DOMParser();
  const containerDoc = parser.parseFromString(containerXml, 'application/xml');
  const rootfileEl = containerDoc.querySelector('rootfile');
  const opfPath = rootfileEl?.getAttribute('full-path');

  if (!opfPath) {
    console.warn('No rootfile path found in container.xml');
    return null;
  }

  // 2. Parse the OPF file
  const opfXml = await zip.file(opfPath)?.async('text');
  if (!opfXml) {
    console.warn('OPF file not found at path:', opfPath);
    return null;
  }

  const opfDoc = parser.parseFromString(opfXml, 'application/xml');
  const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';

  // 3. Extract Dublin Core metadata
  const getText = (tag) => {
    // Try with namespace prefix
    let el = opfDoc.querySelector(`metadata > *|${tag}`);
    if (!el) {
      // Try getElementsByTagNameNS
      const els = opfDoc.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', tag);
      if (els.length > 0) el = els[0];
    }
    return el?.textContent?.trim() || '';
  };

  const getAll = (tag) => {
    const els = opfDoc.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', tag);
    return Array.from(els).map((el) => el.textContent?.trim()).filter(Boolean);
  };

  const title = getText('title');
  const creators = getAll('creator');
  const author = creators.join(', ');
  const description = getText('description');
  const language = getText('language');
  const date = getText('date');
  const subjects = getAll('subject');

  // 4. Extract ISBN from identifiers
  let isbn = '';
  const identifiers = opfDoc.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', 'identifier');
  for (const idEl of identifiers) {
    const text = idEl.textContent?.trim() || '';
    const scheme = idEl.getAttribute('opf:scheme')?.toLowerCase() || '';

    // Check if it's explicitly marked as ISBN
    if (scheme === 'isbn') {
      isbn = text.replace(/[^0-9X]/gi, '');
      break;
    }

    // Check for ISBN patterns (10 or 13 digits)
    const cleaned = text.replace(/[^0-9X]/gi, '');
    if (/^(97[89])?\d{9}[\dX]$/i.test(cleaned)) {
      isbn = cleaned;
      // Don't break — prefer explicitly marked ones
    }

    // Check for URN:ISBN: format
    if (text.toLowerCase().startsWith('urn:isbn:')) {
      isbn = text.substring(9).replace(/[^0-9X]/gi, '');
      break;
    }
  }

  // 5. Extract cover image
  let coverObjectUrl = '';
  const coverHref = findCoverHref(opfDoc);

  if (coverHref) {
    // Resolve the cover path relative to the OPF directory
    const coverPath = coverHref.startsWith('/') ? coverHref.substring(1) : opfDir + coverHref;
    const coverFile = zip.file(coverPath);

    if (coverFile) {
      try {
        const blob = await coverFile.async('blob');
        coverObjectUrl = URL.createObjectURL(blob);
      } catch (err) {
        console.warn('Failed to extract cover image:', err);
      }
    }
  }

  // 6. Map language code to our app's language values
  const langMap = {
    es: 'es', spa: 'es', 'es-ar': 'es', 'es-es': 'es', 'es-mx': 'es',
    en: 'en', eng: 'en', 'en-us': 'en', 'en-gb': 'en',
    pt: 'pt', por: 'pt', 'pt-br': 'pt', 'pt-pt': 'pt',
    fr: 'fr', fre: 'fr', fra: 'fr',
    de: 'de', ger: 'de', deu: 'de',
    it: 'it', ita: 'it',
  };
  const mappedLanguage = langMap[language.toLowerCase()] || '';

  return {
    title,
    author,
    isbn,
    description: cleanHtml(description),
    language: mappedLanguage,
    date,
    subjects,
    coverObjectUrl,
  };
}

/**
 * Find the cover image href in the OPF manifest.
 * EPUBs store cover references in several ways:
 *   1. <meta name="cover" content="cover-image-id" /> → look up id in manifest
 *   2. <item properties="cover-image" /> (EPUB3)
 *   3. <item id="cover" /> with image media-type
 *   4. Item with "cover" in the href path
 */
function findCoverHref(opfDoc) {
  const manifest = opfDoc.querySelector('manifest');
  if (!manifest) return null;

  const items = manifest.querySelectorAll('item');
  const itemMap = {};
  for (const item of items) {
    const id = item.getAttribute('id');
    if (id) itemMap[id] = item;
  }

  // Method 1: <meta name="cover" content="cover-image-id" />
  const metaCover = opfDoc.querySelector('metadata meta[name="cover"]');
  if (metaCover) {
    const coverId = metaCover.getAttribute('content');
    const coverItem = itemMap[coverId];
    if (coverItem) {
      return coverItem.getAttribute('href');
    }
  }

  // Method 2: EPUB3 properties="cover-image"
  for (const item of items) {
    const props = item.getAttribute('properties') || '';
    if (props.includes('cover-image')) {
      return item.getAttribute('href');
    }
  }

  // Method 3: Item with id="cover" or id="cover-image" that's an image
  for (const idName of ['cover', 'cover-image', 'coverimage', 'Cover']) {
    const item = itemMap[idName];
    if (item) {
      const mediaType = item.getAttribute('media-type') || '';
      if (mediaType.startsWith('image/')) {
        return item.getAttribute('href');
      }
    }
  }

  // Method 4: Any image item with "cover" in the href
  for (const item of items) {
    const mediaType = item.getAttribute('media-type') || '';
    const href = item.getAttribute('href') || '';
    if (mediaType.startsWith('image/') && /cover/i.test(href)) {
      return href;
    }
  }

  return null;
}

/**
 * Strip HTML tags from description text (some EPUBs have HTML in dc:description)
 */
function cleanHtml(text) {
  if (!text) return '';
  // Remove HTML tags
  const cleaned = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  // Decode HTML entities
  const textarea = document.createElement('textarea');
  textarea.innerHTML = cleaned;
  return textarea.value;
}
