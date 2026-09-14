import { describe, it, expect } from 'vitest';
import { SPIN_SCORE_TIERS } from '../../packages/database/prisma/tiers';

/**
 * Regression: SPIN Score bands once had a gap at volume 0 (minVolume 1),
 * an overlap at 50000 (two rows matched), and a closed top (maxVolume
 * 100000 left volume >100k unbilled → `run()` 400'd). Bands must tile
 * [0, ∞) contiguously.
 */
describe('SPIN Score pricing bands', () => {
  const bands = [...SPIN_SCORE_TIERS].sort((a, b) => a.minVolume - b.minVolume);

  it('starts at volume 0 so new orgs are priced', () => {
    expect(bands[0]?.minVolume).toBe(0);
  });

  it('is contiguous with no overlaps', () => {
    for (let i = 0; i < bands.length - 1; i++) {
      expect(bands[i + 1]?.minVolume).toBe((bands[i]?.maxVolume ?? -1) + 1);
    }
  });

  it('is open-ended at the top', () => {
    expect(bands[bands.length - 1]?.maxVolume).toBeNull();
  });

  it('keeps the PDF-exact step prices', () => {
    expect(bands.map((b) => b.unitPriceMinor)).toEqual([
      13000, 12500, 12000, 11500, 10500, 9500,
    ]);
  });
});
