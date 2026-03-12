# La Estantería — Diseño: Archivos Locales, Social en la Nube

## Problema

Los EPUBs están en Google Drive (cloud). Queremos que los archivos nunca salgan del
dispositivo del usuario, pero manteniendo la experiencia social sin fricción.

## Restricciones del diseño

- **Quién hostea**: cualquier persona, sin conocimientos técnicos
- **Tamaño del grupo**: 2-5 personas (amigos/familia)
- **Privacidad**: EPUBs 100% locales. Metadatos (títulos, portadas, valoraciones) pueden estar en Firebase
- **Referentes**: Plex (compartir servidor), Kavita (biblioteca local), Calibre-web (servir EPUBs)

## Principio central

> Firebase se queda como cerebro social. Google Drive desaparece.
> Los EPUBs viven en el dispositivo del usuario. Compartir = transferir archivo.

---

## Arquitectura: 3 opciones de menor a mayor fricción

---

### Opción A: "Modelo Plex" — PWA + Servidor companion local

```
┌─────────────────────────────────────────────────────────┐
│                    Firebase (nube)                       │
│  Auth · Firestore (metadatos, follows, actividad)       │
│  Cloud Functions (notificaciones, digest)                │
└──────────────┬──────────────────────┬───────────────────┘
               │                      │
        ┌──────▼──────┐        ┌──────▼──────┐
        │  Ana (host) │        │ Luis (guest) │
        │             │        │              │
        │ PWA normal  │        │  PWA normal  │
        │      +      │        │              │
        │ Companion   │        │ Se conecta   │
        │ local       │        │ al companion │
        │ (sirve      │        │ de Ana para  │
        │  EPUBs)     │        │ descargar    │
        │             │        │              │
        │ ~/Libros/   │        │ ~/Libros/    │
        │  ├─ 1984.epub        │  └─ (vacío o │
        │  ├─ Rayuela.epub     │     sus propios)
        │  └─ ...     │        │              │
        └─────────────┘        └──────────────┘
```

**Cómo funciona:**

1. Ana instala la PWA normal (sin cambios) + un **companion app** ligero
   - El companion es una app de escritorio (Electron/Tauri) o un servicio local
   - Se instala con un click: `LaEstanteria-Companion.dmg` / `.exe` / `.AppImage`
   - Al abrirlo: elige carpeta de libros → listo

2. Cuando Ana sube un libro:
   - Metadatos → Firebase (título, autor, portada, ISBN...) — como ahora
   - EPUB → carpeta local (`~/La Estantería/`) — en vez de Google Drive
   - El companion lo indexa automáticamente

3. Luis quiere descargar un libro de Ana:
   - Ve el libro en el catálogo (metadatos vienen de Firebase)
   - Pulsa "Descargar"
   - La PWA contacta al companion de Ana
   - El companion sirve el EPUB directamente

4. Conectividad Ana ↔ Luis:
   - **Mismo WiFi**: automático (mDNS/Bonjour discovery)
   - **Remoto**: el companion incluye túnel integrado (Cloudflare Tunnel o Tailscale)
   - Ana comparte un enlace: `https://abc123.trycloudflare.com` (autogenerado)

**Qué cambia en el código:**

| Componente | Antes | Después |
|---|---|---|
| `useBooks.jsx` upload | Sube EPUB a Google Drive | Guarda EPUB en filesystem local vía companion API |
| `googleDrive.js` | API de Google Drive | **Se elimina** |
| `functions/index.js` generateDownloadLink | Genera link de Drive | Redirige al companion del propietario |
| `functions/index.js` sendToKindle | Descarga de Drive + SMTP | Companion envía directamente por SMTP |
| `UploadModal.jsx` | Pide acceso a Drive | Guarda en carpeta local |
| `BookModal.jsx` download | Link de Drive | Descarga desde companion del owner |
| `firebase.js` | Sin cambios | Sin cambios |
| Hooks sociales | Sin cambios | Sin cambios |

**Nuevo componente: Companion App (~500 LOC)**
```
companion/
├── server.js          # Express sirviendo EPUBs (puerto local)
├── watcher.js         # Vigila carpeta de libros (chokidar)
├── tunnel.js          # Cloudflare tunnel automático
├── discovery.js       # mDNS para red local
└── tray.js            # Icono en bandeja del sistema
```

**Pros:**
- Máxima funcionalidad (descarga directa entre usuarios)
- Experiencia tipo Plex: "tu servidor personal de libros"
- Firebase se mantiene intacto para lo social

**Contras:**
- Requiere instalar una app de escritorio adicional
- El companion tiene que estar encendido para que otros descarguen
- Hay que resolver conectividad (túnel)

