/**
 * Security Toolkit 2.0 - Secure Password Generator
 * 
 * Security improvements:
 * - Cryptographically secure random number generation with rejection sampling
 * - BIP39 word list (2048 words) for high entropy passphrases
 * - Proper DOM element access (no implicit globals)
 * - Input validation and error handling
 * - Separation of concerns (business logic vs DOM)
 */

(function() {
  'use strict';

  // Character sets for password generation
  const SETS = {
    lower: 'abcdefghijklmnopqrstuvwxyz',
    upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    numbers: '0123456789',
    symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?'
  };

  // DOM Elements - explicit access (no implicit globals)
  let elements = {};

  /**
   * Secure random number generator using rejection sampling
   * Eliminates modulo bias by rejecting values that would cause bias
   * 
   * @param {number} max - Maximum value (exclusive)
   * @returns {number} Random integer in range [0, max)
   */
  function secureRandom(max) {
    if (max <= 0) {
      throw new Error('secureRandom: max must be positive');
    }
    if (max === 1) {
      return 0;
    }

    // Calculate the maximum value we can use without bias
    // We need to reject values >= threshold to avoid modulo bias
    const maxValid = Math.floor(2**32 / max) * max;
    const arr = new Uint32Array(1);
    
    let value;
    do {
      crypto.getRandomValues(arr);
      value = arr[0];
    } while (value >= maxValid);
    
    return value % max;
  }

  /**
   * Calculate password strength score
   * 
   * @param {string} password - Password to check
   * @returns {number} Strength score (0-100)
   */
  function calculateStrength(password) {
    if (!password || password.length === 0) {
      return 0;
    }

    let score = 0;
    
    // Length contribution
    score += Math.min(password.length * 4, 40);
    
    // Character variety
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const hasSymbols = /[^a-zA-Z0-9]/.test(password);
    
    const varietyCount = [hasLower, hasUpper, hasNumbers, hasSymbols].filter(Boolean).length;
    score += varietyCount * 15;
    
    // Penalty for repeated characters
    const uniqueChars = new Set(password).size;
    const repetitionPenalty = (password.length - uniqueChars) * 2;
    score = Math.max(0, score - repetitionPenalty);
    
    return Math.min(score, 100);
  }

  /**
   * Generate a secure password
   * 
   * @param {number} length - Desired password length
   * @param {Object} options - Character set options
   * @returns {string} Generated password
   */
  function generatePassword(length, options) {
    // Build character pool
    let pool = '';
    if (options.lower) pool += SETS.lower;
    if (options.upper) pool += SETS.upper;
    if (options.numbers) pool += SETS.numbers;
    if (options.symbols) pool += SETS.symbols;
    
    if (!pool) {
      throw new Error('At least one character set must be selected');
    }
    
    // Validate length
    const len = Math.max(6, Math.min(64, parseInt(length, 10) || 16));
    
    // Generate password
    let password = '';
    for (let i = 0; i < len; i++) {
      password += pool[secureRandom(pool.length)];
    }
    
    return password;
  }

  /**
   * Generate a secure passphrase using BIP39 word list
   * 
   * @param {number} wordCount - Number of words
   * @param {string} separator - Word separator
   * @returns {string} Generated passphrase
   */
  function generatePassphrase(wordCount, separator) {
    if (typeof BIP39_WORDS === 'undefined' || !BIP39_WORDS || BIP39_WORDS.length === 0) {
      throw new Error('BIP39 word list not loaded');
    }
    
    const count = Math.max(3, Math.min(12, parseInt(wordCount, 10) || 6));
    const sep = (separator || '-').slice(0, 10); // Limit separator length
    
    const words = [];
    for (let i = 0; i < count; i++) {
      words.push(BIP39_WORDS[secureRandom(BIP39_WORDS.length)]);
    }
    
    return words.join(sep);
  }

  /**
   * Get strength description
   * 
   * @param {number} score - Strength score (0-100)
   * @returns {string} Description
   */
  function getStrengthDescription(score) {
    if (score < 40) return 'Слабый пароль';
    if (score < 70) return 'Средний пароль';
    if (score < 90) return 'Надёжный пароль';
    return 'Очень надёжный пароль';
  }

  /**
   * Calculate entropy for passphrase
   * 
   * @param {number} wordCount - Number of words
   * @returns {number} Entropy in bits
   */
  function calculateEntropy(wordCount) {
    if (typeof BIP39_WORDS === 'undefined' || !BIP39_WORDS) {
      return 0;
    }
    const wordListSize = BIP39_WORDS.length;
    return Math.log2(wordListSize) * wordCount;
  }

  /**
   * Initialize DOM elements
   */
  function initializeElements() {
    elements = {
      // Password generation
      pwdLength: document.getElementById('pwdLength'),
      pLower: document.getElementById('pLower'),
      pUpper: document.getElementById('pUpper'),
      pNumbers: document.getElementById('pNumbers'),
      pSymbols: document.getElementById('pSymbols'),
      genPwdBtn: document.getElementById('genPwdBtn'),
      pwdResult: document.getElementById('pwdResult'),
      pwdStrength: document.getElementById('pwdStrength'),
      
      // Passphrase generation
      wordCount: document.getElementById('wordCount'),
      separator: document.getElementById('separator'),
      genPhraseBtn: document.getElementById('genPhraseBtn'),
      phraseResult: document.getElementById('phraseResult'),
      phraseHint: document.getElementById('phraseHint'),
      
      // Password checking
      checkInput: document.getElementById('checkInput'),
      checkBtn: document.getElementById('checkBtn'),
      checkResult: document.getElementById('checkResult'),
      checkStrength: document.getElementById('checkStrength')
    };
    
    // Validate all elements exist
    for (const [key, element] of Object.entries(elements)) {
      if (!element) {
        console.error(`Element not found: ${key}`);
      }
    }
  }

  /**
   * Handle password generation
   */
  function handleGeneratePassword() {
    try {
      const options = {
        lower: elements.pLower.checked,
        upper: elements.pUpper.checked,
        numbers: elements.pNumbers.checked,
        symbols: elements.pSymbols.checked
      };
      
      if (!options.lower && !options.upper && !options.numbers && !options.symbols) {
        elements.pwdResult.textContent = 'Выберите хотя бы один набор символов';
        return;
      }
      
      const length = parseInt(elements.pwdLength.value, 10) || 16;
      const password = generatePassword(length, options);
      const strength = calculateStrength(password);
      
      elements.pwdResult.textContent = password;
      elements.pwdStrength.style.width = strength + '%';
    } catch (error) {
      console.error('Error generating password:', error);
      elements.pwdResult.textContent = 'Ошибка генерации пароля';
    }
  }

  /**
   * Handle passphrase generation
   */
  function handleGeneratePassphrase() {
    try {
      const wordCount = parseInt(elements.wordCount.value, 10) || 6;
      const separator = elements.separator.value || '-';
      
      const passphrase = generatePassphrase(wordCount, separator);
      const entropy = calculateEntropy(wordCount);
      
      elements.phraseResult.textContent = passphrase;
      elements.phraseHint.textContent = `Энтропия: ~${entropy.toFixed(1)} бит`;
    } catch (error) {
      console.error('Error generating passphrase:', error);
      elements.phraseResult.textContent = 'Ошибка генерации passphrase';
      elements.phraseHint.textContent = '';
    }
  }

  /**
   * Handle password checking
   */
  function handleCheckPassword() {
    try {
      const password = elements.checkInput.value;
      
      if (!password) {
        elements.checkResult.textContent = '';
        elements.checkStrength.style.width = '0%';
        return;
      }
      
      const strength = calculateStrength(password);
      const description = getStrengthDescription(strength);
      
      elements.checkResult.textContent = description;
      elements.checkStrength.style.width = strength + '%';
    } catch (error) {
      console.error('Error checking password:', error);
      elements.checkResult.textContent = 'Ошибка проверки пароля';
    }
  }

  /**
   * Copy text to clipboard with fallback for older browsers
   * 
   * @param {string} text - Text to copy
   * @returns {Promise<boolean>} Success status
   */
  function copyToClipboard(text) {
    // Modern Clipboard API (requires secure context)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text)
        .then(() => true)
        .catch(err => {
          console.warn('Clipboard API failed, trying fallback:', err);
          return fallbackCopyToClipboard(text);
        });
    }
    
    // Fallback for older browsers or insecure contexts
    return Promise.resolve(fallbackCopyToClipboard(text));
  }

  /**
   * Fallback copy method using execCommand
   * 
   * @param {string} text - Text to copy
   * @returns {boolean} Success status
   */
  function fallbackCopyToClipboard(text) {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      return successful;
    } catch (err) {
      console.error('Fallback copy failed:', err);
      return false;
    }
  }

  /**
   * Show visual feedback when copying
   * 
   * @param {HTMLElement} element - Element that was clicked
   */
  function showCopyFeedback(element) {
    const originalText = element.textContent;
    const originalBorder = element.style.borderColor;
    
    element.textContent = '✓ Скопировано!';
    element.style.borderColor = '#22c55e';
    element.style.transition = 'border-color 0.2s';
    
    setTimeout(() => {
      element.textContent = originalText;
      element.style.borderColor = originalBorder || '';
    }, 1500);
  }

  /**
   * Handle output click (copy to clipboard)
   */
  function handleOutputClick(event) {
    if (event.target.classList.contains('output')) {
      const text = event.target.textContent.trim();
      if (text) {
        copyToClipboard(text).then(success => {
          if (success) {
            showCopyFeedback(event.target);
          } else {
            console.error('Failed to copy text to clipboard');
            // Show error feedback
            const originalText = event.target.textContent;
            event.target.textContent = 'Ошибка копирования';
            setTimeout(() => {
              event.target.textContent = originalText;
            }, 1000);
          }
        });
      }
    }
  }

  /**
   * Initialize tabs
   */
  function initializeTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        
        // Update tab states
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Update section states
        document.querySelectorAll('.section').forEach(section => {
          section.classList.remove('active');
        });
        const targetSection = document.getElementById(targetTab);
        if (targetSection) {
          targetSection.classList.add('active');
        }
      });
    });
  }

  /**
   * Initialize event listeners
   */
  function initializeEvents() {
    if (elements.genPwdBtn) {
      elements.genPwdBtn.addEventListener('click', handleGeneratePassword);
    }
    
    if (elements.genPhraseBtn) {
      elements.genPhraseBtn.addEventListener('click', handleGeneratePassphrase);
    }
    
    if (elements.checkBtn) {
      elements.checkBtn.addEventListener('click', handleCheckPassword);
    }
    
    if (elements.checkInput) {
      elements.checkInput.addEventListener('input', handleCheckPassword);
    }
    
    document.addEventListener('click', handleOutputClick);
  }

  /**
   * Initialize application
   */
  function init() {
    initializeElements();
    initializeTabs();
    initializeEvents();
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
