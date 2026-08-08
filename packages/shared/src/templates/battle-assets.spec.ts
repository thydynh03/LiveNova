import { castleAssetKey, troopSpriteUrl, CASTLE_DAMAGE_TIERS } from '../types';

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
