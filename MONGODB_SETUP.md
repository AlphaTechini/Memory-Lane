# MongoDB Setup Guide

## Option 1: Install MongoDB Locally (Recommended for Development)

### Windows Installation:
1. Download MongoDB Community Server from: https://www.mongodb.com/try/download/community
2. Run the installer and follow the setup wizard
3. Make sure to install MongoDB as a service
4. MongoDB will automatically start on system boot

### Start MongoDB Service:
```powershell
# Start MongoDB service
net start MongoDB

# Check if MongoDB is running
mongo --eval "db.adminCommand('ismaster')"
```

### Alternative: Start MongoDB manually
```powershell
# Navigate to MongoDB bin directory (usually)
cd "C:\Program Files\MongoDB\Server\7.0\bin"

# Start MongoDB
mongod --dbpath "C:\data\db"
```

## Option 2: Use MongoDB Atlas (Cloud Database)

1. Go to https://www.mongodb.com/atlas
2. Create a free account
3. Create a new cluster
4. Get your connection string
5. Update your .env file:
```env
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/sensay-ai?retryWrites=true&w=majority
```

## Option 3: Use Docker (If you have Docker installed)

```bash
# Run MongoDB in Docker container
docker run -d -p 27017:27017 --name mongodb mongo:latest

# Connect to it
docker exec -it mongodb mongo
```

## Verify MongoDB Connection

After MongoDB is running, you can test the connection:

```javascript
// Test with Node.js
const { MongoClient } = require('mongodb');
const client = new MongoClient('mongodb://localhost:27017');

async function testConnection() {
  try {
    await client.connect();
    console.log('✅ MongoDB connected successfully');
    await client.close();
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
  }
}

testConnection();
```

## Next Steps

1. Install MongoDB using one of the options above
2. Make sure MongoDB is running
3. Restart your Node.js server
4. The authentication system will automatically create the necessary collections

## Default Database Structure

Once connected, your database will have:
- Database: `sensay-ai`
- Collection: `users` (for authentication)
- Collection: `replicas` (for Sensay API data)

## MongoDB GUI Tools (Optional)

For easier database management, you can install:
- MongoDB Compass (Official GUI): https://www.mongodb.com/products/compass
- Studio 3T: https://studio3t.com/
- Robo 3T: https://robomongo.org/
