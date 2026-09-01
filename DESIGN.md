# Fleek IPRS — Design System

**Version:** 1.0  
**Date:** 2026-08-31  
**Brand:** Fleektech LTD (fleektech.co.ke)

---

## 1. Color System

### Primary Brand Colors
| Name | Hex | Usage |
|------|-----|-------|
| Navy 950 | `#0A1628` | Primary background, headers, sidebar |
| Navy 900 | `#0C1D36` | Card backgrounds, secondary surfaces |
| Navy 800 | `#122945` | Hover states, borders |
| Navy 700 | `#1A3A5C` | Subtle accents |
| Teal 500 | `#00D9B5` | Primary CTAs, links, active states |
| Teal 400 | `#33E0C4` | Hover states, focus rings |
| Teal 600 | `#00AE96` | Pressed states |

### Semantic Colors
| Name | Light | Dark | Usage |
|------|-------|------|-------|
| Success | `#059669` | `#10B981` | Success badges, positive amounts |
| Warning | `#D97706` | `#F59E0B` | Pending, not_found, backup |
| Error | `#DC2626` | `#EF4444` | Failed, danger actions |
| Info | `#2563EB` | `#3B82F6` | Info badges, links |

### Neutral Scale (Light Mode)
| Name | Hex | Usage |
|------|-----|-------|
| Slate 50 | `#F8FAFC` | Page background |
| Slate 100 | `#F1F5F9` | Card backgrounds |
| Slate 200 | `#E2E8F0` | Borders, dividers |
| Slate 300 | `#CBD5E1` | Input borders, disabled |
| Slate 400 | `#94A3B8` | Placeholder text |
| Slate 500 | `#64748B` | Secondary text |
| Slate 600 | `#475569` | Body text |
| Slate 700 | `#334155` | Headings |
| Slate 800 | `#1E293B` | Primary text |
| Slate 900 | `#0F172A` | High contrast text |

---

## 2. Typography

### Font Families
| Role | Font | Fallback |
|------|------|----------|
| Headlines | `Spline Sans` | `Inter`, `system-ui` |
| Body | `Manrope` | `Inter`, `system-ui` |
| Labels/UI | `Manrope` | `Inter`, `system-ui` |
| Mono | `JetBrains Mono` | `Fira Code`, `monospace` |

### Type Scale
| Level | Size | Weight | Line Height | Letter Spacing |
|-------|------|--------|-------------|----------------|
| Display XL | 48px / 3rem | 700 | 1.1 | -0.02em |
| Display LG | 36px / 2.25rem | 700 | 1.15 | -0.01em |
| Display MD | 30px / 1.875rem | 600 | 1.2 | -0.01em |
| Heading 1 | 24px / 1.5rem | 700 | 1.3 | 0 |
| Heading 2 | 20px / 1.25rem | 600 | 1.35 | 0 |
| Heading 3 | 18px / 1.125rem | 600 | 1.4 | 0 |
| Body LG | 18px / 1.125rem | 400 | 1.6 | 0 |
| Body MD | 16px / 1rem | 400 | 1.6 | 0 |
| Body SM | 14px / 0.875rem | 400 | 1.5 | 0 |
| Label LG | 14px / 0.875rem | 500 | 1.5 | 0.01em |
| Label MD | 13px / 0.8125rem | 500 | 1.5 | 0.01em |
| Label SM | 12px / 0.75rem | 500 | 1.4 | 0.02em |
| Caption | 12px / 0.75rem | 400 | 1.4 | 0.01em |
| Mono MD | 14px / 0.875rem | 400 | 1.6 | 0 |
| Mono SM | 12px / 0.75rem | 400 | 1.5 | 0 |

---

## 3. Spacing System

### Base Unit: 4px
| Token | Value | Usage |
|-------|-------|-------|
| space-1 | 4px | Tight gaps, icon padding |
| space-2 | 8px | Component internal padding |
| space-3 | 12px | Form field gaps |
| space-4 | 16px | Card padding, component spacing |
| space-5 | 20px | Section gaps |
| space-6 | 24px | Major section spacing |
| space-8 | 32px | Page section spacing |
| space-10 | 40px | Large section spacing |
| space-12 | 48px | Hero sections |
| space-16 | 64px | Major layout spacing |

---

## 4. Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| radius-none | 0 | Sharp corners |
| radius-sm | 4px | Small elements, badges |
| radius-md | 8px | **Default** - cards, inputs, buttons |
| radius-lg | 12px | Modals, large cards |
| radius-xl | 16px | Hero elements |
| radius-full | 9999px | Pills, avatars, progress bars |

