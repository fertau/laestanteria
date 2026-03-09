const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { google } = require("googleapis");
const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");

initializeApp();
const db = getFirestore();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDriveClient() {
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "./service-account.json";
  const absPath = path.resolve(__dirname, keyPath);
  const key = JSON.parse(fs.readFileSync(absPath, "utf8"));

  const auth = new google.auth.JWT(
    key.client_email,
    null,
    key.private_key,
    ["https://www.googleapis.com/auth/drive.readonly"],
  );
  return google.drive({ version: "v3", auth });
}

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// Check that caller is a registered user
async function verifyRegistered(uid) {
  const userDoc = await db.doc(`users/${uid}`).get();
  if (!userDoc.exists) {
    throw new HttpsError("permission-denied", "Usuario no registrado");
  }
  return userDoc.data();
}

// Check that caller can access the book (own book or library follow)
async function verifyBookAccess(uid, book) {
  const uploaderUid = book.uploadedBy?.uid;
  if (uploaderUid === uid) return true;

  const followsSnap = await db.collection("follows")
    .where("followerUid", "==", uid)
    .where("followingUid", "==", uploaderUid)
    .where("status", "==", "accepted")
    .where("accessLevel", "==", "library")
    .limit(1)
    .get();

  if (followsSnap.empty) {
    throw new HttpsError("permission-denied", "No tenes acceso a la biblioteca de este usuario");
  }
  return true;
}

// ---------------------------------------------------------------------------
// generateDownloadLink
// ---------------------------------------------------------------------------
// Returns a temporary download URL for an EPUB stored in Google Drive.
// The service account must have been shared on the file (done during upload).

exports.generateDownloadLink = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Debe estar autenticado");
  }

  const { bookId } = request.data;
  if (!bookId) throw new HttpsError("invalid-argument", "Falta bookId");

  const uid = request.auth.uid;
  await verifyRegistered(uid);

  // Get book
  const bookSnap = await db.doc(`books/${bookId}`).get();
  if (!bookSnap.exists) throw new HttpsError("not-found", "Libro no encontrado");
  const book = bookSnap.data();

  await verifyBookAccess(uid, book);

  const drive = getDriveClient();

  // Get file metadata to build download URL
  const fileMeta = await drive.files.get({
    fileId: book.driveFileId,
    fields: "id,name,webContentLink",
  });

  // Generate a direct download link
  // For service account access, we return webContentLink or construct one
  const downloadUrl = fileMeta.data.webContentLink ||
    `https://www.googleapis.com/drive/v3/files/${book.driveFileId}?alt=media`;

  // Log the download
  await db.collection(`sendLogs/${uid}/items`).add({
    bookId,
    type: "download",
    createdAt: FieldValue.serverTimestamp(),
  });

  return { downloadUrl, fileName: fileMeta.data.name || `${book.title}.epub` };
});

// ---------------------------------------------------------------------------
// sendToKindle
// ---------------------------------------------------------------------------
// Downloads the EPUB from Drive and sends it via email to the user's Kindle.

