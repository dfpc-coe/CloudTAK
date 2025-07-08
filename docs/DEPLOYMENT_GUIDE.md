# 🚀 CloudTAK Infrastructure - Deployment Guide

## **Quick Start (Recommended)**

### **Prerequisites**
- AWS Account with configured credentials
- Base infrastructure stack (`TAK-<n>-BaseInfra`) deployed
- Public Route 53 hosted zone for your domain
- Node.js and npm installed
- Docker installed and running

### **One-Command Deployment**
```bash
# Install dependencies
npm install

# Deploy development environment
npm run deploy:dev

# Deploy production environment  
npm run deploy:prod
```

**That's it!** 🎉 The CDK deployment handles building, context configuration, and deployment.

---

## **📋 Environment Configurations**

| Environment | Stack Name | Domain | CloudTAK Cost* | Complete Stack Cost** | Features |
|-------------|------------|--------|----------------|----------------------|----------|
| **dev-test** | `TAK-Dev-CloudTAK` | `cloudtak.dev.tak.nz` | ~$70 | ~$290 | Cost-optimized, Aurora Serverless v2 |
| **prod** | `TAK-Prod-CloudTAK` | `cloudtak.tak.nz` | ~$380 | ~$1158 | High availability, Aurora Multi-AZ |

*CloudTAK Infrastructure only, **Complete deployment (BaseInfra + AuthInfra + TakInfra + VideoInfra + CloudTAK)  
Estimated AWS costs for ap-southeast-2, excluding data transfer and usage

---

## **🔧 Advanced Configuration**

### **Custom Stack Deployment**
```bash
# Deploy with custom stack name
npm run deploy:dev -- --context stackName=Demo
npm run deploy:prod -- --context stackName=Enterprise
```

### **Infrastructure Preview**
```bash
# Preview changes before deployment
npm run synth:dev     # Development environment
npm run synth:prod    # Production environment

# Show what would change
npm run cdk:diff:dev  # Development diff
npm run cdk:diff:prod # Production diff
```

---

## **🚀 First-Time Setup**

### **Prerequisites**
1. **AWS Account** with appropriate permissions
2. **Base Infrastructure** deployed (`TAK-<n>-BaseInfra`)
3. **Node.js** and npm installed  
4. **AWS CLI** configured with credentials
5. **Docker** installed and running

### **Initial Setup Steps**
```bash
# 1. Clone and install
git clone <repository-url>
cd CloudTAK
npm install

# 2. Set environment variables (if using AWS profiles)
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text --profile your-profile)
export CDK_DEFAULT_REGION=$(aws configure get region --profile your-profile)

# 3. Deploy CloudTAK infrastructure
npm run deploy:dev -- --context stackName=YourStackName
```

---

## **🔄 Environment Transformation**

### **Switching Between Environment Types**

You can transform deployed environments between different configuration profiles (dev-test ↔ prod) without recreating resources from scratch.

### **Initial Deployment with Custom Configuration**
```bash
# Deploy a demo environment with dev-test configuration
npm run deploy:dev -- --context stackName=Demo
```

### **Environment Upgrade (dev-test → prod)**
```bash
# Transform to production configuration
npm run deploy:prod -- --context stackName=Demo
```

### **Environment Downgrade (prod → dev-test)**
```bash
# Scale back to development configuration
npm run deploy:dev -- --context stackName=Demo
```

---

## **🛠️ Troubleshooting**

### **Common Issues**

#### **Missing Base Infrastructure**
```
Error: Cannot import value TAK-Demo-BaseInfra-VPC-ID
```
**Solution:** Ensure base infrastructure stack is deployed first.

#### **Docker Build Issues**
```
Error: Docker build failed
```
**Solution:** Ensure Docker is running and Dockerfiles exist in api/ and tasks/ directories.

### **Debug Commands**
```bash
# Check what would be deployed
npm run synth:dev
npm run synth:prod

# See differences from current state
npm run cdk:diff:dev
npm run cdk:diff:prod

# View CloudFormation events
aws cloudformation describe-stack-events --stack-name TAK-DevTest-CloudTAK
```

---

## **📊 Post-Deployment**

### **Verify Deployment**
```bash
# Check stack status
aws cloudformation describe-stacks --stack-name TAK-Dev-CloudTAK

# View outputs
aws cloudformation describe-stacks --stack-name TAK-Dev-CloudTAK \
  --query 'Stacks[0].Outputs'
```

### **Access Services**
- **CloudTAK Web Interface**: `https://cloudtak.{domain}`
- **CloudTAK API**: `https://cloudtak.{domain}/api`
- **ETL Tasks**: Managed via ECS console

### **Cleanup**
```bash
# Destroy development environment
npm run cdk:destroy -- --context envType=dev-test

# Destroy production environment (use with caution!)
npm run cdk:destroy -- --context envType=prod
```

---

## **🔗 Related Documentation**

- **[Main README](../README.md)** - Project overview and quick start
- **[Architecture Guide](ARCHITECTURE.md)** - Technical architecture details
- **[Configuration Guide](PARAMETERS.md)** - Complete configuration reference
- **[Docker Image Strategy](DOCKER_IMAGE_STRATEGY.md)** - Image building and deployment strategy
