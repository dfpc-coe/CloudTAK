# CloudTAK CDK Migration Plan

## Overview

This document outlines the migration from the current openaddresses/deploy CloudFormation approach to a CDK-based deployment aligned with BaseInfra, AuthInfra, and TakInfra patterns.

## Current State Analysis

### Resource Naming Issues
- **Current**: Hardcoded names like `coe-ecr-etl`, `tak-vpc-{Environment}`
- **Target**: Consistent naming with `TAK-{StackName}-CloudTAK-*` pattern
- **Impact**: CloudTAK software expects specific resource names

### Infrastructure Dependencies
- **Current**: Assumes specific VPC/ECS naming from openaddresses patterns
- **Target**: Import resources from BaseInfra/AuthInfra/TakInfra stacks
- **Challenge**: Bridge naming differences without modifying upstream code

## Migration Strategy

### Phase 1: Preparation (Week 1)
1. **Set up upstream sync automation**
   ```bash
   chmod +x scripts/sync-upstream.sh
   ./scripts/sync-upstream.sh
   ```

2. **Initialize CDK infrastructure**
   ```bash
   cd cdk
   npm install
   npm run build
   ```

3. **Build and test container images**
   ```bash
   chmod +x branding/build-cdk.sh
   ./branding/build-cdk.sh
   ```

### Phase 2: Infrastructure Deployment (Week 2)
1. **Deploy BaseInfra stack** (if not already deployed)
   ```bash
   cd ../base-infra
   npm run deploy -- --context environment=dev-test --context stackName=DevTest
   ```

2. **Deploy AuthInfra stack** (if not already deployed)
   ```bash
   cd ../auth-infra
   npm run deploy -- --context environment=dev-test --context stackName=DevTest
   ```

3. **Deploy CloudTAK CDK stack**
   ```bash
   cd ../CloudTAK/cdk
   npm run deploy -- --context environment=dev-test --context stackName=DevTest
   ```

### Phase 3: Application Migration (Week 3)
1. **Update container images with CDK-compatible environment variables**
2. **Test API functionality with new infrastructure**
3. **Migrate ETL jobs and Lambda functions**
4. **Validate data processing pipelines**

### Phase 4: Production Cutover (Week 4)
1. **Deploy production infrastructure**
2. **Migrate data and configurations**
3. **Update DNS and routing**
4. **Decommission old CloudFormation stacks**

## Resource Naming Bridge

### Problem
CloudTAK software contains hardcoded resource names that don't align with CDK naming conventions:

```javascript
// Current hardcoded names in CloudTAK
const ecrRepo = 'coe-ecr-etl';
const vpcImport = `tak-vpc-${environment}`;
const clusterName = `coe-ecs-${environment}`;
```

### Solution
The `ResourceBridge` construct creates resources with expected names while maintaining CDK patterns:

```typescript
// Creates ECR repo with original name for compatibility
this.ecrRepository = new ecr.Repository(this, 'CloudTAKECR', {
  repositoryName: 'coe-ecr-etl', // Keep original name
});

// Provides environment variables to bridge naming gaps
public getEnvironmentVariables(): Record<string, string> {
  return {
    'ECR_REPOSITORY_URI': this.ecrRepository.repositoryUri,
    'VPC_ID': cdk.Fn.importValue(`TAK-${stackName}-BaseInfra-VpcId`),
    // ... other bridging variables
  };
}
```

## Branding Integration

### Current Process
1. Manual script execution
2. File replacement and text substitution
3. Docker image building
4. Manual deployment

### New CDK Process
1. **Automated branding**: `branding/build-cdk.sh`
2. **Container image management**: ECR integration
3. **CDK deployment**: Infrastructure and application together

### Weekly Sync Process
```bash
# 1. Sync upstream changes
./scripts/sync-upstream.sh

# 2. Apply branding and build images
./branding/build-cdk.sh

# 3. Deploy updated infrastructure
cd cdk && npm run deploy
```

## Environment Variables Mapping

