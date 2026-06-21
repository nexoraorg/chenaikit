import { hashPassword, comparePassword } from '../password';
import bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('Password Utils', () => {
  const mockPassword = 'SecurePass123!';
  const mockHash = '$2b$10$mockhashedpassword';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('hashPassword', () => {
    it('should hash password with bcrypt', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue(mockHash);

      const result = await hashPassword(mockPassword);

      expect(bcrypt.hash).toHaveBeenCalledWith(mockPassword, expect.any(Number));
      expect(result).toBe(mockHash);
    });

    it('should use salt rounds from environment or default', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue(mockHash);

      await hashPassword(mockPassword);

      expect(bcrypt.hash).toHaveBeenCalledWith(mockPassword, expect.any(Number));
    });
  });

  describe('comparePassword', () => {
    it('should return true for matching password', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await comparePassword(mockPassword, mockHash);

      expect(bcrypt.compare).toHaveBeenCalledWith(mockPassword, mockHash);
      expect(result).toBe(true);
    });

    it('should return false for non-matching password', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await comparePassword('WrongPassword', mockHash);

      expect(result).toBe(false);
    });

    it('should handle bcrypt errors', async () => {
      (bcrypt.compare as jest.Mock).mockRejectedValue(new Error('Bcrypt error'));

      await expect(comparePassword(mockPassword, mockHash)).rejects.toThrow('Bcrypt error');
    });
  });
});
