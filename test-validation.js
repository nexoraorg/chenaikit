// Simple test script to demonstrate the form validation system
const { ValidationRules, validateField, validateFields } = require('./packages/core/dist/index.js');

async function testValidation() {
  console.log('🧪 Testing ChenAIKit Form Validation System\n');

  // Test 1: Email validation
  console.log('1. Testing Email Validation:');
  const emailError = await validateField('invalid-email', ValidationRules.email());
  console.log(`   Invalid email: "${emailError}"`);
  
  const validEmail = await validateField('test@example.com', ValidationRules.email());
  console.log(`   Valid email: "${validEmail || 'No error'}"`);

  // Test 2: Stellar address validation
  console.log('\n2. Testing Stellar Address Validation:');
  const invalidStellar = await validateField('invalid-address', ValidationRules.stellarAddress());
  console.log(`   Invalid Stellar address: "${invalidStellar}"`);
  
  const validStellar = await validateField('GABCDEFGHIJKLMNOPQRSTUVWXYZ123456789012345678901234567890', ValidationRules.stellarAddress());
  console.log(`   Valid Stellar address: "${validStellar || 'No error'}"`);

  // Test 3: Number validation
  console.log('\n3. Testing Number Validation:');
  const negativeNumber = await validateField('-10', ValidationRules.positiveNumber());
  console.log(`   Negative number: "${negativeNumber}"`);
  
  const validNumber = await validateField('100', ValidationRules.positiveNumber());
  console.log(`   Valid number: "${validNumber || 'No error'}"`);

  // Test 4: Multiple field validation
  console.log('\n4. Testing Multiple Field Validation:');
  const formData = {
    email: 'invalid-email',
    stellarAddress: 'invalid-address',
    amount: '-50'
  };
  
  const validationRules = {
    email: ValidationRules.email(),
    stellarAddress: ValidationRules.stellarAddress(),
    amount: ValidationRules.positiveNumber()
  };
  
  const errors = await validateFields(formData, validationRules);
  console.log('   Form errors:', errors);

  console.log('\n✅ All validation tests completed!');
  console.log('\n🌐 To test the full React application, visit: http://localhost:3001');
}

// Run the test
testValidation().catch(console.error);
