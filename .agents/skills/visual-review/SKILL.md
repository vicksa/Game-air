---
name: hand-quest-visual-review
description: Use after visual changes to review screenshots and game motion against the arcade art direction.
---

Read docs/ART_DIRECTION.md. Run the browser tests and inspect test-results/title.png, gameplay.png and mobile.png. Check actual rendered output: hierarchy, spacing, text clipping, contrast, focus rings and primary-action visibility. Inspect character silhouettes against each background and ensure platforms and spikes read immediately. Check sprite alignment and transparent edges; use the animation preview page for individual states.

Review keyboard start, camera failure, tutorial, pause, tracking loss, victory and defeat. Verify reduced-motion suppresses shake, flashes and decorative blinking. Record what was tested and what needs a physical camera in docs/VALIDATION.md. Correct issues before publishing; do not describe the camera flow as physically validated without real footage or hardware.
