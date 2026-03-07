/**
 * Google Drive API helpers.
 * Uses the OAuth access token from Firebase Auth (Google provider with drive.file scope).
 */

const DRIVE_API = 'https://www.googleapis.com/';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const EPUB_MIME = 'application/epub+zip';

/**
 * Get or create the "La estanteria" folder in the user's Drive.
 * Returns the folder ID.
 */
export async function getOrCreateFolder(accessToken) {
  // Search for existing folder
  const searchUrl = `${DRIVE_API}drive/v3/files?q=${encodeURIComponent(
    `name='La estanteria' and mimeType='${FOLDER_MIME}' and trashed=false`
  )}&fields=files(id,name)`;

  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const searchData = await searchRes.json();

  if (searchData.files?.length > 0) {
    return searchData.files[0].id;
  }

  // Create folder
  const createRes = await fetch(`${DRIVE_API}drive/v3/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'La estanteria',
      mimeType: FOLDER_MIME,
    }),
  });
  const folder = await createRes.json();
  return folder.id;
}

/**
 * Upload an EPUB file to the user's "La estanteria" folder.
 * Returns { driveFileId }.
 * Uses resumable upload for progress tracking.
 */
export async function uploadEpubToDrive(accessToken, file, title, folderId, onProgress) {
  const fileName = `${title}.epub`.replace(/[/\\?%*:|"<>]/g, '-');

  // Step 1: Initiate resumable upload
  const initRes = await fetch(
    `${DRIVE_API}upload/drive/v3/files?uploadType=resumable`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': EPUB_MIME,
        'X-Upload-Content-Length': file.size,
      },
      body: JSON.stringify({
        name: fileName,
        parents: [folderId],
        mimeType: EPUB_MIME,
      }),
    }
  );

  const uploadUrl = initRes.headers.get('Location');
  if (!uploadUrl) throw new Error('No se pudo iniciar la subida a Drive');

  // Step 2: Upload the file content with progress
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', EPUB_MIME);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText);
        resolve({ driveFileId: data.id });
      } else {
        reject(new Error(`Error al subir a Drive: ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Error de red al subir a Drive'));
    xhr.send(file);
  });
}

/**
 * Share a Drive file with the service account (read-only).
 * The service account email comes from VITE_SERVICE_ACCOUNT_EMAIL or is passed explicitly.
 */
export async function shareWithServiceAccount(accessToken, driveFileId, serviceAccountEmail) {
  const res = await fetch(
    `${DRIVE_API}drive/v3/files/${driveFileId}/permissions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'user',
        emailAddress: serviceAccountEmail,
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Error al compartir con service account: ${err.error?.message || res.status}`);
  }
}