**Default radius: 8px (radius-md)**

---

## 5. Shadows

| Level | Value | Usage |
|-------|-------|-------|
| shadow-sm | `0 1px 2px 0 rgb(0 0 0 / 0.05)` | Cards, inputs |
| shadow-md | `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)` | Elevated cards |
| shadow-lg | `0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)` | Modals, dropdowns |
| shadow-xl | `0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)` | Overlays, drawers |

---

## 6. Components

### Button
| Variant | Background | Text | Border | Hover | Focus |
|---------|------------|------|--------|-------|-------|
| Primary | Teal 500 | Navy 950 | none | Teal 400 | ring-2 Teal 400 |
| Secondary | Navy 900 | White | none | Navy 800 | ring-2 Navy 800 |
| Outline | Transparent | Navy 900 | Slate 300 | Navy 50 | ring-2 Navy 500 |
| Ghost | Transparent | Navy 700 | none | Slate 100 | ring-2 Navy 500 |
| Danger | Error 500 | White | none | Error 400 | ring-2 Error 400 |

**Sizes:**
- SM: `h-8 px-3 text-sm` (32px height)
- MD: `h-10 px-4 text-sm` (40px height) — **Default**
- LG: `h-12 px-6 text-base` (48px height)

### Input
- Height: 40px (h-10)
- Padding: `px-3 py-2`
- Border: `border-slate-300` (focus: `border-teal-500`)
- Radius: 8px
- Placeholder: `text-slate-400`
- Error state: `border-red-500`, focus `ring-red-200`

### Select
- Same as Input
- Chevron icon: `lucide-chevron-down` (16px)
- Disabled: `bg-slate-100 text-slate-500`

### Card
- Background: White
- Border: `border-slate-200`
- Radius: 8px
- Shadow: `shadow-sm`
- Header padding: `p-4 pb-2`
- Content padding: `p-4`

### Badge
| Tone | Background | Text |
|------|------------|------|
| Green | `#ECFDF5` | `#065F46` |
| Amber | `#FFFAEB` | `#92400E` |
| Red | `#FEF2F2` | `#991B1B` |
| Blue | `#EFF6FF` | `#1E40AF` |
| Slate | `#F1F5F9` | `#475569` |

**Size:** `px-2 py-0.5 text-xs font-medium rounded-full`

### Table
- Header: `bg-slate-50 text-xs uppercase tracking-wide text-slate-400`
- Row: `border-b border-slate-100 last:border-0`
- Cell: `py-2.5 px-4`
- Hover: `bg-slate-50`

### Sidebar (Dashboard)
- Width: `w-64` (256px)
- Background: Navy 950
- Text: White / Slate 300
- Active: `bg-white/10 text-teal-400`
- Collapsed (mobile): `w-16` with tooltips

---

## 7. Layout

### Container
| Breakpoint | Max Width | Padding |
|------------|-----------|---------|
| Mobile | 100% | 16px |
| Tablet (md) | 768px | 24px |
| Desktop (lg) | 1024px | 24px |
| XL (xl) | 1280px | 32px |
| 2XL (2xl) | 1440px | 32px |

### Grid
- 12-column grid
- Gutter: 24px (lg), 16px (md), 12px (sm)

---

## 8. Motion

### Durations
| Token | Value | Usage |
|-------|-------|-------|
| fast | 150ms | Button hover, badge transitions |
| normal | 200ms | Modal open/close, dropdown |
| slow | 300ms | Page transitions, sidebar collapse |

### Easing
- Default: `cubic-bezier(0.4, 0, 0.2, 1)` (ease-out)
- Spring: `cubic-bezier(0.34, 1.56, 0.64, 1)` (for playful elements)

---

## 9. Accessibility (WCAG AA)

### Contrast Requirements
- Normal text: 4.5:1
- Large text (18px+): 3:1
- UI components: 3:1

### Focus States
- All interactive elements: `outline-none ring-2 ring-offset-2 ring-teal-500`
- Focus visible only: `focus-visible`

### Color Independence
- Never rely on color alone for status
- Icons + text for badges
- Patterns for charts

---

## 10. Iconography

### Library: `lucide-react`
- Size: 16px (inline), 20px (buttons), 24px (sidebar)
- Stroke width: 2
- Style: Outline (not filled)

