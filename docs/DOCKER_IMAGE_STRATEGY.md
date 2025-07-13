# Docker Image Strategy

This document explains the hybrid Docker image strategy implemented in the CloudTAK stack, which supports both pre-built images from ECR and local Docker building for maximum flexibility.

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

**Note**: The `cloudtakImageTag` is used to derive all other image tags:
- Events Lambda: `events-${cloudtakImageTag}` → `events-abc123`
- PMTiles Lambda: `pmtiles-${cloudtakImageTag}` → `pmtiles-abc123`
- Data Task (Batch): `data-${cloudtakImageTag}` → `data-abc123`

### Default Behavior

- **CI/CD environments**: Uses pre-built images when available
- **Local development**: Builds images on-demand (default)
- **Manual override**: Can force either mode via context parameters

## Usage Examples

### GitHub Actions (Pre-built Images)
```bash
npm run deploy:dev -- \
  --context usePreBuiltImages=true \
  --context cloudtakImageTag=cloudtak-abc123
```

### Local Development (Build on Demand)
```bash
# Use NPM scripts for local builds (default behavior)
npm run deploy:dev     # Dev environment, build locally
npm run deploy:prod    # Prod environment, build locally

# Or explicitly disable pre-built images
npm run deploy:dev -- \
  --context usePreBuiltImages=false
```

## Image Repositories

The stack uses two ECR repositories from BaseInfra:

- **CloudTAK API & Lambda Functions**: Uses `ECR_ARTIFACTS_REPO` from BaseInfra
  - API: `${ECR_REPO}:cloudtak-${SHA}`
  - Events Lambda: `${ECR_REPO}:events-${SHA}`
  - PMTiles Lambda: `${ECR_REPO}:pmtiles-${SHA}`
- **ETL Tasks (Batch)**: Uses `ECR_ETL_TASKS_REPO` from BaseInfra
  - Data Task: `${ETL_ECR_REPO}:data-${SHA}`
- **Repository Names**: Dynamically retrieved from BaseInfra stack exports

## Upstream Integration
- **Automatic Sync**: Weekly sync with upstream repository
- **Branding Application**: TAK.NZ customizations applied after sync
- **Version Tagging**: Git SHA and version-based image tags

## Implementation Details

### Stack Logic
```typescript
// Determine image strategy
const usePreBuiltImages = this.node.tryGetContext('usePreBuiltImages') ?? false;
const cloudtakImageTag = this.node.tryGetContext('cloudtakImageTag');

if (usePreBuiltImages && cloudtakImageTag) {
  // Get ECR repository from BaseInfra and build image URI
  const ecrRepoArn = Fn.importValue(createBaseImportValue(stackNameComponent, BASE_EXPORT_NAMES.ECR_REPO));
  const ecrRepoName = Fn.select(1, Fn.split('/', ecrRepoArn));
  const imageUri = `${account}.dkr.ecr.${region}.amazonaws.com/${Token.asString(ecrRepoName)}:${cloudtakImageTag}`;
  containerImage = ecs.ContainerImage.fromRegistry(imageUri);
} else {
  // Fall back to building Docker image asset
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



### Debug Commands

```bash
# Test synthesis with pre-built images
npm run synth:dev -- \
  --context usePreBuiltImages=true \
  --context cloudtakImageTag=cloudtak-abc123

# Test synthesis with local building
npm run synth:dev -- \
  --context usePreBuiltImages=false

# Check available context
npm run cdk:context
```

## Future Enhancements

Potential improvements:
- **Automatic image discovery** from ECR latest tags
- **Image vulnerability scanning** integration
- **Multi-architecture support** (ARM64/AMD64)
- **Image caching strategies** for faster local builds