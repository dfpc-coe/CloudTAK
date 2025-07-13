# CloudTAK Environment Variables

CloudTAK supports configuration through environment variables that override database settings when present at startup. This document lists all available configuration environment variables.

## S3 Configuration File

For production deployments, CloudTAK can load configuration from an S3 bucket (imported from BaseInfra). Upload a `cloudtak-config.env` file to the S3 configuration bucket to provide environment variables.

**Example**: See `cloudtak-config.env.example` in the repository root for a complete configuration template.

**Usage**:
1. Copy `cloudtak-config.env.example` to `cloudtak-config.env`
2. Customize the configuration values
3. Upload to the S3 bucket: `s3://{bucket-name}/cloudtak-config.env`
4. Enable S3 configuration in deployment: `useS3CloudTAKConfigFile=true`

## Server Configuration Variables

These variables configure the TAK server connection and are processed during application startup to solve the first-boot configuration problem.

### TAK Server Configuration

| Environment Variable | Type | Description |
|---------------------|------|-------------|
| `CLOUDTAK_Server_name` | string | TAK Server name/description |
| `CLOUDTAK_Server_url` | string | TAK Server connection URL (e.g., "ssl://tak.example.com:8089") |
| `CLOUDTAK_Server_api` | string | TAK Server API URL (e.g., "https://tak.example.com:8443") |
| `CLOUDTAK_Server_webtak` | string | TAK Server WebTAK URL (e.g., "https://tak.example.com:8446") |

### TAK Server Authentication

CloudTAK supports multiple authentication methods for connecting to TAK servers:

#### Option 1: P12/PKCS12 Certificate (Recommended for AWS)
| Environment Variable | Type | Description |
|---------------------|------|-------------|
| `CLOUDTAK_Server_auth_p12_secret_arn` | string | AWS Secrets Manager ARN containing P12 certificate |
| `CLOUDTAK_Server_auth_password` | string | Password for P12/PKCS12 file |

#### Option 2: Direct Certificate and Key
| Environment Variable | Type | Description |
|---------------------|------|-------------|
| `CLOUDTAK_Server_auth_cert` | string | TAK Server client certificate (PEM format) |
| `CLOUDTAK_Server_auth_key` | string | TAK Server client private key (PEM format) |

### Admin User Configuration

| Environment Variable | Type | Description |
|---------------------|------|-------------|
| `CLOUDTAK_ADMIN_USERNAME` | string | Admin username for CloudTAK system |
| `CLOUDTAK_ADMIN_PASSWORD` | string | Admin password for CloudTAK system |

## Application Configuration Variables

These variables follow the pattern `CLOUDTAK_Config_` and override database settings.

### Format Rules
- Prefix: `CLOUDTAK_Config_`
- Replace `::` with `_` in the config key
- All characters after `CLOUDTAK_Config_` are case SENSITIVE

**Example:** `media::url` becomes `CLOUDTAK_Config_media_url`

### ArcGIS Online Configuration

| Environment Variable | Type | Description |
|---------------------|------|-------------|
| `CLOUDTAK_Config_agol_enabled` | boolean | Enable/disable ArcGIS Online integration |
| `CLOUDTAK_Config_agol_token` | string | ArcGIS Online API token |

### Media Server Configuration

| Environment Variable | Type | Description |
|---------------------|------|-------------|
| `CLOUDTAK_Config_media_url` | string | CloudTAK Hosted MediaMTX Service URL |

### Map Configuration

| Environment Variable | Type | Default | Description |
|---------------------|------|---------|-------------|
| `CLOUDTAK_Config_map_center` | string | "-100,40" | Initial map center coordinates |
| `CLOUDTAK_Config_map_pitch` | integer (0-90) | 0 | Initial map pitch |
| `CLOUDTAK_Config_map_bearing` | integer (0-360) | 0 | Initial map bearing |
| `CLOUDTAK_Config_map_zoom` | integer (0-20) | 4 | Initial map zoom level |

### Display Defaults Configuration

These settings configure the default display preferences for new users. Existing users will not be affected by changes to these settings.