### Common Icons
| Name | Component | Usage |
|------|-----------|-------|
| Search | `Search` | Search inputs |
| Filter | `Filter` | Filter buttons |
| Download | `Download` | Export buttons |
| Upload | `Upload` | File uploads |
| Eye | `Eye` | View details |
| Edit | `Edit` | Edit actions |
| Trash | `Trash2` | Delete actions |
| Plus | `Plus` | Add new |
| ChevronDown | `ChevronDown` | Select, accordion |
| ChevronRight | `ChevronRight` | Navigation |
| Shield | `Shield` | Security, verification |
| CreditCard | `CreditCard` | Payments |
| Building | `Building` | Organizations, banks |
| Users | `Users` | Team, members |
| Settings | `Settings` | Admin, config |
| Bell | `Bell` | Notifications |
| Menu | `Menu` | Mobile nav toggle |
| X | `X` | Close modals |

---

## 11. Forms

### Validation
- Inline validation on blur
- Error message: `text-red-500 text-sm mt-1`
- Success: `text-green-500 text-sm mt-1` (optional)

### Field Layout
```
Label (Label component)
  Input/Select/Textarea
  [Error/Help text]
```

### Required Indicator
- Red asterisk `*` after label
- `aria-required="true"`

---

## 12. Data Display

### Currency (KES)
- Format: `KES 1,234.56`
- Positive: `text-emerald-600` with `+` prefix
- Negative: `text-red-600` with `−` prefix
- Zero: `text-slate-500` with `—`

### Dates
- Short: `DD MMM YYYY` (01 Jan 2026)
- Long: `DD MMMM YYYY, HH:mm` (01 January 2026, 14:30)
- Relative: `X min ago`, `X hr ago`, `X days ago` (for recent)

### Numbers
- Thousands separator: `,`
- Decimal: `.`
- Compact: `1.2K`, `1.5M` (for large numbers)

---

## 13. Empty States

### Structure
```
[Illustration/Icon] (64px, slate-300)
[Title] (text-lg font-semibold slate-900)
[Description] (text-sm slate-500, max-w-xs)
[Primary Action Button]
```

### Examples
- "No verifications yet" + "Run your first check"
- "No batches yet" + "Upload a CSV"
- "Wallet is empty" + "Top up via M-Pesa"

---

## 14. Loading States

### Skeleton
- Background: `bg-slate-200 animate-pulse`
- Border radius: matches component
- Shimmer: optional `bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200`

### Spinners
- Small: `h-4 w-4` (inline)
- Medium: `h-8 w-8` (buttons)
- Large: `h-12 w-12` (page)

### Button Loading
- Disable button
- Show spinner + "Loading..." text
- Maintain button width

---

## 15. Responsive Breakpoints

| Name | Width | Usage |
|------|-------|-------|
| sm | 640px | Mobile landscape |
| md | 768px | Tablet |
| lg | 1024px | Desktop |
| xl | 1280px | Large desktop |
| 2xl | 1536px | Ultra-wide |

---

## 16. Implementation Notes

### Tailwind Config Extensions
```js
theme: {
  extend: {
    colors: {
      navy: { 950: '#0A1628', 900: '#0C1D36', 800: '#122945', 700: '#1A3A5C' },
      teal: { 400: '#33E0C4', 500: '#00D9B5', 600: '#00AE96' },
      brand: { gradient: 'linear-gradient(135deg, #00D9B5 0%, #00AE96 100%)' },
    },
    fontFamily: {
      display: ['Spline Sans', 'Inter', 'system-ui'],
      body: ['Manrope', 'Inter', 'system-ui'],
      mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
    },
    borderRadius: {
      DEFAULT: '8px',
      md: '8px',
    },
    spacing: {
      '1': '4px', '2': '8px', '3': '12px', '4': '16px',
      '5': '20px', '6': '24px', '8': '32px', '10': '40px',
      '12': '48px', '16': '64px',
    },
  },
}
```

### CSS Variables (for dynamic theming)
```css
:root {
  --color-navy-950: #0A1628;
  --color-teal-500: #00D9B5;
  --radius-md: 8px;
  --space-4: 16px;
}
```

---

## 17. Dark Mode (Future)

### Color Overrides
| Light | Dark |
|-------|------|
| Slate 50 → Slate 950 | Page background |
| White → Navy 900 | Card backgrounds |
| Slate 900 → Slate 100 | Primary text |
| Slate 500 → Slate 400 | Secondary text |
| Teal 500 → Teal 400 | Primary accent |

---

*End of DESIGN.md*