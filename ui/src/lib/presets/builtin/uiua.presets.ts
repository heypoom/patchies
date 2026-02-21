/**
 * Uiua Node Presets
 *
 * Pre-configured Uiua demo programs
 */

export const UIUA_PRESETS = {
  'game-of-life.uiua': {
    type: 'uiua',
    data: {
      expr: `Life ← ↥∩=₃⟜+⊸(/+↻⊂A₂C₂)
⁅×0.6 gen⊙⚂ ˙⊟30 # Init
⍥⊸Life100        # Run
≡▽₂ 4            # Upscale`,
      enableVideoOutlet: true,
      enableMessageOutlet: false
    }
  },
  'uiua-logo.uiua': {
    type: 'uiua',
    data: {
      expr: `U ← /=⊞<0.2_0.7 /+×⟜ⁿ1_2
I ← <⊙(⌵/ℂ) # Circle
u ← +0.1⧋↧ ⊃(I0.95|⊂⊙0.5⇌˙×)
A ← ×⊃U(I1) # Alpha
⧋(⊂⊃u A) ˙⊞⊟-⊸¬÷⟜⇡200`,
      enableVideoOutlet: true,
      enableMessageOutlet: false
    }
  },
  'sine.uiua': {
    type: 'uiua',
    data: {
      expr: `[0 4 7 10]     # Notes
×220 ˜ⁿ2÷12    # Freqs
∿×τ ⊞× ÷⟜⇡&asr # Generate
÷⧻⟜/+⍉         # Mix`,
      enableVideoOutlet: false,
      enableMessageOutlet: true
    }
  },
  'spiral.uiua': {
    type: 'uiua',
    data: {
      expr: `↯⟜(×20-⊸¬÷⟜⇡)200 # Xs
-⊃∠(⌵ℂ)⊸⍉        # Spiral field
-π◿τ⊞-×τ÷⟜⇡20    # Animate`,
      enableVideoOutlet: true,
      enableMessageOutlet: false
    }
  },
  'stripes.uiua': {
    type: 'uiua',
    data: {
      expr: `⍉ ˙[⊞⊃⊃+↥-] ⇡300
÷2 +1.2 ∿ ÷10`,
      enableVideoOutlet: true,
      enableMessageOutlet: false
    }
  },
  'cellular-automata.uiua': {
    type: 'uiua',
    data: {
      expr: `Rule ← ˜⊏⊓⋯₈(°⋯⧈⇌3⊂⊂⊃⊣⟜⊢)
=⌊⊃÷₂⇡ 500        # Init
⍥⟜⊸Rule ⌊÷2◡⋅⧻ 30 # Run`,
      enableVideoOutlet: true,
      enableMessageOutlet: false
    }
  },
  'mandelbrot.uiua': {
    type: 'uiua',
    data: {
      expr: `×2 ⊞ℂ⤙-1/4 -1/2÷⟜⇡300 # Init
>2⌵ ⍥⟜⊸(+⊙°√) 50 ⟜∘   # Run
÷⧻⟜/+                 # Normalize`,
      enableVideoOutlet: true,
      enableMessageOutlet: false
    }
  }
};