| Environment Variable | Type | Default | Options | Description |
|---------------------|------|---------|---------|-------------|
| `CLOUDTAK_Config_display_stale` | string | "10 Minutes" | "Immediate", "10 Minutes", "30 Minutes", "1 Hour", "Never" | Default stale data timeout |
| `CLOUDTAK_Config_display_distance` | string | "mile" | "meter", "kilometer", "mile" | Default distance unit |
| `CLOUDTAK_Config_display_elevation` | string | "feet" | "meter", "feet" | Default elevation unit |
| `CLOUDTAK_Config_display_speed` | string | "mi/h" | "m/s", "km/h", "mi/h" | Default speed unit |
| `CLOUDTAK_Config_display_projection` | string | "globe" | "mercator", "globe" | Default map projection |
| `CLOUDTAK_Config_display_zoom` | string | "conditional" | "always", "conditional", "never" | Default zoom behavior |
| `CLOUDTAK_Config_display_text` | string | "Medium" | "Small", "Medium", "Large" | Default text size |

### TAK User Group Configuration

| Environment Variable | Type | Description |
|---------------------|------|-------------|
| `CLOUDTAK_Config_group_Yellow` | string | Yellow group configuration |
| `CLOUDTAK_Config_group_Cyan` | string | Cyan group configuration |
| `CLOUDTAK_Config_group_Green` | string | Green group configuration |
| `CLOUDTAK_Config_group_Red` | string | Red group configuration |
| `CLOUDTAK_Config_group_Purple` | string | Purple group configuration |
| `CLOUDTAK_Config_group_Orange` | string | Orange group configuration |
| `CLOUDTAK_Config_group_Blue` | string | Blue group configuration |
| `CLOUDTAK_Config_group_Magenta` | string | Magenta group configuration |
| `CLOUDTAK_Config_group_White` | string | White group configuration |
| `CLOUDTAK_Config_group_Maroon` | string | Maroon group configuration |
| `CLOUDTAK_Config_group_Dark_Blue` | string | Dark Blue group configuration |
| `CLOUDTAK_Config_group_Teal` | string | Teal group configuration |
| `CLOUDTAK_Config_group_Dark_Green` | string | Dark Green group configuration |
| `CLOUDTAK_Config_group_Brown` | string | Brown group configuration |

### OIDC (OpenID Connect) Configuration

| Environment Variable | Type | Description |
|---------------------|------|-------------|
| `CLOUDTAK_Config_oidc_enabled` | boolean | Enable/disable OIDC authentication |
| `CLOUDTAK_Config_oidc_enforced` | boolean | Enforce OIDC authentication |
| `CLOUDTAK_Config_oidc_name` | string | OIDC provider name |
| `CLOUDTAK_Config_oidc_discovery` | string | OIDC discovery URL |
| `CLOUDTAK_Config_oidc_client` | string | OIDC client ID |
| `CLOUDTAK_Config_oidc_secret` | string | OIDC client secret |

### COTAK OAuth Provider Configuration

| Environment Variable | Type | Description |
|---------------------|------|-------------|
| `CLOUDTAK_Config_provider_url` | string | Provider URL |
| `CLOUDTAK_Config_provider_secret` | string | Provider secret |
| `CLOUDTAK_Config_provider_client` | string | Provider client |

### Login Page Configuration

| Environment Variable | Type | Description |
|---------------------|------|-------------|
| `CLOUDTAK_Config_login_signup` | string | TAK Server signup link URL |
| `CLOUDTAK_Config_login_forgot` | string | TAK Server password reset link URL |
| `CLOUDTAK_Config_login_logo` | string | Base64 encoded login logo (must start with "data:image/png;base64,") |

## Usage Examples

### TAK Server Configuration with P12 Certificate (AWS)
```bash
# Configure TAK Server connection
export CLOUDTAK_Server_name="Production TAK Server"
export CLOUDTAK_Server_url="ssl://tak.example.com:8089"
export CLOUDTAK_Server_api="https://tak.example.com:8443"
export CLOUDTAK_Server_webtak="https://tak.example.com:8446"

# Use P12 certificate from AWS Secrets Manager
export CLOUDTAK_Server_auth_p12_secret_arn="arn:aws:secretsmanager:region:account:secret:tak-cert"
export CLOUDTAK_Server_auth_password="atakatak"

# Admin user configuration
export CLOUDTAK_ADMIN_USERNAME="admin"
export CLOUDTAK_ADMIN_PASSWORD="secure-password"
```

### TAK Server Configuration with Direct Certificates
```bash
# Configure TAK Server connection
export CLOUDTAK_Server_name="Development TAK Server"
export CLOUDTAK_Server_url="ssl://tak-dev.example.com:8089"
export CLOUDTAK_Server_api="https://tak-dev.example.com:8443"
export CLOUDTAK_Server_webtak="https://tak-dev.example.com:8446"

# Use direct certificate and key
export CLOUDTAK_Server_auth_cert="-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----"
export CLOUDTAK_Server_auth_key="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----"
```

