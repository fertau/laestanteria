# La Estantería — Modelo "Kindle Direct"

## Principio

> Los EPUBs viven en el dispositivo del dueño. Nunca se hostean en la nube.
> Compartir = enviar directamente al Kindle del otro vía email.
> Firebase se queda como cerebro social (metadatos, catálogo, vínculos).
> Amazon es la infraestructura de entrega.

---

## Arquitectura

```
┌──────────────────────────────────────────────────────────────┐
│                      Firebase (nube)                         │
│                                                              │
│  Auth · Firestore (metadatos, catálogos, vínculos, pedidos) │
│  Cloud Functions (relay SMTP → Kindle)                       │
└────────────┬───────────────────────────────┬─────────────────┘
             │                               │
      ┌──────▼──────┐                 ┌──────▼──────┐
      │  Ana         │                │  Luis        │
      │  (PWA)       │                │  (PWA)       │
      │              │                │              │
      │  OPFS local  │   ──SMTP──►   │  Kindle      │
      │  ├─ 1984.epub│   (vía Cloud  │  📱          │
      │  ├─ Rayuela  │    Function)  │              │
      │  └─ Dune     │                │  OPFS local  │
      │              │                │  (sus libros)│
      └──────────────┘                └──────────────┘
```

**Flujo de datos:**
- Metadatos (títulos, portadas, valoraciones) → Firebase (nube)
- Archivos EPUB → OPFS del navegador (100% local, nunca salen a storage cloud)
- Entrega de libros → Cloud Function lee EPUB del navegador del dueño → SMTP → `@kindle.com` del receptor
- El EPUB toca el servidor solo en tránsito (memoria, sin persistir)

---

## Modelo de confianza: Kindle emails cruzados

El vínculo entre dos usuarios se establece mediante un **handshake de Kindle emails**:

### Setup (una sola vez)

```
Ana                                          Luis
 │                                            │
 ├─ 1. Registra su Kindle email              ├─ 1. Registra su Kindle email
 │    ana_kindle@kindle.com                  │    luis_kindle@kindle.com
 │                                            │
 ├─ 2. Habilita en Amazon el email            ├─ 2. Habilita en Amazon el email
 │    remitente de la app:                   │    remitente de la app:
 │    estanteria@tudominio.com               │    estanteria@tudominio.com
 │                                            │
 ├─ 3. Envía solicitud de vínculo a Luis     │
 │    (comparte su Kindle email)              │
 │                                            ├─ 3. Acepta y comparte su
 │                                            │    Kindle email con Ana
 │                                            │
 └─ ✓ Vínculo establecido                    └─ ✓ Vínculo establecido
     Ana puede enviar al Kindle de Luis           Luis puede enviar al Kindle de Ana
     Luis puede enviar al Kindle de Ana           Ana puede enviar al Kindle de Luis
```

### ¿Por qué funciona como mecanismo de confianza?

1. **Bidireccional**: ambos deben dar su Kindle email Y habilitar el remitente en Amazon
2. **Revocable**: quitar el email remitente en Amazon corta el acceso instantáneamente
3. **Verificable**: si el email no está habilitado, el envío falla → la app lo detecta
4. **Sin intermediarios**: Amazon valida la autorización, no nosotros
5. **Ya existe**: los usuarios de Kindle ya conocen este mecanismo

### Datos en Firestore

```
// Vínculo entre usuarios
bonds/{bondId}:
  userA: "ana_uid"
  userB: "luis_uid"
  kindleEmailA: "ana_kindle@kindle.com"    // visible solo para B
  kindleEmailB: "luis_kindle@kindle.com"    // visible solo para A
  status: "pending" | "active"
  createdAt: timestamp
  activatedAt: timestamp

// Perfil de usuario
users/{uid}:
  displayName: "Ana"
  kindleEmail: "ana_kindle@kindle.com"      // privado, solo visible a vínculos activos
  senderEmailWhitelisted: true | false      // auto-verificado
  ...campos existentes
```

---

## Flujos principales

### 1. Publicar catálogo

Sin cambios visibles para el usuario. Ana sube un libro:

```
Ana elige EPUB → rellena metadatos (o auto-enriquece)
    │
    ├── Metadatos → Firestore (como ahora)
    │   { title, author, genre, coverUrl, isbn, uploadedBy... }
    │
    └── EPUB → OPFS del navegador (en vez de Google Drive)
        Se guarda el hash SHA-256 como referencia
```

El catálogo de Ana es visible para todos sus vínculos activos.

### 2. Explorar catálogos de otros

