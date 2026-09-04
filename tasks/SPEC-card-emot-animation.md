# Spec: Comprehensive 25+ Retro Kaomoji Library with Bespoke Animations

## Objective
Provide an exhaustive library of 25+ retro ASCII/Unicode kaomoji across 15 distinct emotional categories, each with a bespoke physics-based micro-animation choreography, ambient breathing motion, and deterministic seed hashing per card ID.

## Emotion Categories & Kaomoji Roster

1. **Fight / Semangat**: `(ง'̀-'́)ง`, `(ง •̀_•́)ง` (Fist-pump jab)
2. **Party / Victory**: `＼(＾O＾)／`, `(ﾉ◕ヮ◕)ﾉ`, `(≧◡≦)` (Celebratory high leap with waving arms)
3. **Love / Kudos**: `(♥‿♥)`, `(人´∀｀)`, `(◍•ᴗ•◍)` (Heartbeat double pulse & snuggle tilt)
4. **Mindblown / Idea**: `( ✧Д✧)`, `(★ω★)`, `( ﾟヮﾟ)` (Sparkle gleam & fast sparkle wobble)
5. **Panic / Tableflip**: `(╯°□°)╯`, `(ノಠ益ಠ)ノ`, `(;￣Д￣)` (Violent table-flip jolt)
6. **Exhausted / Burnout**: `(×_×)`, `(っ- ‸ -ς)`, `(-.-)Zzz` (Dizzy teetering slump)
7. **Crying / Heartbreak**: `ಥ_ಥ`, `(T_T)`, `( ; _ ; )` (Sobbing heave & tremble)
8. **Nervous / Sweating**: `(・_・;)`, `(￣▽￣;)`, `(•᷄- •᷅ )` (Anxious rapid shiver)
9. **Skeptical / Side-Eye**: `(¬_¬)`, `(¬‿¬)` (Deliberate dramatic side-eye shift)
10. **Cool / Chill**: `(⌐■_■)`, `( •_•)>⌐■-■` (Swagger nod)
11. **Joy / Happy**: `(ᵔ◡ᵔ)`, `(✿◠‿◠)`, `(＾◡＾)` (Double hop & giggly tilt)
12. **Angry / Rage**: `(ಠ_ಠ)`, `(｀Д´)`, `(╬ಠ益ಠ)` (Indignant rapid rumble)
13. **Shock / Alert**: `(°ロ°!)`, `(⊙_⊙;)`, `(ﾟOﾟ)` (Startled high leap & spring recoil)
14. **Curious / Confused**: `(⊙_⊙)`, `(・・?)`, `(˘･_･˘)` (Cocked head-tilt left & right)
15. **Neutral / Deadpan**: `( -_- )`, `(._.)`, `(・_・)` (Sarcastic deadpan hop)

## Technical Architecture
- **Compositor-Only Motion**: Strictly uses `transform: translate3d(...) rotate(...) scale3d(...)` for 60fps performance on low-end mobile devices.
- **Ambient Idle**: `@keyframes emotIdleFloat` adds gentle breathing so idle cards look alive.
- **Deterministic Hashing**: `getVariant(list, seed)` hashes card `a.id` so a card maintains the same variant consistently.
- **Responsive Sizing**: `clamp(2rem, 3.8vw, 2.6rem)` with `max-width: 100%` and `white-space: nowrap` prevents card overflow.
