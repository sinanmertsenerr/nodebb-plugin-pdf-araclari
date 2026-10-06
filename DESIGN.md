---
version: alpha
name: "PDF Araçları"
description: "PDF tools inside Yaşar Forum: the forum's own type, neutrals and blue; a familiar document-left, settings-right workspace; short verbs."
colors:
  accent: "#1a73e8"
  accent-hover: "#1765cc"
  on-accent: "#ffffff"
  accent-dark-theme: "#8ab4f8"
  accent-hover-dark-theme: "#aecbfa"
  on-accent-dark-theme: "#0b1b33"
  canvas: "#eef0f2"
  canvas-dark-theme: "#141517"
  field-dark-theme: "#2a2b2e"
  ink-secondary: "#46545d"
  muted: "#5f6d75"
  ink-secondary-dark-theme: "#c9d0d5"
  muted-dark-theme: "#9aa6ad"
  danger: "#a4262c"
  danger-dark-theme: "#f28b82"
  success: "#166534"
  success-dark-theme: "#86efac"
  watermark-grey: "#6b7280"
  watermark-red: "#dc2626"
  watermark-blue: "#2563eb"
  watermark-violet: "#7c3aed"
  watermark-black: "#111827"
typography:
  body:
    fontFamily: "Inter"
    fontSize: "14px"
    fontWeight: 400
  title:
    fontFamily: "Inter"
    fontSize: "28px"
    fontWeight: 700
rounded:
  input: "6px"
  button: "8px"
  option: "10px"
  container: "12px"
---

# PDF Araçları

## Decisions the owner made (keep)

- **The forum's blue (`--yu-solid`, #1a73e8; dark theme #8ab4f8) for actions, like CV Oluşturucu.** Violet stays only on the tool's card in the forum menu (Timetable blue, CV green, PDF violet). design-mcp reads blue on grey as `saas-default-palette`; it is waived because it is the forum's own palette.
- **The forum's typeface and neutrals.** Inter, `--bs-body-bg`, `--bs-body-color` and the sidebar inks come from the forum so the tool looks like part of it, in light and dark. `single-typeface` and `cool-grey-neutrals` are waived for this reason.
- **Home is the short list.** Tools are grouped in bordered boxes (Temel, Dönüştür, Düzenle, Güvenlik, Öğrenci, Tara), each tool one row with a small neutral icon square and its name, balanced in three columns so all tools show without scrolling. The owner picked this from three options in the forum.
- **Words stay few.** Tool names are one or two words; one filled primary action per screen.

## Layout

- **Page shape: guided sequence.** Every tool shows a 1-2-3 step bar (choose file, adjust, download) next to its title; the bar follows the tool's state.
- **Step 1, upload:** a grey area with one large button and "or drag it here"; files never leave the device and the area says so.
- **Step 2, workspace:** the document on the left on the grey canvas (the page at the largest size that fits, or the page grid or file list), the settings panel on the right (file name with "Change", controls, then the main button at the panel's base). The workspace fills the screen; on phones the panel goes under the document and the button sticks to the bottom.
- **Step 3, done:** the panel's base turns into a success line, Download (primary), "Change settings" and "New file".

## Controls

Segmented buttons for two to four short choices (like the CV tool's template switch), option rows with a one-line hint for choices that need explaining, sliders with their value on the right, labels above fields, a submit that stays enabled and says what is missing.

## Rules

- Radius by role: 6px inputs, 8px buttons, 10px option rows and drop areas inside the panel, 12px containers.
- Flat: shadows only on the page sheet in the preview (it sits on the canvas) and on floating toasts.
- Touch targets 44px on coarse pointers; focus ring in the accent; motion only for state, off with `prefers-reduced-motion`.
