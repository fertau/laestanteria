# La Estantería — Diseño Self-Hosting

## Contexto

Actualmente la app depende de:
- **Vercel** para servir el frontend
- **Firebase** (Firestore, Auth, Cloud Functions) como backend
- **Google Drive** como almacenamiento de archivos EPUB
- **Google OAuth** como sistema de autenticación

El objetivo es eliminar la dependencia de hosting externo y permitir que cualquier persona ejecute su propia instancia en su máquina o servidor personal.

---

## Arquitectura Propuesta: Instancia Local + Federación Ligera

### Principio central

> Cada usuario (o grupo pequeño) ejecuta su propia instancia.
> Las instancias se descubren y conectan entre sí para compartir.

```
┌─────────────────┐         ┌─────────────────┐
│  Instancia Ana  │◄───────►│  Instancia Luis │
│                 │         │                 │
│  SQLite local   │         │  SQLite local   │
│  EPUBs en disco │         │  EPUBs en disco │
│  UI en :3000    │         │  UI en :3000    │
└────────┬────────┘         └────────┬────────┘
         │                           │
         └──────────┬────────────────┘
                    │
           ┌────────▼────────┐
           │  Instancia Marta│
           │  (otro nodo)    │
           └─────────────────┘
```

---

## Stack Técnico

| Componente | Actual | Self-hosted |
|---|---|---|
| Frontend | React + Vite (Vercel) | React + Vite (servido localmente) |
| Backend | Firebase Cloud Functions | **Servidor Express/Fastify** integrado |
| Base de datos | Firestore | **SQLite** (archivo local) |
| Almacenamiento | Google Drive | **Sistema de archivos local** |
| Autenticación | Firebase Auth (Google) | **Passkey / contraseña local** |
| Comunicación entre nodos | N/A | **API REST + tokens firmados** |

### ¿Por qué SQLite?

- Sin dependencias externas (un solo archivo `.db`)
- Rendimiento excelente para el volumen de datos de una biblioteca personal
- Backups triviales (copiar el archivo)
- Migraciones simples con `better-sqlite3` o `drizzle-orm`

### Ejecutable único

La app se distribuiría como un **binario único** (vía `pkg`, Docker, o script de instalación):

```bash
# Opción 1: Docker
docker run -p 3000:3000 -v ~/mi-biblioteca:/data laestanteria

# Opción 2: Binario nativo
./laestanteria --port 3000 --data ~/mi-biblioteca

# Opción 3: npm
npx laestanteria
```

Los EPUBs y la base de datos vivirían en un directorio configurable (`/data` o `~/mi-biblioteca`).

---

## Modelos de Uso

### Modelo A: Personal (un usuario)

```
Usuario → localhost:3000 → su propia biblioteca
```

- Sin autenticación (o PIN opcional)
- Todos los libros son privados
- Funciona 100% offline
- Ideal para gestión personal de ebooks

### Modelo B: Grupo local (LAN/hogar)

```
Varios dispositivos → 192.168.1.X:3000 → biblioteca compartida
```

- Un dispositivo actúa como servidor (NAS, Raspberry Pi, PC siempre encendido)
- Usuarios del hogar acceden vía red local
- Autenticación simple (usuario + contraseña)
- Todos los usuarios del grupo ven la misma biblioteca

### Modelo C: Grupo distribuido (Internet) — Federación

```
Ana (ana.duckdns.org) ◄──► Luis (luis.tailscale.net)
                       ▲
                       │
                  Marta (IP directa + puerto)
```

Este es el modelo que reemplaza la funcionalidad social actual. Se detalla a continuación.

---

## Sistema de Compartir: Federación Ligera

### Concepto

Cada instancia expone una **API pública limitada** que permite:
1. Descubrirse mutuamente
2. Intercambiar catálogos (metadatos, no archivos)
3. Solicitar descargas de libros específicos

### Flujo de conexión entre instancias

```
1. Ana quiere conectar con Luis
   Ana introduce la URL de Luis: luis.tailscale.net:3000

2. La instancia de Ana envía solicitud de conexión
   POST luis.tailscale.net:3000/api/federation/request
   { "from": "ana.duckdns.org:3000", "displayName": "Ana", "message": "¡Hola!" }

3. Luis ve la solicitud en su panel de Notificaciones
   → Acepta con nivel de acceso: "catálogo" o "catálogo + descarga"

4. Se intercambian tokens firmados (JWT o similar)
   Ambas instancias guardan la relación en su SQLite local

5. La instancia de Ana sincroniza periódicamente el catálogo de Luis
   GET luis.tailscale.net:3000/api/federation/catalog
   Headers: { Authorization: "Bearer <token>" }

6. Ana ve los libros de Luis en su interfaz, marcados como "remotos"
   Si quiere descargar uno:
   GET luis.tailscale.net:3000/api/federation/download/:bookId
```

### Niveles de acceso (equivalentes al sistema actual)

| Nivel actual | Equivalente self-hosted |
|---|---|
| `activity` | **Catálogo**: ver títulos, autores, portadas, valoraciones |
| `library` | **Catálogo + Descarga**: además puede descargar EPUBs |

### Experiencia de usuario

#### Pantalla "Personas" → "Instancias conectadas"

```
┌─────────────────────────────────────────────┐
│  Instancias conectadas                      │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │ 🟢 Luis — luis.tailscale.net        │    │
│  │    234 libros · catálogo + descarga │    │
│  │    Última sync: hace 5 min          │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │ 🔴 Marta — 85.123.45.67:3000       │    │
│  │    189 libros · solo catálogo       │    │
│  │    Offline desde: ayer              │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  [+ Conectar nueva instancia]               │
│                                             │
│  Enlace de invitación: (copiar)             │
│  laestanteria://connect?host=ana.duckdns... │
└─────────────────────────────────────────────┘
```

