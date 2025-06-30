# Docker Image Strategy

This document explains the hybrid Docker image strategy implemented in the CloudTAK stack, which supports both pre-built images and local Docker building.

## Overview

The stack uses a **fallback strategy** that:
1. **First tries to use pre-built images** from ECR (fast deployments)
2. **Falls back to building Docker images locally** if pre-built images aren't available

This provides the best of both worlds:
- **Fast CI/CD deployments** using pre-built images
- **Flexible local development** with on-demand building
- **Upstream synchronization** with automatic branding application

## Configuration

### Context Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `usePreBuiltImages` | Enable/disable pre-built image usage | `true` or `false` |
| `cloudtakImageTag` | Tag for CloudTAK API image | `cloudtak-abc123` |

### Default Behavior

- **CI/CD environments**: Uses pre-built images when available
- **Local development**: Builds images on-demand (default)
- **Manual override**: Can force either mode via context parameters

## Usage Examples

### GitHub Actions (Pre-built Images)
```bash
npm run cdk deploy -- \
  --context usePreBuiltImages=true \
  --context cloudtakImageTag=cloudtak-abc123
```

### Local Development (Build on Demand)
```bash
# Use NPM scripts for convenience
npm run deploy:dev    # Dev environment, build locally
npm run deploy:prod   # Prod environment, build locally

# Or use CDK directly
npm run cdk deploy -- \
  --context envType=dev-test \
  --context usePreBuiltImages=false
```

## Image Repositories

The stack uses the ECR repository created by BaseInfra:

- **CloudTAK API**: `${AWS_ACCOUNT}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO_NAME}:${TAG}`
- **ETL Tasks**: `${AWS_ACCOUNT}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO_NAME}:${TASK}-${TAG}`
- **Repository Name**: Dynamically retrieved from BaseInfra stack exports

## Upstream Synchronization

### Automatic Sync Process
1. **Fetch upstream changes** from dfpc-coe/CloudTAK
2. **Merge changes** into local branch
3. **Apply TAK.NZ branding** via `scripts/apply-branding.sh`
4. **Build images** with updated code and branding
5. **Push to ECR** with version tags

### Branding Application
The branding script applies TAK.NZ customizations:
- Logo replacement
- Text branding updates
- Icon generation
- Configuration adjustments

## Implementation Details

### Stack Logic
```typescript
// Determine image strategy
const usePreBuiltImages = this.node.tryGetContext('usePreBuiltImages') ?? false;
const cloudtakImageTag = this.node.tryGetContext('cloudtakImageTag');

if (usePreBuiltImages && cloudtakImageTag) {
  // Use pre-built image from ECR
  const imageUri = `${account}.dkr.ecr.${region}.amazonaws.com/${ecrRepoName}:${cloudtakImageTag}`;
  containerImage = ecs.ContainerImage.fromRegistry(imageUri);
} else {
  // Build Docker image locally
  const dockerImageAsset = new ecrAssets.DockerImageAsset(/* ... */);
  containerImage = ecs.ContainerImage.fromDockerImageAsset(dockerImageAsset);
}
```

## Benefits

### Performance
- **Deployment time**: ~15 minutes → ~8 minutes (no Docker builds)
- **CI/CD efficiency**: Only builds when source code changes
- **Local flexibility**: Build on-demand for development

### Reliability
- **Separate concerns**: Image building vs infrastructure deployment
- **Retry capability**: Can retry deployments without rebuilding images
- **Error isolation**: Docker build failures don't affect infrastructure

### Flexibility
- **Environment-specific images**: Different image versions per environment
- **Easy rollbacks**: Change image tags without code changes
- **Independent lifecycle**: Manage images separately from infrastructure

## Troubleshooting

### Common Issues

**Image not found in ECR:**
```
Error: Repository does not exist or no permission to access
```
- Ensure ECR repositories exist
- Verify image tags are correct
- Check AWS permissions

**Build failures in local mode:**
```
Error: Docker build failed
```
- Ensure Docker is running locally
- Check docker-compose.yml syntax
- Verify build context and dependencies

**Upstream sync conflicts:**
```
Error: Merge conflicts with upstream
```
- Manually resolve conflicts
- Check branding compatibility
- Use `[force-deploy]` to override validation

### Debug Commands

```bash
# Test synthesis with pre-built images
npm run cdk synth -- \
  --context usePreBuiltImages=true \
  --context cloudtakImageTag=cloudtak-abc123

# Test synthesis with local building
npm run cdk synth -- \
  --context usePreBuiltImages=false

# Check available context
npm run cdk context
```

## Future Enhancements

Potential improvements:
- **Automatic image discovery** from ECR latest tags
- **Image vulnerability scanning** integration
- **Multi-architecture support** (ARM64/AMD64)
- **Image caching strategies** for faster local builds