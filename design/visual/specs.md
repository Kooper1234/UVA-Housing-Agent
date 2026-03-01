# UVA Housing Agent - Visual Design Specs (Maya)

Version: MVP v1.0  
Owner: Visual Design  
Applies to: Web app (mobile/tablet/desktop), light mode only

---

## 0) Implementation Rules

1. All values below are production tokens/specs, not mock guidance.
2. Use 4px base grid and rem values tied to 16px root font-size.
3. No dark mode in MVP.
4. No listing photos in cards for MVP.
5. Price/person is the visual anchor on listing cards.

---

## 1) Color System

## 1.1 Brand Core
- `brand.navy.700` = **#232D4B** (UVA Navy)
- `brand.orange.600` = **#E57200** (UVA Orange)

## 1.2 Neutrals (Backgrounds, surfaces, text)
- `neutral.0` = #FFFFFF
- `neutral.25` = #FCFCFD
- `neutral.50` = #F8FAFC
- `neutral.100` = #F1F5F9
- `neutral.200` = #E2E8F0
- `neutral.300` = #CBD5E1
- `neutral.400` = #94A3B8
- `neutral.500` = #64748B
- `neutral.600` = #475569
- `neutral.700` = #334155
- `neutral.800` = #1E293B
- `neutral.900` = #0F172A

## 1.3 Semantic Colors
### Primary/Interactive
- `primary.default` = #232D4B
- `primary.hover` = #1B243D
- `primary.active` = #141B2E
- `primary.disabled` = #A8B0C1
- `primary.on` = #FFFFFF

### Accent (used for key highlights, selected marker, selected compare)
- `accent.default` = #E57200
- `accent.hover` = #C96400
- `accent.active` = #A95500
- `accent.softBg` = #FFF2E8
- `accent.on` = #FFFFFF

### Success
- `success.default` = #15803D
- `success.softBg` = #DCFCE7
- `success.border` = #86EFAC
- `success.on` = #FFFFFF

### Warning
- `warning.default` = #B45309
- `warning.softBg` = #FFEDD5
- `warning.border` = #FDBA74
- `warning.on` = #FFFFFF

### Error
- `error.default` = #B42318
- `error.softBg` = #FEE4E2
- `error.border` = #FDA29B
- `error.on` = #FFFFFF

### Info
- `info.default` = #1D4ED8
- `info.softBg` = #DBEAFE
- `info.border` = #93C5FD
- `info.on` = #FFFFFF

## 1.4 Surface + Border Tokens
- `bg.canvas` = #F8FAFC
- `bg.surface` = #FFFFFF
- `bg.subtle` = #F1F5F9
- `bg.elevated` = #FFFFFF
- `border.default` = #E2E8F0
- `border.strong` = #CBD5E1
- `border.focus` = #E57200

## 1.5 Text Hierarchy Tokens
- `text.primary` = #0F172A
- `text.secondary` = #334155
- `text.tertiary` = #64748B
- `text.inverse` = #FFFFFF
- `text.link` = #1D4ED8

## 1.6 State Mapping
- Hover on neutral card: bg #FFFFFF, border #CBD5E1, shadow increased
- Active press: reduce shadow + 1px translateY
- Disabled: opacity 0.5, no shadow, no pointer
- Focus ring: `0 0 0 3px #FFF2E8` + `0 0 0 1px #E57200`

---

## 2) Typography

## 2.1 Font Families (Google Fonts)
- **Primary UI:** `Inter` (400/500/600/700)
- **Display/price emphasis:** `Archivo` (600/700)
- Fallback stack: `Inter, Archivo, system-ui, -apple-system, Segoe UI, Roboto, sans-serif`

## 2.2 Type Scale (16px root)
| Token | Size | Rem | Weight | Line Height |
|---|---:|---:|---:|---:|
| display.lg | 36px | 2.25rem | 700 | 44px |
| h1 | 30px | 1.875rem | 700 | 38px |
| h2 | 24px | 1.5rem | 700 | 32px |
| h3 | 20px | 1.25rem | 600 | 28px |
| h4 | 18px | 1.125rem | 600 | 26px |
| body.lg | 16px | 1rem | 400 | 24px |
| body.md | 14px | 0.875rem | 400 | 22px |
| body.sm | 13px | 0.8125rem | 400 | 20px |
| label.md | 12px | 0.75rem | 600 | 16px |
| caption | 11px | 0.6875rem | 500 | 16px |

## 2.3 Listing Price Styles (most prominent)
- `price.card` = Archivo 700, 32px/2rem, line-height 36px, tracking -0.02em, color #232D4B
- `price.cardSuffix` (“/person”) = Inter 600, 13px/0.8125rem, line-height 16px, color #475569
- `price.detail` = Archivo 700, 36px/2.25rem, line-height 40px

---

## 3) Spacing System

## 3.1 Base Unit
- Base: **4px**
- Scale tokens:
  - `space-1` 4px
  - `space-2` 8px
  - `space-3` 12px
  - `space-4` 16px
  - `space-5` 20px
  - `space-6` 24px
  - `space-8` 32px
  - `space-10` 40px
  - `space-12` 48px

