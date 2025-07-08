# CloudTAK Infrastructure

<p align=center>Modern AWS CDK v2 infrastructure for CloudTAK web interface and ETL services

## Overview

CloudTAK provides a web-based interface for Team Awareness Kit (TAK) data with ETL (Extract, Transform, Load) capabilities for processing and visualizing situational awareness information. This repository deploys the CloudTAK infrastructure layer with containerized services, auto-scaling, and enterprise-grade security features.

It is specifically targeted at the deployment of [TAK.NZ](https://tak.nz) via a CI/CD pipeline with automated upstream synchronization from the [dfpc-coe/CloudTAK](https://github.com/dfpc-coe/CloudTAK) repository.

### Architecture Layers

This CloudTAK infrastructure requires the base infrastructure layer. Layers can be deployed in multiple independent environments:

```
        PRODUCTION ENVIRONMENT                DEVELOPMENT ENVIRONMENT
        Domain: tak.nz                        Domain: dev.tak.nz

┌─────────────────────────────────┐    ┌─────────────────────────────────┐
│         CloudTAK                │    │         CloudTAK                │
│    CloudFormation Stack         │    │    CloudFormation Stack         │
│      (This Repository)          │    │      (This Repository)          │
└─────────────────────────────────┘    └─────────────────────────────────┘
                │                                        │
                ▼                                        ▼
┌─────────────────────────────────┐    ┌─────────────────────────────────┐
│        VideoInfra               │    │        VideoInfra               │
│    CloudFormation Stack         │    │    CloudFormation Stack         │
└─────────────────────────────────┘    └─────────────────────────────────┘
                │                                        │
                ▼                                        ▼
┌─────────────────────────────────┐    ┌─────────────────────────────────┐
│         TakInfra                │    │         TakInfra                │
│    CloudFormation Stack         │    │    CloudFormation Stack         │
└─────────────────────────────────┘    └─────────────────────────────────┘
                │                                        │
                ▼                                        ▼
┌─────────────────────────────────┐    ┌─────────────────────────────────┐
│        AuthInfra                │    │        AuthInfra                │
│    CloudFormation Stack         │    │    CloudFormation Stack         │
└─────────────────────────────────┘    └─────────────────────────────────┘
                │                                        │
                ▼                                        ▼
┌─────────────────────────────────┐    ┌─────────────────────────────────┐
│        BaseInfra                │    │        BaseInfra                │
│    CloudFormation Stack         │    │    CloudFormation Stack         │
└─────────────────────────────────┘    └─────────────────────────────────┘
```

| Layer | Repository | Description |
|-------|------------|-------------|
| **BaseInfra** | [`base-infra`](https://github.com/TAK-NZ/base-infra)  | Foundation: VPC, ECS, S3, KMS, ACM |
| **AuthInfra** | [`auth-infra`](https://github.com/TAK-NZ/auth-infra) | SSO via Authentik, LDAP |
| **TakInfra** | [`tak-infra`](https://github.com/TAK-NZ/tak-infra) | TAK Server |
| **VideoInfra** | [`video-infra`](https://github.com/TAK-NZ/video-infra) | Video Server based on Mediamtx |
| **CloudTAK** | `CloudTAK` (this repo) | CloudTAK web interface and ETL |

**Deployment Order**: BaseInfra must be deployed first, followed by AuthInfra, then TakInfra, VideoInfra, and finally CloudTAK. Each layer imports outputs from the layer below via CloudFormation exports.

## Quick Start

### Prerequisites
- [AWS Account](https://signin.aws.amazon.com/signup) with configured credentials
- Base infrastructure stack (`TAK-<n>-BaseInfra`) must be deployed first
- Public Route 53 hosted zone (e.g., `tak.nz`)
- [Node.js](https://nodejs.org/) and npm installed
- [Docker](https://docker.com/) installed and running

### Installation & Deployment

```bash
# 1. Install dependencies
npm install

# 2. Bootstrap CDK (first time only)
npx cdk bootstrap --profile your-aws-profile

# 3. Deploy development environment
npm run deploy:dev

# 4. Deploy production environment  
npm run deploy:prod
```

## Infrastructure Resources

### Compute & Services
- **ECS Service** - CloudTAK web application with auto-scaling
- **ECS Tasks** - ETL processing tasks (data, events, pmtiles)
- **Application Load Balancer** - HTTP/HTTPS traffic distribution
- **Target Groups** - Health check and traffic routing
- **API Gateway** - PMTiles API endpoint with custom domain

### Database & Storage
- **Aurora PostgreSQL** - Encrypted cluster with backup retention for CloudTAK data
- **S3 Buckets** - Asset storage and ALB access logs (imported from BaseInfra)
- **ECR Repository** - Container image storage (imported from BaseInfra)

### Processing & Integration
- **AWS Batch** - Scalable ETL job processing for data, events, and pmtiles
- **Lambda Functions** - Event-driven processing for S3 notifications and image handling
- **Secrets Manager** - Application secrets and database credentials
- **CloudWatch Alarms** - SNS topics and alarms for Lambda function monitoring

### Security & DNS
- **Security Groups** - Fine-grained network access controls
- **Route 53 Records** - CloudTAK endpoint DNS management
- **KMS Encryption** - Data encryption at rest and in transit
- **ACM Certificates** - SSL certificate management

## Docker Image Handling

This stack uses a **hybrid Docker image strategy** that supports both pre-built images from ECR and local Docker building for maximum flexibility.

- **Strategy**: See [Docker Image Strategy Guide](docs/DOCKER_IMAGE_STRATEGY.md) for details
- **CI/CD Mode**: Uses pre-built images for fast deployments (~8 minutes vs ~15 minutes)
- **Development Mode**: Builds images locally for flexible development
- **Automatic Fallback**: Seamlessly switches between modes based on context parameters

### Docker Images Used

1. **CloudTAK API**: Web interface and API services
2. **Events Task**: Event processing container
3. **PMTiles Task**: Tile generation container
4. **Data Task**: Data processing container

### Upstream Integration
- **Automatic Sync**: Weekly sync with upstream repository
- **Branding Application**: TAK.NZ customizations applied after sync
- **Version Tagging**: Git SHA and version-based image tags

### Authentication Integration
- **Authentik User Creation**: Automatically creates CloudTAK admin user in Authentik
- **SSO Integration**: Integrates with AuthInfra layer for single sign-on
- **Admin Email**: Configurable admin email for user creation

## Available Environments

| Environment | Stack Name | Description | Domain | CloudTAK Cost* | Complete Stack Cost** |
|-------------|------------|-------------|--------|----------------|----------------------|
| `dev-test` | `TAK-Dev-CloudTAK` | Cost-optimized development | `cloudtak.dev.tak.nz` | ~$70 | ~$290 |
| `prod` | `TAK-Prod-CloudTAK` | High-availability production | `cloudtak.tak.nz` | ~$380 | ~$1158 |

*CloudTAK Infrastructure only, **Complete deployment (BaseInfra + AuthInfra + TakInfra + VideoInfra + CloudTAK)  
Estimated AWS costs for ap-southeast-2, excluding data transfer and usage

## Development Workflow

### NPM Scripts
```bash
# Development and Testing
npm run dev                    # Build and test
npm run test                   # Run tests
npm run lint                   # Run linting

# Environment-Specific Deployment
npm run deploy:dev            # Deploy to dev-test
npm run deploy:prod           # Deploy to production
npm run synth:dev             # Preview dev infrastructure
npm run synth:prod            # Preview prod infrastructure

# Infrastructure Management
npm run cdk:diff:dev          # Show what would change in dev
npm run cdk:diff:prod         # Show what would change in prod
npm run cdk:bootstrap         # Bootstrap CDK in account
```



### Configuration System

The project uses **AWS CDK context-based configuration** for consistent deployments:

- **All settings** stored in [`cdk.json`](cdk.json) under `context` section
- **Version controlled** - consistent deployments across team members
- **Runtime overrides** - use `--context` flag for one-off changes
- **Environment-specific** - separate configs for dev-test and production

#### Configuration Override Examples
```bash
# Override CloudTAK hostname for deployment
npm run deploy:dev -- --context hostname=map

# Deploy with different resource allocation
npm run deploy:prod -- --context taskCpu=4096 --context taskMemory=8192

# Custom stack name
npm run deploy:dev -- --context stackName=Demo
```



## 📚 Documentation

- **[🚀 Deployment Guide](docs/DEPLOYMENT_GUIDE.md)** - Comprehensive deployment instructions and configuration options
- **[🏗️ Architecture Guide](docs/ARCHITECTURE.md)** - Technical architecture and design decisions  
- **[⚙️ Configuration Guide](docs/PARAMETERS.md)** - Complete configuration management reference
- **[🐳 Docker Image Strategy](docs/DOCKER_IMAGE_STRATEGY.md)** - Hybrid image strategy for fast CI/CD and flexible development

## Security Features

### Enterprise-Grade Security
- **🔑 KMS Encryption** - All data encrypted with customer-managed keys
- **🛡️ Network Security** - Private subnets with controlled internet access
- **🔒 IAM Policies** - Least-privilege access patterns throughout
- **🔐 Container Security** - Non-root containers with minimal privileges
- **📋 Automated Updates** - Weekly upstream sync with security patches

## Getting Help

### Common Issues
- **Base Infrastructure** - Ensure base infrastructure stack is deployed first
- **Route53 Hosted Zone** - Ensure your domain's hosted zone exists before deployment
- **AWS Permissions** - CDK requires broad permissions for CloudFormation operations
- **Docker Issues** - Ensure Docker is running for local development
- **Upstream Conflicts** - Use manual conflict resolution for complex merge conflicts

### Support Resources
- **AWS CDK Documentation** - https://docs.aws.amazon.com/cdk/
- **CloudTAK Upstream** - https://github.com/dfpc-coe/CloudTAK
- **TAK.NZ Project** - https://github.com/TAK-NZ/
- **Issue Tracking** - Use GitHub Issues for bug reports and feature requests

## Contributing

### Development Process
1. **Fork Repository** - Create your own fork for development
2. **Create Branch** - Use feature branches for development
3. **Test Changes** - Run tests and validate deployment
4. **Submit PR** - Create pull request with detailed description
5. **Review Process** - Code review and automated testing

### Upstream Contributions
- **Bug Fixes** - Submit to upstream dfpc-coe/CloudTAK repository
- **TAK.NZ Specific** - Keep customizations in this repository
- **Documentation** - Improve documentation for better maintainability