Luis abre el catálogo y ve los libros de Ana (metadatos de Firebase):

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  📖          │  │  📖          │  │  📖          │
│  1984        │  │  Rayuela     │  │  Dune        │
│  Orwell      │  │  Cortázar    │  │  Herbert     │
│  ★★★★★      │  │  ★★★★☆      │  │  ★★★★☆      │
│  ✅ Mío      │  │  📚 De Ana  │  │  📚 De Ana  │
└──────────────┘  └──────────────┘  └──────────────┘

Filtros: Todos | Mis libros | De Ana | De Marta
```

### 3. Pedir libros

```
Luis abre "Rayuela" de Ana
    │
    ▼
┌─────────────────────────────────────┐
│  📖 Rayuela                        │
│  Julio Cortázar · 1963             │
│  ★★★★☆ (3 valoraciones)           │
│                                     │
│  📚 En la estantería de Ana        │
│                                     │
│  ┌──────────────────────────────┐  │
│  │  📩 Pedir a mi Kindle       │  │
│  └──────────────────────────────┘  │
│                                     │
│  ┌──────────────────────────────┐  │
│  │  📋 Añadir a mi lista       │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
```

Luis puede pedir uno o varios libros a la vez:

```
// Selección múltiple en catálogo
Luis selecciona 5 libros de Ana → "Pedir selección a mi Kindle"

// Firestore
requests/{requestId}:
  fromUid: "luis_uid"
  toUid: "ana_uid"
  books: [
    { bookId: "abc", title: "Rayuela" },
    { bookId: "def", title: "Dune" },
    { bookId: "ghi", title: "1984" },
    ...
  ]
  status: "pending"
  createdAt: timestamp
```

### 4. Aprobar y enviar

Ana recibe notificación (push notification de la PWA + WhatsApp opcional):

```
WhatsApp (vía Twilio/bot simple):
─────────────────────────────────
📚 La Estantería
Luis te pidió 5 libros:
- Rayuela
- Dune
- 1984
- Fahrenheit 451
- El fin de la eternidad

Revisar: https://laestanteria.app/requests/xyz
─────────────────────────────────
```

Ana abre la PWA y ve el pedido:

```
┌─────────────────────────────────────────────┐
│  📩 Pedido de Luis · hace 10 min           │
│                                             │
│  ☑️ Rayuela              [Enviar]          │
│  ☑️ Dune                 [Enviar]          │
│  ☑️ 1984                 [Enviar]          │
│  ☑️ Fahrenheit 451       [Enviar]          │
│  ☐  El fin de la eternidad  [Rechazar]     │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  📩 Enviar 4 seleccionados         │   │
│  │     → al Kindle de Luis            │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Destino: luis_kindle@kindle.com            │
└─────────────────────────────────────────────┘
```

Al pulsar "Enviar seleccionados":

```
Para cada libro seleccionado:
    │
    ├── PWA lee EPUB de OPFS
    ├── Sube a Cloud Function (multipart, en memoria)
    ├── Cloud Function envía vía SMTP a luis_kindle@kindle.com
    ├── Cloud Function borra el archivo de memoria
    └── Firestore: marca libro como enviado en el request

Todo el lote en paralelo. Progreso visible:
    Rayuela ✅ Enviado
    Dune ✅ Enviado
    1984 ⏳ Enviando...
    Fahrenheit 451 ⏳ En cola
```

### 5. Recepción

Luis recibe los libros en su Kindle automáticamente. En la PWA:

```
┌─────────────────────────────────────┐
│  📩 Tu pedido a Ana                │
│                                     │
│  ✅ Rayuela — enviado a tu Kindle  │
│  ✅ Dune — enviado a tu Kindle     │
│  ✅ 1984 — enviado a tu Kindle     │
│  ✅ Fahrenheit 451 — enviado       │
│  ❌ El fin de la eternidad —       │
│     Ana no lo tiene disponible     │
└─────────────────────────────────────┘
```

---

## Notificación por WhatsApp

Para que Ana no tenga que abrir la PWA constantemente, se envía un WhatsApp
cuando recibe un pedido. Opciones de implementación:

### Opción simple: enlace wa.me

No requiere API de WhatsApp. La Cloud Function genera un enlace `wa.me`
que se incluye en una push notification o email:

```
Push notification → "Luis te pidió 5 libros — revisar en la app"
```

### Opción mejor: WhatsApp Business API (Twilio/Meta)

Envío directo de mensaje al WhatsApp de Ana con resumen del pedido y enlace
a la app. Coste: ~$0.005 por mensaje (gratis en tier de prueba).

### Opción más simple: solo push notification

La PWA ya soporta push notifications. Es suficiente para un grupo de 2-5:

```
🔔 Luis te pidió 5 libros
   Toca para revisar
