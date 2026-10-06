---
version: alpha
name: "PDF Araçları"
description: "Quiet tool surface inside Yaşar Forum: the forum's own type and neutrals, one violet accent, flat surfaces, short verbs."
colors:
  accent: "#6d28d9"
  accent-hover: "#5b21b6"
  on-accent: "#ffffff"
  accent-dark-theme: "#a78bfa"
  accent-text-dark-theme: "#c4b5fd"
  on-accent-dark-theme: "#1e1033"
  line: "rgba(16, 32, 42, .14)"
  hover: "rgba(16, 32, 42, .05)"
  ink-secondary: "#46545d"
  muted: "#5f6d75"
  ink-secondary-dark-theme: "#c9d0d5"
  muted-dark-theme: "#9aa6ad"
  field-dark-theme: "#2a2b2e"
  danger: "#a4262c"
  danger-dark-theme: "#f28b82"
  success: "#166534"
  success-dark-theme: "#86efac"
typography:
  body:
    fontFamily: "var(--bs-body-font-family) (Inter, set by the forum)"
    fontSize: "14px"
    fontWeight: 400
  title:
    fontFamily: "same"
    fontSize: "28px"
    fontWeight: 700
rounded:
  control: "6-8px"
  container: "10-12px"
---

# PDF Araçları

## Decisions the owner made (keep)

- **Violet accent (#6d28d9, dark theme #c4b5fd).** Chosen by the owner so the tool is told apart in the forum's "Araçlar" menu: Timetable is blue, CV Oluşturucu is green, PDF Araçları is violet. design-mcp flags violet as `ai-purple-primary`; it is waived for this reason.
- **The forum's typeface and neutrals.** The app inherits `--bs-body-font-family` (Inter), `--bs-body-bg`, `--bs-body-color` and `--bs-border-color` so it looks like part of the forum and follows its light and dark themes. `single-typeface`, `generic-typeface` and `cool-grey-neutrals` come from the forum, not from this plugin.
- **Words stay few.** Tool names are one or two words (Birleştir, Böl, Sırala, Küçült). One primary action per screen, kept visible in a sticky bar.

## Layout

Tool list on the left (grouped, current item marked with the accent bar and `aria-current`), the selected tool on the right. On phones the list becomes a select. Every tool follows one flow: drop PDF, adjust, one filled button, result band with Download. Files never leave the device, and the drop zone says so.

## States

Each tool has empty (drop zone), loading ("Açılıyor…"), error (inline, says what happened) and ready (result band) states. Password-protected files ask for the password in place.

## Rules

- Radius by role: 6px inputs, 8px buttons, 10-12px containers.
- Flat: no resting shadows. Notices are full-width bands with a rule, not tinted cards.
- Touch targets 44px on coarse pointers; focus ring in the accent; motion only for state (`prefers-reduced-motion` turns it off).
- "Yakında" labels on unfinished tools are temporary and go away when the tools ship.
