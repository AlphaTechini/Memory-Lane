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

## 2. Prepare Private Repository Access

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
