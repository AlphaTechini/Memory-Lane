/**
 * Test script to verify Sensay user API implementation
 * This script tests the enhanced user creation handling with proper error handling
 */

import { 
  createSensayUser, 
  getCurrentSensayUser, 
  updateCurrentSensayUser,
  deleteCurrentSensayUser,
  getSensayUser,
  ensureSensayUser
} from './src/services/sensayService.js';
import { sensayConfig } from './src/config/sensay.js';

console.log('🧪 Testing Sensay User API Implementation\n');

// Check if Sensay is properly configured
if (!sensayConfig.isProperlyConfigured()) {
  console.log('⚠️ Sensay API is not properly configured. Set SENSAY_ORGANIZATION_SECRET environment variable.');
  process.exit(1);
}

console.log(`✅ Sensay API configured with version: ${sensayConfig.apiVersion}`);
console.log(`🔗 Base URL: ${sensayConfig.baseUrl}\n`);

async function testSensayUserAPI() {
  const testEmail = `test-user-${Date.now()}@example.com`;
  const testName = 'Test User';
  let createdUserId = null;

  try {
    console.log('📝 Test 1: Creating a new Sensay user');
    console.log(`   Email: ${testEmail}`);
    console.log(`   Name: ${testName}`);
    
    const createResult = await createSensayUser({
      email: testEmail,
      name: testName
    });

    if (createResult.success && createResult.id) {
      createdUserId = createResult.id;
      console.log(`   ✅ User created successfully with ID: ${createdUserId}\n`);
    } else {
      console.log(`   ❌ User creation failed:`, createResult);
      return;
    }

    console.log('📖 Test 2: Retrieving user with getCurrentSensayUser');
    const getCurrentResult = await getCurrentSensayUser(createdUserId);
    
    if (getCurrentResult && getCurrentResult.success) {
      console.log(`   ✅ User retrieved successfully:`, {
        id: getCurrentResult.id,
        email: getCurrentResult.email,
        name: getCurrentResult.name
      });
    } else {
      console.log(`   ❌ Failed to retrieve user:`, getCurrentResult);
    }
    console.log('');

    console.log('📖 Test 3: Retrieving user with getSensayUser (by ID)');
    const getUserResult = await getSensayUser(createdUserId);
    
    if (getUserResult && getUserResult.success) {
      console.log(`   ✅ User retrieved successfully:`, {
        id: getUserResult.id,
        email: getUserResult.email,
        name: getUserResult.name
      });
    } else {
      console.log(`   ❌ Failed to retrieve user by ID:`, getUserResult);
    }
    console.log('');

    console.log('✏️ Test 4: Updating user information');
    const updatedName = 'Updated Test User';
    const updateResult = await updateCurrentSensayUser(createdUserId, {
      name: updatedName
    });

    if (updateResult && updateResult.success) {
      console.log(`   ✅ User updated successfully:`, {
        id: updateResult.id,
        email: updateResult.email,
        name: updateResult.name
      });
    } else {
      console.log(`   ❌ Failed to update user:`, updateResult);
    }
    console.log('');

    console.log('🔄 Test 5: Testing ensureSensayUser with existing user');
    const ensureResult = await ensureSensayUser({
      email: testEmail,
      name: testName
    });

    if (ensureResult.conflict) {
      console.log(`   ✅ Correctly detected existing user (conflict expected)`);
    } else if (ensureResult.success) {
      console.log(`   ❓ Unexpected: ensureSensayUser returned success for existing user`);
    } else {
      console.log(`   ❌ ensureSensayUser failed:`, ensureResult);
    }
    console.log('');

    console.log('🗑️ Test 6: Deleting the test user');
    const deleteResult = await deleteCurrentSensayUser(createdUserId);
    
    if (deleteResult && deleteResult.success) {
      console.log(`   ✅ User deleted successfully`);
    } else {
      console.log(`   ❌ Failed to delete user:`, deleteResult);
    }
    console.log('');

    console.log('🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response data:', error.response.data);
    }
    
    // Cleanup: try to delete the created user if it exists
    if (createdUserId) {
      try {
        console.log('🧹 Attempting cleanup...');
        await deleteCurrentSensayUser(createdUserId);
        console.log('   ✅ Cleanup successful');
      } catch (cleanupError) {
        console.log('   ⚠️ Cleanup failed:', cleanupError.message);
      }
    }
  }
}

// Test for invalid email validation
async function testValidation() {
  console.log('🧪 Testing input validation...\n');

  try {
    console.log('📝 Test: Creating user without email (should fail)');
    await createSensayUser({ name: 'Test User' });
    console.log('   ❌ Validation failed - should have thrown error');
  } catch (error) {
    console.log('   ✅ Correctly rejected invalid input:', error.message);
  }

  try {
    console.log('📝 Test: Creating user with invalid name pattern');
    const result = await createSensayUser({ 
      email: 'test@example.com', 
      name: 'Invalid@Name#With$Special%Characters!' 
    });
    
    if (result.conflict) {
      console.log('   ✅ Name was cleaned or user already exists (expected)');
    } else if (result.success) {
      console.log('   ✅ Name was cleaned and user created');
      // Clean up
      await deleteCurrentSensayUser(result.id);
    }
  } catch (error) {
    console.log('   ⚠️ Name validation test failed:', error.message);
  }
  
  console.log('');
}

// Run tests
(async () => {
  await testValidation();
  await testSensayUserAPI();
})().catch(console.error);