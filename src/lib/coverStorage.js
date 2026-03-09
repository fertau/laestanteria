/**
 * Cover image upload helper using Firebase Storage.
 * Covers are stored at: covers/{bookId}/cover.{ext}
 * Public read, authenticated write, max 5MB, images only.
 */

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

const MAX_COVER_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Upload a cover image to Firebase Storage and return the download URL.
 * @param {string} bookId - Firestore book document ID
 * @param {File} file - Image file to upload
 * @returns {Promise<string>} Public download URL
 */
export async function uploadCoverImage(bookId, file) {
  if (!file.type.startsWith('image/')) {
    throw new Error('El archivo no es una imagen');
  }
  if (file.size > MAX_COVER_SIZE) {
    throw new Error('La imagen excede 5MB');
  }

  const ext = file.name.split('.').pop() || 'jpg';
  const storageRef = ref(storage, `covers/${bookId}/cover.${ext}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}
