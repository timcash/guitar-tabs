# Virtual Right Hand Implementation Plan

Goal: Add a visual representation of the plucking hand at the bridge/pluck zone to show which fingers are used for specific strings.

## 1. Hand Model (Geometric Primitive Approach)
Instead of a complex rigged mesh with Inverse Kinematics, we will use a **Procedural Geometric Model** for better performance and easier control:
- **Palm**: A slightly flattened box/capsule.
- **Fingers**: Each finger (Thumb, Index, Middle, Ring) will be composed of 2-3 segments (Cylinders) connected by joints (Group nodes).
- **Styling**: Semi-transparent holographic or "wireframe" look to avoid obstructing the view of the strings.
- **Geometry seam first**: Keep the placement and animation math in a pure module (`src/handGeometry.ts`) so we can test finger targets, mirrored handedness, and pluck curves without depending on Three.js scene state.
- **Per-finger rig shape**:
  - Thumb: 2 segments, wider radius, allowed to shift across strings 6-4.
  - Index/Middle/Ring: 3 segments each, anchored above strings 3/2/1 respectively.
  - Palm root: one parent `Group` positioned just behind `bridgeZ`, with all finger bases expressed in local coordinates so flipping handedness can be handled by mirroring the X targets rather than rebuilding the rig.
- **Pose model**: each finger should resolve to a small struct like `{ x, y, z, curl, glow }`, where `x/y/z` is the fingertip target and `curl` drives segment rotations. This keeps render code dumb and lets tests assert geometry directly.

## 2. Finger-to-String Mapping (Standard Fingerstyle)
We will implement a standard `p-i-m-a` mapping:
- **Thumb (p)**: Assigned to strings 6, 5, and 4 (Bass strings).
- **Index (i)**: Assigned to string 3.
- **Middle (m)**: Assigned to string 2.
- **Ring (a)**: Assigned to string 1.
- **Home positions**: thumb defaults to string 4 when idle; `i/m/a` stay parked over `3/2/1`.
- **Mirroring rule**: use the same string numbering and just mirror `x` from the existing `getStringX` convention when `isFlippedX` changes.

## 3. Animation Logic
- **Idle State**: Fingers "hover" slightly above their assigned strings in a relaxed arc.
- **Pluck Action**: 
    - When `triggerPluck` is called, the corresponding finger will "flick" (rotate its segments) towards the palm.
    - Uses a simple interpolation (Tween) or a damped harmonic oscillator for a natural return to idle.
- **Thumb Movement**: The thumb will move laterally (along the X-axis) to reach strings 6, 5, or 4 as needed.
- **Time source**: prefer absolute timestamps (`performance.now()` or song elapsed ms) over frame-count deltas so hand tests can sample exact poses deterministically.
- **Recommended pluck envelope**:
  - Attack: ~40-50ms to full curl.
  - Release: ~120-150ms back to rest.
  - Travel: small negative `z` pull plus slight downward `y` dip; avoid large lateral sweeps except for thumb retargeting between bass strings.
- **State boundary**: store only `lastPluckAt` and `lastPluckedString` per finger. The rendered pose should be recomputed every frame from the pure geometry helpers, not incrementally mutated.

## 4. Integration Steps
1. **Pure math first**: land and stabilize `src/handGeometry.ts` with Vitest coverage for mapping, flipped handedness, thumb retargeting, and pluck envelopes.
2. **Renderer component**: add a `VirtualHand` helper used by `FretboardRenderer`, but keep it separate from note/explosion code so the hand rig can be updated independently.
3. **Setup**: initialize one hand root `Group` near `bridgeZ` and build reusable meshes for palm and finger segments once in the constructor.
4. **Trigger boundary**: add a dedicated `triggerHandPluck(stringNum, atMs)` method instead of overloading `triggerExplosion`. Audio, particles, and hand motion all happen off the same pluck event, but they should not share implementation.
5. **Frame update**: update the hand with the current absolute time each render (`hand.update(nowMs, activeString, isFlippedX)`), then derive mesh transforms from the pure pose data.
6. **Debug surface**: if iteration gets slow inside the full song loop, add a minimal hand-only debug route/component that cycles strings 6->1 and logs sampled finger poses without the rest of the scene.

## 5. Visual Polish
- Add a subtle "glow" to the finger that just plucked.
- Ensure the hand responds to the `isFlippedX` state (Left-handed vs Right-handed).
- Keep the palm slightly above and behind the pluck zone so the hand reads as a guide overlay, not a physical occluder over the strings.
- Start with simple translucent materials until geometry and timing feel correct; only then add wireframe accents or joint detail.

## 6. Test Strategy
- **Unit tests**: keep fast tests around `handGeometry.ts` only. Verify `p-i-m-a` mapping, mirrored `x` coordinates, thumb movement on bass strings, and that pluck poses return to rest after the animation window.
- **Renderer smoke test**: once the rig exists, extend the browser test to toggle playback and confirm no exceptions when the hand is active.
- **Logging**: mirror the existing `TEST_GEOM` pattern with a low-volume hand log such as `TEST_HAND: finger=p string=5 curl=0.82 x=-3.00` behind a debug flag so geometry changes can be inspected without flooding the console.
