/**
 * Test script to verify Supavec API connectivity
 */

import './src/config/loadEnv.js';
import { healthCheck, listFiles } from './src/services/supavecService.js';

async function runTest() {
    console.log('🧪 Testing Supavec API Connectivity...\n');

    try {
        console.log('1. Running Health Check (30s timeout)...');
        const health = await healthCheck(30000);
        console.log('Health Result:', JSON.stringify(health, null, 2));

        if (health.status === 'healthy') {
            console.log('\n✅ Supavec API is reachable and healthy!');

            console.log('\n2. Attempting to list files...');
            const files = await listFiles({ limit: 5 });
            console.log('Files List Success:', !files.success === false);
            if (files.results) {
                console.log(`Found ${files.results.length} files.`);
            } else {
                console.log('No files found or error in response structure.');
                console.log('Response:', JSON.stringify(files, null, 2));
            }
        } else {
            console.log('\n❌ Supavec API is NOT healthy.');
            console.log('Error:', health.error || 'Unknown error');
            console.log('Status Code:', health.errorCode);
        }
    } catch (error) {
        console.error('\n💥 Unexpected error during test:');
        console.error(error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
        }
    }
}

runTest();
