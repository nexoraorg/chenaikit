import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  FormControl,
  Select,
  MenuItem,
  Typography,
  Tooltip,
  Avatar,
  Chip
} from '@mui/material';
import { supportedLanguages, changeLanguage, getCurrentLanguage } from '../i18n/config';

interface LanguageSwitcherProps {
  variant?: 'select' | 'chip' | 'avatar';
  size?: 'small' | 'medium' | 'large';
  showFlag?: boolean;
  showNativeName?: boolean;
  compact?: boolean;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  variant = 'select',
  size = 'medium',
  showFlag = true,
  showNativeName = true,
  compact = false
}) => {
  const { i18n } = useTranslation();
  const currentLang = getCurrentLanguage();

  const handleLanguageChange = (event: any) => {
    const newLanguage = event.target.value;
    changeLanguage(newLanguage);
  };

  const getCurrentLanguageInfo = () => {
    return supportedLanguages.find(lang => lang.code === currentLang) || supportedLanguages[0];
  };

  const renderSelectVariant = () => (
    <FormControl size={size === 'large' ? 'medium' : size}>
      <Select
        value={currentLang}
        onChange={handleLanguageChange}
        displayEmpty
        sx={{
          minWidth: compact ? 120 : 200,
          '& .MuiSelect-select': {
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }
        }}
      >
        {supportedLanguages.map((language) => (
          <MenuItem key={language.code} value={language.code}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {showFlag && (
                <Typography sx={{ fontSize: '1.2em' }}>
                  {language.flag}
                </Typography>
              )}
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {language.nativeName}
                </Typography>
                {!compact && (
                  <Typography variant="caption" color="text.secondary">
                    {language.name}
                  </Typography>
                )}
              </Box>
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );

  const renderChipVariant = () => {
    const currentLangInfo = getCurrentLanguageInfo();
    
    return (
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {supportedLanguages.map((language) => (
          <Chip
            key={language.code}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {showFlag && (
                  <Typography sx={{ fontSize: '0.9em' }}>
                    {language.flag}
                  </Typography>
                )}
                {showNativeName ? language.nativeName : language.name}
              </Box>
            }
            onClick={() => changeLanguage(language.code)}
            variant={language.code === currentLang ? 'filled' : 'outlined'}
            color={language.code === currentLang ? 'primary' : 'default'}
            size={size === 'large' ? 'medium' : size}
            clickable
            sx={{
              '&:hover': {
                backgroundColor: language.code === currentLang ? 'primary.dark' : 'action.hover'
              }
            }}
          />
        ))}
      </Box>
    );
  };

  const renderAvatarVariant = () => {
    const currentLangInfo = getCurrentLanguageInfo();
    
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Tooltip title={i18n.t('settings.language')}>
          <Avatar
            sx={{
              width: size === 'large' ? 48 : size === 'small' ? 32 : 40,
              height: size === 'large' ? 48 : size === 'small' ? 32 : 40,
              fontSize: size === 'large' ? '1.5em' : size === 'small' ? '1em' : '1.2em',
              cursor: 'pointer',
              backgroundColor: 'primary.main',
              '&:hover': {
                backgroundColor: 'primary.dark'
              }
            }}
            onClick={() => {
              // Cycle through languages
              const currentIndex = supportedLanguages.findIndex(lang => lang.code === currentLang);
              const nextIndex = (currentIndex + 1) % supportedLanguages.length;
              changeLanguage(supportedLanguages[nextIndex].code);
            }}
          >
            {currentLangInfo.flag}
          </Avatar>
        </Tooltip>
        {!compact && (
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {currentLangInfo.nativeName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {currentLangInfo.name}
            </Typography>
          </Box>
        )}
      </Box>
    );
  };

  const renderCompactVariant = () => {
    const currentLangInfo = getCurrentLanguageInfo();
    
    return (
      <Tooltip title={`${currentLangInfo.nativeName} (${currentLangInfo.name})`}>
        <Typography
          sx={{
            fontSize: '1.5em',
            cursor: 'pointer',
            userSelect: 'none',
            '&:hover': {
              transform: 'scale(1.1)',
              transition: 'transform 0.2s'
            }
          }}
          onClick={() => {
            // Cycle through languages
            const currentIndex = supportedLanguages.findIndex(lang => lang.code === currentLang);
            const nextIndex = (currentIndex + 1) % supportedLanguages.length;
            changeLanguage(supportedLanguages[nextIndex].code);
          }}
        >
          {currentLangInfo.flag}
        </Typography>
      </Tooltip>
    );
  };

  switch (variant) {
    case 'chip':
      return renderChipVariant();
    case 'avatar':
      return renderAvatarVariant();
    case 'compact':
      return renderCompactVariant();
    default:
      return renderSelectVariant();
  }
};

// Language selector for mobile/drawer
export const MobileLanguageSelector: React.FC = () => {
  const { t } = useTranslation();
  const currentLang = getCurrentLanguage();

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        {t('settings.language')}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {supportedLanguages.map((language) => (
          <Box
            key={language.code}
            onClick={() => changeLanguage(language.code)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              p: 2,
              borderRadius: 1,
              cursor: 'pointer',
              backgroundColor: language.code === currentLang ? 'action.selected' : 'transparent',
              '&:hover': {
                backgroundColor: 'action.hover'
              }
            }}
          >
            <Typography sx={{ fontSize: '1.5em' }}>
              {language.flag}
            </Typography>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {language.nativeName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {language.name}
              </Typography>
            </Box>
            {language.code === currentLang && (
              <Typography color="primary.main">
                ✓
              </Typography>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
};

// Language info display component
export const LanguageInfo: React.FC = () => {
  const { t, i18n } = useTranslation();
  const currentLang = getCurrentLanguage();
  const currentLangInfo = supportedLanguages.find(lang => lang.code === currentLang) || supportedLanguages[0];

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography sx={{ fontSize: '1.2em' }}>
        {currentLangInfo.flag}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {currentLangInfo.nativeName}
      </Typography>
    </Box>
  );
};

export default LanguageSwitcher;
