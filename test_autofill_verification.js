#!/usr/bin/env node

// Test script to verify profile auto-fill functionality
// Run this in the browser console to check current state

console.log('=== PROFILE AUTO-FILL VERIFICATION TEST ===');

// Function to test profile auto-fill logic
function testAutoFill() {
  console.log('\n1. Checking localStorage data...');
  
  // Check all profile-related localStorage keys
  const keys = ['userProfile', 'registeredUsers'];
  
  for (const key of keys) {
    const data = localStorage.getItem(key);
    if (data) {
      try {
        const parsed = JSON.parse(data);
        console.log(`${key}:`, parsed);
      } catch (e) {
        console.log(`${key}: (invalid JSON)`, data);
      }
    } else {
      console.log(`${key}: not found`);
    }
  }
  
  // Check for user-specific profiles
  console.log('\n2. Checking for user-specific profiles...');
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('userProfile_')) {
      const data = localStorage.getItem(key);
      try {
        const parsed = JSON.parse(data);
        console.log(`${key}:`, parsed);
      } catch (e) {
        console.log(`${key}: (invalid JSON)`);
      }
    }
  }
  
  console.log('\n3. Testing gender/sex field consistency...');
  const userProfile = localStorage.getItem('userProfile');
  if (userProfile) {
    const profile = JSON.parse(userProfile);
    const gender = profile.gender;
    const sex = profile.sex;
    
    console.log(`Gender field: ${gender}`);
    console.log(`Sex field: ${sex}`);
    
    if (gender && sex && gender === sex) {
      console.log('✅ Gender/sex fields are consistent');
    } else if (gender || sex) {
      console.log('⚠️  Gender/sex fields are inconsistent or missing');
      console.log('Recommendation: Update profile to sync fields');
    } else {
      console.log('❌ No gender/sex data found');
    }
  }
  
  console.log('\n4. Testing form element states...');
  
  // Check FitnessAdvisorPage gender select
  const genderSelect = document.getElementById('gender');
  if (genderSelect) {
    console.log('FitnessAdvisorPage gender select:');
    console.log(`  Value: "${genderSelect.value}"`);
    console.log(`  Options:`, Array.from(genderSelect.options).map(o => `${o.value}="${o.text}"`));
    
    if (genderSelect.value && genderSelect.value !== '') {
      console.log('✅ Gender field has value');
    } else {
      console.log('❌ Gender field is empty or "Select..."');
    }
  }
  
  // Check ProfilePage sex select
  const sexSelect = document.getElementById('sex');
  if (sexSelect) {
    console.log('ProfilePage sex select:');
    console.log(`  Value: "${sexSelect.value}"`);
    console.log(`  Options:`, Array.from(sexSelect.options).map(o => `${o.value}="${o.text}"`));
    
    if (sexSelect.value && sexSelect.value !== '') {
      console.log('✅ Sex field has value');
    } else {
      console.log('❌ Sex field is empty or "Select..."');
    }
  }
  
  if (!genderSelect && !sexSelect) {
    console.log('No gender/sex select elements found (not on relevant page)');
  }
  
  console.log('\n5. Recommendations:');
  console.log('- If fields show "Select...", clear localStorage and register again');
  console.log('- Check browser console for auto-fill debug logs');
  console.log('- Verify profile data has both gender and sex fields');
}

// Run the test
testAutoFill();

// Export for manual use
window.testAutoFill = testAutoFill;

console.log('\n=== Test completed. Run testAutoFill() again to recheck ===');
