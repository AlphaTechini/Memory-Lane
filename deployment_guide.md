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

## 2. DynamoDB Connectivity (Easy Mode)

To connect to DynamoDB without manually managing Access Keys:

1.  **Create an IAM Role**:
    *   Go to **IAM > Roles > Create role**.
    *   Select **AWS Service** and **EC2**.
    *   Attach the policy: `AmazonDynamoDBFullAccess`.
    *   Name it `EC2MemoryLaneRole`.
2.  **Attach to Instance**:
    *   Go to **EC2 > Instances**.
    *   Select your instance > **Actions > Security > Modify IAM role**.
    *   Select `EC2MemoryLaneRole` and save.

The Go RAG engine will now automatically authenticate with DynamoDB using this role.

### Required DynamoDB Tables
You must create these 4 tables in the AWS Console before starting the app:

| Table Name | Partition Key (Type) | Sort Key (Type) |
| --- | --- | --- |
| `IdentityCore` | `pk` (String) | `sk` (String) |
| `MemoryChunks` | `pk` (String) | `sk` (String) |
| `TokenIndex` | `pk` (String) | `sk` (String) |
| `ReviewQueue` | `pk` (String) | *(None)* |

## 3. Prepare Private Repository Access

Since your repo is private, the EC2 instance needs permission to clone it. 

### Method A: SSH Key (Recommended)
1. On the EC2: `ssh-keygen -t ed25519 -C "your-email@example.com"`
2. Display public key: `cat ~/.ssh/id_ed25519.pub`
3. Add this key to **GitHub Settings > SSH and GPG keys > New SSH key**.
4. Update `deploy.sh` to use the SSH URL: `git@github.com:AlphaTechini/Memory-Lane.git`.

## 3. Deployment Command

Once the SSH key is set up, run the deployment script:

```bash
# Get the script (if you haven't copied it yet)
curl -o deploy.sh https://raw.githubusercontent.com/AlphaTechini/Memory-Lane/main/deploy.sh
chmod +x deploy.sh
./deploy.sh
```

## 4. Environment Variables

PM2 will start the apps, but you need to provide your secrets. Create a `.env` file in `/home/ec2-user/memory-lane/backend` and `/home/ec2-user/memory-lane/rag-engine`.

**Backend `.env`:**
```env
PORT=3000
MONGODB_URI=your_atlas_uri
GROQ_API_KEY=your_key
RAG_ENGINE_URL=http://localhost:8081
JWT_SECRET=your_secret
```

**RAG Engine `.env`:**
```env
MONGODB_URI=your_atlas_uri
PORT=8081
```

## 5. PM2 Management Commands

- `pm2 status` - See running services.
- `pm2 logs` - See real-time logs.
- `pm2 restart all` - Restart after env changes.
- `pm2 stop rag-engine` - Stop specific service.
