# Multi-Factor Authentication (MFA) - User Guide

## Overview

ChenAIKit provides a Time-based One-Time Password (TOTP) based Multi-Factor Authentication (MFA) system compliant with RFC 6238 and NIST 800-63B guidelines. This adds an additional layer of security to user accounts.

## Features

- **TOTP-based authentication** using authenticator apps (Google Authenticator, Authy, Microsoft Authenticator, etc.)
- **10 one-time backup codes** for account recovery
- **Recovery email flow** for resetting MFA when access is lost
- **Rate limiting** - 5 MFA attempts per 5 minutes
- **Account lockout** after 10 consecutive failed attempts (30-minute lockout)
- **Time window tolerance** of ±1 step (60 seconds) to handle clock drift

## User Enrollment Flow

### Step 1: Navigate to Security Settings
1. Log in to your ChenAIKit account
2. Go to `Settings > Security`
3. Click **"Enable Two-Factor Authentication"**

### Step 2: Scan QR Code
1. A QR code will be displayed on screen
2. Open your authenticator app (Google Authenticator, Authy, etc.)
3. Tap the **+** icon and select **"Scan QR code"**
4. Point your camera at the QR code on screen
5. The app will add "ChenAIKit (your-email)" as a new entry

### Step 3: Verify Setup
1. Your authenticator app will display a 6-digit code that refreshes every 30 seconds
2. Enter this code in the verification field on the website
3. Click **"Verify"**

### Step 4: Save Backup Codes
1. After verification, 10 backup codes will be displayed
2. **Save these codes in a secure location** (password manager, encrypted file, printed copy)
3. Each backup code can be used **only once**
4. Click **"Done"** to complete the setup

## Using MFA

### During Login
1. Enter your email and password as usual
2. If MFA is enabled, you will be prompted to enter a verification code
3. Open your authenticator app and enter the current 6-digit code
4. Alternatively, use a backup code if you don't have access to your authenticator app

### Backup Codes
- Click **"Use a backup code"** on the MFA challenge screen
- Enter one of your 10 backup codes
- The used backup code will be removed from your account
- You can regenerate backup codes from Security Settings

## Recovery Flow

### If You Lose Access to Your Authenticator App

1. On the MFA challenge screen, click **"Lost access?"**
2. Enter your recovery email address
3. A recovery email will be sent with a link (valid for 15 minutes)
4. Click the link and follow the instructions to reset your MFA
5. A new QR code and backup codes will be generated

## Managing MFA

### Disabling MFA
1. Go to `Settings > Security`
2. Click **"Disable Two-Factor Authentication"**
3. Enter your password to confirm
4. MFA will be immediately disabled

### Regenerating Backup Codes
1. Go to `Settings > Security`
2. If MFA is enabled, click **"Regenerate Backup Codes"**
3. Save the new codes shown

### Checking MFA Status
- `GET /api/auth/mfa/status` - Returns current MFA configuration status
- View in Security Settings UI

## Security Considerations

### NIST 800-63B Compliance
- TOTP secrets are encrypted at rest using AES-256-GCM
- Backup codes are stored as bcrypt hashes
- Rate limiting prevents brute force attacks
- Account lockout after repeated failures
- Secure recovery flow with encrypted tokens

### Best Practices
- Always save backup codes in a secure location
- Use a reputable authenticator app
- Keep your recovery email up to date
- Never share your MFA codes or backup codes
- If you suspect compromise, disable and re-enable MFA immediately

## Troubleshooting

### "Invalid MFA token" Error
- Ensure the code hasn't expired (codes refresh every 30 seconds)
- Check that your device's time is synchronized correctly
- Try using a backup code instead

### "Account locked" Error
- Wait 30 minutes for the lockout to expire
- Use the recovery email flow to reset MFA
- Contact support for admin override if needed

### Recovery Email Not Received
- Check spam/junk folder
- Ensure your recovery email is correct
- Contact support if the issue persists

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/mfa/setup` | POST | Initialize MFA setup, returns QR code URL |
| `/api/auth/mfa/verify` | POST | Verify TOTP token and enable MFA |
| `/api/auth/mfa/challenge` | POST | Verify TOTP during login session |
| `/api/auth/mfa/disable` | POST | Disable MFA (requires password) |
| `/api/auth/mfa/status` | GET | Get current MFA status |
| `/api/auth/mfa/backup-codes` | GET | Get list of remaining backup codes |
| `/api/auth/mfa/backup-codes/regenerate` | POST | Generate new backup codes |
| `/api/auth/mfa/recovery/send` | POST | Send recovery email |
| `/api/auth/mfa/recovery/complete` | POST | Complete MFA recovery |

## Admin Override

In case of emergencies, administrators can:
1. Access the database directly
2. Set `mfaEnabled = false` and clear `mfaSecret` for the affected user
3. Instruct the user to set up MFA again from Security Settings

**Note:** Admin override should only be used in verified emergency situations and should be logged and audited.