```

---

## Qué cambia en el código

### Archivos a crear

| Archivo | Propósito | ~LOC |
|---|---|---|
| `src/lib/localStore.js` | Abstracción OPFS/IndexedDB para EPUBs | 120 |
| `src/hooks/useRequests.jsx` | Hook para pedidos (crear, aprobar, rechazar) | 150 |
| `src/hooks/useBonds.jsx` | Hook para vínculos entre usuarios | 100 |
| `src/components/RequestModal.jsx` | Modal de aprobación de pedidos | 120 |
| `src/components/BondSetup.jsx` | Flujo de setup de vínculo (Kindle emails) | 100 |
| `src/pages/Requests.jsx` | Página de pedidos pendientes/historial | 80 |

### Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/hooks/useBooks.jsx` | Upload: Drive → `localStore.save()` |
| `src/components/UploadModal.jsx` | Guardar EPUB en OPFS en vez de Drive |
| `src/components/BookModal.jsx` | Botón "Pedir a mi Kindle" en vez de "Descargar" |
| `src/pages/People.jsx` | Sección de vínculos + setup Kindle email |
| `src/pages/Notifications.jsx` | Incluir pedidos pendientes |
| `src/hooks/useFollows.jsx` | Integrar concepto de bond (vínculo con Kindle) |
| `functions/index.js` | `sendToKindle`: recibe EPUB como upload en vez de descargarlo de Drive |
| `functions/index.js` | Nuevo: `onRequestCreated` trigger para push notification |
| `firestore.rules` | Reglas para `bonds/` y `requests/` |

### Archivos a eliminar

| Archivo | Razón |
|---|---|
| `src/lib/googleDrive.js` | Ya no se usa Google Drive |

### Archivos sin cambios

Todo lo demás: hooks sociales (ratings, readingStatus, activity, collections,
recommendations), componentes UI (BookCard, BookGrid, Stars, Avatar, Header...),
páginas (Home, Catalog, Stats, Collections...), lib de metadatos
(googleBooks, openLibrary, hardcover, epubParser...).

---

## Modelo de datos (nuevas colecciones Firestore)

```javascript
// Vínculo entre dos usuarios
bonds/{bondId}: {
  userA: uid,
  userB: uid,
  kindleEmailA: "x@kindle.com",   // solo legible por userB
  kindleEmailB: "y@kindle.com",   // solo legible por userA
  status: "pending" | "active",   // active = ambos completaron setup
  initiatedBy: uid,
  createdAt: timestamp,
  activatedAt: timestamp
}

// Pedido de libros
requests/{requestId}: {
  fromUid: uid,                    // quien pide
  toUid: uid,                     // dueño de los libros
  books: [
    {
      bookId: string,
      title: string,
      status: "pending" | "approved" | "rejected" | "sent" | "failed",
      sentAt: timestamp | null
    }
  ],
  status: "pending" | "partial" | "completed",
  createdAt: timestamp,
  resolvedAt: timestamp
}
```

### Firestore Rules (nuevas)

```
match /bonds/{bondId} {
  allow read: if request.auth.uid == resource.data.userA
               || request.auth.uid == resource.data.userB;
  allow create: if request.auth.uid == request.resource.data.initiatedBy;
  allow update: if request.auth.uid == resource.data.userA
                 || request.auth.uid == resource.data.userB;
}

match /requests/{requestId} {
  allow read: if request.auth.uid == resource.data.fromUid
               || request.auth.uid == resource.data.toUid;
  allow create: if request.auth.uid == request.resource.data.fromUid;
  allow update: if request.auth.uid == resource.data.toUid;  // solo el dueño aprueba
}
```

---

## Cloud Function: envío a Kindle (modificada)

```javascript
// Antes: descarga de Google Drive
// Ahora: recibe EPUB como upload del navegador del dueño

exports.sendToKindle = onCall(async (request) => {
  const { kindleEmail, bookTitle } = request.data;
  const file = request.rawRequest.file;  // EPUB subido en memoria

  // Validar que el usuario tiene un bond activo con el destinatario
  // Validar que kindleEmail coincide con el bond
  // Enviar por SMTP
  // NO persistir el archivo en ningún storage

  await transporter.sendMail({
    from: '"La Estantería" <estanteria@tudominio.com>',
    to: kindleEmail,
    subject: bookTitle,
    attachments: [{
      filename: `${bookTitle}.epub`,
      content: file.buffer  // en memoria, no en disco
    }]
  });

  // Actualizar request status
  return { success: true };
});
```

---

## Setup flow para nuevos usuarios

### Onboarding actualizado