### Application Configuration
```bash
# Set map center to New Zealand coordinates
export CLOUDTAK_Config_map_center="-41.2865,174.7762"
export CLOUDTAK_Config_map_zoom=6

# Configure display defaults for new users
export CLOUDTAK_Config_display_stale="30 Minutes"
export CLOUDTAK_Config_display_distance="kilometer"
export CLOUDTAK_Config_display_elevation="meter"
export CLOUDTAK_Config_display_speed="km/h"
export CLOUDTAK_Config_display_projection="mercator"
export CLOUDTAK_Config_display_zoom="conditional"
export CLOUDTAK_Config_display_text="Medium"

# Enable ArcGIS Online
export CLOUDTAK_Config_agol_enabled=true
export CLOUDTAK_Config_agol_token="your_agol_token_here"

# Configure emergency response groups
export CLOUDTAK_Config_group_Red="Emergency Response Team"
export CLOUDTAK_Config_group_Blue="Police Units"
export CLOUDTAK_Config_group_Green="Medical Teams"
```

### OIDC Authentication
```bash
# Configure OIDC authentication
export CLOUDTAK_Config_oidc_enabled=true
export CLOUDTAK_Config_oidc_enforced=false
export CLOUDTAK_Config_oidc_name="Corporate SSO"
export CLOUDTAK_Config_oidc_discovery="https://your-oidc-provider.com/.well-known/openid_configuration"
export CLOUDTAK_Config_oidc_client="your-client-id"
export CLOUDTAK_Config_oidc_secret="your-client-secret"
```

### Docker Compose Example
```yaml
version: '3.8'
services:
  cloudtak:
    image: cloudtak:latest
    environment:
      # TAK Server Configuration
      - CLOUDTAK_Server_name=Production TAK Server
      - CLOUDTAK_Server_url=ssl://tak.example.com:8089
      - CLOUDTAK_Server_api=https://tak.example.com:8443
      - CLOUDTAK_Server_webtak=https://tak.example.com:8446
      - CLOUDTAK_Server_auth_cert=-----BEGIN CERTIFICATE-----...
      - CLOUDTAK_Server_auth_key=-----BEGIN PRIVATE KEY-----...
      
      # Admin Configuration
      - CLOUDTAK_ADMIN_USERNAME=admin
      - CLOUDTAK_ADMIN_PASSWORD=secure-password
      
      # Application Configuration
      - CLOUDTAK_Config_map_center=-41.2865,174.7762
      - CLOUDTAK_Config_map_zoom=6
      - CLOUDTAK_Config_agol_enabled=true
      - CLOUDTAK_Config_agol_token=your_token_here
      - CLOUDTAK_Config_group_Red=Emergency Response
```

## Configuration Processing

### Server Configuration
1. **First Boot**: If no server configuration exists in the database, CloudTAK creates initial server configuration using environment variables
2. **Runtime Updates**: Server configuration environment variables override database values when present at startup
3. **Certificate Handling**: Supports both P12/PKCS12 files (via AWS Secrets Manager) and direct PEM certificates
4. **Admin User Creation**: Automatically creates admin user with system admin permissions when credentials are provided

### Application Configuration
1. **Database Override**: `CLOUDTAK_Config_*` variables override corresponding database settings
2. **Startup Processing**: All matching environment variables are processed and stored in the database during startup
3. **Case Sensitivity**: Configuration keys after `CLOUDTAK_Config_` are case-sensitive
4. **Key Transformation**: `::` in database keys becomes `_` in environment variable names

## Important Notes

- **Server configuration** environment variables solve the first-boot configuration problem by allowing automated TAK server setup without requiring API authentication
- Environment variables present at launch will **OVERRIDE** any values stored in the database
- All characters after `CLOUDTAK_Config_` are case sensitive
- Boolean values should be set as `true` or `false`
- Integer values should be provided as numbers without quotes
- String values can be provided with or without quotes
- Empty string values will be treated as valid configuration
- For certificate/key values, use proper PEM format with escaped newlines (`\n`) in environment variables
- P12 certificates from AWS Secrets Manager are automatically converted to PEM format
- Admin users created via environment variables receive full system administrator privileges