/**
 * Calibre Library detection and OPF metadata parsing.
 *
 * Calibre stores each book in:
 *   Author Name/Book Title (id)/
 *     metadata.opf  ← Dublin Core XML
 *     cover.jpg     ← extracted cover
 *     Book.epub     ← the file
 *
 * This module detects that structure from a webkitdirectory FileList
 * and parses standalone metadata.opf files (same Dublin Core format as EPUB OPFs).
 */

import { cleanHtml } from './epubParser';

import { mapGenre } from './genreUtils';

const LANG_MAP = {
  es: 'es', spa: 'es', 'es-ar': 'es', 'es-es': 'es', 'es-mx': 'es',
  en: 'en', eng: 'en', 'en-us': 'en', 'en-gb': 'en',
  pt: 'pt', por: 'pt', 'pt-br': 'pt', 'pt-pt': 'pt',
  fr: 'fr', fre: 'fr', fra: 'fr',
  de: 'de', ger: 'de', deu: 'de',
  it: 'it', ita: 'it',
};

/**
 * Detect Calibre library structure from a webkitdirectory FileList.
 * Groups files by parent directory and identifies metadata.opf + cover + epub.
 *
 * @param {FileList|File[]} files - All files from the folder picker
 * @returns {{ isCalibre: boolean, books: CalibreBookBundle[], looseEpubs: File[] }}
 */
export function detectCalibreStructure(files) {
  const dirMap = new Map(); // parentDir → { epubs, opf, cover }
  const allFiles = Array.from(files);

  for (const file of allFiles) {
    const relPath = file.webkitRelativePath || file.name;
    const parts = relPath.split('/');
    // Skip files at the root level of the selected folder (depth < 2 for Calibre)
    if (parts.length < 2) continue;

    // Parent directory = everything except the filename
    const parentDir = parts.slice(0, -1).join('/');
    const fileName = parts[parts.length - 1].toLowerCase();

    if (!dirMap.has(parentDir)) {
      dirMap.set(parentDir, { epubs: [], opf: null, cover: null });
    }
    const entry = dirMap.get(parentDir);

    if (fileName === 'metadata.opf') {
      entry.opf = file;
    } else if (/^cover\.(jpg|jpeg|png)$/i.test(fileName)) {
      entry.cover = file;
    } else if (fileName.endsWith('.epub')) {
      entry.epubs.push(file);
    }
  }

  // Also collect loose .epub files (no directory or in root)
  const looseEpubs = allFiles.filter((f) => {
    const relPath = f.webkitRelativePath || f.name;
    const parts = relPath.split('/');
    if (!f.name.toLowerCase().endsWith('.epub')) return false;
    // It's "loose" if it's in the root folder (1 level deep from selection)
    if (parts.length <= 2) {
      const parentDir = parts.slice(0, -1).join('/');
      const entry = dirMap.get(parentDir);
      // If this directory has no OPF, the epub is loose
      return !entry?.opf;
    }
    return false;
  });

  // Build bundles for directories with EPUBs
  const books = [];
  let hasCalibre = false;

  for (const [dirPath, entry] of dirMap) {
    if (entry.epubs.length === 0) continue;

    if (entry.opf) {
      hasCalibre = true;
      // One bundle per epub in this directory (rare to have multiple, but handle it)
      for (const epub of entry.epubs) {
        books.push({
          epub,
          opfFile: entry.opf,
          coverFile: entry.cover,
          relativePath: dirPath,
        });
      }
    }
  }

  return { isCalibre: hasCalibre, books, looseEpubs };
}

/**
 * Parse a standalone metadata.opf file (Dublin Core XML).
 * Same XML parsing pattern as epubParser.js but reads a plain text File.
 *
 * @param {File} opfFile - The metadata.opf File object
 * @returns {Promise<{title, author, isbn, description, language, genre, subjects}>}
 */
export async function parseCalibreOpf(opfFile) {
  const xml = await opfFile.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');

  // Dublin Core text extraction (mirrors epubParser.js)
  const getText = (tag) => {
    let el = doc.querySelector(`metadata > *|${tag}`);
    if (!el) {
      const els = doc.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', tag);
      if (els.length > 0) el = els[0];
    }
    return el?.textContent?.trim() || '';
  };

  const getAll = (tag) => {
    const els = doc.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', tag);
    return Array.from(els).map((el) => el.textContent?.trim()).filter(Boolean);
  };

  const title = getText('title');
  const creators = getAll('creator');
  const author = creators.join(', ');
  const description = cleanHtml(getText('description'));
  const language = getText('language');
  const subjects = getAll('subject');

  // Extract ISBN from identifiers (same logic as epubParser.js)
  let isbn = '';
  const identifiers = doc.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', 'identifier');
  for (const idEl of identifiers) {
    const text = idEl.textContent?.trim() || '';
    const scheme = idEl.getAttribute('opf:scheme')?.toLowerCase() || '';

    if (scheme === 'isbn') {
      isbn = text.replace(/[^0-9X]/gi, '');
      break;
    }

    const cleaned = text.replace(/[^0-9X]/gi, '');
    if (/^(97[89])?\d{9}[\dX]$/i.test(cleaned)) {
      isbn = cleaned;
    }

    if (text.toLowerCase().startsWith('urn:isbn:')) {
      isbn = text.substring(9).replace(/[^0-9X]/gi, '');
      break;
    }
  }

  // Map language
  const mappedLanguage = LANG_MAP[language.toLowerCase()] || '';

  // Map genre from subjects
  const genre = subjects.length ? mapGenre(subjects.join(', ')) : '';

  return { title, author, isbn, description, language: mappedLanguage, genre, subjects };
}

/**
 * Create an Object URL from a Calibre cover file for preview.
 * @param {File} coverFile
 * @returns {string} Object URL
 */
export function getCalibreCoverUrl(coverFile) {
  return URL.createObjectURL(coverFile);
}
