import { frameBudget } from './frame-budget';

describe('frameBudget', () => {
  beforeEach(() => frameBudget._reset());

  it('starts at full quality, so a healthy machine is never handicapped', () => {
    expect(frameBudget.quality).toBe('full');
    expect(frameBudget.loadScale).toBe(1);
  });

  it('sheds load in steps rather than all at once', () => {
    frameBudget._forFrameTime(30); // ~33fps
    expect(frameBudget.quality).toBe('reduced');
    expect(frameBudget.loadScale).toBe(0.5);

    frameBudget._forFrameTime(50); // ~20fps
    expect(frameBudget.quality).toBe('minimal');
    expect(frameBudget.loadScale).toBe(0.25);
  });

  it('will not recover at the same frame time it degraded at', () => {
    frameBudget._forFrameTime(30);
    expect(frameBudget.quality).toBe('reduced');

    // Just under the degrade threshold is not enough to come back. Without this
    // gap a frame time sitting on the boundary flips tiers every sample, and
    // density that flickers reads as a bug — worse than staying conservative.
    frameBudget._forFrameTime(23);
    expect(frameBudget.quality).toBe('reduced');

    frameBudget._forFrameTime(15);
    expect(frameBudget.quality).toBe('full');
  });

  it('never scales the troop ceiling to nothing', () => {
    frameBudget._forFrameTime(200);
    // A machine in real trouble still has to show that gifts are doing
    // something. An empty battlefield is indistinguishable from a broken feed.
    expect(frameBudget.loadScale).toBeGreaterThan(0);
  });
});
