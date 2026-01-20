// Test script to verify profile auto-fill behavior
// Run this in browser console to test the functionality

console.log('=== Testing Profile Auto-Fill ===');

// Check current profile data in localStorage
const savedProfile = localStorage.getItem('userProfile');
console.log('localStorage userProfile exists:', !!savedProfile);

if (savedProfile) {
  try {
    const profile = JSON.parse(savedProfile);
    console.log('Current profile data:', profile);
    
    // Test gender field handling
    const profileGender = profile.sex || profile.gender;
    console.log('Profile gender value:', profileGender);
    
    if (profileGender && ['male', 'female', 'other', 'prefer-not-to-say'].includes(profileGender.toLowerCase())) {
      console.log('✅ Gender field should auto-fill with:', profileGender.toLowerCase());
    } else {
      console.log('⚠️  Gender field will use default: male');
    }
  } catch (error) {
    console.error('Error parsing profile data:', error);
  }
} else {
  console.log('No profile data found in localStorage');
}

// Check all localStorage keys related to user data
console.log('\n=== All localStorage keys ===');
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  if (key && (key.includes('user') || key.includes('profile') || key.includes('registered'))) {
    console.log(`${key}:`, localStorage.getItem(key)?.substring(0, 100) + '...');
  }
}

// Test with sample data
const testProfile = {
  name: 'George K',
  age: 27,
  sex: 'male',
  weight: 195,
  height: 70,
  fitnessAgent: 'weight_loss_coach'
};

console.log('\n=== Testing auto-fill logic ===');
console.log('Test data that should auto-fill:', testProfile);

// Simulate the auto-fill logic
const defaultFormData = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  age: '',
  weight: '',
  height: '',
  gender: 'male',
  fitnessLevel: 'beginner',
  agentType: 'personal_trainer',
  medicalConditions: ''
};

const autoFilledData = {
  ...defaultFormData,
  name: defaultFormData.name || testProfile.name || '',
  age: defaultFormData.age || testProfile.age || '',
  weight: defaultFormData.weight || testProfile.weight || '',
  height: defaultFormData.height || testProfile.height || '',
  fitnessLevel: defaultFormData.fitnessLevel || testProfile.fitnessLevel || 'beginner',
  agentType: defaultFormData.agentType || testProfile.fitnessAgent || testProfile.agentType || 'personal_trainer'
};

// Handle gender field carefully
const profileGender = testProfile.sex || testProfile.gender;
if (profileGender && ['male', 'female', 'other', 'prefer-not-to-say'].includes(profileGender.toLowerCase())) {
  autoFilledData.gender = profileGender.toLowerCase();
} else {
  autoFilledData.gender = defaultFormData.gender || 'male';
}

console.log('Result after auto-fill:', autoFilledData);
console.log('Gender field final value:', autoFilledData.gender);

// Check current form state if on registration page
try {
  const genderSelect = document.getElementById('gender');
  if (genderSelect) {
    console.log('\n=== Current form state ===');
    console.log('Gender select element value:', genderSelect.value);
    console.log('Gender select element options:');
    Array.from(genderSelect.options).forEach((option, index) => {
      console.log(`  ${index}: value="${option.value}" text="${option.text}" selected=${option.selected}`);
    });
  } else {
    console.log('Gender select element not found (not on registration page)');
  }
} catch (error) {
  console.log('Could not check form state:', error.message);
}
