import { getImage, preload, resetImageCache } from './image-cache';

/**
 * jsdom's Image never loads anything, so the handlers are driven by hand. Every
 * created instance is captured to check how many requests actually went out.
 */
class FakeImage {
  static instances: FakeImage[] = [];

  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  crossOrigin: string | null = null;
  width = 128;
  height = 32;

  private _src = '';

  constructor() {
    FakeImage.instances.push(this);
  }

  set src(value: string) {
    this._src = value;
  }

  get src() {
    return this._src;
  }
}

beforeAll(() => {
  (globalThis as unknown as { Image: unknown }).Image = FakeImage;
});

beforeEach(() => {
  FakeImage.instances = [];
  resetImageCache();
});

describe('image cache', () => {
  it('returns null while an image is still loading', () => {
    expect(getImage('a.png')).toBeNull();
    expect(FakeImage.instances).toHaveLength(1);
  });

  it('hands back the decoded image once it loads', () => {
    getImage('a.png');
    FakeImage.instances[0].onload!();

    expect(getImage('a.png')).toBe(FakeImage.instances[0] as unknown as HTMLImageElement);
  });

  it('requests each url once, however often it is drawn', () => {
    // The draw loop asks sixty times a second; one request per frame would be a
    // request storm on the streamer's machine.
    for (let i = 0; i < 50; i += 1) getImage('a.png');

    expect(FakeImage.instances).toHaveLength(1);
  });

  it('remembers a failure instead of retrying forever', () => {
    getImage('broken.png');
    FakeImage.instances[0].onerror!();

    for (let i = 0; i < 20; i += 1) expect(getImage('broken.png')).toBeNull();

    // One bad asset must not turn into twenty requests a second.
    expect(FakeImage.instances).toHaveLength(1);
  });

  it('sets crossOrigin so the canvas is not tainted', () => {
    getImage('a.png');
    expect(FakeImage.instances[0].crossOrigin).toBe('anonymous');
  });

  it('ignores an absent url without creating a request', () => {
    expect(getImage(undefined)).toBeNull();
    expect(FakeImage.instances).toHaveLength(0);
  });

  it('preloads a whole set, skipping the gaps', () => {
    preload(['a.png', undefined, 'b.png']);
    expect(FakeImage.instances).toHaveLength(2);
  });
});
