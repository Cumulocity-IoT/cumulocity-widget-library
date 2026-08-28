/*
 * Copyright (c) 2026 Cumulocity GmbH.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

export const FLEET_STATISTICS_PREVIEW = 'data:image/svg+xml;utf8,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 250" width="100%" height="100%">
  <rect width="400" height="250" fill="#f8fafc" rx="8" />
  
  <!-- Header / Title -->
  <rect x="20" y="20" width="160" height="14" rx="4" fill="#cbd5e1" />
  <rect x="20" y="42" width="100" height="10" rx="3" fill="#e2e8f0" />
  
  <!-- Badge -->
  <rect x="300" y="20" width="80" height="22" rx="11" fill="#e0f2fe" />
  <text x="340" y="35" font-size="11" fill="#0284c7" font-family="sans-serif" font-weight="bold" text-anchor="middle">1,248 Devices</text>
  
  <!-- Donut Chart -->
  <g transform="translate(140, 140)">
    <!-- Slice 1: v2.4.0 (42%) -->
    <path d="M 0,-70 A 70,70 0 0,1 66,22 L 38,13 A 40,40 0 0,0 0,-40 Z" fill="#1776bf" />
    
    <!-- Slice 2: v2.3.1 (28%) -->
    <path d="M 66,22 A 70,70 0 0,1 -41,56 L -23,32 A 40,40 0 0,0 38,13 Z" fill="#38bdf8" />
    
    <!-- Slice 3: v2.2.0 (18%) -->
    <path d="M -41,56 A 70,70 0 0,1 -66,-22 L -38,-13 A 40,40 0 0,0 -23,32 Z" fill="#f59e0b" />
    
    <!-- Slice 4: Other (12%) -->
    <path d="M -66,-22 A 70,70 0 0,1 0,-70 L 0,-40 A 40,40 0 0,0 -38,-13 Z" fill="#94a3b8" />
    
    <!-- Center hole with text -->
    <circle cx="0" cy="0" r="36" fill="#ffffff" />
    <text x="0" y="-4" font-size="12" fill="#64748b" font-family="sans-serif" text-anchor="middle">Total</text>
    <text x="0" y="14" font-size="15" fill="#1e293b" font-family="sans-serif" font-weight="bold" text-anchor="middle">100%</text>
  </g>
  
  <!-- Legend items -->
  <g transform="translate(250, 95)">
    <!-- Item 1 -->
    <rect x="0" y="0" width="12" height="12" rx="3" fill="#1776bf" />
    <text x="20" y="10" font-size="11" fill="#334155" font-family="sans-serif" font-weight="600">v2.4.0 (42%)</text>
    
    <!-- Item 2 -->
    <rect x="0" y="24" width="12" height="12" rx="3" fill="#38bdf8" />
    <text x="20" y="34" font-size="11" fill="#334155" font-family="sans-serif" font-weight="600">v2.3.1 (28%)</text>
    
    <!-- Item 3 -->
    <rect x="0" y="48" width="12" height="12" rx="3" fill="#f59e0b" />
    <text x="20" y="58" font-size="11" fill="#334155" font-family="sans-serif" font-weight="600">v2.2.0 (18%)</text>
    
    <!-- Item 4 -->
    <rect x="0" y="72" width="12" height="12" rx="3" fill="#94a3b8" />
    <text x="20" y="82" font-size="11" fill="#334155" font-family="sans-serif" font-weight="600">Other (12%)</text>
  </g>
</svg>
`);
