# EC2 Deployment Guide (Ubuntu & Amazon Linux)

Follow these steps to deploy the Memory Lane backend to your `t4g.small` instance.

## 1. AWS Security Group Setup

In the AWS Console, ensure your Security Group has the following **Inbound Rules**:

| Protocol | Port Range | Source | Reason |
| --- | --- | --- | --- |
| TCP | 22 | Your IP | SSH Access |
| TCP | 3000 | 0.0.0.0/0 | Node Backend (Direct) |
| TCP | 80 | 0.0.0.0/0 | HTTP (for Nginx/Frontend) |
| TCP | 443 | 0.0.0.0/0 | HTTPS |

## 2. DynamoDB Setup (Step-by-Step)

Before the app can store memories, you must create these 4 tables in the DynamoDB Console.

### Step 1: Create Tables
Go to **DynamoDB > Tables > Create table** and repeat for each:

1.  **Table name**: `IdentityCore`
    *   **Partition key**: `pk` (String)
    *   **Sort key**: `sk` (String)
2.  **Table name**: `MemoryChunks`
    *   **Partition key**: `pk` (String)
    *   **Sort key**: `sk` (String)
3.  **Table name**: `TokenIndex`
    *   **Partition key**: `pk` (String)
    *   **Sort key**: `sk` (String)
4.  **Table name**: `ReviewQueue`
    *   **Partition key**: `pk` (String)
    *   **Sort key**: *(Leave empty)*

### Step 2: Connect EC2 to DynamoDB (The "Bridge")
1.  **IAM Role**: Create a role for **EC2** with `AmazonDynamoDBFullAccess`.
2.  **Attach**: Go to your instance > Actions > Security > **Modify IAM role** and attach the new role.

## 3. Clone and Deploy

The updated script now supports both **Ubuntu** and **Amazon Linux**.

```bash
# SSH into EC2, then:
curl -o deploy.sh https://raw.githubusercontent.com/AlphaTechini/Memory-Lane/main/deploy.sh
chmod +x deploy.sh
./deploy.sh
```

## 4. Environment Variables

Create a `.env` file in the project directories on your server.

**Location:** `~/memory-lane/backend/.env`
```env
PORT=3000
MONGODB_URL=your_atlas_uri (optional if using Dynamo)
GROQ_API_KEY=your_key
RAG_ENGINE_URL=http://localhost:8081
JWT_SECRET=your_secret
FRONTEND_URL=your_frontend_url (e.g., https://memorylane.cyberpunk.work)
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret
EMAIL_FROM=noreply@yourdomain.com
RESEND_API_KEY=your_resend_key
```

**Location:** `~/memory-lane/rag-engine/.env`
```env
STORAGE_BACKEND=dynamodb
AWS_REGION=eu-north-1  # Replace with your instance region
PORT=8081
```

## 5. PM2 Management Commands

- `pm2 status` - See running services.
- `pm2 logs` - See real-time logs.
- `pm2 restart all` - Restart after env changes.
