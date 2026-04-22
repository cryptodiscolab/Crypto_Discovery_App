---
version: 1.0.0
name: Crypto Disco DailyApp - Midnight Cyber Spec
description: A premium, AI-native design system for Web3 agents, featuring high-contrast dark modes and glassmorphism.
colors:
  background:
    primary: "#050505"
    secondary: "#0a0a0a"
    accent: "rgba(59, 130, 246, 0.1)" # primary-500 with low opacity
  text:
    primary: "#f1f5f9"
    secondary: "#94a3b8"
    accent: "#3b82f6"
  brand:
    primary: "#3b82f6"
    secondary: "#0ea5e9"
    success: "#10b981"
    error: "#ef4444"
    warning: "#f59e0b"
typography:
  family:
    sans: "Inter, system-ui, sans-serif"
    mono: "Fira Code, monospace"
    heading: "Orbitron, sans-serif"
  size:
    base: "16px"
    h1: "2.5rem"
    h2: "2rem"
    h3: "1.5rem"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "24px"
spacing:
  unit: 4
  base: 16
components:
  card:
    background: "rgba(255, 255, 255, 0.03)"
    border: "1px solid rgba(255, 255, 255, 0.08)"
    blur: "12px"
  button:
    primary:
      bg: "#3b82f6"
      text: "#ffffff"
    glass:
      bg: "rgba(255, 255, 255, 0.05)"
      border: "1px solid rgba(255, 255, 255, 0.1)"
---

# Design Specification

This document provides the visual identity and engineering standards for the Crypto Disco DailyApp ecosystem.

## Overview
The "Midnight Cyber" aesthetic is designed for maximum clarity in high-density data environments (Calculators, Arbitrage Bots, Raffle Dashboards). It prioritizes **Night-First** readability, **Glassmorphism** for depth, and **Neon Accents** for call-to-actions.

## Core Principles
1. **Rationale-First**: Every design decision MUST have a functional reason. No decorative elements without purpose.
2. **Infinite Depth**: Use varying levels of card opacity and backdrop blurs to create a spatial hierarchy.
3. **Cyber-Tactile**: Interactive elements should feel alive through micro-animations and subtle glows.

## Component Guidelines

### Meteora Bot Dashboard
- **Real-time Feeds**: Use high-contrast monospace (Fira Code) for price data.
- **Status Indicators**: Pulse animations for "Live" states (Primary color for active, Grayscale for idle).
- **Control Panels**: Glassmorphic "Control Pods" with 1px borders to simulate a cockpit feel.

### Raffle Frontend
- **Ticket Visuals**: Use vibrant gradients (`#3b82f6` to `#0ea5e9`) to make reward elements feel "premium".
- **Interaction**: Buttons must have a `:hover` scaling effect (1.02x) and a primary-colored shadow.

## Do's and Don'ts
- **DO** use `backdrop-filter: blur(12px)` for all overlay elements.
- **DO** use `!important` sparingly, prioritize the Tailwind utility layer.
- **DON'T** use pure white (`#ffffff`) for body text; use Slate-100 (`#f1f5f9`).
- **DON'T** use flat, opaque backgrounds for desktop components.
