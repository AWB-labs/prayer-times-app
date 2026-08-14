# PT7 — Design System (DESIGN.md)

> Source of truth for generating PT7 screens. PT7 is a digital platform that transforms
> physiotherapy by connecting clinics, therapists, and patients through one intuitive
> ecosystem — simplifying rehabilitation management while supporting better recovery
> outcomes and more efficient clinical care.
>
> **Design language:** calm, clinical, trustworthy, human. Light, effortless layouts with
> generous negative space, soft green gradients, and strong typographic hierarchy.

---

## 1. Brand Personality

- **Trustworthy & clinical** — healthcare-grade credibility, never sterile.
- **Human & approachable** — recovery is personal; imagery and copy feel warm.
- **Movement & progress** — the visual identity reflects motion, flexibility, rehabilitation.
- **Clarity first** — light, airy interfaces with generous white space and one clear focal point per screen.

---

## 2. Color

### Core palette

| Token | Name | Hex | Role |
|-------|------|-----|------|
| `--forest-green` | Forest Green | `#0F3826` | Primary dark / text on light, deep brand anchor, headings |
| `--emerald` | Emerald | `#24BA8F` | Primary brand green / CTAs, active states, accents, highlights |
| `--mint` | Mint | `#B0E8C7` | Soft supporting tint / backgrounds, chips, subtle fills |
| `--white` | White | `#FFFFFF` | Base surface / negative space |

### Usage rules

- **Emerald (`#24BA8F`)** is the signature action color — primary buttons, links, selected states, progress, key numbers.
- **Forest Green (`#0F3826`)** for primary text and high-emphasis headings on light surfaces.
- **Mint (`#B0E8C7`)** for gentle backgrounds, tags, and low-emphasis fills — never for body text.
- **White** dominates. Interfaces should feel light and effortless.
- Ensure text always meets sufficient contrast (avoid low-contrast green-on-green for body copy).

### Suggested extended neutrals (for UI, derived — keep subtle)

| Token | Hex | Role |
|-------|-----|------|
| `--ink` | `#0F3826` | Primary text (Forest Green) |
| `--text-secondary` | `#5B6B63` | Secondary/body text, muted labels |
| `--surface` | `#FFFFFF` | Cards, sheets |
| `--surface-muted` | `#F4F9F6` | Page background, subtle sections |
| `--border` | `#E4EDE8` | Hairlines, dividers, input borders |

---

## 3. Gradients

Gradients are a **core part of the brand expression** — they bring movement, depth, and emotion. Built from the brand greens (Forest Green → Emerald → Mint).

**Named gradient meanings:**
- **Recovery Flow** — healing, recovery, continuous progress.
- **Motion** — movement, flexibility, rehabilitation.
- **Clinical Calm** — trust, wellbeing, patient care.
- **Connected Care** — connection between therapists, patients, and clinics.

**Gradient Do's:**
- Use **one gradient per composition**.
- Maintain **soft, blurred transitions**.
- Ensure text placed over gradients has **sufficient contrast**.
- Pair gradients with **generous white space**.

**Gradient Don'ts:**
- Don't stretch or distort gradients.
- Don't overlay multiple gradients.
- Don't use low-contrast combinations.
- Don't place body text on busy gradient areas.

_Example CSS:_
```css
/* Recovery Flow — hero / accent surfaces */
background: linear-gradient(135deg, #0F3826 0%, #24BA8F 55%, #B0E8C7 100%);
/* Keep transitions soft — add blur or large radius when used as a backdrop */
```

---

## 4. Typography

**Primary typeface: Manrope** — used across all digital and print. Clean, modern, highly
readable, built for healthcare and technology experiences.

### Weights (three, for clear hierarchy)

| Weight | Use for |
|--------|---------|
| **Manrope Bold** | Hero titles, page titles, key numbers & stats, important highlights |
| **Manrope Medium** | Section headings, card titles, buttons & navigation, labels & form titles |
| **Manrope Regular** | Body text, descriptions, instructions, captions & notes |

### Accent style (emphasis without a second font)

Emphasis is created with **style, not another font**:
- **Manrope SemiBold**, **UPPERCASE**, **+2%–5% letter-spacing**, in **primary green (Emerald)**.
- Used sparingly for labels, overlines, highlights, and key messages.
- Examples: `NEW FEATURE`, `AI POWERED`, `PHASE 01`.

### Type hierarchy

