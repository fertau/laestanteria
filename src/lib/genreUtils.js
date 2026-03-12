/**
 * Centralized genre mapping for La Estantería.
 * Maps free-text genre/category/subject strings from APIs, EPUBs, and Calibre
 * to one of the app's standard genres.
 *
 * Order matters: more specific patterns come BEFORE generic ones
 * (e.g., "Ciencia ficcion" before "Ciencia" and "Ficcion").
 */

const GENRE_MAP = [
  // --- Specific compound genres first ---
  [/sci[\s._-]?fi|science[\s._-]?fic|ciencia[\s._-]?fic|cyberpunk|dystopi|space[\s._-]?opera|post[\s._-]?apocalyp|steampunk|futurist/i, 'Ciencia ficcion'],
  [/non[\s._-]?fic|no[\s._-]?ficc|nonfiction|ensayo|essay|reference|informational/i, 'No ficcion'],
  [/fantas[yí]|wizard|dragon|sorcery|sorc|mytholog|fairy[\s._-]?tale|fae\b|hechiz|bruj|urban[\s._-]?fantas|dark[\s._-]?fantas|epic[\s._-]?fantas|sword|magician/i, 'Fantasia'],
  [/myster|thriller|suspens[eo]?|misterio|detective|crime|murder|whodunit|noir\b|spy|espionage|polici[ao]|investigat|crimen|intriga/i, 'Misterio'],
  [/romanc[ei]|love[\s._-]?stor|chick[\s._-]?lit|eroti[ck]|amor(?:os)?|romantic|sentimental/i, 'Romance'],
  [/biograph|biograf|memoir|autobiography|autobiograf|diary|diario|testimon|life[\s._-]?of|vida[\s._-]?de/i, 'Biografia'],
  [/self[\s._-]?help|autoayuda|self[\s._-]?improv|motivat|productiv|mindfulness|desarrollo[\s._-]?personal|superaci[oó]n|wellness|coaching|habit/i, 'Autoayuda'],
  [/business|negocio|econom|financ|management|marketing|entrepren|startup|invest(?!ig)|leadership|liderazgo|emprendimiento/i, 'Negocios'],
  [/child|infant|juvenil|\bkid|young[\s._-]?adult|middle[\s._-]?grade|picture[\s._-]?book|\bteen|adolescen|ni[ñn]os?|ya\b/i, 'Infantil'],
  [/philos|filosof|[eé]tica|metaphys|existential|stoic/i, 'Filosofia'],
  [/poet|poes[ií]|verse|poem|lyric|sonnet|haiku/i, 'Poesia'],
  [/histor/i, 'Historia'],
  // --- Broad "Ciencia" after compound genres ---
  [/scien[ct]|ciencia|physics|chemistry|biology|math|technolog|engineer|comput|psych|sociol|anthropol|neurosci|astro|quantum|evolution|ecolog|medicin/i, 'Ciencia'],
  // --- "Arte" with careful word boundary to avoid "artificial", "article", etc. ---
  [/\b(?:art|arts|arte)\b|painting|sculpture|photograph|design|architectur|music|cine|film|theater|teatro|fotograf|visual[\s._-]?art/i, 'Arte'],
  // --- Generic fiction LAST (catchall) ---
  [/fic[ct]i[oó]n|novel[ai]?|literary|(?:short[\s._-]?)?stories|narrative|prose|relato|cuento/i, 'Ficcion'],
];

/**
 * Map a genre/category/subject string to one of the app's standard genres.
 * Accepts a string (possibly comma-separated) or an array of strings.
 * Pre-normalizes hyphens/underscores for better matching.
 *
 * @param {string|string[]} input - Category string, comma-separated list, or array
 * @returns {string} Mapped genre or empty string
 */
export function mapGenre(input) {
  if (!input) return '';

  // Build a single string to test against
  const raw = Array.isArray(input) ? input.join(', ') : String(input);

  // Normalize: replace hyphens/underscores with spaces, collapse whitespace
  const normalized = raw.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';

  // Try full string first (handles "Science Fiction, Fantasy" → Ciencia ficcion)
  for (const [regex, genre] of GENRE_MAP) {
    if (regex.test(normalized)) return genre;
  }

  return '';
}