### Current CloudFormation → CDK Mapping
| Current | CDK Equivalent | Source |
|---------|----------------|--------|
| `tak-vpc-${env}-vpc` | `TAK-${stackName}-BaseInfra-VpcId` | BaseInfra export |
| `coe-ecs-${env}` | `TAK-${stackName}-BaseInfra` | BaseInfra export |
| `coe-ecr-etl` | `coe-ecr-etl` | ResourceBridge (compatibility) |
| Stack name patterns | `TAK-${stackName}-CloudTAK` | CDK naming convention |

## Required Changes to Upstream CloudTAK

### Minimal Changes Needed
To maintain compatibility while enabling CDK deployment, these changes should be proposed to upstream:

1. **Environment variable configuration**
   ```javascript
   // Instead of hardcoded:
   const ecrRepo = 'coe-ecr-etl';
   
   // Use environment variable:
   const ecrRepo = process.env.ECR_REPOSITORY_NAME || 'coe-ecr-etl';
   ```

2. **VPC import flexibility**
   ```javascript
   // Instead of hardcoded:
   const vpcId = cf.importValue(`tak-vpc-${environment}-vpc`);
   
   // Use environment variable:
   const vpcId = process.env.VPC_ID || cf.importValue(`tak-vpc-${environment}-vpc`);
   ```

3. **Resource naming configuration**
   ```javascript
   // Add configuration object:
   const config = {
     ecrRepository: process.env.ECR_REPOSITORY_NAME || 'coe-ecr-etl',
     vpcImportPrefix: process.env.VPC_IMPORT_PREFIX || 'tak-vpc',
     stackPrefix: process.env.STACK_PREFIX || '',
   };
   ```

### Change Request Template
```markdown
## Feature Request: Configurable Resource Naming

### Problem
Current hardcoded resource names prevent deployment in environments with different naming conventions.

### Solution
Add environment variable configuration for key resource names:
- ECR repository names
- VPC import value patterns
- Stack naming prefixes

### Benefits
- Enables deployment in multiple AWS environments
- Maintains backward compatibility
- Supports different infrastructure patterns

### Implementation
[Include specific code changes]
```

## Testing Strategy

### Unit Tests
- CDK construct validation
- Resource naming verification
- Environment variable mapping

### Integration Tests
- Full stack deployment
- API functionality validation
- ETL pipeline testing

### Performance Tests
- Container startup time
- API response times
- ETL job execution

## Rollback Plan

### Emergency Rollback
1. **DNS cutover**: Point traffic back to old infrastructure
2. **Data sync**: Ensure data consistency
3. **Service restoration**: Validate old services are functional

### Gradual Rollback
1. **Blue-green deployment**: Run both infrastructures in parallel
2. **Traffic splitting**: Gradually shift traffic back
3. **Monitoring**: Validate performance and functionality

## Success Criteria

### Technical
- [ ] All CloudTAK functionality working on CDK infrastructure
- [ ] Automated upstream sync process
- [ ] Container images building and deploying successfully
- [ ] ETL jobs processing data correctly

### Operational
- [ ] Weekly sync process documented and automated
- [ ] Monitoring and alerting configured
- [ ] Backup and disaster recovery tested
- [ ] Team trained on new deployment process

## Timeline

| Week | Phase | Activities | Deliverables |
|------|-------|------------|--------------|
| 1 | Preparation | Setup, testing, validation | Working CDK stack in dev |
| 2 | Infrastructure | Deploy all stacks, integration testing | Full infrastructure deployed |
| 3 | Application | Migrate services, test functionality | Working application |
| 4 | Production | Cutover, monitoring, optimization | Production deployment |

## Risk Mitigation

### High Risk Items
1. **Resource naming conflicts**: Mitigated by ResourceBridge
2. **Data migration issues**: Blue-green deployment strategy
3. **Performance degradation**: Comprehensive testing
4. **Upstream sync conflicts**: Automated conflict resolution

### Contingency Plans
- Maintain old infrastructure during transition
- Automated rollback procedures
- 24/7 monitoring during cutover
- Expert support team on standby