# AWS GitHub Actions Setup for CloudTAK

This guide covers setting up GitHub Actions for the CloudTAK repository, building on the base infrastructure already configured in BaseInfra.

## Prerequisites

**⚠️ Important:** Steps 1-2 from the [BaseInfra AWS GitHub Setup](https://github.com/TAK-NZ/base-infra/blob/main/docs/AWS_GITHUB_SETUP.md) must be completed first:
- Route 53 DNS setup
- GitHub OIDC Identity Provider and IAM roles

> **Note:** The organization variables and secrets configured in BaseInfra will be used for both environments.

## 3. GitHub Environment Setup for CloudTAK

### 3.1 Create Environments

In your CloudTAK GitHub repository, go to **Settings → Environments** and create:

1. **`production`** environment
   - **Protection rules:**
     - Required reviewers: Add team leads
     - Wait timer: 5 minutes
     - Deployment branches and tags: Select "Selected branches and tags"
       - Add rule: "v*" (for version tags like v1.0.0)

2. **`demo`** environment
   - **Protection rules:**
     - Deployment branches and tags: Select "Selected branches and tags"
       - Add rule: "main"

## 4. Branch Protection Setup

**Configure branch protection for `main`** to ensure only tested code is deployed:

1. Go to **Settings → Branches → Add rule**
2. **Branch name pattern**: `main`
3. **Enable these protections:**
   - ☑️ Require a pull request before merging
   - ☑️ Require status checks to pass before merging
     - ☑️ Require branches to be up to date before merging
     - ☑️ Status checks: Select "Test CDK code" after first workflow run

## 5. Breaking Change Detection for CloudTAK

### 5.1 CloudTAK-Specific Breaking Changes

**Critical resources that trigger breaking change detection:**
- PostgreSQL database cluster replacements
- API Gateway replacements
- Application Load Balancer replacements
- Secrets Manager secret deletions
- ECS service configuration changes
- AWS Batch job definition changes

### 5.2 Implementation

CloudTAK uses the same breaking change detection system as BaseInfra:

1. **Stage 1 (PR Level)**: CDK diff analysis during pull requests - fast feedback
2. **Stage 2 (Deploy Level)**: CloudFormation change set validation before demo deployment - comprehensive validation

### 5.3 Override Mechanism

To deploy breaking changes intentionally:

1. **Include `[force-deploy]` in commit message**
2. **The workflows will detect the override and proceed with deployment**
3. **Use with caution** - ensure dependent stacks are updated accordingly

## 6. GitHub Actions Workflows

### 6.1 Workflow Architecture

```mermaid
graph TD
    A[Push to main] --> B[CDK Tests]
    A --> C[Sync Upstream]
    C --> D[Build Demo Images]
    B --> E[Validate Prod Config]
    D --> F[Deploy & Test]
    E --> F
    F --> G[Revert to Dev-Test]
    
    H[Create v* tag] --> I[CDK Tests]
    H --> J[Sync Upstream]
    J --> K[Build Prod Images]
    I --> L[Manual Approval]
    K --> L
    L --> M[Deploy Production]
```

### 6.2 Demo Testing Workflow (`demo-deploy.yml`)

**Triggers:**
- Push to `main` branch
- Manual dispatch

**Jobs:**
1. **test**: Run CDK unit tests and linting
2. **build-images**: Sync upstream, apply branding, build CloudTAK images
3. **validate-prod**: Validate production configuration
4. **deploy-and-test**: Deploy with prod profile and run tests
5. **revert-to-dev-test**: Always revert to dev-test configuration

### 6.3 Production Deployment Workflow (`production-deploy.yml`)

**Triggers:**
- Version tags (`v*`)
- Manual dispatch

**Jobs:**
1. **test**: Run CDK unit tests
2. **build-images**: Sync upstream, apply branding, build production images
3. **deploy-production**: Deploy to production with built images (requires approval)

### 6.4 Weekly Upstream Sync (`weekly-sync.yml`)

**Triggers:**
- Schedule: Saturday 2AM NZST (14:00 UTC)
- Manual dispatch

**Process:**
1. Check sync mode configuration
2. Sync with upstream CloudTAK repository (main branch or latest tag)
3. Commit clean upstream code (no branding applied)
4. Create pull request for review

**Sync Modes:**
- `main` - Sync with upstream main branch
- `tag` - Sync with latest version tag
- Unset/disabled - No sync performed

**Note:** Branding is now applied at build time, not during sync. This keeps the main branch clean with upstream code only.

### 6.5 Image Building with Conditional Branding

**Build Process:**
1. Checkout clean upstream code from main branch
2. Apply TAK.NZ branding (if `APPLY_BRANDING=true`)
3. Build Docker images with applied branding
4. Push branded images to ECR

**Branding Control:**
- `APPLY_BRANDING=true` - Build with TAK.NZ branding applied
- `APPLY_BRANDING=false` - Build with clean upstream code
- Allows testing both branded and unbranded versions

## 7. Required Secrets and Variables

### 7.1 Organization Secrets (configured in BaseInfra)

| Secret | Description | Used For |
|--------|-------------|----------|
| `DEMO_AWS_ACCOUNT_ID` | Demo AWS account ID | Demo environment |
| `DEMO_AWS_ROLE_ARN` | Demo GitHub Actions IAM role ARN | Demo environment |
| `DEMO_AWS_REGION` | Demo AWS deployment region | Demo environment |
| `PROD_AWS_ACCOUNT_ID` | Production AWS account ID | Production environment |
| `PROD_AWS_ROLE_ARN` | Production GitHub Actions IAM role ARN | Production environment |
| `PROD_AWS_REGION` | Production AWS deployment region | Production environment |

### 7.2 Organization Variables (configured in BaseInfra)

| Variable | Description | Used For |
|----------|-------------|----------|
| `DEMO_STACK_NAME` | Stack name suffix for demo | Demo environment |
| `DEMO_TEST_DURATION` | Test wait time in seconds | Demo environment |
| `DEMO_R53_ZONE_NAME` | Demo Route53 zone name | Demo environment |

### 7.3 Repository Variables

| Variable | Description | Values | Usage |
|----------|-------------|--------|-------|
| `SYNC_MODE` | Controls weekly upstream sync behavior | `main`, `tag`, or unset | `main` = sync with main branch, `tag` = sync with latest version tag, unset = disabled |
| `APPLY_BRANDING` | Controls whether TAK.NZ branding is applied during image builds | `true`, `false` | `true` = apply branding at build time, `false` = build with upstream code only |

## 8. Composite Actions

### 8.1 Setup CDK Environment Action

Location: `.github/actions/setup-cdk/action.yml`

**Purpose:** Reduces code duplication by consolidating common setup steps:
- Repository checkout
- Node.js setup with npm caching
- AWS credentials configuration
- Dependency installation

**Benefits:**
- Consistent setup across all workflows
- Easier maintenance and updates
- Reduced workflow file size
- Centralized Node.js and AWS configuration

## 9. Verification

Test the CloudTAK setup:

1. **Demo Testing:** Push to `main` branch → Should sync upstream → Build images → Deploy demo → Test → Revert
2. **Production:** Create and push version tag:
   ```
   git tag v1.0.0
   git push origin v1.0.0
   ```
   → Should require approval → Deploy after approval

### 9.1 Deployment Flow

**Main Branch Push:**
```
Push to main → Tests → Demo (prod profile) → Wait → Tests → Demo (dev-test profile)
```

**Version Tag Push:**
```
Tag v* → Tests → Production (prod profile) [requires approval]
```

**Benefits:**
- Cost optimization: Demo runs dev-test profile between deployments
- Risk mitigation: Both profiles tested in demo before production
- Separation: Independent workflows for demo testing vs production deployment

## 10. Troubleshooting

### 10.1 Common Workflow Issues

| Issue | Symptoms | Solution |
|-------|----------|----------|
| **Missing Secrets** | `Error: Could not assume role` | Verify organization secrets are set correctly |
| **Missing Variables** | `Error: Required variable not set` | Ensure organization variables are configured |
| **Breaking Changes** | Workflow stops at validation | Use `[force-deploy]` in commit message or fix changes |
| **Image Build Fails** | Docker build errors | Check Dockerfile and build context |
| **CDK Synthesis Fails** | `cdk synth` command fails | Verify cdk.json context values |
| **Deployment Timeout** | Job runs for hours | Check AWS resources and add timeout settings |
| **Composite Action Error** | `Can't find action.yml` | Ensure checkout step runs before composite action |

### 10.2 CloudTAK Specific Issues

**Common CloudTAK Problems:**

- **Upstream Conflicts:** Resolve conflicts between upstream changes and TAK.NZ customizations
- **Branding Issues:** Verify branding files exist and are compatible with upstream changes
- **API Changes:** Check for breaking changes in upstream API that affect ETL tasks
- **Database Schema:** Verify database migrations are compatible with upstream changes
- **Image Build Failures:** Check Docker build logs for specific errors
- **ETL Task Failures:** Verify AWS Batch job definitions and container configurations

**Troubleshooting Steps:**

1. Check CloudTAK version in cdk.json
2. Verify stack status in CloudFormation console
3. Review stack events for specific error messages
4. Confirm ECR images are built and tagged correctly
5. Test database connectivity through AWS console
6. Check ECS service logs for container startup issues
7. Verify API Gateway endpoints and configurations

### 10.3 Dependencies on BaseInfra, AuthInfra, and TakInfra

**Required BaseInfra Resources:**
- VPC and networking (subnets, security groups)
- ECS cluster and service discovery
- KMS keys for encryption
- Route 53 hosted zones
- S3 buckets for CDK assets and data storage
- ECR repositories

**Required AuthInfra Resources:**
- PostgreSQL database cluster
- Application Load Balancer (for OIDC integration)
- Secrets Manager secrets (for database credentials)

**Required TakInfra Resources:**
- TAK server API endpoints
- TAK server data sources

Ensure BaseInfra, AuthInfra, and TakInfra are deployed and stable before deploying CloudTAK changes.