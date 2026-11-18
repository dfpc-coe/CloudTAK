# CloudTAK Infrastructure

<p align=center>Modern AWS CDK v2 infrastructure for CloudTAK web interface and ETL services

## Overview

The [Team Awareness Kit (TAK)](https://tak.gov/solutions/emergency) provides Fire, Emergency Management, and First Responders an operationally agnostic tool for improved situational awareness and a common operational picture. 

CloudTAK provides a web-based interface for Team Awareness Kit (TAK) data with ETL (Extract, Transform, Load) capabilities for processing and visualizing situational awareness information. This repository deploys the CloudTAK infrastructure layer with containerized services, auto-scaling, and enterprise-grade security features.

It is specifically targeted at the deployment of [TAK.NZ](https://tak.nz) via a CI/CD pipeline with automated upstream synchronization from the [dfpc-coe/CloudTAK](https://github.com/dfpc-coe/CloudTAK) repository.

Nevertheless others interested in deploying a similar infrastructure can do so by adapting the configuration items.

### Architecture Layers

This CloudTAK infrastructure requires the base infrastructure layer, and is itself the foundation
for higher level layers, each deployed as a separate stack from its own repository.

For the full layer diagram and deployment order across all TAK.NZ repositories, see the
[TAK.NZ organization overview](https://github.com/TAK-NZ). That diagram is maintained in one place
so it stays current as layers are added.

## Quick Start

### Prerequisites
- [AWS Account](https://signin.aws.amazon.com/signup) with configured credentials
- Base infrastructure stack (`TAK-<n>-BaseInfra`) must be deployed first
- Authentication infrastructure stack (`TAK-<n>-AuthInfra`) must be deployed first
- TAK server infrastructure stack (`TAK-<n>-TakInfra`) must be deployed first
- Public Route 53 hosted zone (e.g., `tak.nz`)
- [Node.js](https://nodejs.org/) and npm installed
- **For CI/CD deployment:** See [AWS & GitHub Setup Guide](docs/AWS_GITHUB_SETUP.md) for multi-account OIDC configuration
  
### Installation & Deployment

```bash
# 1. Install dependencies
cd cdk && npm install

# 2. Bootstrap CDK (first time only)
npx cdk bootstrap --profile your-aws-profile

# 3. Deploy development environment
npm run deploy:dev

# 4. Deploy production environment  
npm run deploy:prod
```

## Infrastructure Resources

### Compute & Services
- **ECS Service** - CloudTAK web application with configurable scaling
- **ECS Tasks** - ETL processing tasks (data, events, pmtiles)
- **Application Load Balancer** - HTTP/HTTPS traffic distribution with dual-stack IPv4/IPv6
- **Target Groups** - Health check and traffic routing
- **API Gateway** - PMTiles API endpoint with custom domain

### Database & Storage
- **Aurora PostgreSQL** - Provisioned `t4g` instances (`db.t4g.medium` dev-test, `db.t4g.large` prod) with encryption
- **S3 Buckets** - Asset storage and ALB access logs (imported from BaseInfra)
- **ECR Repository** - Container image storage (imported from BaseInfra)

### Processing & Integration
- **ECS Tasks** - Uploaded-data conversion (events), tile generation (pmtiles) and data retention
- **Lambda Functions** - Event-driven processing for S3 notifications and image handling
- **Secrets Manager** - Application secrets and database credentials
- **CloudWatch Alarms** - SNS topics and alarms for Lambda function monitoring

### Security & DNS
- **Security Groups** - Fine-grained network access controls
- **Route 53 Records** - CloudTAK endpoint DNS management with dual-stack support
- **KMS Encryption** - Data encryption at rest and in transit (imported from BaseInfra)
- **ACM Certificates** - SSL certificate management (imported from BaseInfra)

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
4. **Retention Task**: Scheduled data retention container

### Upstream Integration
- **Merge-based Sync**: `scripts/sync-upstream.sh` 3-way merges upstream `api/` and `tasks/` via the `vendor/upstream` branch, so TAK.NZ changes are carried forward by git rather than re-applied
- **Manual by design**: run when you intend to take a new upstream release; every sync needs review on our side
- **Branding Application**: TAK.NZ customizations applied at image build time
- **Version Tagging**: Git SHA and version-based image tags
- **Fork Delta**: [`docs/fork/FORK-DELTA.md`](docs/fork/FORK-DELTA.md) records why each customization exists

### Certificate Management
- **User Certificates**: Automatic enrollment and renewal on OIDC login (7-day threshold)
- **Connection Certificates**: Self-healing renewal for ETL connections via API endpoint
- **Renewal Threshold**: Certificates expiring within 7 days are automatically renewed
- **Zero Downtime**: Connections remain active during certificate renewal
- **Graceful Failure**: Automatic retry on next execution if renewal fails

### Authentication Integration
- **Authentik User Creation**: Automatically creates CloudTAK admin user in Authentik
- **SSO Integration**: Integrates with AuthInfra layer for single sign-on
- **Admin Email**: Configurable admin email for user creation

## Available Environments

| Environment | Stack Name | Description | Domain |
|-------------|------------|-------------|--------|
| `dev-test` | `TAK-Dev-CloudTAK` | Cost-optimized development | `map.dev.tak.nz` |
| `prod` | `TAK-Prod-CloudTAK` | Production-ready deployment | `map.tak.nz` |

## Development Workflow

### NPM Scripts
```bash
# Development and Testing
npm run dev                    # Build and test
npm run test                   # Run tests
npm run test:coverage          # Generate coverage report
npm run test:watch             # Run tests in watch mode

# Environment-Specific Deployment
npm run deploy:dev            # Deploy to dev-test
npm run deploy:prod           # Deploy to production
npm run deploy:local:dev      # Deploy dev with local Docker builds
npm run deploy:local:prod     # Deploy prod with local Docker builds
npm run synth:dev             # Preview dev infrastructure
npm run synth:prod            # Preview prod infrastructure

# Infrastructure Management
npm run cdk:diff:dev          # Show what would change in dev
npm run cdk:diff:prod         # Show what would change in prod
npm run cdk:bootstrap         # Bootstrap CDK in account
```



### Configuration System

The project uses **AWS CDK context-based configuration** for consistent deployments:

- **All settings** stored in [`cdk/cdk.json`](cdk/cdk.json) under `context` section
- **Version controlled** - consistent deployments across team members
- **Runtime overrides** - use `--context` flag for one-off changes
- **Environment-specific** - separate configs for dev-test and production

#### Configuration Override Examples
```bash
# Override CloudTAK hostname for deployment
npm run deploy:dev -- --context hostname=cloudtak

# Deploy with different resource allocation
npm run deploy:prod -- --context taskCpu=4096 --context taskMemory=8192

# Custom stack name
npm run deploy:dev -- --context stackName=Demo

# Use local Docker builds instead of pre-built images
npm run deploy:local:dev
```



## 📚 Documentation

- **[🚀 Deployment Guide](docs/DEPLOYMENT_GUIDE.md)** - Comprehensive deployment instructions and configuration options
- **[🏗️ Architecture Guide](docs/ARCHITECTURE.md)** - Technical architecture and design decisions  
- **[⚙️ Configuration Guide](docs/PARAMETERS.md)** - Complete configuration management reference
- **[🐳 Docker Image Strategy](docs/DOCKER_IMAGE_STRATEGY.md)** - Hybrid image strategy for fast CI/CD and flexible development
- **[🪝 Webhooks Guide](docs/WEBHOOKS.md)** - Incoming webhook support for ETL layers
- **[📧 Inbound Email Guide](docs/EMAIL.md)** - Email delivery to ETL layers (SES Mail Manager, DNS records, security notes)
- **[🗄️ Aurora Major Upgrade Runbook](docs/AURORA-MAJOR-UPGRADE.md)** - Aurora PostgreSQL 17 to 18 upgrade procedure and rollback
- **[🔐 OIDC Authentication](docs/OIDC_AUTHENTICATION.md)** - In-app Single Sign-On setup with Authentik
- **[📜 Certificate Management](docs/fork/README-CERT-RENEWAL.md)** - Automatic certificate monitoring and renewal

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
- **Upstream Conflicts** - See the [Upstream Sync Runbook](docs/UPSTREAM-SYNC.md). Sync PRs must be merged with a **merge commit, never squashed**.

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