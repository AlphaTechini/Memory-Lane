import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from backend/.env if present
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGO = process.env.MONGODB_URI || process.env.MONGODB_URL || process.env.DATABASE_URL || 'mongodb://localhost:27017/sensay';
const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;

console.log('Connecting to MongoDB:', MONGO);
await mongoose.connect(MONGO);
console.log('Connected to MongoDB');

// Import User model (ESM)
const { default: User } = await import('../src/models/User.js');

try {
  // Find users which have a password field (selected explicitly)
  const candidates = await User.find({ password: { $exists: true, $ne: null } }).select('+password');
  console.log(`Found ${candidates.length} users with password field present`);

  let rehashed = 0;

  for (const user of candidates) {
    const pwd = user.password || '';
    const alreadyHashed = /^\$2[aby]\$/.test(pwd);
    if (alreadyHashed) {
      // Skip already hashed
      continue;
    }

    console.log(`Hashing password for user ${user.email} (id: ${user._id})`);
    const salt = await bcrypt.genSalt(ROUNDS);
    const hashed = await bcrypt.hash(pwd, salt);
    user.password = hashed;
    await user.save();
    rehashed += 1;
  }

  console.log(`Rehashed ${rehashed} passwords`);
} catch (err) {
  console.error('Migration failed:', err);
} finally {
  await mongoose.disconnect();
  console.log('Disconnected and finished');
  process.exit(0);
}
