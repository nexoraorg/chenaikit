#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const LOCALES_DIR = path.join(__dirname, '../src/locales');
const SUPPORTED_LANGUAGES = ['en', 'es', 'zh'];

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function loadTranslationFile(language) {
  const filePath = path.join(LOCALES_DIR, `${language}.json`);
  
  if (!fs.existsSync(filePath)) {
    log('red', `❌ Translation file not found: ${filePath}`);
    return null;
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    log('red', `❌ Error parsing ${filePath}: ${error.message}`);
    return null;
  }
}

function getAllKeys(obj, prefix = '') {
  const keys = [];
  
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      keys.push(...getAllKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  
  return keys.sort();
}

function validateTranslations() {
  log('blue', '🔍 Validating translations...\n');
  
  const translations = {};
  let hasErrors = false;
  
  // Load all translation files
  for (const lang of SUPPORTED_LANGUAGES) {
    const translation = loadTranslationFile(lang);
    if (translation) {
      translations[lang] = translation;
      log('green', `✅ Loaded ${lang}.json`);
    } else {
      hasErrors = true;
    }
  }
  
  if (hasErrors) {
    log('red', '\n❌ Failed to load all translation files');
    process.exit(1);
  }
  
  // Get all keys from the base language (English)
  const baseKeys = getAllKeys(translations.en);
  log('blue', `\n📊 Found ${baseKeys.length} translation keys in base language\n`);
  
  // Validate each language
  for (const lang of SUPPORTED_LANGUAGES) {
    if (lang === 'en') continue; // Skip base language
    
    const langKeys = getAllKeys(translations[lang]);
    const missingKeys = baseKeys.filter(key => !langKeys.includes(key));
    const extraKeys = langKeys.filter(key => !baseKeys.includes(key));
    
    log('yellow', `\n🌍 Validating ${lang.toUpperCase()} (${langKeys.length} keys):`);
    
    if (missingKeys.length === 0 && extraKeys.length === 0) {
      log('green', `  ✅ All translations present and valid`);
    } else {
      hasErrors = true;
      
      if (missingKeys.length > 0) {
        log('red', `  ❌ Missing ${missingKeys.length} translations:`);
        missingKeys.slice(0, 5).forEach(key => {
          log('red', `    - ${key}`);
        });
        if (missingKeys.length > 5) {
          log('red', `    ... and ${missingKeys.length - 5} more`);
        }
      }
      
      if (extraKeys.length > 0) {
        log('yellow', `  ⚠️  Found ${extraKeys.length} extra keys:`);
        extraKeys.slice(0, 5).forEach(key => {
          log('yellow', `    - ${key}`);
        });
        if (extraKeys.length > 5) {
          log('yellow', `    ... and ${extraKeys.length - 5} more`);
        }
      }
    }
  }
  
  // Check for empty values
  log('blue', '\n🔍 Checking for empty translations...\n');
  
  for (const lang of SUPPORTED_LANGUAGES) {
    const emptyKeys = [];
    
    function checkEmpty(obj, prefix = '') {
      for (const key in obj) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          checkEmpty(obj[key], fullKey);
        } else {
          if (obj[key] === '' || obj[key] === null || obj[key] === undefined) {
            emptyKeys.push(fullKey);
          }
        }
      }
    }
    
    checkEmpty(translations[lang]);
    
    if (emptyKeys.length > 0) {
      hasErrors = true;
      log('red', `❌ ${lang.toUpperCase()}: Found ${emptyKeys.length} empty translations:`);
      emptyKeys.slice(0, 5).forEach(key => {
        log('red', `  - ${key}`);
      });
      if (emptyKeys.length > 5) {
        log('red', `  ... and ${emptyKeys.length - 5} more`);
      }
    } else {
      log('green', `✅ ${lang.toUpperCase()}: No empty translations found`);
    }
  }
  
  // Check for placeholder consistency
  log('blue', '\n🔍 Checking placeholder consistency...\n');
  
  const basePlaceholders = {};
  
  function extractPlaceholders(obj, prefix = '') {
    for (const key in obj) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        extractPlaceholders(obj[key], fullKey);
      } else {
        const placeholders = (obj[key].match(/{{\s*\w+\s*}}/g) || []);
        if (placeholders.length > 0) {
          basePlaceholders[fullKey] = placeholders;
        }
      }
    }
  }
  
  extractPlaceholders(translations.en);
  
  for (const lang of SUPPORTED_LANGUAGES) {
    if (lang === 'en') continue;
    
    const inconsistentKeys = [];
    
    function checkPlaceholders(obj, prefix = '') {
      for (const key in obj) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          checkPlaceholders(obj[key], fullKey);
        } else {
          if (basePlaceholders[fullKey]) {
            const placeholders = (obj[key].match(/{{\s*\w+\s*}}/g) || []);
            const basePlaceholdersSet = new Set(basePlaceholders[fullKey]);
            const placeholdersSet = new Set(placeholders);
            
            if (basePlaceholdersSet.size !== placeholdersSet.size || 
                ![...basePlaceholdersSet].every(p => placeholdersSet.has(p))) {
              inconsistentKeys.push({
                key: fullKey,
                base: basePlaceholders[fullKey],
                current: placeholders
              });
            }
          }
        }
      }
    }
    
    checkPlaceholders(translations[lang]);
    
    if (inconsistentKeys.length > 0) {
      hasErrors = true;
      log('red', `❌ ${lang.toUpperCase()}: Found ${inconsistentKeys.length} placeholder inconsistencies:`);
      inconsistentKeys.slice(0, 3).forEach(({ key, base, current }) => {
        log('red', `  - ${key}:`);
        log('red', `    Base: ${base.join(', ')}`);
        log('red', `    ${lang}: ${current.join(', ')}`);
      });
      if (inconsistentKeys.length > 3) {
        log('red', `  ... and ${inconsistentKeys.length - 3} more`);
      }
    } else {
      log('green', `✅ ${lang.toUpperCase()}: Placeholder consistency verified`);
    }
  }
  
  // Summary
  log('blue', '\n📊 Validation Summary:');
  
  if (hasErrors) {
    log('red', '❌ Translation validation failed!');
    log('yellow', 'Please fix the issues above before committing.');
    process.exit(1);
  } else {
    log('green', '✅ All translations are valid!');
    log('green', `🎉 Successfully validated ${SUPPORTED_LANGUAGES.length} languages with ${baseKeys.length} keys each.`);
  }
}

// Run validation
if (require.main === module) {
  validateTranslations();
}

module.exports = { validateTranslations };
