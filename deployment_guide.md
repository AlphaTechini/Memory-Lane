# EC2 Deployment Guide

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

> [!TIP]
> Use **"Default settings"** for Table settings (On-demand capacity) to stay within most free tiers.

### Step 2: Grant EC2 Access (IAM)
1.  Go to **IAM > Roles > Create role**.
2.  Select **AWS Service** and **EC2**.
3.  Choose Use Case: **EC2 - Allows EC2 instances to call AWS services on your behalf**.
4.  Attach policy: `AmazonDynamoDBFullAccess`.
5.  Name it `EC2MemoryLaneRole`.
### Step 2: Connect EC2 to DynamoDB (The "Bridge")
Now that your tables and role exist, you must "connect" them by giving the role to your instance:

1.  **Go to EC2 Console > Instances**.
2.  Select your running `memory-lane` instance.
3.  Click **Actions > Security > Modify IAM role**.
4.  Select the `EC2MemoryLaneRole` you created in the previous step.
5.  Click **Update IAM role**.

---

## 3. Clone and Deploy

Since the repo is public, you can clone via HTTPS directly on the EC2.

```bash
# SSH into EC2, then:
sudo yum update -y
sudo yum install -y git
git clone https://github.com/AlphaTechini/Memory-Lane.git
cd Memory-Lane
chmod +x deploy.sh
./deploy.sh
```

## 4. Environment Variables

Create a `.env` file in `/home/ec2-user/memory-lane/backend` and `/home/ec2-user/memory-lane/rag-engine`.

**Backend `.env`:**
```env
PORT=3000
MONGODB_URI=your_atlas_uri (optional if using Dynamo)
GROQ_API_KEY=your_key
RAG_ENGINE_URL=http://localhost:8081
JWT_SECRET=your_secret
```

**RAG Engine `.env`:**
```env
STORAGE_BACKEND=dynamodb
AWS_REGION=eu-north-1  # Replace with your instance region
PORT=8081
```

## 5. PM2 Management Commands

- `pm2 status` - See running services.
- `pm2 logs` - See real-time logs.
- `pm2 restart all` - Restart after env changes.
