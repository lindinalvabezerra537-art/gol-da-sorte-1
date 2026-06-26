---
name: Gol da Sorte ball overlay positions
description: Pixel-scan + real device calibration confirmed overlay positions for Gol da Sorte PWA
---

## Image dimensions
1125 × 2175 px, aspect ratio 0.5172

## IMPORTANT: raw image vs real device discrepancy
Raw pixel scan of image gives different yF than what appears on the user's Android device.
Always prefer WhatsApp screenshot measurements for RIGHT PANEL y-axis calibration.
- Raw image scan: "JOGADAS 12" at yF=0.110-0.126
- Real device (WA screenshot 826×1280): "JOGADAS 12" at yF≈0.289-0.306
- Discrepancy caused by browser chrome (address bar, nav bar) shrinking effective viewport

## RIGHT PANEL calibrated positions (from real device WA screenshot)

| Element | x | y | w | h | Notes |
|---|---|---|---|---|---|
| JOGADAS counter (real number) | 0.675 | **0.188** | 0.130 | 0.048 | User confirmed "perfeito" |
| "+" buy button | 0.795 | 0.188 | 0.080 | 0.048 | Right of counter |
| "JOGADAS 12 +" black mask | 0.618 | **0.249** | 0.285 | 0.082 | Covers static image text |
| CONVIDAR AGORA button | 0.608 | 0.569 | 0.272 | 0.052 | Purple button |

## Ball row positions (raw image fractions — still valid for LEFT panel)
```
R0: y=[0.764, 0.848], x=[[0.086,0.191],[0.200,0.304],[0.313,0.415]]
R1: y=[0.654, 0.738], x=[[0.086,0.191],[0.200,0.304],[0.313,0.415]]
R2: y=[0.544, 0.628], x=[[0.086,0.191],[0.200,0.304],[0.313,0.415]]
R3: y=[0.409, 0.493], x=[[0.183,0.330],[0.327,0.434],[0.435,0.544]]
R4: y=[0.317, 0.401], x=[[0.183,0.330],[0.327,0.434],[0.435,0.544]]
R5: y=[0.213, 0.297], x=[[0.086,0.191],[0.200,0.304],[0.313,0.415]]
JOGAR: ov(0.030, 0.860, 0.560, 0.052)
```

## Row wrong-ball counts
ROW_WRONG_COUNT = [1, 1, 2, 2, 2, 1]

## How to re-calibrate
Set TOUCH_CALIB=true in App.tsx. User taps element, logs show xF/yF.
Use onTouchEnd with changedTouches (NOT onTouchStart — iOS needs changedTouches).

**Why:** Ball positions are purely geometric (left panel, predictable from raw image). Right panel UI elements depend on device viewport+chrome — always use real device screenshot for those.
