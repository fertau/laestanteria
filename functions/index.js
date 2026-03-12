const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const nodemailer = require("nodemailer");

initializeApp();
const db = getFirestore();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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


// ---------------------------------------------------------------------------
// sendToKindle
// ---------------------------------------------------------------------------
// Receives an EPUB as base64 from the client and sends it via email to a
// Kindle address. The file is processed entirely in memory — never persisted.
// Used for both "send to own Kindle" and "send to bonded user's Kindle".

exports.sendToKindle = onCall({
  region: "us-central1",
  timeoutSeconds: 120,
  // Allow larger payloads for EPUB uploads (base64-encoded, ~50MB max)
  enforceAppCheck: false,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Debe estar autenticado");
  }

  const { kindleEmail, bookTitle, bookAuthor, epubBase64 } = request.data;

  if (!kindleEmail) throw new HttpsError("invalid-argument", "Falta kindleEmail");
  if (!bookTitle) throw new HttpsError("invalid-argument", "Falta bookTitle");
  if (!epubBase64) throw new HttpsError("invalid-argument", "Falta epubBase64");

  if (!kindleEmail.endsWith("@kindle.com")) {
    throw new HttpsError("invalid-argument", "El email debe terminar en @kindle.com");
  }

  const uid = request.auth.uid;
  await verifyRegistered(uid);

  // Decode base64 to buffer (in memory only — never saved to disk/storage)
  const buffer = Buffer.from(epubBase64, "base64");

  // Sanity check: max 50MB
  if (buffer.length > 50 * 1024 * 1024) {
    throw new HttpsError("invalid-argument", "El archivo es demasiado grande (max 50MB)");
  }

  const fileName = `${bookAuthor || "Libro"} - ${bookTitle}.epub`;

  // Send via SMTP
  const transporter = getTransporter();
  await transporter.sendMail({
    from: process.env.KINDLE_SENDER_EMAIL || process.env.SMTP_USER,
    to: kindleEmail,
    subject: "Libro de La estanteria",
    text: `${bookTitle} por ${bookAuthor || ""}`,
    attachments: [{
      filename: fileName,
      content: buffer,
      contentType: "application/epub+zip",
    }],
  });

  // Log the send
  await db.collection(`sendLogs/${uid}/items`).add({
    type: "kindle",
    kindleEmail,
    bookTitle,
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