## 3.2 Radius Tokens
- `radius-sm` 8px
- `radius-md` 12px
- `radius-lg` 16px
- `radius-xl` 20px
- `radius-pill` 9999px

## 3.3 Shadow Tokens
- `shadow-sm`: 0 1px 2px rgba(15,23,42,.06)
- `shadow-md`: 0 6px 16px rgba(15,23,42,.08)
- `shadow-lg`: 0 12px 24px rgba(15,23,42,.12)

---

## 4) Layout + Breakpoints

- **Mobile:** 0–768px
- **Tablet:** 769–1024px
- **Desktop:** 1025px+

Container widths:
- Mobile: full width, 16px side padding
- Tablet: max 960px, 24px side padding
- Desktop: max 1280px, 24px side padding

Grid:
- Mobile: single column
- Tablet: 8 columns, 24px gutters
- Desktop: 12 columns, 24px gutters

---

## 5) Component Specs

## 5.1 Onboarding Quick-Start Card
- Card width: 100% (max 720px desktop)
- Min height: 420px desktop / auto mobile
- Padding: 24px (desktop/tablet), 16px (mobile)
- Radius: 16px
- Background: #FFFFFF
- Border: 1px solid #E2E8F0
- Shadow: shadow-md

Internal layout:
- Title to subtitle: 8px
- Subtitle to form group: 20px
- Form row gap: 12px
- Section gap: 16px

Fields:
1) Budget field
- Label: 12/600
- Input height: 44px
- Input padding: 0 12px
- Border radius: 12px
2) Roommate chips row
- Chip height: 36px, min-width 44px, px 12
3) Class building autocomplete
- Input height: 44px

Primary CTA (“See my matches”):
- Height: 48px
- Width: 100%
- Radius: 12px
- Background: #232D4B
- Text: 15px/600 #FFF
- Hover: #1B243D
- Active: #141B2E

AI prompt chips below CTA:
- Height: 32px
- Padding: 0 12px
- Gap: 8px wrap
- Inactive bg #F1F5F9, text #334155
- Hover bg #E2E8F0

## 5.2 Listing Card (No Photos)
Dimensions:
- Mobile: width 100%, min-height 232px
- Tablet/Desktop list column: width 100%, min-height 224px
- Padding: 16px
- Radius: 16px
- Border: 1px solid #E2E8F0
- Background: #FFFFFF
- Shadow default: shadow-sm

Card structure spacing:
- Row gaps: 10px
- Top row (name + match badge)
- Price row
- Metadata row
- Commute row
- Badges row
- Actions row

Typography:
- Name: 18px/600, #0F172A
- Match badge text: 11px/600
- Price/person: `price.card`
- Total price secondary: 13px/400 #64748B
- Metadata: 13px/500 #334155
- Commute line: 13px/500 #475569
- Action buttons: 13px/600

States:
- Default: border #E2E8F0, shadow-sm
- Hover: border #CBD5E1, shadow-md, translateY(-1px)
- Highlighted from map: border #E57200, bg #FFF9F3, left accent bar 3px #E57200
- In-compare: border #232D4B, bg #F8FAFF, compare icon filled navy

Badge styles:
- Match % badge: bg #FFF2E8, text #A95500, border 1px #FDBA74, radius 9999, h24 px10
- “No pin yet”: bg #F1F5F9, text #475569, border 1px #CBD5E1
- Confidence high: bg #DCFCE7 text #166534
- Confidence medium: bg #FFEDD5 text #9A3412
- Confidence low: bg #FEE4E2 text #B42318

Actions row:
- Primary text button (“Details”): navy text
- Compare toggle button: h32 px10 radius 8
- Ask AI button: h32 px10 radius 8 bg #EFF6FF text #1D4ED8

## 5.3 Filter Chips + Filter Sheet
Chip specs:
- Height 36px
- Horizontal padding 12px
- Radius pill
- Text 13px/600
- Leading icon 14px
- Gap between chips: 8px

Chip states:
- Inactive: bg #FFF, border #CBD5E1, text #334155
- Hover: bg #F8FAFC
- Active: bg #232D4B, border #232D4B, text #FFF
- Disabled: bg #F8FAFC, border #E2E8F0, text #94A3B8

Mobile filter sheet:
- Full-height bottom sheet (min 85vh)
- Top radius 20px
- Header height 56px with drag handle
- Body scrollable with 16px padding
- Sticky footer: height 72px, bg #FFF, top border #E2E8F0
- Footer actions: Clear (text), Apply filters (primary button h44)

## 5.4 Map Markers (Price Labels)
- Marker base: pill with pointer tail
- Height: 32px
- Min width: 56px
- Horizontal padding: 10px
- Radius: 9999px
- Font: Archivo 700, 13px

States:
- Default mapped: bg #232D4B, text #FFF, border 1px #1B243D
- Hover: bg #1B243D, scale 1.04
- Active/selected: bg #E57200, border #A95500, text #FFF, shadow-md
- Non-interactive (if disabled): bg #94A3B8

