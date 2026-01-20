/**
 * Height utility functions for converting between inches and feet+inches
 */

/**
 * Convert total inches to feet and inches
 * @param {number} totalInches - Total height in inches
 * @returns {{feet: number, inches: number}} - Feet and remaining inches
 */
export const inchesToFeetAndInches = (totalInches) => {
  if (!totalInches || isNaN(totalInches)) {
    return { feet: 0, inches: 0 };
  }
  
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  
  return { feet, inches };
};

/**
 * Convert feet and inches to total inches
 * @param {number} feet - Number of feet
 * @param {number} inches - Number of inches
 * @returns {number} - Total height in inches
 */
export const feetAndInchesToInches = (feet, inches) => {
  const f = parseInt(feet) || 0;
  const i = parseInt(inches) || 0;
  return f * 12 + i;
};

/**
 * Format height for display
 * @param {number} totalInches - Total height in inches
 * @returns {string} - Formatted string like "5 ft 10 in" or "70 inches"
 */
export const formatHeight = (totalInches) => {
  if (!totalInches || isNaN(totalInches)) {
    return 'N/A';
  }
  
  const { feet, inches } = inchesToFeetAndInches(totalInches);
  return `${feet} ft ${inches} in`;
};

/**
 * Format height for display (short version)
 * @param {number} totalInches - Total height in inches
 * @returns {string} - Formatted string like "5'10"" or "70""
 */
export const formatHeightShort = (totalInches) => {
  if (!totalInches || isNaN(totalInches)) {
    return 'N/A';
  }
  
  const { feet, inches } = inchesToFeetAndInches(totalInches);
  return `${feet}'${inches}"`;
};

/**
 * Parse height string like "5'10"" or "5 ft 10 in" to total inches
 * @param {string|number} heightStr - Height string or number
 * @returns {number} - Total height in inches
 */
export const parseHeightToInches = (heightStr) => {
  // If already a number, return it
  if (typeof heightStr === 'number') {
    return heightStr;
  }
  
  if (!heightStr || typeof heightStr !== 'string') {
    return 0;
  }
  
  // Try to parse "5'10"" format
  const shortMatch = heightStr.match(/(\d+)'(\d+)"/);
  if (shortMatch) {
    return feetAndInchesToInches(parseInt(shortMatch[1]), parseInt(shortMatch[2]));
  }
  
  // Try to parse "5 ft 10 in" format
  const longMatch = heightStr.match(/(\d+)\s*ft\s*(\d+)\s*in/);
  if (longMatch) {
    return feetAndInchesToInches(parseInt(longMatch[1]), parseInt(longMatch[2]));
  }
  
  // Try to parse just inches
  const inchesMatch = heightStr.match(/(\d+)\s*(?:inches|in)?$/);
  if (inchesMatch) {
    return parseInt(inchesMatch[1]);
  }
  
  return 0;
};