**Fricción: ★★★☆☆** (media — instalar companion + configurar túnel)

---

### Opción B: "Modelo WebRTC" — Solo PWA, transferencia peer-to-peer

```
┌──────────────────────────────────────────────────┐
│                  Firebase (nube)                  │
│  Auth · Firestore · Cloud Functions              │
│  + Señalización WebRTC (Firestore como canal)    │
└──────────┬─────────────────────────┬─────────────┘
           │                         │
    ┌──────▼──────┐          ┌───────▼─────┐
    │   Ana       │◄════════►│    Luis     │
    │   (PWA)     │  WebRTC  │    (PWA)    │
    │             │  P2P     │             │
    │ IndexedDB/  │          │ IndexedDB/  │
    │ OPFS        │          │ OPFS        │
    │ (EPUBs)     │          │ (EPUBs)     │
    └─────────────┘          └─────────────┘
```

**Cómo funciona:**

1. Ana sube un libro desde la PWA:
   - Metadatos → Firebase (como ahora)
   - EPUB → **Origin Private File System (OPFS)** del navegador
   - No sale del dispositivo, no necesita companion

2. Luis quiere descargar un libro de Ana:
   - Ve el libro en catálogo (Firebase)
   - Pulsa "Solicitar libro"
   - Se crea un documento en Firestore: `transfers/{id}` con offer/answer SDP
   - Firebase actúa como servidor de señalización
   - Se establece conexión WebRTC directa entre los navegadores
   - El EPUB se transfiere P2P (browser a browser)

3. Si Ana no está online:
   - Luis ve "Ana está offline — solicitar para cuando vuelva"
   - Cuando Ana abre la PWA, ve la solicitud pendiente → acepta → transferencia automática
   - **Fallback**: Ana puede "enviar por otro medio" (genera enlace temporal o exporta archivo)

**Flujo de señalización (Firestore):**
```
transfers/{transferId}:
  bookId: "abc123"
  from: "ana_uid"
  to: "luis_uid"
  status: "pending" | "signaling" | "transferring" | "completed"
  offer: { sdp: "..." }    ← Ana escribe
  answer: { sdp: "..." }   ← Luis escribe
  iceCandidates: [...]      ← ambos escriben
```

**Almacenamiento en navegador:**
- **OPFS (Origin Private File System)**: API moderna, rápida, sin límite práctico de tamaño
- Fallback: IndexedDB para navegadores sin OPFS
- Los EPUBs se almacenan como blobs con hash SHA-256 como referencia
- Firestore guarda: `{ driveFileId → localFileHash }` para mapear libros a archivos locales

**Qué cambia en el código:**

| Componente | Antes | Después |
|---|---|---|
| `googleDrive.js` | API de Drive | **`localStore.js`** — wrapper OPFS/IndexedDB |
| `useBooks.jsx` upload | Drive upload | `localStore.save(file)` + metadatos a Firebase |
| `functions/index.js` generateDownloadLink | Link de Drive | **Se elimina** (P2P directo) |
| `BookModal.jsx` download | Link de Drive | Botón "Solicitar" → WebRTC transfer |
| Nuevo: `useTransfers.jsx` | — | Hook para gestionar transferencias P2P |
| Nuevo: `lib/webrtc.js` | — | Lógica WebRTC (offer/answer/datachannel) |
| Nuevo: `lib/localStore.js` | — | Abstracción OPFS + IndexedDB |
| `functions/index.js` sendToKindle | Descarga de Drive | **Cloud Function descarga vía WebRTC relay** o usuario envía manualmente |

**Pros:**
- **Cero instalación adicional** — solo la PWA que ya existe
- Archivos nunca tocan ningún servidor
- Funciona en móvil y escritorio
- Firebase ya resuelve señalización gratis (Firestore realtime)

**Contras:**
- Ambos usuarios deben estar online simultáneamente (o usar cola de pendientes)
- OPFS tiene soporte limitado en Safari iOS (mejorando)
- WebRTC puede fallar detrás de NATs restrictivos (solución: TURN server gratuito)
- Enviar a Kindle requiere workaround (el usuario lo hace manualmente o desde companion)
- Almacenamiento del navegador puede ser limpiado por el OS si hay presión de espacio

**Fricción: ★★☆☆☆** (baja — nada que instalar, pero requiere que ambos estén online)

---

### Opción C: "Modelo Buzón" — Firebase + compartir por mensajería

