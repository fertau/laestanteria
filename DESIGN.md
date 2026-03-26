# Design System — La Estanteria

## Product Context
- **What this is:** Biblioteca personal entre amigos — importa EPUBs, manda a Kindle, pedi prestado
- **Who it's for:** Lectores que comparten libros con amigos cercanos (bonds)
- **Space/industry:** Book tracking / library management (alternativa a Goodreads, StoryGraph, Hardcover)
- **Project type:** Web app (PWA)

## Aesthetic Direction
- **Direction:** Luxury/Refined con warmth
- **Decoration level:** Intentional — glow calido en elementos activos, sutil grain en surfaces
- **Mood:** Libreria de barrio a la noche, con luz calida. Sofisticado y clasico, no vintage.
- **Differentiation:** Unica app de libros con dark theme calido. Todos los competidores usan fondos claros y sans-serif genericos.

## Typography
- **Display/Hero:** Instrument Serif — sofisticada, contemporanea, con calidez editorial. Para titulos de pagina, hero, nombres de libros en modales.
- **Body:** DM Sans — legible, moderno, buen complemento del serif. Para texto general, botones, labels, descripciones.
- **UI/Labels:** Same as body (DM Sans)
- **Data/Tables:** Geist Mono — tabular-nums, limpio. Para stats, contadores, metadata tecnica.
- **Code:** Geist Mono
- **Loading:** Google Fonts via `<link>` con `display=swap` y `preconnect`
- **Scale:**
  - xs: 11px
  - sm: 13px
  - base: 14px
  - md: 16px
  - lg: 18px
  - xl: 22px
  - 2xl: 28px
  - 3xl: 36px

## Color
- **Approach:** Restrained — 1 accent + warm neutrals, color is rare and meaningful
- **Background:** #0f0c08
- **Surface:** #16120e
- **Surface hover:** #1e1914
- **Accent:** #C17B3F — amber/dorado, es el alma de la app
- **Accent hover:** #d4904f
- **Accent warm:** #D4944F — para hover states mas calidos
- **Accent glow:** rgba(193, 123, 63, 0.15)
- **Accent soft:** rgba(193, 123, 63, 0.08)
- **Text:** #e8dcc8
- **Text muted:** #8a7a66
- **Text dim:** #6a5a46
- **Border:** #2a2218
- **Semantic:** success #27ae60, warning #C17B3F (reuse accent), error #c0392b, info #2980b9
- **Dark mode:** N/A — la app es dark-only por identidad

## Spacing
- **Base unit:** 8px (with 4px half-step)
- **Density:** Comfortable
- **Scale:** xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48) 3xl(64)

## Layout
- **Approach:** Grid-disciplined — cards de libros en grid responsive
- **Grid:** auto-fill, minmax(145px, 1fr)
- **Max content width:** 960px
- **Border radius:** sm:4px, md:8px (--radius), lg:12px (--radius-lg), xl:16px (--radius-xl)

## Motion
- **Approach:** Minimal-functional — solo transiciones de estado
- **Easing:** ease (0.2s default)
- **Duration:** micro(100ms) short(200ms) medium(300ms)

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-26 | Initial design system | Created by /design-consultation. Competitive research showed all book apps use light themes + generic sans-serif. La Estanteria's dark warm palette + Instrument Serif serif gives it unique identity. |
| 2026-03-26 | Instrument Serif for display | User wanted sophisticated + classic, not vintage. Instrument Serif is contemporary editorial serif that pairs well with the warm amber palette. |
| 2026-03-26 | No light mode | Deliberate risk — dark-only identity. Coherent with the "libreria de barrio a la noche" mood. |
