/**
 * SCIM wiring (cloudtak.scimEnabled).
 *
 * One generated Secrets Manager token has to reach both sides: the CloudTAK API container
 * (SCIM_ENABLED / SCIM_TOKEN) and the OIDC setup Lambda that creates the Authentik SCIM provider
 * (SCIM_TOKEN_SECRET_ARN / SCIM_URL). These tests pin that, and that the flag is opt-in.
 */
import * as fs from 'fs';
import * as path from 'path';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { synthTemplate } from '../../__helpers__/synth-stack';

const CONTEXT = { usePreBuiltImages: true, cloudtakImageTag: 'cloudtak-testsha' };

function devTestConfig(cloudtak: Record<string, unknown>): Record<string, unknown> {
  const cdkJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../cdk.json'), 'utf-8'));
  const base = cdkJson.context['dev-test'];
  return { ...base, cloudtak: { ...base.cloudtak, ...cloudtak } };
}

function synth(cloudtak: Record<string, unknown>): Template {
  return synthTemplate('dev-test', { ...CONTEXT, 'dev-test': devTestConfig(cloudtak) });
}

function containerEnvironment(template: Template): Record<string, string> {
  const defs = template.findResources('AWS::ECS::TaskDefinition');
  const env: Record<string, string> = {};
  for (const def of Object.values(defs)) {
    for (const container of (def as any).Properties.ContainerDefinitions || []) {
      for (const entry of container.Environment || []) env[entry.Name] = entry.Value;
    }
  }
  return env;
}

function containerSecretNames(template: Template): string[] {
  const defs = template.findResources('AWS::ECS::TaskDefinition');
  const names: string[] = [];
  for (const def of Object.values(defs)) {
    for (const container of (def as any).Properties.ContainerDefinitions || []) {
      for (const secret of container.Secrets || []) names.push(secret.Name);
    }
  }
  return names;
}

function oidcLambdaEnvironment(template: Template): Record<string, unknown> {
  const fns = template.findResources('AWS::Lambda::Function', {
    Properties: { Environment: { Variables: { APPLICATION_SLUG: 'cloudtak' } } },
  });
  const [fn] = Object.values(fns);
  return (fn as any).Properties.Environment.Variables;
}

describe('cloudtak.scimEnabled', () => {
  describe('off (the default)', () => {
    const template = synth({ oidcEnabled: true });

    it('creates no SCIM token secret', () => {
      const secrets = template.findResources('AWS::SecretsManager::Secret', {
        Properties: { Name: Match.stringLikeRegexp('ScimToken') },
      });
      expect(Object.keys(secrets)).toHaveLength(0);
    });

    it('leaves the API in database-driven SCIM mode', () => {
      expect(containerEnvironment(template)).not.toHaveProperty('SCIM_ENABLED');
      expect(containerSecretNames(template)).not.toContain('SCIM_TOKEN');
    });

    it('does not ask the OIDC setup Lambda to create a SCIM provider', () => {
      const env = oidcLambdaEnvironment(template);
      expect(env).not.toHaveProperty('SCIM_TOKEN_SECRET_ARN');
      expect(env).not.toHaveProperty('SCIM_URL');
    });
  });

  describe('on', () => {
    const template = synth({ oidcEnabled: true, scimEnabled: true });

    it('generates one 48 character token in Secrets Manager', () => {
      template.hasResourceProperties('AWS::SecretsManager::Secret', {
        Name: Match.stringLikeRegexp('-CloudTAK-ScimToken$'),
        GenerateSecretString: Match.objectLike({
          PasswordLength: 48,
          ExcludePunctuation: true,
        }),
      });
    });

    it('hands that token to the CloudTAK API as SCIM_TOKEN and switches on SCIM_ENABLED', () => {
      expect(containerEnvironment(template).SCIM_ENABLED).toBe('true');
      expect(containerSecretNames(template)).toContain('SCIM_TOKEN');
    });

    it('hands the same secret and the SCIM base URL to the OIDC setup Lambda', () => {
      const env = oidcLambdaEnvironment(template);
      expect(env).toHaveProperty('SCIM_TOKEN_SECRET_ARN');
      expect(JSON.stringify(env.SCIM_URL)).toContain('/api/scim/v2');
    });

    it('lets the OIDC setup Lambda read the token secret', () => {
      const policies = JSON.stringify(template.findResources('AWS::IAM::Policy'));
      expect(policies).toContain('ScimToken');
      expect(policies).toContain('secretsmanager:GetSecretValue');
    });
  });

  it('refuses to synth without OIDC, because the OIDC setup creates the SCIM provider', () => {
    expect(() => synth({ oidcEnabled: false, scimEnabled: true })).toThrow(/scimEnabled requires cloudtak.oidcEnabled/);
  });
});
