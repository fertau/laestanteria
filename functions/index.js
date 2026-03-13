const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

initializeApp();
const db = getFirestore();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Server-level SMTP transporter (for weeklyDigest only). */
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
// Per-user SMTP encryption (AES-256-GCM)
// ---------------------------------------------------------------------------

function getEncryptionKey() {
  const hex = process.env.SMTP_ENCRYPTION_KEY || "";
  if (hex.length !== 64) {
    throw new HttpsError("internal", "SMTP_ENCRYPTION_KEY no configurada en el servidor");
  }
  return Buffer.from(hex, "hex");
}

function encryptPassword(plaintext) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

function decryptPassword(stored) {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, encryptedHex] = stored.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final("utf8");
}

/**
 * Create a nodemailer transporter using a user's personal SMTP credentials.
 * Returns null if the user hasn't configured SMTP.
 */
async function getUserTransporter(uid) {
  const userDoc = await db.doc(`users/${uid}`).get();
  const userData = userDoc.exists ? userDoc.data() : null;
  if (!userData?.smtpConfigured || !userData?.senderEmail) return null;

  const smtpDoc = await db.doc(`users/${uid}/private/smtp`).get();
  const smtpData = smtpDoc.exists ? smtpDoc.data() : null;
  if (!smtpData?.encryptedAppPassword) return null;

  const password = decryptPassword(smtpData.encryptedAppPassword);
  return {
    transporter: nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user: userData.senderEmail, pass: password },
    }),
    senderEmail: userData.senderEmail,
  };
}


// ---------------------------------------------------------------------------
// saveSmtpCredentials — store per-user SMTP config (encrypted)
// ---------------------------------------------------------------------------

exports.saveSmtpCredentials = onCall({
  region: "us-central1",
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Debe estar autenticado");
  }
  const uid = request.auth.uid;
  await verifyRegistered(uid);

  const { senderEmail, appPassword } = request.data;

  if (!senderEmail || !senderEmail.includes("@")) {
    throw new HttpsError("invalid-argument", "Email de remitente invalido");
  }

  // Gmail app passwords are 16 lowercase letters (may have spaces between groups)
  const cleanPassword = (appPassword || "").replace(/\s/g, "");
  if (!cleanPassword || cleanPassword.length !== 16) {
    throw new HttpsError("invalid-argument",
      "La contraseña de aplicacion debe tener 16 caracteres (sin espacios)");
  }

  const encryptedAppPassword = encryptPassword(cleanPassword);

  // Store encrypted password in private subcollection (not readable by client)
  await db.doc(`users/${uid}/private/smtp`).set({ encryptedAppPassword });

  // Store non-sensitive fields in main user doc (readable by client for UI)
  await db.doc(`users/${uid}`).update({
    senderEmail,
    smtpConfigured: true,
  });

  return { success: true };
});

// ---------------------------------------------------------------------------
// testSmtpCredentials — verify user's SMTP connection works
// ---------------------------------------------------------------------------

exports.testSmtpCredentials = onCall({
  region: "us-central1",
  timeoutSeconds: 30,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Debe estar autenticado");
  }
  const uid = request.auth.uid;
  await verifyRegistered(uid);

  const result = await getUserTransporter(uid);
  if (!result) {
    throw new HttpsError("failed-precondition",
      "SMTP no configurado. Guarda tus credenciales primero.");
  }

  try {
    await result.transporter.verify();
    return { success: true, message: "Conexion SMTP verificada correctamente" };
  } catch (err) {
    return { success: false, message: `Error de conexion: ${err.message}` };
  }
});

// ---------------------------------------------------------------------------
// sendToKindle
// ---------------------------------------------------------------------------
// Receives an EPUB as base64 from the client and sends it via email to a
// Kindle address. The file is processed entirely in memory — never persisted.
// Uses the SENDER's personal SMTP credentials (per-user Gmail + App Password).

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

  const baseName = `${bookAuthor || "Libro"} - ${bookTitle}`.replace(/[/\\?%*:|"<>]/g, "-");

  // Gmail blocks .epub attachments as a security risk.
  // Wrap the EPUB in a proper ZIP so Gmail allows it through.
  // Kindle accepts .zip files and will extract the EPUB inside.
  const archiver = require("archiver");
  const { PassThrough } = require("stream");

  const zipBuffer = await new Promise((resolve, reject) => {
    const chunks = [];
    const passthrough = new PassThrough();
    passthrough.on("data", (chunk) => chunks.push(chunk));
    passthrough.on("end", () => resolve(Buffer.concat(chunks)));
    passthrough.on("error", reject);

    const archive = archiver("zip", { zlib: { level: 1 } });
    archive.on("error", reject);
    archive.pipe(passthrough);
    archive.append(buffer, { name: `${baseName}.epub` });
    archive.finalize();
  });

  // Send via user's personal SMTP
  const smtpResult = await getUserTransporter(uid);
  if (!smtpResult) {
    throw new HttpsError("failed-precondition",
      "No configuraste tu email de envio. Anda a Perfil → Configuracion Kindle.");
  }
  await smtpResult.transporter.sendMail({
    from: smtpResult.senderEmail,
    to: kindleEmail,
    subject: "Libro de La estanteria",
    text: `${bookTitle} por ${bookAuthor || ""}`,
    attachments: [{
      filename: `${baseName}.zip`,
      content: zipBuffer,
      contentType: "application/zip",
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