#### Catálogo unificado

Los libros de instancias remotas aparecen integrados en el catálogo principal, con un indicador visual:

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  📖          │  │  📖          │  │  📖     🌐   │ ← icono "remoto"
│  Don Quijote │  │  1984        │  │  Rayuela     │
│  ★★★★☆      │  │  ★★★★★      │  │  ★★★★☆      │
│  (mío)       │  │  (mío)       │  │  de: Luis    │
└──────────────┘  └──────────────┘  └──────────────┘
```

Filtros adicionales en el catálogo:
- **Todos** | **Mis libros** | **De Luis** | **De Marta**

Al abrir un libro remoto:
- Se muestra metadatos cacheados localmente
- Botón "Descargar" (si tiene permiso) → descarga el EPUB a la instancia local
- Una vez descargado, se convierte en libro local (copia propia)

---

## Conectividad: Opciones para usuarios no técnicos

El mayor reto del self-hosting es la accesibilidad de red. Propuestas por orden de facilidad:

### 1. Tailscale / ZeroTier (recomendado)

- Crea una red privada virtual entre dispositivos
- Sin abrir puertos, sin configurar router
- Gratis para uso personal
- El usuario instala Tailscale → obtiene una IP estable tipo `100.x.x.x`
- La app podría integrar un tutorial paso a paso

```
Paso 1: Instala Tailscale → tailscale.com
Paso 2: Comparte tu dirección Tailscale con tus amigos
Paso 3: Conéctate a su instancia desde "Personas"
```

### 2. Túnel Cloudflare (zero-config público)

- `cloudflared tunnel` expone localhost a una URL pública
- Sin abrir puertos
- Gratis
- Más frágil que Tailscale pero más inmediato

### 3. DuckDNS + UPnP / Port forwarding manual

- Para usuarios que controlan su router
- DuckDNS da un subdominio gratuito apuntando a su IP dinámica

### 4. Modo "buzón" (compartir offline)

- Exportar un libro o colección como archivo `.estanteria` (ZIP con EPUB + metadatos JSON)
- Enviarlo por cualquier medio (email, WhatsApp, USB...)
- El receptor lo importa en su instancia
- No requiere conectividad entre instancias

```
[Exportar selección] → genera: mis-recomendaciones.estanteria (45 MB)
[Importar paquete]   → arrastra el archivo → libros añadidos
```

---

## Funcionalidades sociales adaptadas

| Feature actual | Adaptación self-hosted |
|---|---|
| Seguir usuario | **Conectar instancia** (bidireccional con aprobación) |
| Feed de actividad | **Sync de actividad** entre instancias conectadas |
| Recomendaciones | **Mensaje con libro adjunto** entre instancias |
| Códigos de invitación | **Enlace de conexión** (`laestanteria://connect?host=...&token=...`) |
| Privacidad open/closed | **Aprobación manual** de solicitudes de conexión |
| Enviar a Kindle | Se mantiene igual (SMTP desde el servidor local) |
| Digest semanal | Se mantiene (cron job local con `node-cron`) |

---

## Migración desde la versión actual

Para usuarios existentes, se ofrecería una herramienta de migración:

```bash
laestanteria migrate --from-firebase
```

1. Exporta todos los libros de Firestore → SQLite
2. Descarga EPUBs de Google Drive → directorio local
3. Exporta perfil, valoraciones, estados de lectura, colecciones
4. Genera configuración local

---

## Resumen de beneficios

| Aspecto | Con hosting | Self-hosted |
|---|---|---|
| Coste | Firebase gratuito limitado, Vercel gratuito limitado | 0€ (tu propio hardware) |
| Privacidad | Datos en Google Cloud | Datos en tu disco |
| Control | Dependencia de servicios externos | 100% tuyo |
| Disponibilidad | 99.9% (cloud) | Depende de tu hardware |
| Escalabilidad | Limitada por plan gratuito | Ilimitada en tu red |
| Complejidad inicial | Baja (click y usar) | Media (instalar + configurar red) |
| Compartir | Inmediato (misma plataforma) | Requiere configurar conexión |

---

## Fases de implementación sugeridas

### Fase 1: Core local
- Servidor Express/Fastify sirviendo el frontend
- SQLite como base de datos
- EPUBs en sistema de archivos local
- Autenticación local (sin OAuth externo)
- Funcionalidad completa para un solo usuario

### Fase 2: Multi-usuario local
- Soporte para múltiples cuentas en la misma instancia
- Roles (admin/usuario)
- Ideal para familia/hogar compartiendo un servidor

### Fase 3: Federación
- API de federación entre instancias
- Sincronización de catálogos
- Descarga entre instancias
- Actividad y recomendaciones distribuidas

### Fase 4: Calidad de vida
- Empaquetado como Docker / binario único
- Modo "buzón" para compartir offline
- Integración con Tailscale
- Tutorial de configuración integrado en la app
- Herramienta de migración desde Firebase

---

## Preguntas abiertas

1. **¿Mantener compatibilidad con Firebase como opción?** (modo hybrid: self-hosted + cloud sync)
2. **¿Priorizar Docker o binario nativo?** (Docker es más portable, binario es más simple)
3. **¿La federación debería ser bidireccional obligatoria?** (actualmente los follows son unidireccionales)
4. **¿Merece la pena un protocolo estándar como OPDS?** (compatibilidad con lectores como Calibre-web, KOReader)
