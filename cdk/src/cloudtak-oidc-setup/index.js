const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

exports.handler = async (event, context) => {
  console.log('CloudTAK OIDC Setup - Event:', JSON.stringify(event, null, 2));
  
  try {
    // Handle CloudFormation DELETE
    if (event.RequestType === 'Delete') {
      console.log('DELETE request - preserving Authentik resources');
      return {
        PhysicalResourceId: event.PhysicalResourceId || 'cloudtak-oidc-setup',
        Data: {},
      };
    }
    
    // Get admin token from Secrets Manager
    const secretsManager = new SecretsManagerClient();
    const secretName = process.env.AUTHENTIK_ADMIN_SECRET_ARN;
    
    const getCommand = new GetSecretValueCommand({ SecretId: secretName });
    const secretData = await secretsManager.send(getCommand);
    
    let adminToken;
    try {
      const secret = JSON.parse(secretData.SecretString);
      adminToken = secret.token;
    } catch {
      adminToken = secretData.SecretString;
    }
    
    // Configure Authentik API client
    const authentikUrl = process.env.AUTHENTIK_URL;
    const api = axios.create({
      baseURL: authentikUrl,
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
    });
    
    // Get authorization flow
    const authorizationFlow = await getFlowByName(api, 'default-provider-authorization-implicit-consent');
    const invalidationFlow = await getFlowByName(api, 'default-provider-invalidation-flow');
    
    // Create OAuth2 provider
    const providerName = 'TAK-CloudTAK';
    const redirectUris = JSON.parse(process.env.REDIRECT_URIS).map(uri => ({
      url: uri,
      matching_mode: 'strict'
    }));
    
    // Get required scope mappings. `groups` is a custom mapping (not one of
    // Authentik's built-in OpenID scopes) added so CloudTAK's OIDC callback can
    // read group membership directly from the userinfo response, without a
    // separate Authentik API round-trip, for system/agency admin role sync.
    const scopeMappings = [];
    for (const scope of ['email', 'openid', 'profile']) {
      const mapping = await getOrCreateScopeMapping(api, scope);
      scopeMappings.push(mapping.pk);
    }
    const groupsMapping = await getOrCreateGroupsScopeMapping(api);
    scopeMappings.push(groupsMapping.pk);
    
    const provider = await createOrUpdateProvider(api, {
      name: providerName,
      authorization_flow: authorizationFlow.pk,
      invalidation_flow: invalidationFlow.pk,
      redirect_uris: redirectUris,
      client_type: 'confidential',
      // REQUIRED. Authentik 2026.8 defaults `grant_types` to an empty list when it is omitted, and a
      // provider with no grant types rejects every authorize request with `invalid_request` ("The request is
      // otherwise malformed"), so logins fail. The same set as the TAK Team Manager provider.
      grant_types: ['authorization_code', 'implicit', 'hybrid'],
      include_claims_in_id_token: true,
      access_code_validity: 'minutes=1',
      access_token_validity: 'minutes=5',
      refresh_token_validity: 'days=30',
      property_mappings: scopeMappings,
    });
    
    // Create application
    const applicationName = process.env.APPLICATION_NAME;
    const applicationSlug = process.env.APPLICATION_SLUG;
    const launchUrl = process.env.LAUNCH_URL;
    const groupName = process.env.GROUP_NAME;
    
    const application = await createOrUpdateApplication(api, {
      name: applicationName,
      slug: applicationSlug,
      provider: provider.pk,
      meta_launch_url: launchUrl,
      meta_description: 'Web-based geospatial collaboration platform.',
      open_in_new_tab: false,
    });
    
    // Upload icon
    await uploadApplicationIcon(api, application.slug);
    
    // Assign to group
    if (groupName) {
      await assignGroupToApplication(api, application.slug, groupName);
    }

    // Optional: SCIM provider that provisions Authentik users into CloudTAK. Only when the stack
    // enabled SCIM (cloudtak.scimEnabled), which also hands the same token to the CloudTAK API.
    if (process.env.SCIM_TOKEN_SECRET_ARN) {
      const scimToken = await getSecretString(secretsManager, process.env.SCIM_TOKEN_SECRET_ARN, 'token');
      await setupScimProvider(api, {
        name: process.env.SCIM_PROVIDER_NAME || 'TAK-CloudTAK-SCIM',
        url: process.env.SCIM_URL,
        token: scimToken,
        applicationSlug: application.slug,
      });
    }
    
    // Get OIDC configuration
    const oidcConfig = await getOidcConfiguration(authentikUrl, applicationSlug);
    
    console.log('CloudTAK OIDC setup completed successfully');
    
    return {
      PhysicalResourceId: provider.pk.toString(),
      Data: {
        clientId: provider.client_id,
        clientSecret: provider.client_secret,
        issuer: oidcConfig.issuer,
        authorizeUrl: oidcConfig.authorizeUrl,
        tokenUrl: oidcConfig.tokenUrl,
        userInfoUrl: oidcConfig.userInfoUrl,
      }
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};

async function getFlowByName(api, name) {
  try {
    const response = await api.get('/api/v3/flows/instances/', { params: { name } });
    if (response.data.results && response.data.results.length > 0) {
      return response.data.results[0];
    }
  } catch (error) {
    console.warn(`Flow lookup by name failed: ${error.message}`);
  }
  
  const allFlows = await api.get('/api/v3/flows/instances/');
  const flow = allFlows.data.results.find(f => f.slug === name);
  if (flow) return flow;
  
  throw new Error(`Flow not found: ${name}`);
}

async function createOrUpdateProvider(api, providerData) {
  const existing = await api.get('/api/v3/providers/oauth2/', {
    params: { name: providerData.name }
  });
  
  let provider;
  if (existing.data.results && existing.data.results.length > 0) {
    const existingProvider = existing.data.results[0];
    const response = await api.patch(`/api/v3/providers/oauth2/${existingProvider.pk}/`, providerData);
    provider = response.data;
  } else {
    const response = await api.post('/api/v3/providers/oauth2/', providerData);
    provider = response.data;
  }
  
  // Ensure we have client_id and client_secret
  if (!provider.client_id || !provider.client_secret) {
    const detailsResponse = await api.get(`/api/v3/providers/oauth2/${provider.pk}/`);
    provider = detailsResponse.data;
  }
  
  return provider;
}

async function createOrUpdateApplication(api, applicationData) {
  try {
    const response = await api.get(`/api/v3/core/applications/${applicationData.slug}/`);
    const updateResponse = await api.patch(`/api/v3/core/applications/${applicationData.slug}/`, applicationData);
    return updateResponse.data;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      const response = await api.post('/api/v3/core/applications/', applicationData);
      return response.data;
    }
    throw error;
  }
}

async function assignGroupToApplication(api, appSlug, groupName) {
  try {
    await api.patch(`/api/v3/core/applications/${appSlug}/`, { group: groupName });
  } catch (error) {
    console.warn('Failed to assign group:', error.message);
  }
}

// Stable media name the bundled logo is stored under in Authentik, and that `meta_icon` points at.
const APPLICATION_ICON_MEDIA_NAME = 'application-icons/CloudTAKLogo.png';

// Upload the bundled logo into Authentik's media storage and point the application's `meta_icon` at it.
//
// Authentik 2026.8 behaviour (checked against its source, and against the TAK Team Manager Lambda, which
// verified the same calls live):
//   - POST /api/v3/admin/file/ (multipart `file` + `name`) returns an EMPTY body on success, so there is no
//     `url` to read back. The earlier code PATCHed `meta_icon: undefined`, which sent nothing, logged
//     "Icon uploaded successfully" and left the application without an icon.
//   - The upload is not idempotent: an existing name gives `400 {"name":["A file with this name already
//     exists."]}`, which is fine because the file we need is already there.
//   - `meta_icon` is a plain writable string; setting it to the media NAME makes `meta_icon_url` resolve.
// An icon that is already set (for example one an admin chose in the UI) is left alone.
async function uploadApplicationIcon(api, appSlug) {
  try {
    const appResponse = await api.get(`/api/v3/core/applications/${appSlug}/`);
    if (appResponse.data.meta_icon) {
      console.log(`Application ${appSlug} already has an icon: ${appResponse.data.meta_icon}`);
      return;
    }

    const iconPath = path.join(__dirname, 'CloudTAKLogo.png');
    if (!fs.existsSync(iconPath)) {
      console.warn('Icon file not found');
      return;
    }

    // Step 1: make sure the file is in media storage under the stable name
    const form = new FormData();
    form.append('file', fs.createReadStream(iconPath), 'CloudTAKLogo.png');
    form.append('name', APPLICATION_ICON_MEDIA_NAME);
    try {
      await axios.post(`${api.defaults.baseURL}/api/v3/admin/file/`, form, {
        headers: {
          'Authorization': api.defaults.headers['Authorization'],
          ...form.getHeaders(),
        },
      });
      console.log(`Icon uploaded to media storage as ${APPLICATION_ICON_MEDIA_NAME}`);
    } catch (uploadError) {
      const status = uploadError.response && uploadError.response.status;
      const detail = JSON.stringify((uploadError.response && uploadError.response.data) || '');
      if (status === 400 && detail.includes('already exists')) {
        console.log(`Icon ${APPLICATION_ICON_MEDIA_NAME} is already in media storage; reusing it`);
      } else {
        throw uploadError;
      }
    }

    // Step 2: point the application at that media path
    await api.patch(`/api/v3/core/applications/${appSlug}/`, {
      meta_icon: APPLICATION_ICON_MEDIA_NAME
    });
    console.log(`Icon assigned to application ${appSlug}: ${APPLICATION_ICON_MEDIA_NAME}`);
  } catch (error) {
    // Not fatal: a missing icon must not fail the whole OIDC provisioning
    console.warn('Failed to upload icon:', error.response ? JSON.stringify(error.response.data) : error.message);
  }
}

async function getOrCreateScopeMapping(api, scopeName) {
  const existing = await api.get('/api/v3/propertymappings/provider/scope/', {
    params: { scope_name: scopeName }
  });
  
  if (existing.data.results && existing.data.results.length > 0) {
    return existing.data.results[0];
  }
  
  const response = await api.post('/api/v3/propertymappings/provider/scope/', {
    name: `authentik default OAuth Mapping: OpenID '${scopeName}'`,
    scope_name: scopeName,
    expression: 'return {}',
    description: `Standard OpenID Connect scope: ${scopeName}`
  });
  
  return response.data;
}

/**
 * Custom scope mapping that adds the requesting user's group names to the
 * `groups` claim in the userinfo response / ID token. CloudTAK's OIDC callback
 * reads this claim to determine system_admin / agency_admin role assignment.
 */
async function getOrCreateGroupsScopeMapping(api) {
  const scopeName = 'groups';
  const existing = await api.get('/api/v3/propertymappings/provider/scope/', {
    params: { scope_name: scopeName }
  });

  if (existing.data.results && existing.data.results.length > 0) {
    return existing.data.results[0];
  }

  const response = await api.post('/api/v3/propertymappings/provider/scope/', {
    name: `CloudTAK OAuth Mapping: '${scopeName}'`,
    scope_name: scopeName,
    expression: 'return {"groups": [group.name for group in request.user.ak_groups.all()]}',
    description: 'Adds group membership to the groups claim for CloudTAK role sync'
  });

  return response.data;
}

async function getSecretString(secretsManager, secretId, jsonKey) {
  const data = await secretsManager.send(new GetSecretValueCommand({ SecretId: secretId }));
  try {
    const parsed = JSON.parse(data.SecretString);
    if (parsed && typeof parsed === 'object' && parsed[jsonKey]) return parsed[jsonKey];
  } catch {
    // not JSON: the secret string is the value itself
  }
  return data.SecretString;
}

// Username CloudTAK keeps for its own built-in administrator. It exists only in CloudTAK, so it must
// never be pushed back to it (or be re-created from an Authentik account of the same name).
const SCIM_EXCLUDED_USERNAME = 'ckadmin';

const SCIM_EXCLUDE_MAPPING_NAME = `scim-exclude-${SCIM_EXCLUDED_USERNAME}`;
const SCIM_EXCLUDE_MAPPING_EXPRESSION = [
  `if request.user.username == "${SCIM_EXCLUDED_USERNAME}":`,
  '    raise SkipObject',
  '# Returning None allows authentik to safely ignore this mapping for other users',
  'return None',
  '',
].join('\n');

/**
 * Create or update the Authentik SCIM provider that provisions users into CloudTAK
 * (`/api/scim/v2`), and attach it to the CloudTAK application as a backchannel provider.
 *
 * CloudTAK authenticates the requests with the same token (`SCIM_TOKEN`, see
 * api/stateless/lib/control/scim.ts), so both sides read one Secrets Manager secret.
 */
async function setupScimProvider(api, { name, url, token, applicationSlug }) {
  if (!url) throw new Error('SCIM_URL is required when SCIM_TOKEN_SECRET_ARN is set');
  if (!token) throw new Error('The SCIM token secret is empty');

  // Authentik's own User and Group SCIM mappings (managed, so they cannot be created here)
  const userMapping = await getManagedScimMapping(api, 'goauthentik.io/providers/scim/user');
  const groupMapping = await getManagedScimMapping(api, 'goauthentik.io/providers/scim/group');
  const excludeMapping = await createOrUpdateScimMapping(api, {
    name: SCIM_EXCLUDE_MAPPING_NAME,
    expression: SCIM_EXCLUDE_MAPPING_EXPRESSION,
  });

  const providerData = {
    name,
    url,
    auth_mode: 'token',
    token,
    verify_certificates: true,
    exclude_users_service_account: true,
    property_mappings: [userMapping.pk, excludeMapping.pk],
    property_mappings_group: [groupMapping.pk],
  };

  const existing = await api.get('/api/v3/providers/scim/', { params: { name } });
  const found = (existing.data.results || []).find((p) => p.name === name);
  let provider;
  if (found) {
    provider = (await api.patch(`/api/v3/providers/scim/${found.pk}/`, providerData)).data;
  } else {
    provider = (await api.post('/api/v3/providers/scim/', providerData)).data;
  }

  // Attach as a backchannel provider, keeping any others already on the application
  const app = (await api.get(`/api/v3/core/applications/${applicationSlug}/`)).data;
  const backchannel = new Set(app.backchannel_providers || []);
  backchannel.add(provider.pk);
  await api.patch(`/api/v3/core/applications/${applicationSlug}/`, {
    backchannel_providers: [...backchannel],
  });

  console.log(`SCIM provider ${name} (${provider.pk}) attached to application ${applicationSlug}`);
  return provider;
}

async function getManagedScimMapping(api, managed) {
  const response = await api.get('/api/v3/propertymappings/provider/scim/', { params: { managed } });
  const mapping = (response.data.results || []).find((m) => m.managed === managed);
  if (!mapping) throw new Error(`Authentik SCIM mapping ${managed} not found`);
  return mapping;
}

async function createOrUpdateScimMapping(api, mappingData) {
  const existing = await api.get('/api/v3/propertymappings/provider/scim/', { params: { search: mappingData.name } });
  const found = (existing.data.results || []).find((m) => m.name === mappingData.name);
  if (found) {
    return (await api.patch(`/api/v3/propertymappings/provider/scim/${found.pk}/`, mappingData)).data;
  }
  return (await api.post('/api/v3/propertymappings/provider/scim/', mappingData)).data;
}

async function getOidcConfiguration(authentikUrl, applicationSlug) {
  try {
    const appConfigUrl = `${authentikUrl}/application/o/${applicationSlug}/.well-known/openid-configuration`;
    // Create a new axios instance without baseURL for this specific call
    const response = await axios.create().get(appConfigUrl);
    
    return {
      issuer: response.data.issuer,
      authorizeUrl: response.data.authorization_endpoint,
      tokenUrl: response.data.token_endpoint,
      userInfoUrl: response.data.userinfo_endpoint,
    };
  } catch (error) {
    console.warn('Failed to fetch OIDC config, using defaults:', error.message);
    return {
      issuer: `${authentikUrl}/application/o/${applicationSlug}/`,
      authorizeUrl: `${authentikUrl}/application/o/authorize/`,
      tokenUrl: `${authentikUrl}/application/o/token/`,
      userInfoUrl: `${authentikUrl}/application/o/userinfo/`,
    };
  }
}
