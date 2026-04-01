# Design System — Trucapp

## Product Context
- **What this is:** A truco match scoring companion app — not a game you play on the phone, but a tool for tracking real-world card games at asados and juntadas.
- **Who it's for:** Friend groups in Argentina who play truco regularly and want to track scores, history, and rivalry stats.
- **Space/industry:** Card game scoring, social sports tracking. Peers: Apple Sports, Scory, Gran Truco Argentino.
- **Project type:** Mobile-first web app (React + Vite + Tailwind, deployed to Vercel).

## Aesthetic Direction
- **Direction:** Cancha Limpia Warm — clean scoreboard core with warm palette. Data-forward, minimal decoration.
- **Decoration level:** Minimal — tally marks and team colors do the visual work. No textures, no glassmorphism, no gradients.
- **Mood:** A well-lit bar, not a server room. Clean and functional but warm and inviting. The kind of object you're proud to pull out at the table.
- **Key feature:** 5-stick tally marks (palitos) are the hero score display. 4 vertical lines + 1 diagonal = 5. Numeric scores are secondary and toggleable (show/hide).

## Typography
- **Display/Hero:** DM Sans 900 — used for score numbers. Large, bold, high contrast.
- **Body:** DM Sans 400 — clean, readable, neutral.
- **UI/Labels:** DM Sans 600-700 — uppercase with letter-spacing for labels and section headers.
- **Data/Tables:** DM Sans 700 (supports tabular-nums via font-variant-numeric: tabular-nums).
- **Code:** Not applicable.
- **Loading:** Google Fonts CDN: `https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;900&display=swap`
- **Scale:**
  - Caption: 11px / 700 / uppercase / 0.1em tracking
  - Label: 13px / 600 / uppercase / 0.04em tracking
  - Body: 14px / 400
  - Heading: 18px / 700
  - Score Display: 56-96px / 900 / -2px tracking

## Color
- **Approach:** Restrained — team colors (green/amber) are the only chromatic elements. Everything else is warm neutrals.
- **Background:** `#181614` — warm near-black
- **Surface:** `#231f1c` — warm dark brown (cards, panels)
- **Surface Elevated:** `#2e2926` — hover states, modals
- **Border:** `#3a3430` — warm border, subtle separation
- **Text Primary:** `#f0ebe5` — warm off-white (not blue-white)
- **Text Secondary:** `#9a8e82` — muted warm gray
- **Text Muted:** `#5c534a` — very subtle, captions
- **Nosotros (Team Green):** `#4ade80` — emerald green, used for team identity, tally marks, buttons, stats
- **Ellos (Team Amber):** `#fbbf24` — amber/gold, used for team identity, tally marks, buttons, stats
- **Accent:** `#4ade80` — same as Nosotros (primary action color)
- **Danger:** `#ef4444` — errors, destructive actions, match end
- **Success:** `#4ade80` — reuses Nosotros green
- **Warning:** `#fbbf24` — reuses Ellos amber
- **Dark mode:** This IS the dark mode. No light mode variant.

## Spacing
- **Base unit:** 8px
- **Density:** Comfortable — generous touch targets for use during games (greasy fingers, passing phone around)
- **Scale:** 2xs(2px) xs(4px) sm(8px) md(16px) lg(24px) xl(32px) 2xl(48px) 3xl(64px)

## Layout
- **Approach:** Grid-disciplined — predictable, consistent alignment. Mobile-first single column.
- **Grid:** Single column on mobile (primary target). No multi-column layouts.
- **Max content width:** 420px (phone-optimized)
- **Border radius:**
  - sm: 4px (inputs, small elements)
  - md: 8px (cards, buttons, panels)
  - lg: 16px (modals, bottom sheets)
  - full: 9999px (pills, toggles)

## Motion
- **Approach:** Minimal-functional — only transitions that aid comprehension.
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out)
- **Duration:** micro(50-100ms) short(150-250ms) medium(250-400ms)
- **Key animations:**
  - New tally mark: draw-in stroke animation (150ms ease-out)
  - Score toggle: height + opacity transition (250ms ease-in-out)
  - Score increment: subtle scale pulse (100ms)
  - Page transitions: slide (200ms ease-out)

## Tally Mark System
- **Structure:** Groups of 5 (4 vertical + 1 diagonal). Partial groups show individual sticks.
- **Stick dimensions:** 3px wide, 48px tall, 1.5px border-radius
- **Diagonal:** Crosses all 4 verticals at ~30deg angle
- **Group spacing:** 16px between complete groups
- **Stick spacing:** 10px between sticks within a group
- **Colors:** All tally marks use `#f0ebe5` (text primary) regardless of team. Team differentiation comes from layout position and labels, not tally color.
- **Animation:** New sticks draw in from bottom (stroke animation, 150ms)

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-31 | Initial design system: Cancha Limpia Warm | Clean scoreboard base + warm palette. Tally marks as hero element. Created by /design-consultation. |
| 2026-03-31 | DM Sans as sole typeface | One font family = zero cognitive load. 900 weight for scores, 400 for body. |
| 2026-03-31 | Warm neutrals over cold grays | App is used at social gatherings (asados). Warm colors feel inviting, cold feels clinical. |
| 2026-03-31 | Tally marks as primary score display | Traditional Argentine scoring method (palitos). More visually distinctive than plain numbers. Numbers toggleable. |
| 2026-03-31 | No light mode | Truco is often played at night. Dark mode is the only mode. |
