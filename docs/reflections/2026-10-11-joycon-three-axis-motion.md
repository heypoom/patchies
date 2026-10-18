# Joy-Con Three-Axis Motion

## Objective

Make `joycon` a general-purpose controller with simultaneous X/Y/Z angles and independent per-axis threshold events.

## Key Challenges & Solutions

- The tracker already computed every axis but exposed only the selected swing angle. Expose a copied angle tuple and track threshold state separately for each axis.
- Replace forward/backward terminology with positive/negative and include the axis on each event. Poom approved replacing the old API without a compatibility adapter.
- Keep angles streaming independently of the event threshold. Replace the single-axis meter with three meters.

## What Could Be Better

These independent angle estimates are not full 3D orientation. Gravity cannot correct rotation around its own axis, so that estimate can drift.

## Action Items

- Verify calibration and simultaneous axis motion with physical controllers.
