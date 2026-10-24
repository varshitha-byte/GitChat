---
name: CodeRAG Assistant
description: Precision developer workbench for codebase RAG and syntax-aware exploration
colors:
  primary: "#f59e0b"
  primary-hover: "#d97706"
  surface-canvas: "#090a0f"
  surface-panel: "#11141d"
  surface-elevated: "#171b26"
  surface-interactive: "#212739"
  border-hairline: "#262d3d"
  border-subtle: "#1c2230"
  text-primary: "#f8fafc"
  text-secondary: "#cbd5e1"
  text-muted: "#94a3b8"
  text-white: "#ffffff"
  text-black: "#000000"
  status-success: "#10b981"
  status-error: "#f43f5e"
  status-info: "#06b6d4"
typography:
  display:
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1.18rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1.08rem"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "-0.01em"
  title:
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.98rem"
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 400
    lineHeight: 1.6
  caption:
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.82rem"
    fontWeight: 500
    lineHeight: 1.45
  code:
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace"
    fontSize: "0.82rem"
    fontWeight: 500
    lineHeight: 1.5
rounded:
  xs: "3px"
  sm: "5px"
  md: "8px"
  lg: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "20px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.text-black}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
---

# Design System: CodeRAG Assistant

## Overview

**Creative North Star: "The Precision Workbench"**

CodeRAG Assistant is designed as an exacting, low-latency developer workstation. Rather than presenting as a conversational gimmick or generic chat card with gratuitous gradients, the interface behaves like an integrated developer tool (in the lineage of JetBrains Fleet, Linear, and GitHub Code Search).

Visual hierarchy is earned through tonal surface planes, disciplined typography, and precise spatial grouping. Color is treated as a scarce, communicative signal: warm instrument amber denotes primary user actions, terminal emerald denotes operational health, and muted slate tones provide clear, readable contrast exceeding WCAG AA standards.

**Key Characteristics:**
- **Zero AI Cliches**: No purple-to-blue linear gradients, no gradient-clipped headline text, and no zero-offset chromatic glow halos.
- **Continuous Tool Panes**: Structural hierarchy is communicated via clean hairline boundaries and tonal contrast, eradicating nested "cards-in-cards".
- **Authentic Engineering Typography**: Powered by Manrope for geometric structural clarity and JetBrains Mono for code telemetry and syntax inspection.
- **Crafted Browser Surfaces**: Tailored selection accents, custom scrollbars, explicit focus rings, and tabular numerals.

## Colors

The palette is rooted in an obsidian carbon ground with warm amber action signals and telemetry indicators.

### Primary
- **Instrument Amber** (`#f59e0b`): The primary active brand cue, reserved for primary commitments, active citation highlights, and focused interactive states. Rarity provides its strength.
- **Deep Amber** (`#d97706`): Hover and pressed states for primary action triggers.

### Neutral
- **Canvas Base** (`#090a0f`): Root foundation under the application layout.
- **Panel Surface** (`#11141d`): Primary container ground for sidebar, chat stream, and code inspector.
- **Elevated Control Ground** (`#171b26`): Input trays, interactive chips, and code snippet containers.
- **Interactive State Ground** (`#212739`): Hovered file tree rows, active tabs, and pressed chips.
- **Hairline Border** (`#262d3d`): Crisp 1px structural separators between panes and controls.
- **Text Primary** (`#f8fafc`): Uncompromised, crisp white body and headline tone (>14:1 contrast).
- **Text Secondary** (`#cbd5e1`): Secondary descriptions, prompts, and breadcrumbs (>9:1 contrast).
- **Text Muted** (`#94a3b8`): Metadata labels, line numbers, and timestamps strictly tuned to exceed WCAG AA 4.5:1.

### Named Rules
**The Rarity of Amber Rule.** The primary amber accent is applied to less than 5% of any view. It denotes interactive intentionality (send actions, selected repo, highlighted code range). It is never used as decorative wallpaper.