```
┌──────────────────────────────────────────────────┐
│                  Firebase (nube)                  │
│  Auth · Firestore (metadatos, follows, social)   │
│  SIN archivos · SIN links de descarga            │
└──────────┬─────────────────────────┬─────────────┘
           │                         │
    ┌──────▼──────┐          ┌───────▼─────┐
    │   Ana       │          │    Luis     │
    │   (PWA)     │          │    (PWA)    │
    │             │ WhatsApp │             │
    │ OPFS/       │ Telegram │ OPFS/      │
    │ IndexedDB   │◄────────►│ IndexedDB  │
    │ (EPUBs)     │ Email    │ (EPUBs)    │
    │             │ AirDrop  │            │
    └─────────────┘          └─────────────┘
```

**Cómo funciona:**

1. Ana sube un libro:
   - Metadatos → Firebase (como siempre)
   - EPUB → almacenamiento local del navegador (OPFS)
   - En el catálogo aparece el libro con toda su info pero sin link de descarga cloud

2. Luis ve el libro en el catálogo y lo quiere:
   - **Opción 1 — "Pedir libro"**: notificación a Ana vía Firebase. Ana ve el pedido y:
     - Pulsa "Compartir" → la PWA genera el archivo desde OPFS
     - Se abre el diálogo nativo de compartir del OS (Web Share API)
     - Elige: WhatsApp, Telegram, AirDrop, email, guardar en disco...
   - **Opción 2 — "Exportar paquete"**: Ana selecciona varios libros →
     - Genera un `.estanteria` (ZIP con EPUBs + metadatos JSON)
     - Lo comparte por el medio que quiera
   - **Opción 3 — Enlace temporal**: Ana genera un enlace de descarga temporal
     - Usa un servicio de transferencia efímero (tipo wormhole/transfer.sh)
     - O simplemente comparte el archivo directamente

3. Luis recibe el EPUB y lo importa:
   - Arrastra el archivo a la PWA → se guarda en OPFS + se vincula al libro en Firebase
   - O: la PWA detecta el `.estanteria` y auto-importa

**Qué cambia en el código:**

| Componente | Antes | Después |
|---|---|---|
| `googleDrive.js` | API de Drive | **`localStore.js`** — wrapper OPFS/IndexedDB |
| `useBooks.jsx` upload | Drive upload | `localStore.save(file)` |
| `BookModal.jsx` | Botón "Descargar" → Drive link | Botón "Pedir" (si no lo tienes) / "Compartir" (si lo tienes) |
| `functions/index.js` generateDownloadLink | **Se elimina** | — |
| Nuevo: `lib/localStore.js` | — | Almacenamiento local OPFS |
| Nuevo: `components/ShareModal.jsx` | — | Diálogo de compartir (Web Share API) |
| Nuevo: `components/ImportDrop.jsx` | — | Zona de drop para importar EPUBs |

**Pros:**
- **Cero fricción técnica** — nada que instalar, ni túneles, ni companion
- Los archivos viajan por canales que el usuario ya usa (WhatsApp, etc.)
- No hay dependencia de estar online simultáneamente
- El modelo mental es natural: "te paso el libro"
- Funciona igual en móvil y escritorio
- Firebase prácticamente sin cambios

**Contras:**
- No hay descarga directa desde la app (hay un paso manual)
- Para bibliotecas grandes, compartir libro a libro es tedioso
  - Mitigación: paquetes `.estanteria` para compartir colecciones enteras
- El catálogo muestra libros que no puedes descargar inmediatamente
  - Mitigación: indicador claro de "disponible localmente" vs "pedir al dueño"
- Enviar a Kindle: el usuario lo hace manualmente (adjuntar EPUB al email)

**Fricción: ★☆☆☆☆** (mínima — pero la experiencia de compartir es manual)

---

## Comparativa

| | Companion (A) | WebRTC (B) | Buzón (C) |
|---|---|---|---|
| Instalar algo extra | Sí (app escritorio) | No | No |
| Ambos online | Sí (para descargar) | Sí (para transferir) | No |
| Descarga directa en-app | Sí | Sí | No (manual) |
| Funciona en móvil | Parcial (companion es desktop) | Sí | Sí |
| Complejidad de implementación | Alta | Media | Baja |
| Cambios en código actual | Moderados | Moderados | Mínimos |
| Archivos en la nube | Nunca | Nunca | Nunca |
| Enviar a Kindle | Automático | Manual | Manual |
| Funciona offline | N/A | Cola de pendientes | Sí (comparte cuando quieras) |

---

## Recomendación: Opción C (Buzón) + elementos de B (WebRTC) como mejora futura

### ¿Por qué?

Para un grupo de 2-5 amigos no técnicos, la prioridad es:
1. **Que funcione ya** — C requiere mínimos cambios al código actual
2. **Que no haya barreras** — nada que instalar, nada que configurar
3. **Que sea natural** — "te paso el libro por WhatsApp" es un gesto que ya hacen

