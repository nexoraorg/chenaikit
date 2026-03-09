import { formatAccountId, validateStellarAddress } from '../helpers';

describe('Helpers Utils', () => {
  describe('formatAccountId', () => {
    it('should throw error as not implemented', () => {
      expect(() => formatAccountId('test')).toThrow('Not implemented yet - see issue #23');
    });
  });

  describe('validateStellarAddress', () => {
    it('should throw error as not implemented', () => {
      expect(() => validateStellarAddress('test')).toThrow('Not implemented yet - see issue #23');
    });
  });
});