```
Paso 1: Login con Google (como ahora)
    │
    ▼
Paso 2: "Configura tu Kindle"
    ┌─────────────────────────────────────────────┐
    │  📚 Conecta tu Kindle                      │
    │                                             │
    │  Tu email de Kindle:                        │
    │  ┌─────────────────────────────────────┐   │
    │  │ mi_kindle@kindle.com                │   │
    │  └─────────────────────────────────────┘   │
    │                                             │
    │  Paso importante:                           │
    │  Añade este email como remitente            │
    │  aprobado en tu cuenta de Amazon:           │
    │                                             │
    │  estanteria@tudominio.com                   │
    │  [Copiar]                                   │
    │                                             │
    │  📖 Cómo hacerlo (link a tutorial)          │
    │                                             │
    │  [Verificar configuración]                  │
    │  [Saltar por ahora]                         │
    └─────────────────────────────────────────────┘
    │
    ▼
Paso 3: "Conecta con amigos" (código de invitación → bond)
```

### Crear vínculo con un amigo

```
Ana va a Personas → "Invitar amigo"
    │
    ▼
Se genera enlace: laestanteria.app/bond/abc123
Ana lo envía por WhatsApp a Luis
    │
    ▼
Luis abre el enlace → acepta → introduce su Kindle email
    │
    ▼
Vínculo activo: ambos ven el catálogo del otro
                ambos pueden pedir libros al Kindle del otro
```

---

## Comparativa con modelo actual

| Aspecto | Modelo actual (Drive) | Modelo Kindle Direct |
|---|---|---|
| Dónde viven los EPUBs | Google Drive (nube) | OPFS del navegador (local) |
| Cómo se comparten | Link de Drive | Envío directo a Kindle |
| Quién controla el acceso | Firebase rules | El dueño aprueba cada pedido |
| Dónde se leen los libros | Descarga + app de lectura | Kindle (el mejor lector) |
| Enviar a Kindle | Feature extra | **Es el mecanismo central** |
| Persistencia del archivo | Drive (permanente) | Local (dispositivo) + Kindle (Amazon) |
| Riesgo legal (hosting) | Archivos en Google Cloud | Archivos nunca en la nube |
| Experiencia de descarga | 1 click | Pedido → aprobación → Kindle |
| Experiencia de lectura | Descargar EPUB → abrir con... | Ya está en tu Kindle |

---

## Limitaciones y mitigaciones

### "¿Y si quiero el EPUB, no solo en Kindle?"

Además de "Pedir a mi Kindle", ofrecer "Pedir archivo":
- El dueño recibe el pedido igual
- En vez de enviar a Kindle, usa Web Share API para enviarlo por WhatsApp/email/etc.
- Es el fallback para usuarios sin Kindle

### "¿Y si Ana no tiene la PWA abierta?"

- Push notification de la PWA
- Email de respaldo con enlace a la app
- El pedido queda en cola hasta que Ana lo revise

### "¿Y si el EPUB es muy grande para email?"

- Límite de Amazon: 50 MB por email
- La mayoría de EPUBs son 1-5 MB
- Para archivos grandes: compresión previa o fallback a Web Share API

### "¿Y si Ana cambió de dispositivo y perdió los EPUBs locales?"

- Los metadatos siguen en Firebase (nunca se pierden)
- Los EPUBs en OPFS se pierden si el usuario limpia datos del navegador
- Mitigación: opción "Exportar mi biblioteca" → genera backup ZIP
- Mitigación: indicador "archivo local disponible / no disponible" por libro

### "¿Y si el usuario no tiene Kindle?"

- El flujo "Pedir archivo" (sin Kindle) funciona como fallback
- El dueño comparte el EPUB por WhatsApp/email/AirDrop
- El receptor lo importa en la app que quiera (Apple Books, Google Play Books, etc.)

---

## Fases de implementación

```
Fase 1: Core Kindle Direct                              ← MVP
├── localStore.js (OPFS para EPUBs)
├── Bonds (vínculos con Kindle email cruzado)
├── Requests (pedir libros)
├── Aprobación + envío a Kindle desde la PWA
├── Push notifications para pedidos
└── Migrar upload de Drive a OPFS

Fase 2: Pulido
├── Pedidos batch (selección múltiple)
├── Fallback "Pedir archivo" (Web Share API, sin Kindle)
├── Exportar/importar biblioteca (backup)
├── Tutorial de onboarding (configurar Kindle)
└── WhatsApp notification (Twilio) para pedidos

Fase 3: Extras
├── Auto-envío: "Enviar automáticamente todo lo que suba Ana"
├── Listas de deseos compartidas
├── Historial de envíos entre usuarios
└── Estadísticas de compartir
```
