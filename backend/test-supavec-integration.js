/**
 * Test script to verify Supavec API integration
 */

// Load environment variables
import './src/config/loadEnv.js';
import { healthCheck, listFiles, uploadText } from './src/services/supavecService.js';

async function testSupavecIntegration() {
  console.log('🧪 Testing Supavec API Integration...\n');

  try {
    // Test 1: Health Check
    console.log('1. Testing API connectivity...');
    const health = await healthCheck(10000);
    console.log('Health Check Result:', {
      status: health.status,
      configured: health.configured,
      connected: health.connected,
      responseTime: health.responseTime + 'ms',
      baseUrl: health.baseUrl
    });

    if (health.status !== 'healthy') {
      console.log('❌ Health check failed:', health.error || health.message);
      return;
    }

    console.log('✅ API connectivity successful\n');

    // Test 2: List Files
    console.log('2. Testing file listing...');
    const filesList = await listFiles('test-namespace', 5);
    console.log('Files List Result:', {
      success: filesList.success !== false,
      fileCount: filesList.files?.length || 0,
      hasFiles: Boolean(filesList.files?.length)
    });
    console.log('✅ File listing successful\n');

    // Test 3: Upload Text (optional - only if you want to test uploads)
    console.log('3. Testing text upload...');
    const testText = 'This is a test upload from the integration test.';
    const uploadResult = await uploadText(testText, 'Integration Test', 'test-namespace');
    console.log('Upload Result:', {
      success: uploadResult.success !== false,
      hasFileId: Boolean(uploadResult.file_id),
      fileId: uploadResult.file_id
    });
    console.log('✅ Text upload successful\n');

    console.log('🎉 All Supavec API tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Error details:', error);
  }
}

// Run the test
testSupavecIntegration();