#!/usr/bin/env node
/**
 * Clear database for fresh testing
 */
import '../src/config/loadEnv.js'; // Load environment variables first
import databaseConfig from '../src/config/database.js';

const prisma = databaseConfig.prisma;

async function clearDatabase() {
  console.log('Clearing database...');
  
  try {
    // Clear in order to avoid foreign key constraints
    await prisma.conversation.deleteMany({});
    console.log('Cleared conversations');
    
    await prisma.patient.deleteMany({});
    console.log('Cleared patients');
    
    await prisma.user.deleteMany({});
    console.log('Cleared users');
    
    console.log('Database cleared successfully');
  } catch (error) {
    console.error('Error clearing database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearDatabase();