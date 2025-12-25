/**
 * Test Supavec API using ONLY the documented endpoints from the docs
 */

// Load environment variables
import './src/config/loadEnv.js';
import axios from 'axios';

async function testSupavecDocs() {
  console.log('🔍 Testing Supavec API using DOCUMENTED endpoints only...\n');

  const apiKey = process.env.SUPAVEC_API_KEY;
  const baseUrl = process.env.SUPAVEC_BASE_URL || 'https://api.supavec.com';

  console.log('Configuration:');
  console.log('- API Key:', apiKey ? `${apiKey.substring(0, 8)}...` : 'NOT SET');
  console.log('- Base URL:', baseUrl);
  console.log('');

  if (!apiKey) {
    console.log('❌ SUPAVEC_API_KEY is not set');
    return;
  }

  try {
    // Test 1: Upload text (from docs: /upload_text)
    console.log('1. Testing text upload (documented endpoint)...');
    
    const uploadResponse = await axios.post(`${baseUrl}/upload_text`, {
      name: 'API Integration Test',
      contents: 'This is a test text upload to verify the API integration. This text needs to be at least 5 characters long according to the documentation.',
      chunk_size: 1000,
      chunk_overlap: 100
    }, {
      headers: {
        'Content-Type': 'application/json',
        'authorization': apiKey
      },
      timeout: 15000
    });

    console.log('✅ Text upload successful');
    console.log('Status:', uploadResponse.status);
    console.log('Response:', uploadResponse.data);
    
    const fileId = uploadResponse.data.file_id;
    
    // Test 2: List user files (from docs: /user_files)
    console.log('\n2. Testing user files listing (documented endpoint)...');
    
    const filesResponse = await axios.post(`${baseUrl}/user_files`, {
      pagination: {
        limit: 5,
        offset: 0
      },
      order_dir: 'desc'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'authorization': apiKey
      },
      timeout: 15000
    });

    console.log('✅ Files listing successful');
    console.log('Status:', filesResponse.status);
    console.log('Files count:', filesResponse.data?.results?.length || 0);
    
    // Test 3: Search (from docs: /search)
    if (fileId) {
      console.log('\n3. Testing search (documented endpoint)...');
      
      const searchResponse = await axios.post(`${baseUrl}/search`, {
        query: 'test',
        file_ids: [fileId],
        k: 3,
        include_embeddings: false
      }, {
        headers: {
          'Content-Type': 'application/json',
          'authorization': apiKey
        },
        timeout: 15000
      });

      console.log('✅ Search successful');
      console.log('Status:', searchResponse.status);
      console.log('Results count:', searchResponse.data?.documents?.length || 0);
      
      // Test 4: Chat (from docs: /chat)
      console.log('\n4. Testing chat (documented endpoint)...');
      
      const chatResponse = await axios.post(`${baseUrl}/chat`, {
        query: 'What is this document about?',
        file_ids: [fileId],
        k: 3,
        stream: false
      }, {
        headers: {
          'Content-Type': 'application/json',
          'authorization': apiKey
        },
        timeout: 15000
      });

      console.log('✅ Chat successful');
      console.log('Status:', chatResponse.status);
      console.log('Response text:', chatResponse.data?.text || 'No text response');
    }

    console.log('\n🎉 All documented API endpoints working correctly!');

  } catch (error) {
    console.log('❌ API Error:');
    console.log('- Message:', error.message);
    console.log('- Status:', error.response?.status);
    console.log('- Status Text:', error.response?.statusText);
    console.log('- Response data:', error.response?.data);
    
    if (error.code === 'ECONNABORTED') {
      console.log('- This appears to be a timeout issue');
    }
  }
}

testSupavecDocs();