/**
 * Compute SHA-256 hash for a file.
 * Shared utility used by importQueue and libraryFolder.
 *
 * @param {File|Blob} file
 * @returns {Promise<string>} hex hash
 */
export async function hashFile(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
