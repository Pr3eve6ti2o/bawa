1. **Yes.** Pin jsqr to 1.4.0, long to 5.3.2, and viem to 2.58.0. This corrects inconsistent pinning without upgrading. Keep lockfile manifest metadata aligned while preserving existing resolutions.

2. **No additional version risk is established.** The lock already selects viem 2.58.0. Pinning prevents automatic patch uptake, but 2.58.2 being newer does not establish that 2.58.0 is broken or vulnerable.

3. **Yes, add MIT license metadata to both packages**, consistent with the root LICENSE. A contracts description is optional. Adding engines matching Node >=22 <23 is sensible if contracts follows the same repository-wide Node policy; its absence alone is not a dependency defect.

4. **No other confirmed issue from the supplied facts.** All 60 dependencies are used and represented in the lock. wallet-core versions match across packages, and the Node/npm settings show no demonstrated contradiction. CSS, tooling, and type-only usage all count as legitimate usage.

5. **Yes, retain lucide-react 1.14.0.** The newer 1.76.0 alone does not justify upgrading under your rule. No qualifying breakage or precisely identified vulnerability has been provided.