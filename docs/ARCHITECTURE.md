# Architecture Documentation

## System Architecture

The CloudTAK Infrastructure provides web-based TAK services with ETL capabilities, database integration, and containerized deployment on AWS ECS with auto-scaling and high availability features.

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Web Clients   │────│  Application     │────│   CloudTAK      │
│ (Browsers/APIs) │    │  Load Balancer   │    │  (ECS Service)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
        │                                               │
        │              ┌──────────────────┐             │
        └──────────────│   API Gateway    │             │
                       │   (PMTiles)      │             │
                       └──────────────────┘             │
                                │                       │
                ┌───────────────┼───────────────────────┼─────────────────────────────┐
                │               │       │               │                             │
                ▼               ▼       ▼               ▼                             ▼
┌─────────────────┐    ┌──────────────────┐    ┌──────────────┐    ┌──────────────────┐
│   Base Layer    │    │   ETL Tasks      │    │   Aurora     │    │   Base Layer     │
│ (VPC/ECS/S3)    │    │ (Batch/Lambda)   │    │ PostgreSQL   │    │  (S3 Buckets)    │
└─────────────────┘    └──────────────────┘    │  Database    │    └──────────────────┘
                                               └──────────────┘
```

## Component Details

### Core Services

#### 1. CloudTAK API Application
- **Technology**: Node.js/TypeScript application running in ECS Fargate
- **Purpose**: Web-based TAK interface and API services
- **Scaling**: Auto-scaling based on CPU utilization (production only)
- **Storage**: External database integration, S3 for assets

#### 2. ETL Task Services
- **Technology**: Containerized ETL tasks running in ECS
- **Purpose**: Data processing and transformation for TAK data
- **Tasks**: Data processing, events processing, pmtiles generation
- **Scaling**: On-demand task execution
- **Integration**: Connects to external databases and APIs

#### 3. Load Balancing
- **Technology**: Application Load Balancer (ALB)
- **Purpose**: HTTP/HTTPS traffic distribution and SSL termination
- **Configuration**: Health checks and target group management
- **SSL**: Automated certificate management via ACM

#### 4. API Gateway
- **Technology**: AWS API Gateway (Regional)
- **Purpose**: PMTiles API endpoint for tile serving
- **Integration**: Lambda proxy integration for tile requests
- **Domain**: Custom domain with SSL certificate
- **CORS**: Configured for cross-origin requests

### Data Layer

#### 1. Aurora PostgreSQL Database
- **Purpose**: Primary data store for CloudTAK application data
- **Configuration**: Serverless v2 (dev-test) or provisioned instances (prod)
- **Backup**: Automated backups with configurable retention
- **Encryption**: Encrypted at rest using AWS KMS

#### 2. S3 Storage Integration
- **Purpose**: Asset storage and ALB access logs
- **Configuration**: S3 buckets imported from BaseInfra layer
- **Usage**: Static assets, logs, and configuration files
- **Integration**: CloudTAK connects to existing S3 resources

#### 3. AWS Batch for ETL Processing
- **Purpose**: Scalable ETL job processing
- **Tasks**: Data processing, events processing, pmtiles generation
- **Scaling**: On-demand compute resources
- **Integration**: Connects to Aurora database and S3 buckets

#### 4. Lambda Functions
- **Purpose**: Event-driven processing and S3 notifications
- **Triggers**: S3 object creation events
- **Tasks**: Image processing, event handling, tile generation
- **Integration**: Processes assets uploaded to S3 bucket

#### 5. CloudWatch Alarms and SNS
- **Purpose**: Monitoring and alerting for Lambda function errors
- **SNS Topics**: High urgency and low urgency notification topics
- **Alarms**: CloudWatch alarms for Lambda function error metrics
- **Integration**: Automated notifications when Lambda functions fail

### Network Architecture

#### 1. VPC Configuration
- **Subnets**: Public subnets for ALB, private subnets for services
- **Availability Zones**: Multi-AZ deployment for high availability
- **NAT Gateway**: Outbound internet access for private subnets

#### 2. Load Balancing
- **Application Load Balancer**: Layer 7 load balancing for HTTP/HTTPS with dual-stack IPv4/IPv6
- **Target Groups**: Health check endpoints for CloudTAK services
- **SSL Termination**: Automated certificate management
- **Access Logs**: Dedicated S3 bucket for ALB access and connection logs

#### 3. Security Groups
- **Principle of Least Privilege**: Minimal required access between components
- **Ingress Rules**: HTTP/HTTPS access from internet
- **Egress Rules**: Controlled outbound access for external integrations

## Environment Configuration System

### 1. Environment Types

#### **dev-test** (Default)
- **Focus**: Cost optimization and development efficiency
- **ECS**: Minimal CPU/memory allocation (1024/4096)
- **Tasks**: Single task instance
- **Container Insights**: Disabled
- **ECS Exec**: Enabled (debugging access)
- **ECR**: 5 image retention, no vulnerability scanning
- **Resource Removal**: DESTROY policy (allows cleanup)

#### **prod**
- **Focus**: High availability, security, and production readiness
- **ECS**: Higher resource allocation (2048/8192)
- **Tasks**: Multiple task instances for redundancy
- **Container Insights**: Enabled (monitoring and observability)
- **ECS Exec**: Disabled (security)
- **ECR**: 20 image retention, vulnerability scanning enabled
- **Resource Removal**: RETAIN policy (protects production resources)

### 2. Parameter Override System
- **CDK Context**: CLI-based parameter overrides
- **Environment Defaults**: Fallback configuration based on environment type
- **Hierarchical Resolution**: Context → Environment Defaults
- **Configuration File**: All settings stored in [`cdk.json`](../cdk/cdk.json)

## Security Architecture

### 1. Network Security Groups

The infrastructure implements a layered security model with dedicated security groups for each component.

#### Application Services

**CloudTAK Security Group**
- **Port 80/TCP** from ALB Security Group only - HTTP traffic from ALB
- **Port 443/TCP** from ALB Security Group only - HTTPS traffic from ALB

**Application Load Balancer Security Group**
- **Port 80/TCP** from `0.0.0.0/0` (IPv4) and `::/0` (IPv6) - HTTP access
- **Port 443/TCP** from `0.0.0.0/0` (IPv4) and `::/0` (IPv6) - HTTPS access

#### Security Design Principles

- **Network Segmentation**: Each service tier has dedicated security groups
- **Minimal Access**: Only required ports and protocols are allowed
- **External Integration**: Secure outbound access for database connections
- **Dualstack Support**: Internet-facing services support both IPv4 and IPv6

### 2. Encryption
- **In Transit**: TLS 1.2+ for all communications
- **At Rest**: ECS task encryption and secure environment variables
- **Key Management**: Imported KMS keys from base infrastructure

### 3. Access Control
- **IAM Roles**: Service-specific roles with minimal permissions
- **Security Groups**: Network-level access control
- **Container Security**: Non-root containers with minimal privileges

### 4. Monitoring and Logging
- **CloudWatch Logs**: Application and system logs
- **CloudWatch Metrics**: Performance and health metrics
- **Container Insights**: Detailed ECS monitoring (production)

## CloudTAK Integration

### 1. Upstream Synchronization
- **Source**: dfpc-coe/CloudTAK repository
- **Process**: Automated sync with conflict resolution
- **Branding**: TAK.NZ customizations applied after sync
- **Frequency**: Weekly automated sync via GitHub Actions

### 2. ETL Task Management
- **Task Types**: Data processing, events, pmtiles generation
- **Execution**: On-demand and scheduled task execution
- **Scaling**: Independent scaling per task type
- **Monitoring**: CloudWatch integration for task monitoring

### 3. Configuration Management
- **Environment Variables**: Core configuration via ECS environment variables
- **External Connections**: Database and API connection strings
- **Secrets**: Secure handling of sensitive configuration data

## Deployment Architecture

### 1. Infrastructure as Code
- **AWS CDK**: TypeScript-based infrastructure definitions
- **Version Control**: Git-based infrastructure versioning
- **Automated Testing**: Unit tests for infrastructure code

### 2. Container Management
- **ECR**: Private container registry from BaseInfra
- **ECS Fargate**: Serverless container platform
- **Docker Images**: Multi-stage builds with upstream sync

### 3. CI/CD Pipeline
- **GitHub Actions**: Automated build and deployment
- **Image Building**: Upstream sync + branding + build
- **Deployment**: Two-stage deployment (dev-test → prod)

## Scalability and Performance

### 1. Auto Scaling (Production)
- **ECS Service**: Auto-scaling based on CPU utilization
- **Target Capacity**: 1-10 tasks based on demand
- **ETL Tasks**: Independent scaling per task type

### 2. High Availability
- **Multi-AZ**: ECS service deployment across availability zones
- **Load Balancing**: Application Load Balancer for traffic distribution
- **Health Checks**: Automated health monitoring and recovery

### 3. Performance Optimization
- **Container Resources**: Environment-specific CPU and memory allocation
- **Monitoring**: Container Insights for detailed performance metrics
- **Caching**: Application-level caching strategies

## Cost Optimization

### Development Environment Optimizations
- **Single Task**: Minimal compute allocation (~$25/month savings)
- **Smaller Resources**: Lower CPU/memory allocation
- **Container Insights Disabled**: Reduces CloudWatch costs
- **Fewer ECR Images**: Reduced storage costs

### Production Environment Features
- **High Availability**: Multiple task instances for redundancy
- **Enhanced Monitoring**: Container Insights enabled
- **Advanced Configuration**: Extended ECR retention
- **Security Features**: Vulnerability scanning enabled

## Integration Points

### 1. Base Infrastructure Dependencies
- **VPC**: Network infrastructure and subnets
- **ECS Cluster**: Container orchestration platform
- **ECR Repository**: Container image storage
- **S3 Buckets**: Asset storage and ALB access logs
- **KMS Keys**: Encryption key management
- **ACM Certificates**: SSL certificate management

### 2. External Integrations
- **Database Connections**: External TAK databases
- **API Integrations**: Third-party service connections
- **Monitoring**: CloudWatch and external monitoring systems

### 3. DNS and Service Discovery
- **Route53 Records**: Both A (IPv4) and AAAA (IPv6) records for dual-stack support
- **ECS Service Discovery**: Internal service communication
- **Load Balancer Integration**: External service access with dual-stack support
- **Health Check Endpoints**: Service health monitoring