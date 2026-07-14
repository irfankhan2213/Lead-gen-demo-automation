export const designLanguages: Record<string, string> = {
  luxury: `
# Design Style: Luxury / Editorial
- Core Principles: Elegance, Vogue-style high-end editorial feel, generous negative space, slow cinematic motion (1500-2000ms), layered depth.
- Palette: Background: #F9F8F6 (warm alabaster paper), Foreground: #1A1A1A (charcoal), Accents: #D4AF37 (gold) used sparingly, Muted: #EBE5DE (taupe).
- Typography: "Playfair Display" (serif) for headlines, "Inter" (sans-serif) for body. Overline labels in uppercase with tracking-[0.25em].
- Radius & Borders: 0px (strictly sharp corners). Thin borders: 1px #1A1A1A at 10-20% opacity. Common pattern is top-border only.
- Shadows & Effects: Subtle shadow-[0_4px_24px_rgba(0,0,0,0.06)] for elevation. Grayscale images (grayscale) that transition slowly to full color (grayscale-0) on hover (duration-[1500ms]).
- Layout: Asymmetric editorial grids, spacious single-column sections, minimal overlapping layers.
`,
  swiss: `
# Design Style: Swiss International
- Core Principles: Extreme grid objectivity, bold asymmetric sans-serif typography, high contrast, clean mathematical layouts.
- Palette: Background: #FFFFFF, Foreground: #0F0F11 (near-black), Accent: #FF3B30 (neon red) or #0055FF (neon blue).
- Typography: "Plus Jakarta Sans" or "Inter" extra-bold/black for headings, tracking-tighter, leading-none.
- Radius & Borders: 0px (sharp). Thick, solid black borders (border-2 or border-4 border-black). Structural gridlines separating columns.
- Shadows & Effects: Zero shadows (shadow-none). Focus on raw, flat interactive blocks and colored grid fills.
- Layout: Rigid 12-column grid layout, asymmetric text placement, thick section dividers (border-b-4 border-black).
`,
  flat: `
# Design Style: Flat / Geometric Blocks
- Core Principles: 2D simplicity, vibrant solid color blocks, high contrast, playfulness, zero shadows or gradients.
- Palette: Background: #F8FAFC, Foreground: #0F172A, Accent: #F59E0B (amber) or #10B981 (emerald).
- Typography: "Outfit" or "Inter" sans-serif, medium/bold weight.
- Radius & Borders: Fully rounded corners (rounded-2xl or rounded-full) on cards and CTA buttons. Thin dark borders (border-2 border-slate-900).
- Shadows & Effects: Strictly flat. Interaction is color-swaps, translates (hover:-translate-y-1), and scale increases on hover.
- Layout: Simple card grids, centered alignments, clear content cards with thick borders.
`,
  material: `
# Design Style: Material You
- Core Principles: Tactile surfaces, soft organic curves, fluid animations, comfortable interactive layers.
- Palette: Background: #F1F5F9, Foreground: #1E293B, Accent: #6366F1 (indigo) or #EC4899 (pink), Surface: #FFFFFF.
- Typography: "Plus Jakarta Sans" or "Inter", friendly and modern.
- Radius & Borders: Very soft rounded corners (rounded-3xl). Minimal borders; separation via elevated surfaces.
- Shadows & Effects: Soft depth shadows (shadow-md, hover:shadow-lg) and inner borders (shadow-[inset_0_1px_2px_rgba(255,255,255,0.45)]).
- Layout: Pill-shaped buttons, rounded cards, organic fluid transitions, symmetric spacing.
`,
  claymorphism: `
# Design Style: Claymorphism
- Core Principles: Inflatable pastel 3D-like shapes, child-like vinyl textures, friendly, playful interactive surfaces.
- Palette: Background: #EEF2F6, Foreground: #1E293B, Soft Pastels: #A5B4FC (indigo), #FCA5A5 (red), #FCD34D (amber).
- Typography: "Fredoka" or "Quicksand" (rounded sans-serif), bold and friendly.
- Radius & Borders: Huge rounded corners (rounded-[2rem] or rounded-full).
- Shadows & Effects: Thick opposing dual shadows to mimic 3D volume (shadow-[0_12px_24px_-4px_rgba(0,0,0,0.1),inset_0_-8px_16px_rgba(0,0,0,0.1),inset_0_8px_16px_rgba(255,255,255,0.8)]).
- Layout: Floating bubble cards, organic offsets, pastel color grids, bouncing transitions (ease-out-back).
`,
  neumorphism: `
# Design Style: Neumorphism (Soft Extrusion)
- Core Principles: Monochromatic cool grey surfaces extruded from the background, using dual light/dark shadows.
- Palette: Background: #E2E8F0, Foreground: #334155, Accent: #3B82F6 (blue) or #10B981 (emerald), Surface: #E2E8F0 (identical to bg).
- Typography: "Inter" or "Geist Mono", clean and technical.
- Radius & Borders: Smooth rounded corners (rounded-2xl). No borders (border-none).
- Shadows & Effects: Extruded look using paired shadows: shadow-[10px_10px_20px_#cbd5e1,-10px_-10px_20px_#ffffff] (regular) and inset shadows on hover (shadow-[inset_10px_10px_20px_#cbd5e1,inset_-10px_-10px_20px_#ffffff]).
- Layout: Flat, embossed layout where elements feel like they are molded out of the screen.
`,
  industrial: `
# Design Style: Industrial / Technical
- Core Principles: Heavy machinery aesthetics, utility, visible mechanical details, raw structural elements.
- Palette: Background: #121214 (dark industrial carbon), Foreground: #E4E4E7, Accent: #FF6B00 (safety orange) or #F59E0B (caution yellow).
- Typography: "Space Grotesk" or "Geist Mono", high-contrast sans/mono.
- Radius & Borders: 0px or slight rounded corners (rounded-sm). Heavy steel borders (border-2 border-[#2E2E33]).
- Shadows & Effects: Sharp dark offset shadows (shadow-[4px_4px_0px_#000000]). Accent elements have glowing borders or warning patterns.
- Layout: Dense grid layouts, technical specification tables, bold raw dividers.
`,
  corporate: `
# Design Style: Corporate Trust
- Core Principles: Traditional institutional trust, authoritative stability, serif headlines, clear professional hierarchy.
- Palette: Background: #FFFFFF, Foreground: #0F172A, Primary: #1E3A8A (navy blue), Accent: #B45309 (amber/gold).
- Typography: "Merriweather" or "Lora" (serif) for headings, "Inter" for body.
- Radius & Borders: Mild rounded corners (rounded-md). Clean borders (border border-slate-200).
- Shadows & Effects: Soft, subtle elevation (shadow-sm, hover:shadow-md), professional transitions.
- Layout: Multi-column feature grids, structured lists, aligned contact and lead forms, standard layouts.
`,
  botanical: `
# Design Style: Botanical / Organic
- Core Principles: Natural warm terracotta/sage color palettes, organic typography, tactile earth tones, calm serene atmosphere.
- Palette: Background: #F7F4EF (warm linen), Foreground: #2D3A2E (deep pine), Accent: #C89D7C (terracotta) or #A3B899 (sage).
- Typography: "Playfair Display" (serif) for headings, "Outfit" for body.
- Radius & Borders: Smooth rounded corners (rounded-xl). Subtle organic dividers.
- Shadows & Effects: Soft natural shadows, linen paper grain texture overlays, smooth fading transitions.
- Layout: Centered column blocks, organic galleries, soft card surfaces, natural borders.
`
};
