---
name: hand-quest-sprite-animation
description: Use when drawing or changing character sprites, obstacles, effects or animation timing.
---

Read docs/ART_DIRECTION.md and public/assets/atlas.json. Character sheets use 48×48 cells, six columns, seven animation rows; origin is bottom center. Preserve transparent padding and consistent feet alignment. The animation rows are idle, run, jump, attack, defend, hurt and death. Keep collisions independent from the visible sprite.

Create distinctive silhouette details for each enemy role. Keep outline, light direction and pixel size consistent. Attacks need a preparation, contact and recovery phase; expose the active interval in gameplay code. Verify a single held gesture cannot repeatedly attack or jump. Regenerate through scripts/generate_assets.py (Pillow required), inspect the sheets and test them in motion. Do not claim visual review from code inspection alone.