## 5.5 AI Chat Interface + Insight Strip
Insight strip (Explorer):
- Height: auto (min 44px)
- Padding: 10px 12px
- Radius: 12px
- Bg: #EFF6FF
- Border: 1px solid #BFDBFE
- Text: 13px/500 #1E3A8A
- CTA text link: 13px/600 #1D4ED8

Chat panel:
- Background: #F8FAFC
- Message list padding: 16px
- Message vertical gap: 10px

AI bubble:
- Max width: 84%
- Bg: #FFFFFF
- Border: 1px solid #E2E8F0
- Radius: 14px 14px 14px 4px
- Padding: 10px 12px
- Text: 14px/400 #0F172A

User bubble:
- Max width: 84%
- Bg: #232D4B
- Radius: 14px 14px 4px 14px
- Padding: 10px 12px
- Text: 14px/400 #FFF

Input composer:
- Container height: 64px
- Padding: 10px 12px
- Border-top: 1px #E2E8F0
- Input height: 44px
- Input radius: 12px
- Send button: 36x36

Prompt chips in chat:
- Same as onboarding chips, plus subtle blue variant bg #EFF6FF

## 5.6 Compare Tray + Compare Table
Compare tray (dock):
- Mobile: fixed bottom above nav; height 72px
- Desktop: fixed bottom-right card; width 360px, height auto
- Bg #FFFFFF, border #CBD5E1, shadow-lg, radius 16px
- Padding 12px
- Listing pills inside: h32, radius 8, bg #F1F5F9

Compare table:
- Up to 4 columns listing cards + left sticky criteria column
- Header row height: 56px
- Body row height: min 48px
- Cell padding: 12px
- Borders: 1px #E2E8F0
- Best value highlight: bg #ECFDF3, text #166534, border-left 3px #22C55E
- Worst/concern value: bg #FEF2F2, text #991B1B

## 5.7 Detail Sheet / Panel
Mobile sheet:
- Initial snap: 70vh; expanded 100vh
- Radius top 20px
- Header sticky with close icon

Desktop panel:
- Width: 420px
- Full height in explorer right column
- Border-left 1px #E2E8F0

Section specs:
- Section vertical spacing: 20px
- Section heading: 16px/600
- Body text: 14px/400
- Key-value row spacing: 8px

CTAs:
- Primary (“Open source listing”): h44, radius 12, navy
- Secondary (“Ask AI about this place”): h44, radius 12, bg #EFF6FF text #1D4ED8
- Tertiary (“Add to compare”): outline #CBD5E1

## 5.8 Navigation
Mobile bottom nav:
- Height: 64px + safe-area inset
- Background: #FFFFFF
- Top border: 1px #E2E8F0
- 4 items equally spaced
- Icon: 20x20
- Label: 11px/600
- Active: icon+label #232D4B, active indicator 2px top bar #E57200
- Inactive: #64748B

Desktop top nav:
- Height: 64px
- Horizontal padding: 24px
- Layout: logo left, tab group center-left, context/filter summary right
- Tab text: 14px/600
- Active tab: navy text + 2px bottom border orange
- Hover: bg #F8FAFC, radius 8

## 5.9 State Components
Loading skeletons:
- Card skeleton height: 224px
- Skeleton blocks with radius 8
- Colors: base #E2E8F0, shimmer #F8FAFC

Empty state:
- Container: centered, max-width 480px, padding 24px
- Icon circle 48x48 bg #F1F5F9
- Title 20/600, body 14/400
- Primary action h44

Error card:
- Bg #FEF2F2, border #FCA5A5, radius 12, padding 12
- Title 14/600 #991B1B
- Body 13/400 #B42318
- Retry button: h32, bg #B42318, text #FFF

Toast notifications:
- Position: bottom-center mobile, bottom-right desktop
- Width: 320px max
- Min height: 48px
- Radius 12, padding 12 14
- Shadow-lg
- Success bg #166534 text #FFF
- Error bg #B42318 text #FFF
- Neutral bg #1E293B text #FFF

---

## 6) Motion / Animation

Use `prefers-reduced-motion` to disable non-essential transforms.

1. Card hover:
- duration 160ms
- easing cubic-bezier(.2,.8,.2,1)
- properties: box-shadow, transform, border-color

2. Filter apply feedback:
- active chips pulse once (scale 1 -> 1.03 -> 1) in 220ms
- results region fade in 120ms

3. Sheet open/close:
- open: translateY(16px -> 0), opacity (0 -> 1), 220ms
- close: reverse, 180ms

4. Loading shimmer:
- gradient move left-to-right
- duration 1.2s infinite linear

5. Toast enter/exit:
- enter 180ms (translateY 8px -> 0, opacity 0 ->1)
- exit 140ms

---

## 7) Engineering Acceptance Checklist (Self-Review)

An engineer should be able to implement without design follow-up if they use:
- defined color tokens (including semantic states)
- exact type scale and two font families
- fixed spacing/radius/shadow tokens
- component dimensions + state specs above
- breakpoint behavior and motion timings

If anything is uncertain in implementation, treat this file as source of truth and prefer tokenized values over ad hoc styling.