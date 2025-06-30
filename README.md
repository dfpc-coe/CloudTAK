# CloudTAK - CDK Implementation

A production-ready AWS CDK implementation of [CloudTAK](https://github.com/dfpc-coe/CloudTAK) with enterprise infrastructure patterns.

## 🏗️ Architecture

This repository extends the upstream CloudTAK project with:

- **AWS CDK Infrastructure** - Modern infrastructure-as-code
- **Enterprise Patterns** - Consistent with BaseInfra/AuthInfra/TakInfra
- **Resource Name Flexibility** - Configurable naming for any AWS environment
- **Production Ready** - Aurora Serverless, proper monitoring, security

## 🚀 Quick Start

### Prerequisites
- AWS CLI configured
- CDK CLI installed: `npm install -g aws-cdk`
- BaseInfra stack deployed (VPC, ECS, KMS, etc.)

### Deploy
```bash
# Deploy to dev-test
./scripts/deploy.sh --environment dev-test --stack-name DevTest

# Deploy to production  
./scripts/deploy.sh --environment prod --stack-name Prod
```

## 📁 Repository Structure

```
├── api/              # CloudTAK API (synced from upstream)
├── tasks/            # ETL tasks (synced from upstream)
├── cdk/              # AWS CDK infrastructure
├── branding/         # TAK.NZ customizations
├── scripts/          # Deployment and sync scripts
└── docker-compose.yml # Local development
```

## 🔄 Upstream Sync

Stay current with upstream CloudTAK features:

```bash
./scripts/sync-upstream.sh
```

This syncs only `api/` and `tasks/` folders while preserving your infrastructure and customizations.

## 🏢 Enterprise Features

### Infrastructure Patterns
- **Consistent naming** with other TAK infrastructure stacks
- **Environment-specific configuration** (dev-test vs prod)
- **Proper secret management** with AWS Secrets Manager
- **Aurora Serverless v2** for cost-effective dev environments
- **Comprehensive monitoring** and logging

### Resource Name Compatibility
Automatically patches hardcoded resource names for CDK compatibility:
- ECR repository names
- ECS cluster references
- VPC import patterns

## 🤝 Contributing

This repository demonstrates how to:
1. Extend upstream projects with enterprise infrastructure
2. Maintain sync with upstream while preserving customizations
3. Implement consistent CDK patterns across multiple stacks

## 📋 Related Projects

- [BaseInfra](https://github.com/TAK-NZ/BaseInfra) - Foundation infrastructure
- [AuthInfra](https://github.com/TAK-NZ/AuthInfra) - Authentication services  
- [TakInfra](https://github.com/TAK-NZ/TakInfra) - TAK Server infrastructure
- [CloudTAK Upstream](https://github.com/dfpc-coe/CloudTAK) - Original project

## 📄 License

Same as upstream CloudTAK project.