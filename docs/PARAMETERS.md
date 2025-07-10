# Configuration Management Guide

The CloudTAK Infrastructure uses **AWS CDK context-based configuration** with centralized settings in [`cdk.json`](../cdk/cdk.json). This provides a single source of truth for all environment configurations while supporting runtime overrides.

## Quick Configuration Reference

### **Environment-Specific Deployment**
```bash
# Deploy with default configuration
npm run deploy:dev     # Development environment
npm run deploy:prod    # Production environment

# Deploy with configuration overrides
npm run deploy:dev -- --context hostname=map
npm run deploy:prod -- --context desiredCount=3
```

## Configuration System Architecture

### **Context-Based Configuration**
All configurations are stored in [`cdk.json`](../cdk/cdk.json) under the `context` section:

```json
{
  "context": {
    "dev-test": {
      "stackName": "Dev",
      "ecs": {
        "taskCpu": 1024,
        "taskMemory": 4096,
        "desiredCount": 1,
        "enableDetailedLogging": true,
        "enableEcsExec": true
      },
      "cloudtak": {
        "hostname": "map",
        "takAdminEmail": "admin@tak.nz"
      },
      "ecr": {
        "imageRetentionCount": 5,
        "scanOnPush": false
      },
      "general": {
        "removalPolicy": "DESTROY",
        "enableDetailedLogging": true,
        "enableContainerInsights": false
      }
    },
    "prod": {
      "stackName": "Prod",
      "ecs": {
        "taskCpu": 2048,
        "taskMemory": 8192,
        "desiredCount": 1,
        "enableDetailedLogging": false,
        "enableEcsExec": false
      },
      "cloudtak": {
        "hostname": "map",
        "takAdminEmail": "admin@tak.nz"
      },
      "ecr": {
        "imageRetentionCount": 20,
        "scanOnPush": true
      },
      "general": {
        "removalPolicy": "RETAIN",
        "enableDetailedLogging": false,
        "enableContainerInsights": true
      }
    }
  }
}
```

### **Environment Comparison**

| Environment | Stack Name | Description | CloudTAK Cost* | Complete Stack Cost** |
|-------------|------------|-------------|----------------|----------------------|
| `dev-test` | `TAK-Dev-CloudTAK` | Cost-optimized development | ~$70 | ~$290 |
| `prod` | `TAK-Prod-CloudTAK` | High-availability production | ~$380 | ~$1158 |

*CloudTAK Infrastructure only, **Complete deployment (BaseInfra + AuthInfra + TakInfra + VideoInfra + CloudTAK)  
Estimated AWS costs for ap-southeast-2, excluding data processing and storage usage

### **Key Configuration Differences**

| Setting | dev-test | prod | Impact |
|---------|----------|------|--------|
| **ECS Resources** | `1024 CPU, 4096 MB` | `2048 CPU, 8192 MB` | Performance |
| **ECS Tasks** | `1` task | `2` tasks | High availability |
| **ECS Exec** | `true` (debugging) | `false` (security) | Development access |
| **Container Insights** | `false` | `true` | ECS monitoring |
| **ECR Image Retention** | `5` images | `20` images | Image history |
| **ECR Vulnerability Scanning** | `false` | `true` | Security scanning |
| **Removal Policy** | `DESTROY` | `RETAIN` | Resource cleanup |

---

## **Runtime Configuration Overrides**

Use CDK's built-in `--context` flag with **flat parameter names** to override any configuration value:

### **ECS Configuration**
| Parameter | Description | dev-test | prod |
|-----------|-------------|----------|------|
| `taskCpu` | CPU units for ECS tasks | `1024` | `2048` |
| `taskMemory` | Memory (MB) for ECS tasks | `4096` | `8192` |
| `desiredCount` | Desired number of running tasks | `1` | `1` |
| `enableDetailedLogging` | Enable detailed application logging | `true` | `false` |
| `enableEcsExec` | Enable ECS exec for debugging | `true` | `false` |

### **Database Configuration**
| Parameter | Description | dev-test | prod |
|-----------|-------------|----------|------|
| `instanceClass` | Aurora instance class | `db.serverless` | `db.t4g.large` |
| `instanceCount` | Number of database instances | `1` | `2` |
| `engineVersion` | PostgreSQL engine version | `17.4` | `17.4` |
| `enablePerformanceInsights` | Enable performance insights | `false` | `true` |
| `backupRetentionDays` | Backup retention period (days) | `7` | `30` |
| `deleteProtection` | Enable deletion protection | `false` | `true` |

