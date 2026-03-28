# Optimize for 30 FPS:

In a previous session we identified ways to improve performance on android to 30 FPS. Create a plan for the following 

ORDER OF EFFORT:
1. DPR Capping (Check scene.js onResize). 
    Check pixel ratio first — `setPixelRatio` is only called in `onResize` in scene.js; if the phone fires resize and jumps to DPR=2, rendering 4x pixels. Fix: cap DPR at 1 for mid on mobile. 
    Expect Potentially 2-4x gain alone.
2. Shadow PCF reduction (Check shadows in config.js)
    Reduce from 5-tap to 1-tap on mid preset. Expect ~10-15% gain.
3. Grid Resizing (Check mid-preset in config.js)
    Reduce mid grid to 96³ — from 128³, cuts DDA steps by ~25%. Tweak preset in config.js.
4. Hierarchical DDA / empty-space skipping — complex, but 2-3x gain in sparse scenes. Last resort.

TASK: Analyze the current files and identify which steps are missing.
