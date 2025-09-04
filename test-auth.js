/**
 * Authentication API Test Examples
 * Run these tests after starting the server to verify authentication functionality
 */

const API_BASE = 'http://localhost:4000';

// Test user data
const testUser = {
  email: 'test@sensay.ai',
  password: 'TestPass123',
  firstName: 'Test',
  lastName: 'User'
};

let authToken = '';
let userId = '';
let otpCode = '';
let emailPreviewURL = '';

/**
 * Helper function to make API requests
 */
async function apiRequest(endpoint, method = 'GET', body = null, token = null) {
  const headers = {
    'Content-Type': 'application/json'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = {
    method,
    headers
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    const data = await response.json();
    
    console.log(`${method} ${endpoint}:`, {
      status: response.status,
      data
    });
    
    return { response, data };
  } catch (error) {
    console.error(`Error with ${method} ${endpoint}:`, error);
    return { error };
  }
}

/**
 * Test 1: Health Check
 */
async function testHealthCheck() {
  console.log('\n🔍 Testing Health Check...');
  await apiRequest('/health');
  await apiRequest('/auth/health');
}

/**
 * Test 2: User Signup
 */
async function testSignup() {
  console.log('\n📝 Testing User Signup...');
  const { data } = await apiRequest('/auth/signup', 'POST', testUser);
  
  if (data.success) {
    authToken = data.token;
    userId = data.user._id;
    emailPreviewURL = data.emailPreviewURL;
    console.log('✅ Signup successful');
    console.log('📋 User ID:', userId);
    console.log('� OTP sent:', data.otpSent);
    if (emailPreviewURL) {
      console.log('📧 Email preview:', emailPreviewURL);
    }
  } else {
    console.log('❌ Signup failed:', data.errors);
  }
}

/**
 * Test 3: Duplicate Signup (should fail)
 */
async function testDuplicateSignup() {
  console.log('\n🔄 Testing Duplicate Signup (should fail)...');
  const { data } = await apiRequest('/auth/signup', 'POST', testUser);
  
  if (!data.success && data.errors.includes('Email is already registered')) {
    console.log('✅ Duplicate signup correctly rejected');
  } else {
    console.log('❌ Duplicate signup should have failed');
  }
}

/**
 * Test 4: Login with Unverified Account (should fail)
 */
async function testUnverifiedLogin() {
  console.log('\n🚫 Testing Login with Unverified Account (should fail)...');
  const { data } = await apiRequest('/auth/login', 'POST', {
    email: testUser.email,
    password: testUser.password
  });
  
  if (!data.success && data.message.includes('not verified')) {
    console.log('✅ Unverified login correctly rejected');
  } else {
    console.log('❌ Unverified login should have failed');
  }
}

/**
 * Test 5: Simulate OTP Verification (manual step for testing)
 */
async function testOTPVerification() {
  console.log('\n🔢 Testing OTP Verification...');
  console.log('📝 For testing, we\'ll simulate a valid OTP code: 123456');
  
  // For testing purposes, let's use a known OTP
  // In real scenario, user would get this from email
  const testOTP = '123456';
  
  const { data } = await apiRequest('/auth/verify-otp', 'POST', {
    email: testUser.email,
    otpCode: testOTP
  });
  
  if (data.success) {
    authToken = data.token;
    console.log('✅ OTP verification successful');
    console.log('🔑 Token received for verified user');
  } else {
    console.log('❌ OTP verification failed:', data.errors);
    console.log('💡 Note: For testing, you would need to check the email/console for the actual OTP');
  }
}

/**
 * Test 6: Resend OTP
 */
async function testResendOTP() {
  console.log('\n🔄 Testing Resend OTP...');
  const { data } = await apiRequest('/auth/resend-otp', 'POST', {
    email: testUser.email
  });
  
  if (data.success) {
    console.log('✅ OTP resent successfully');
    if (data.emailPreviewURL) {
      console.log('📧 Email preview:', data.emailPreviewURL);
    }
  } else {
    console.log('❌ Resend OTP failed:', data.errors);
  }
}

/**
 * Test 7: Verify User Account (Old Method)
 */
async function testVerifyAccount() {
  console.log('\n✅ Testing Account Verification (Old Method)...');
  const { data } = await apiRequest(`/auth/verify/${userId}`, 'POST');
  
  if (data.success) {
    console.log('✅ Account verified successfully');
  } else {
    console.log('❌ Account verification failed:', data.message);
  }
}

/**
 * Test 8: Login with Verified Account
 */
async function testLogin() {
  console.log('\n🔐 Testing Login with Verified Account...');
  const { data } = await apiRequest('/auth/login', 'POST', {
    email: testUser.email,
    password: testUser.password
  });
  
  if (data.success) {
    authToken = data.token;
    console.log('✅ Login successful');
    console.log('🔑 New token received');
    console.log('👤 User data:', data.user);
  } else {
    console.log('❌ Login failed:', data.errors);
  }
}

/**
 * Test 9: Get Current User (Protected Route)
 */
async function testGetCurrentUser() {
  console.log('\n👤 Testing Get Current User (Protected Route)...');
  const { data } = await apiRequest('/auth/me', 'GET', null, authToken);
  
  if (data.success) {
    console.log('✅ Current user retrieved successfully');
    console.log('👤 User data:', data.user);
  } else {
    console.log('❌ Failed to get current user:', data.errors);
  }
}

/**
 * Test 10: Invalid Token Access
 */
async function testInvalidToken() {
  console.log('\n🚫 Testing Invalid Token Access (should fail)...');
  const { data } = await apiRequest('/auth/me', 'GET', null, 'invalid-token');
  
  if (!data.success && data.message.includes('Invalid')) {
    console.log('✅ Invalid token correctly rejected');
  } else {
    console.log('❌ Invalid token should have been rejected');
  }
}

/**
 * Test 9: Login with Wrong Password
 */
async function testWrongPassword() {
  console.log('\n🚫 Testing Login with Wrong Password (should fail)...');
  const { data } = await apiRequest('/auth/login', 'POST', {
    email: testUser.email,
    password: 'wrongpassword'
  });
  
  if (!data.success && data.message.includes('Invalid email or password')) {
    console.log('✅ Wrong password correctly rejected');
  } else {
    console.log('❌ Wrong password should have been rejected');
  }
}

/**
 * Test 10: Logout
 */
async function testLogout() {
  console.log('\n👋 Testing Logout...');
  const { data } = await apiRequest('/auth/logout', 'POST');
  
  if (data.success) {
    console.log('✅ Logout successful');
  } else {
    console.log('❌ Logout failed');
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🧪 Starting Authentication API Tests...');
  console.log('==========================================');
  
  try {
    await testHealthCheck();
    await testSignup();
    await testDuplicateSignup();
    await testUnverifiedLogin();
    await testVerifyAccount();
    await testLogin();
    await testGetCurrentUser();
    await testInvalidToken();
    await testWrongPassword();
    await testLogout();
    
    console.log('\n🎉 All tests completed!');
    console.log('==========================================');
  } catch (error) {
    console.error('❌ Test execution failed:', error);
  }
}

// Export for use as module or run directly
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runAllTests,
    testUser,
    apiRequest
  };
} else {
  // Run tests if this file is executed directly
  runAllTests();
}