### Roadmap propuesto

```
Fase 1: Modelo Buzón (C)                          ← MVP
├── Migrar almacenamiento de Drive a OPFS/IndexedDB
├── Botón "Compartir" con Web Share API
├── Botón "Pedir libro" con notificación Firebase
├── Zona de importación drag & drop
├── Indicador "lo tengo" / "pedir" en cada libro
└── Exportar/importar paquetes .estanteria

Fase 2: WebRTC opcional (B)                        ← Mejora
├── Transferencia P2P cuando ambos están online
├── Señalización via Firestore
├── Cola de transferencias pendientes
└── Indicador de presencia online

Fase 3: Companion opcional (A)                     ← Power users
├── App de escritorio para quien quiera "modo Plex"
├── Servir EPUBs desde carpeta local
├── Túnel integrado para acceso remoto
└── Enviar a Kindle automático
```

### Impacto en el código actual (Fase 1)

**Archivos a crear:**
- `src/lib/localStore.js` — abstracción OPFS/IndexedDB (~100 LOC)
- `src/components/ShareModal.jsx` — diálogo compartir (~80 LOC)
- `src/components/ImportDrop.jsx` — zona drag & drop (~60 LOC)

**Archivos a modificar:**
- `src/hooks/useBooks.jsx` — cambiar upload de Drive a localStore
- `src/components/UploadModal.jsx` — guardar archivo local
- `src/components/BookModal.jsx` — botones compartir/pedir en vez de descargar

**Archivos a eliminar:**
- `src/lib/googleDrive.js`

**Archivos sin cambios:**
- Todo lo demás (hooks sociales, páginas, componentes UI, Firebase config...)

---

## UX detallado — Fase 1 (Modelo Buzón)

### Subir un libro

Sin cambios aparentes. El usuario elige un EPUB, rellena metadatos, y pulsa "Subir".
La diferencia es interna: el archivo va a OPFS en vez de a Drive.

### Ver un libro en el catálogo

```
┌─────────────────────────────────────┐
│  📖 Rayuela                        │
│  Julio Cortázar                    │
│  ★★★★☆ (3 valoraciones)           │
│                                     │
│  Estado: Leyendo  📖               │
│                                     │
│  ┌─────────────┐ ┌───────────────┐ │
│  │ 📥 Leer     │ │ 📤 Compartir  │ │  ← Si LO TIENES localmente
│  └─────────────┘ └───────────────┘ │
│                                     │
│  — o bien —                         │
│                                     │
│  ┌──────────────────────────────┐  │
│  │ 🔔 Pedir a Ana              │  │  ← Si NO lo tienes
│  └──────────────────────────────┘  │
│  Subido por: Ana · hace 3 días     │
└─────────────────────────────────────┘
```

### Flujo "Pedir libro"

```
Luis pulsa "Pedir a Ana"
    │
    ▼
Firebase: nueva recomendación/solicitud
    │
    ▼
Ana recibe notificación (push o en-app)
    │
    ▼
Ana abre la notificación → ve "Luis quiere Rayuela"
    │
    ▼
Ana pulsa "Compartir" → Web Share API
    │
    ├── WhatsApp → envía EPUB a Luis
    ├── Telegram → envía EPUB a Luis
    ├── AirDrop → envía EPUB a Luis
    ├── Email → adjunta EPUB
    └── Guardar → exporta a disco para enviar como quiera
    │
    ▼
Luis recibe el EPUB por el canal elegido
    │
    ▼
Luis abre la PWA → arrastra el EPUB → se vincula al libro
    │
    ▼
Indicador cambia de "Pedir" a "Leer" ✓
```

### Flujo "Compartir colección"

```
Ana va a una colección → "Ciencia ficción" (12 libros)
    │
    ▼
Pulsa "Exportar colección"
    │
    ▼
Se genera: ciencia-ficcion.estanteria (85 MB)
    (ZIP con 12 EPUBs + metadata.json)
    │
    ▼
Web Share API o descarga directa
    │
    ▼
Luis recibe → arrastra a la PWA → 12 libros importados
```

### Indicadores visuales en el catálogo

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  📖          │  │  📖          │  │  📖     ☁️   │
│  1984        │  │  Rayuela     │  │  Dune        │
│  ★★★★★      │  │  ★★★★☆      │  │  ★★★★☆      │
│  ✅ Local    │  │  ✅ Local    │  │  📋 De Ana   │
└──────────────┘  └──────────────┘  └──────────────┘
  (puedo leer)     (puedo leer)     (puedo pedir)
```

Filtro rápido: **Todos** | **Mis libros** | **Disponibles** | **Por pedir**