## Typography

**Display / UI Font:** 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif  
**Code & Data Font:** 'JetBrains Mono', 'Fira Code', monospace with `font-variant-numeric: tabular-nums`

**Character:** Modern geometric precision paired with monospace legibility.

### Hierarchy
- **Display / App Title** (700 weight, 1.18rem, line-height 1.3, letter-spacing -0.02em): Top brand anchor.
- **Section Heading** (700 weight, 1.08rem, line-height 1.35): Sidebar modules and inspector headers.
- **Subheading / Card Title** (700 weight, 0.98rem, line-height 1.4): Module subsections.
- **Body Text** (400 weight, 0.9rem, line-height 1.6): Assistant answers and documentation prose.
- **Caption / Meta** (500 weight, 0.82rem, line-height 1.45): Secondary descriptions, hints, and badges.
- **Code & Citations** (500 weight, 0.82rem, line-height 1.5): File paths, line numbers, syntax blocks.

### Named Rules
**The Solid Text Rule.** Gradient fills and clip masks on text are strictly forbidden. Text carries meaning through size, weight, and contrast.

## Layout

A three-column workstation with fixed header:
- **Left Sidebar (320px width)**: Continuous toolpane containing codebase ingestion, repository selector, telemetry stats, and repository tree.
- **Center Query Pane (flexible width, min 480px)**: Conversation stream with recommended prompt chips and a pinned ergonomic input dock.
- **Right Code Inspector (flexible width, min 420px)**: Live source code viewer with synchronized line-number highlight gutter and single-click copy action.

## Elevation & Depth

Surfaces are flat and tonal by default. Depth is conveyed through background luminance stepping (`#090a0f` -> `#11141d` -> `#171b26`) and 1px crisp borders.

### Shadow Vocabulary
- **Modal Overlay Elevation** (`box-shadow: 0 12px 36px rgba(0, 0, 0, 0.65)`): Applied exclusively to floating modal dialogs.
- **No Chromatic Halos**: Colored blur halos (`box-shadow: 0 0 Xpx var(--accent)`) are prohibited.

## Shapes

- **Badges & Micro Chips**: 3px (`var(--radius-xs)`) and 5px (`var(--radius-sm)`) corners.
- **Controls & Buttons**: 8px (`var(--radius-md)`) corners.
- **Panels & Overlays**: 12px (`var(--radius-lg)`) corners.
- **Pills**: 9999px (`var(--radius-full)`) for status pills.

## Components

### Buttons
- **Primary**: Solid Instrument Amber background (`#f59e0b`), dark carbon text (`#090a0f`), weight 600, padding 8px 14px.
- **Secondary / Ghost**: Hairline border (`#262d3d`), surface ground (`#171b26`), text (`#f8fafc`), hover background (`#212739`).

### Citations & Prompt Chips
- Tactile pill containers with 1px border (`#262d3d`), subtle hover lift, and explicit focus rings.

### Code Viewer
- Gutter with right-aligned tabular numerals (`#94a3b8`).
- Selected line highlighting uses full-width background tint (`rgba(245, 158, 11, 0.12)`) without exaggerated vertical border stripes.

## Do's and Don'ts

### Do:
- **Do** maintain a minimum contrast ratio of 4.5:1 on all text and form placeholders.
- **Do** style browser surfaces including `::selection`, `caret-color`, and custom scrollbars.
- **Do** use `font-variant-numeric: tabular-nums` for line numbers, metrics, and timestamps.
- **Do** provide clear `:focus-visible` styling on all interactive elements.

### Don't:
- **Don't** use purple/violet gradients or neon cyan chromatic halos.
- **Don't** use gradient text (`background-clip: text`).
- **Don't** nest cards within cards in the sidebar.
- **Don't** use 3px colored left borders on alerts, cards, or code lines.
- **Don't** use font sizes below 11px for functional UI text.