exports.sendToKindle = onCall({ region: "us-central1", timeoutSeconds: 120 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Debe estar autenticado");
  }

  const { bookId } = request.data;
  if (!bookId) throw new HttpsError("invalid-argument", "Falta bookId");

  const uid = request.auth.uid;
  const userData = await verifyRegistered(uid);

  if (!userData.kindleEmail) {
    throw new HttpsError("failed-precondition", "Configura tu email de Kindle en tu perfil primero");
  }

  // Get book
  const bookSnap = await db.doc(`books/${bookId}`).get();
  if (!bookSnap.exists) throw new HttpsError("not-found", "Libro no encontrado");
  const book = bookSnap.data();

  await verifyBookAccess(uid, book);

  // Download from Drive
  const drive = getDriveClient();
  const response = await drive.files.get(
    { fileId: book.driveFileId, alt: "media" },
    { responseType: "arraybuffer" },
  );

  const buffer = Buffer.from(response.data);
  const fileName = `${book.author} - ${book.title}.epub`;

  // Send via email
  const transporter = getTransporter();
  await transporter.sendMail({
    from: process.env.KINDLE_SENDER_EMAIL || process.env.SMTP_USER,
    to: userData.kindleEmail,
    subject: "Libro de La estanteria",
    text: `${book.title} por ${book.author}`,
    attachments: [{
      filename: fileName,
      content: buffer,
      contentType: "application/epub+zip",
    }],
  });

  // Log
  await db.collection(`sendLogs/${uid}/items`).add({
    bookId,
    type: "kindle",
    kindleEmail: userData.kindleEmail,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { success: true };
});

// ---------------------------------------------------------------------------
// Activity triggers
// ---------------------------------------------------------------------------

// When a new book is created → activity event
exports.onBookCreated = onDocumentCreated("books/{bookId}", async (event) => {
  const book = event.data.data();
  if (!book) return;

  await db.collection("activity").add({
    type: "book_added",
    actorUid: book.uploadedBy?.uid,
    actorName: book.uploadedBy?.displayName,
    bookId: event.params.bookId,
    bookTitle: book.title,
    bookAuthor: book.author,
    bookCoverUrl: book.coverUrl || "",
    createdAt: FieldValue.serverTimestamp(),
  });
});

// When reading status changes → activity event
exports.onReadingStatusChanged = onDocumentWritten(
  "readingStatus/{uid}/books/{bookId}",
  async (event) => {
    const after = event.data.after?.data();
    if (!after) return; // deletion

    const uid = event.params.uid;
    const bookId = event.params.bookId;

    // Get user name
    const userSnap = await db.doc(`users/${uid}`).get();
    const userName = userSnap.exists ? userSnap.data().displayName : "Alguien";

    // Get book info
    const bookSnap = await db.doc(`books/${bookId}`).get();
    const book = bookSnap.exists ? bookSnap.data() : {};

    const statusLabels = { want: "quiere leer", reading: "esta leyendo", finished: "termino" };

    await db.collection("activity").add({
      type: "reading_status",
      actorUid: uid,
      actorName: userName,
      bookId,
      bookTitle: book.title || "Libro desconocido",
      bookAuthor: book.author || "",
      status: after.status,
      statusLabel: statusLabels[after.status] || after.status,
      createdAt: FieldValue.serverTimestamp(),
    });
  },
);

// ---------------------------------------------------------------------------
// Weekly digest (runs every Monday at 9 AM)
// ---------------------------------------------------------------------------

exports.weeklyDigest = onSchedule("every monday 09:00", async () => {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  // Get recent books
  const recentBooks = await db.collection("books")
    .where("uploadedAt", ">=", oneWeekAgo)
    .orderBy("uploadedAt", "desc")
    .limit(10)
    .get();

  if (recentBooks.empty) return; // nothing to report

  // Get all users who want digests
  const usersSnap = await db.collection("users")
    .where("notifyDigest", "==", true)
    .get();

  if (usersSnap.empty) return;

  const bookList = recentBooks.docs.map((d) => {
    const b = d.data();
    return `- ${b.title} por ${b.author} (subido por ${b.uploadedBy?.displayName || "?"})`;
  }).join("\n");

  const appUrl = process.env.APP_URL || "https://laestanteria.vercel.app";

  const transporter = getTransporter();

  for (const userDoc of usersSnap.docs) {
    const user = userDoc.data();
    if (!user.email) continue;

    try {
      await transporter.sendMail({
        from: process.env.KINDLE_SENDER_EMAIL || process.env.SMTP_USER,
        to: user.email,
        subject: "La estanteria — Resumen semanal",
        text: `Hola ${user.displayName || ""},\n\nEsta semana se agregaron ${recentBooks.size} libros:\n\n${bookList}\n\nVisita ${appUrl} para explorar el catalogo.\n\nLa estanteria`,
      });
    } catch (err) {
      console.error(`Error sending digest to ${user.email}:`, err.message);
    }
  }
});
