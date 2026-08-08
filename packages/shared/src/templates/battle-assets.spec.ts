import {
  castleAssetKey,
  troopSpriteUrl,
  resolveBattleAssets,
  BATTLE_DEFAULT_ASSETS,
  CASTLE_DAMAGE_TIERS,
} from '../types';

const full = {
  castle_cat: 'intact.png',
  castle_cat_damaged: 'damaged.png',
  castle_cat_ruined: 'ruined.png',
};

describe('castleAssetKey', () => {
  it('picks artwork by remaining health', () => {
    expect(castleAssetKey('cat', 1000, 1000, full)).toBe('intact.png');
    expect(castleAssetKey('cat', 500, 1000, full)).toBe('damaged.png');
    expect(castleAssetKey('cat', 100, 1000, full)).toBe('ruined.png');
  });

  it('falls back to a tier the template does supply', () => {
    // A missing damaged sprite must not blank the castle at the exact moment it
    // is under attack, which is when the audience is looking at it.
    expect(castleAssetKey('cat', 500, 1000, { castle_cat: 'intact.png' })).toBe('intact.png');
    expect(castleAssetKey('cat', 1000, 1000, { castle_cat_ruined: 'ruined.png' })).toBe(
      'ruined.png',
    );
  });

  it('returns nothing when the template has no castle art at all', () => {
    // The caller then draws its own, rather than rendering a broken image.
    expect(castleAssetKey('cat', 1000, 1000, {})).toBeUndefined();
    expect(castleAssetKey('cat', 1000, 1000, undefined)).toBeUndefined();
  });

  it('never divides by a zero maximum', () => {
    expect(castleAssetKey('cat', 0, 0, full)).toBe('intact.png');
  });

  it('clamps health outside its own range', () => {
    expect(castleAssetKey('cat', -50, 1000, full)).toBe('ruined.png');
    expect(castleAssetKey('cat', 5000, 1000, full)).toBe('intact.png');
  });

  it('keeps the tiers ordered from healthiest down', () => {
    const thresholds = CASTLE_DAMAGE_TIERS.map((t) => t.minHpPercent);
    expect([...thresholds].sort((a, b) => b - a)).toEqual(thresholds);
  });
});

describe('troopSpriteUrl', () => {
  it('reads the sheet for one kingdom', () => {
    expect(troopSpriteUrl('dog', { sprite_troop_dog: 'dog.png' })).toBe('dog.png');
  });

  it('returns nothing when the kingdom has no sheet', () => {
    expect(troopSpriteUrl('dog', { sprite_troop_cat: 'cat.png' })).toBeUndefined();
    expect(troopSpriteUrl('dog', undefined)).toBeUndefined();
  });
});

describe('resolveBattleAssets', () => {
  it('gives every kingdom artwork before anyone uploads any', () => {
    const resolved = resolveBattleAssets(undefined);

    for (const team of ['cat', 'dog', 'bear', 'capy']) {
      expect(troopSpriteUrl(team, resolved)).toBeDefined();
      expect(castleAssetKey(team, 1000, 1000, resolved)).toBeDefined();
      expect(castleAssetKey(team, 100, 1000, resolved)).toBeDefined();
    }
  });

  it('lets a template override one key without losing the rest', () => {
    const resolved = resolveBattleAssets({ castle_cat: 'https://cdn/custom.png' });

    expect(castleAssetKey('cat', 1000, 1000, resolved)).toBe('https://cdn/custom.png');
    // Overriding the cat castle must not blank the dog's.
    expect(castleAssetKey('dog', 1000, 1000, resolved)).toBe(
      BATTLE_DEFAULT_ASSETS.castle_dog,
    );
  });

  it('does not mutate the shipped defaults', () => {
    const before = { ...BATTLE_DEFAULT_ASSETS };
    resolveBattleAssets({ castle_cat: 'x' });

    // A round that overrode a key would otherwise poison every later round in
    // the same browser session.
    expect(BATTLE_DEFAULT_ASSETS).toEqual(before);
  });

  it('points every default at a path under /battle', () => {
    for (const url of Object.values(BATTLE_DEFAULT_ASSETS)) {
      expect(url.startsWith('/battle/')).toBe(true);
      expect(url.endsWith('.svg')).toBe(true);
    }
  });
});
