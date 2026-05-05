---
version: alpha
name: 建設AI会議室 (Multi-Agent)
description: "A dense three-column dashboard for multi-agent AI discussion — PM/CFO/COO/CEO roles. Inspired by Linear's dark-canvas discipline but adapted to light mode (#f1f5f9 canvas) with blue accent (#3b82f6). Outfit/Inter at -0.005em body tracking and -0.025em heading tracking. Role colors are load-bearing: PM=sky, CFO=emerald, COO=amber, CEO=violet. Cards use existing --border token with 1px borders. Dark mode via data-theme='dark' inverts to navy (#0f172a). Three-column grid: sidebar (250px) + main (flex) + panel (300px)."

colors:
  primary: "#3b82f6"
  on-primary: "#ffffff"
  primary-dark: "#60a5fa"
  ink: "#0f172a"
  ink-muted: "#64748b"
  canvas: "#f1f5f9"
  surface: "#ffffff"
  border: "#e2e8f0"
  role-pm: "#0ea5e9"
  role-cfo: "#10b981"
  role-coo: "#f59e0b"
  role-ceo: "#8b5cf6"
  canvas-dark: "#0f172a"
  surface-dark: "#1e293b"
  border-dark: "#334155"

typography:
  display:
    fontFamily: "Outfit, Inter, -apple-system, sans-serif"
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.20
    letterSpacing: -0.03em
  headline:
    fontFamily: "Outfit, Inter, -apple-system, sans-serif"
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: -0.025em
  body:
    fontFamily: "Outfit, Inter, -apple-system, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.50
    letterSpacing: -0.005em
  caption:
    fontFamily: "Outfit, Inter, -apple-system, sans-serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.40
    letterSpacing: 0

rounded:
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px

components:
  header:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.border}"
    height: 64px
  card:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.border}"
    border: "1px solid"
    rounded: "{rounded.lg}"
  role-badge-pm:
    backgroundColor: "#e0f2fe"
    textColor: "{colors.role-pm}"
    rounded: "{rounded.pill}"
  role-badge-cfo:
    backgroundColor: "#d1fae5"
    textColor: "{colors.role-cfo}"
    rounded: "{rounded.pill}"
  role-badge-coo:
    backgroundColor: "#fef3c7"
    textColor: "{colors.role-coo}"
    rounded: "{rounded.pill}"
  role-badge-ceo:
    backgroundColor: "#ede9fe"
    textColor: "{colors.role-ceo}"
    rounded: "{rounded.pill}"
---

## Overview

建設AI会議室は建設プロジェクトのAI多角意思決定ツール。Three-column grid layout with persistent sidebar (org chart) and right panel (discussion history). Role colors are semantic and must remain consistent across all views.

**Key Characteristics:**
- Light slate canvas (#f1f5f9), dark mode via data-theme='dark'.
- Outfit/Inter with -0.025em heading tracking.
- Role colors (PM/CFO/COO/CEO) are non-negotiable brand elements.
- Dense information layout — readability over whitespace.
