/** Object types that benefit from UI design guidelines injected into the generator prompt */
export const UI_DESIGN_OBJECTS = new Set(['vue', 'dom']);

export const UI_DESIGN_GUIDELINES = `# UI Design Guidelines

Before writing any UI code, commit to a BOLD aesthetic direction:

1. **Tone**: Pick an extreme and execute it with precision — brutally minimal, maximalist chaos,
retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial, brutalist,
art deco, soft/pastel, industrial, etc.

2. **Differentiation**: What makes this UNFORGETTABLE? Choose one thing and nail it.

## Typography

Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter.
Pair a distinctive display font with a refined body font.
Unexpected, characterful font choices are strongly preferred.

## Color & Theme

Commit to a cohesive aesthetic. Dominant colors with sharp accents outperform timid, evenly-distributed palettes.

## Motion

Focus on high-impact moments: one well-orchestrated load with staggered reveals (animation-delay)
creates more delight than scattered micro-interactions. Use hover states that surprise.

## Backgrounds & Visual Details

Create atmosphere and depth rather than defaulting to solid colors.
Apply creative forms like gradient meshes, noise textures, geometric patterns,
layered transparencies, dramatic shadows, and decorative borders.

## What to AVOID

NEVER use generic AI-generated aesthetics:

- Overused font families: Inter, Roboto, Arial, system fonts
- Clichéd color schemes (particularly purple gradients on white backgrounds)
- Predictable, cookie-cutter layouts that lack context-specific character`;
