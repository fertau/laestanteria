/**
 * Google Drive API helpers.
 * Uses the OAuth access token from Firebase Auth (Google provider with drive.file scope).
 */

const DRIVE_API = 'https://www.googleapis.com/';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const EPUB_MIME = 'application/epub+zip';

/**
 * Helper: Make an authenticated Drive API request with proper error handling.
 * Throws descriptive errors for common issues (401, 403, etc.).
 */
async function driveRequest(url, options, accessToken) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    let errorMessage = `Error de Drive (${res.status})`;
    try {
      const errBody = await res.json();
      const apiMsg = errBody.error?.message || '';
      if (res.status === 401) {
        errorMessage = 'Token de Drive expirado o invalido. Volve a iniciar sesion.';
      } else if (res.status === 403) {
        errorMessage = `Sin permisos en Drive: ${apiMsg || 'scope insuficiente'}`;
      } else if (res.status === 404) {
        errorMessage = `Recurso no encontrado en Drive: ${apiMsg}`;
      } else if (apiMsg) {
        errorMessage = `Error de Drive: ${apiMsg}`;
      }
    } catch {
      // Could not parse error body
    }
    throw new Error(errorMessage);
  }

  return res;
}

/**
 * Get or create the "La Cueva" folder in the user's Drive.
 * Migration-safe: searches for both "La Cueva" (new) and "La estanteria" (legacy)
 * so existing users' books remain accessible.
 * Returns the folder ID.
 */
export async function getOrCreateFolder(accessToken) {
  // Search for both new and legacy folder names (migration-safe)
  const searchUrl = `${DRIVE_API}drive/v3/files?q=${encodeURIComponent(
    `(name='La Cueva' or name='La estanteria') and mimeType='${FOLDER_MIME}' and trashed=false`
  )}&fields=files(id,name)`;

  const searchRes = await driveRequest(searchUrl, {}, accessToken);
  const searchData = await searchRes.json();

  if (searchData.files?.length > 0) {
    // Prefer "La Cueva" if both exist, otherwise use whichever is found
    const cueva = searchData.files.find((f) => f.name === 'La Cueva');
    return cueva ? cueva.id : searchData.files[0].id;
  }

  // Create new folder with new name
  const createRes = await driveRequest(`${DRIVE_API}drive/v3/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'La Cueva',
      mimeType: FOLDER_MIME,
    }),
  }, accessToken);

  const folder = await createRes.json();
  if (!folder.id) {
    throw new Error('No se pudo crear la carpeta en Drive');
  }
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

  if (!initRes.ok) {
    let detail = '';
    try {
      const errBody = await initRes.json();
      detail = errBody.error?.message || '';
    } catch { /* ignore */ }

    if (initRes.status === 401) {
      throw new Error('Token de Drive expirado. Recarga la pagina y volve a intentar.');
    }
    throw new Error(`Error al iniciar subida a Drive (${initRes.status}): ${detail}`);
  }

  const uploadUrl = initRes.headers.get('Location');
  if (!uploadUrl) throw new Error('No se pudo iniciar la subida a Drive (sin URL de upload)');

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
        try {
          const data = JSON.parse(xhr.responseText);
          resolve({ driveFileId: data.id });
        } catch {
          reject(new Error('Respuesta invalida de Drive al subir archivo'));
        }
      } else {
        reject(new Error(`Error al subir a Drive: ${xhr.status} ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => reject(new Error('Error de red al subir a Drive. Verifica tu conexion.'));
    xhr.ontimeout = () => reject(new Error('Timeout al subir a Drive. El archivo puede ser muy grande.'));
    xhr.send(file);
  });
}

/**
 * Share a Drive file with the service account (read-only).
 * The service account email comes from VITE_SERVICE_ACCOUNT_EMAIL.
 */
export async function shareWithServiceAccount(accessToken, driveFileId, serviceAccountEmail) {
  await driveRequest(
    `${DRIVE_API}drive/v3/files/${driveFileId}/permissions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'reader',
        type: 'user',
        emailAddress: serviceAccountEmail,
      }),
    },
    accessToken
  );
}
