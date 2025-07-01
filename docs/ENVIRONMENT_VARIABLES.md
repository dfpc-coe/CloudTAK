# CloudTAK Environment Variables

CloudTAK supports configuration through environment variables that override database settings when present at startup. This document lists all available configuration environment variables.

## Format

Environment variables follow the pattern:
- Prefix: `CLOUDTAK_Config_`
- Replace `::` with `_` in the config key
- All characters after `CLOUDTAK_Config_` are case SENSITIVE

**Example:** `media::url` becomes `CLOUDTAK_Config_media_url`

## Available Environment Variables

### TAK Server Configuration

| Environment Variable | Type | Description |
|---------------------|------|-------------|
| `CLOUDTAK_Server_name` | string | TAK Server name/description |
| `CLOUDTAK_Server_url` | string | TAK Server connection URL (e.g., "ssl://tak.example.com:8089") |
| `CLOUDTAK_Server_api` | string | TAK Server API URL (e.g., "https://tak.example.com:8443") |
| `CLOUDTAK_Server_webtak` | string | TAK Server WebTAK URL (e.g., "https://tak.example.com:8443") |
| `CLOUDTAK_Server_auth_cert` | string | TAK Server client certificate (PEM format) |
| `CLOUDTAK_Server_auth_key` | string | TAK Server client private key (PEM format) |
| `CLOUDTAK_Server_auth_p12` | string | TAK Server P12/PKCS12 file (base64 encoded) |
| `CLOUDTAK_Server_auth_password` | string | Password for P12/PKCS12 file |

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

### TAK Server Configuration
```bash
# Configure TAK Server connection
export CLOUDTAK_Server_name="Production TAK Server"
export CLOUDTAK_Server_url="ssl://tak.example.com:8089"
export CLOUDTAK_Server_api="https://tak.example.com:8443"
export CLOUDTAK_Server_webtak="https://tak.example.com:8443"

# Option 1: Use P12 file (recommended for automation)
export CLOUDTAK_Server_auth_p12="$(base64 -w 0 /path/to/client.p12)"
export CLOUDTAK_Server_auth_password="atakatak"

# Option 2: Use separate certificate and key files
export CLOUDTAK_Server_auth_cert="-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----"
export CLOUDTAK_Server_auth_key="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----"
```

### Basic Configuration
```bash
# Set map center to New Zealand coordinates
export CLOUDTAK_Config_map_center="-41.2865,174.7762"

# Set initial zoom level
export CLOUDTAK_Config_map_zoom=6
```

### ArcGIS Online Integration
```bash
# Enable ArcGIS Online
export CLOUDTAK_Config_agol_enabled=true
export CLOUDTAK_Config_agol_token="your_agol_token_here"
```

### Group Configuration
```bash
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
      - CLOUDTAK_Server_webtak=https://tak.example.com:8443
      # Application Configuration
      - CLOUDTAK_Config_map_center=-41.2865,174.7762
      - CLOUDTAK_Config_map_zoom=6
      - CLOUDTAK_Config_agol_enabled=true
      - CLOUDTAK_Config_agol_token=your_token_here
      - CLOUDTAK_Config_group_Red=Emergency Response
```

## Important Notes

- Environment variables present at launch will **OVERRIDE** any values stored in the database
- **Server configuration** environment variables solve the first-boot configuration problem by allowing automated TAK server setup without requiring API authentication
- All characters after `CLOUDTAK_Config_` are case sensitive
- Boolean values should be set as `true` or `false`
- Integer values should be provided as numbers without quotes
- String values can be provided with or without quotes
- Empty string values will be treated as valid configuration
- For certificate/key values, use proper PEM format with escaped newlines (`\n`) in environment variables