### **CloudTAK Configuration**
| Parameter | Description | dev-test | prod |
|-----------|-------------|----------|------|
| `hostname` | Hostname for CloudTAK service | `map` | `map` |
| `takAdminEmail` | Admin email address | `admin@tak.nz` | `admin@tak.nz` |

### **ECR Configuration**
| Parameter | Description | dev-test | prod |
|-----------|-------------|----------|------|
| `imageRetentionCount` | Number of ECR images to retain | `5` | `20` |
| `scanOnPush` | Enable ECR vulnerability scanning | `false` | `true` |

### **General Configuration**
| Parameter | Description | dev-test | prod |
|-----------|-------------|----------|------|
| `removalPolicy` | Resource cleanup policy | `DESTROY` | `RETAIN` |
| `enableDetailedLogging` | Enable detailed CloudWatch logging | `true` | `false` |
| `enableContainerInsights` | Enable ECS Container Insights | `false` | `true` |

---

## **Parameter Override Examples**

```bash
# Custom CloudTAK hostname
npm run deploy:dev -- --context hostname=map

# ECS scaling
npm run deploy:dev -- --context taskCpu=2048 --context taskMemory=8192

# Enable production features in development
npm run deploy:dev -- \
  --context enableContainerInsights=true \
  --context scanOnPush=true

# Custom stack name
npm run deploy:dev -- --context stackName=Demo

# Override ECS resources
npm run deploy:dev -- \
  --context taskCpu=2048 \
  --context taskMemory=8192 \
  --context desiredCount=2

# Custom ECR settings
npm run deploy:prod -- \
  --context imageRetentionCount=30 \
  --context scanOnPush=false
```

---

## **Security Considerations**

### **Network Security**
- **Private Subnets**: All compute resources deployed in private subnets
- **Security Groups**: Restrictive access controls with least privilege
- **Load Balancers**: Application Load Balancer for HTTP/HTTPS traffic
- **VPC Integration**: Imports VPC and subnets from base infrastructure

### **Data Security**
- **ECS Task Encryption**: All data encrypted in transit and at rest
- **Secrets Management**: AWS Secrets Manager for sensitive data
- **Container Security**: Non-root containers with minimal privileges

### **Access Control**
- **IAM Roles**: Service-specific roles with minimal permissions
- **ECS Exec**: Enabled in development, disabled in production
- **API Security**: Secure API endpoints with proper authentication

---

## **Cost Optimization**

### **Development Environment Optimizations**
- **Single ECS Task**: Minimal compute allocation (~$25/month savings)
- **No Container Insights**: Reduces CloudWatch costs
- **Smaller CPU/Memory**: Lower ECS task costs
- **Fewer ECR Images**: Reduced storage costs

### **Production Environment Features**
- **High Availability**: Multiple ECS tasks for redundancy
- **Enhanced Monitoring**: Container Insights for observability
- **Advanced Configuration**: Extended ECR retention
- **Security Features**: Vulnerability scanning enabled

---

## **Complete Configuration Reference**

### **Required Parameters**
| Parameter | Description | Example |
|-----------|-------------|---------|
| `stackName` | Stack identifier for CloudFormation exports | `DevTest`, `Prod`, `Demo` |

### **ECS Configuration**
| Parameter | Type | Description | Valid Values |
|-----------|------|-------------|-------------|
| `taskCpu` | number | CPU units for ECS tasks | `256`, `512`, `1024`, `2048`, `4096` |
| `taskMemory` | number | Memory (MB) for ECS tasks | `512`, `1024`, `2048`, `4096`, `8192` |
| `desiredCount` | number | Desired number of running tasks | `1-10` |
| `enableDetailedLogging` | boolean | Enable detailed application logging | `true`, `false` |
| `enableEcsExec` | boolean | Enable ECS exec for debugging | `true`, `false` |

### **CloudTAK Configuration**
| Parameter | Type | Description | Valid Values |
|-----------|------|-------------|-------------|
| `hostname` | string | CloudTAK hostname | Any valid hostname |
| `takAdminEmail` | string | Admin email address | Valid email address |

## 📋 Deployment Examples

### Basic Deployments
```bash
# Development environment
npm run deploy:dev

# Production environment
npm run deploy:prod
```

### Advanced Deployments
```bash
# Custom environment for feature testing
npm run deploy:dev -- \
  --context stackName=FeatureX \
  --context hostname=feature

# High-performance development environment
npm run deploy:dev -- \
  --context taskCpu=2048 \
  --context taskMemory=8192 \
  --context desiredCount=2

# Production with cost optimization
npm run deploy:prod -- \
  --context desiredCount=1 \
  --context enableContainerInsights=false
```