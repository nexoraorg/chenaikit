import {
  normalizeVersion,
  isSupportedVersion,
  isDeprecated,
  isSunset,
  compareSemver,
  resolveVersion,
  DEFAULT_VERSION,
} from '../versionUtils';

describe('normalizeVersion', () => {
  it.each([
    ['v1', 'v1'],
    ['V2', 'v2'],
    ['1', 'v1'],
    ['2.0.0', 'v2'],
    ['v1.5', 'v1'],
    ['  v2  ', 'v2'],
  ])('normalizes %s -> %s', (input, expected) => {
    expect(normalizeVersion(input)).toBe(expected);
  });

  it.each([[''], ['abc'], ['vX'], [null], [undefined]])('returns null for %s', (input) => {
    expect(normalizeVersion(input as any)).toBeNull();
  });
});

describe('isSupportedVersion', () => {
  it('recognizes registered versions', () => {
    expect(isSupportedVersion('v1')).toBe(true);
    expect(isSupportedVersion('v2')).toBe(true);
    expect(isSupportedVersion('v9')).toBe(false);
    expect(isSupportedVersion(null)).toBe(false);
  });
});

describe('lifecycle helpers', () => {
  it('flags v1 as deprecated and v2 as not', () => {
    expect(isDeprecated('v1')).toBe(true);
    expect(isDeprecated('v2')).toBe(false);
  });

  it('treats v1 as not yet sunset before its sunset date', () => {
    expect(isSunset('v1', new Date('2026-06-01'))).toBe(false);
  });

  it('treats v1 as sunset on/after its sunset date', () => {
    expect(isSunset('v1', new Date('2027-01-01'))).toBe(true);
  });

  it('never sunsets a version without a sunset date', () => {
    expect(isSunset('v2', new Date('2099-01-01'))).toBe(false);
  });
});

describe('compareSemver', () => {
  it('compares versions correctly', () => {
    expect(compareSemver('1.0.0', '2.0.0')).toBe(-1);
    expect(compareSemver('2.1.0', '2.0.5')).toBe(1);
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
  });
});

describe('resolveVersion', () => {
  it('honors precedence path > header > query', () => {
    expect(resolveVersion({ path: 'v2', header: 'v1', query: 'v1' })).toEqual({
      version: 'v2',
      source: 'path',
    });
    expect(resolveVersion({ header: 'v2', query: 'v1' })).toEqual({
      version: 'v2',
      source: 'header',
    });
    expect(resolveVersion({ query: 'v2' })).toEqual({ version: 'v2', source: 'query' });
  });

  it('returns the default version when nothing is supplied', () => {
    expect(resolveVersion({})).toEqual({ version: DEFAULT_VERSION, source: 'default' });
  });

  it('returns null for an explicit unsupported version', () => {
    expect(resolveVersion({ header: 'v9' })).toBeNull();
  });
});
