// Centralized early environment loading so all subsequent imports see populated process.env
import dotenv from 'dotenv';

// Load .env only once; we set 'override: true' so .env always wins over PM2 cached values
const result = dotenv.config({ override: true });

if (process.env.NODE_ENV !== 'test') {
  if (result.error) {
    console.warn('⚠️ dotenv failed to load .env file:', result.error.message);
  } else {
    console.log('🌱 Environment variables loaded early');
  }
}

// Optionally export nothing; side-effect module
export { }; 