| Level | Style |
|-------|-------|
| **Overline / Label** | Manrope SemiBold, ALL CAPS, +6% letter-spacing, Emerald |
| **H1 — Hero Title** | Manrope Bold |
| **H2 — Section Heading** | Manrope Medium |
| **Body** | Manrope Regular |

_Example scale (adjust per platform):_

| Role | Size / Weight |
|------|---------------|
| Overline | 12–13px · SemiBold · +6% tracking · uppercase |
| H1 Hero | 32–40px · Bold · tight leading |
| H2 Section | 22–26px · Medium |
| H3 Card title | 18px · Medium |
| Body | 15–16px · Regular · 1.5 line-height |
| Caption | 13px · Regular · secondary color |

```css
font-family: 'Manrope', -apple-system, 'Segoe UI', sans-serif;
```

---

## 5. Logo

- The **PT7 logo** is a unified geometric monogram overlaying the letters **P, T, and 7** on
  a single grid, using color-shifting paths to highlight each character.
- Interlocking lines are a **metaphor for joint articulation, alignment, and movement** in physiotherapy.
- Always reproduce using **approved brand colors** only.
- Built on a **proportional grid based on the width of the letter "p"** — never manually recreate or alter.
- **Minimum size:** 3 cm (print) — never reproduce below the approved minimum; keep proportions intact.
- **Clear space:** maintain defined clear space around the mark on all sides.
- **App icon** = the brand logo, available in **gradient** and **solid** variations for flexibility across backgrounds.

**Incorrect logo usage — never:** stretch, rotate, recolor, distort, outline, add strokes,
or add drop shadows. Always use the official supplied asset.

**Co-branding:** when alongside partner/sponsor logos, keep equal visual integrity, clear
separation, proportional sizing, and appropriate spacing so PT7 stays distinct.

---

## 6. Imagery Style

- Reflects **movement, recovery, and human connection**.
- Photography should feel **authentic, approachable, and clinically trustworthy**, guiding
  users through their rehabilitation journey.
- Incorporate the **green palette subtly** — through clothing, exercise mats, accessories,
  or environmental details rather than heavy overlays.

---

## 7. Layout System

Built on **simplicity, balance, and movement**: clean spacing, strong alignment, and
generous negative space create a light, effortless environment.

**Principles:**
1. **Consistent alignment** — align content to a single vertical axis for a clean, organized layout.
2. **Color / spacing** — use plenty of white space between elements to improve readability and focus.
3. **Clear hierarchy** — organize information by importance using size, weight, and spacing
   (Heading → Supporting Text → Primary Action → Secondary Content).
4. **Focal logo placement** — top-left, bottom-right, or centered depending on composition.

**Suggested spacing scale (8pt base):** 4, 8, 12, 16, 24, 32, 48, 64.
**Radius:** cards & inputs ~12–16px; pills/buttons fully rounded or ~12px. Keep corners soft.
**Shadows:** subtle and soft — avoid harsh drop shadows (consistent with the light aesthetic).

---

## 8. Components (guidance for generation)

- **Buttons**
  - Primary: Emerald `#24BA8F` fill, white label, Manrope Medium, generous padding, soft radius.
  - Secondary: white fill, `#E4EDE8` border, Forest Green label.
  - Text/ghost: Emerald label, no fill.
- **Cards:** white surface, hairline border or subtle shadow, 16px radius, roomy padding, one clear title (Manrope Medium).
- **Overlines / tags:** Mint background with Forest Green text, or uppercase Emerald SemiBold label.
- **Inputs:** white fill, `#E4EDE8` border, Forest Green text, Emerald focus ring.
- **Progress / stats:** big Manrope Bold numbers in Forest Green or Emerald; label in secondary text.
- **Hero sections:** may use one soft brand gradient backdrop with ample white space and high-contrast text.

---

## 9. Quick prompt block for Stitch

> Design in the **PT7** brand system. Typeface **Manrope** (Bold for titles, Medium for
> headings/buttons, Regular for body; uppercase SemiBold +tracking Emerald overlines for
> labels). Colors: Forest Green `#0F3826` (text/anchor), Emerald `#24BA8F` (primary actions
> & accents), Mint `#B0E8C7` (soft fills/backgrounds), White `#FFFFFF` (base). Use **one soft
> green gradient per screen** with generous white space. Light, calm, clinically trustworthy,
> human. Strong hierarchy, single-axis alignment, soft radii (12–16px), subtle shadows. Avoid
> low-contrast text, multiple gradients, and heavy/harsh styling.
