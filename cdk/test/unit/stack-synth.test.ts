/**
 * Full-stack synth-smoke + behavioral/safety assertions for CloudTakStack.
 *
 * These are the highest-value CDK tests in the suite: the synth-smoke cases
 * catch the failure that actually happens in practice (a stack that no longer
 * synthesizes), and the behavioral cases assert only properties whose meaning
 * goes beyond restating construct code — prod data-loss safety, feature-flag
 * wiring, and the cross-stack export contract other stacks import by name.
 *
 * Each stack variant is synthesized once and the resulting Template is reused
 * across assertions, so the whole file pays for roughly four synths.
 */
import { Template, Match } from 'aws-cdk-lib/assertions';
import { synthTemplate, synthStack, EnvType } from '../__helpers__/synth-stack';

// The prebuilt-image path resolves image tags from a cloudtakImageTag context
// value that CI supplies (e.g. `cloudtak-<sha>`); without it the events and
// retention services throw at synth. Mirror that here.
const PREBUILT_CONTEXT = { usePreBuiltImages: true, cloudtakImageTag: 'cloudtak-testsha' };
const LOCAL_CONTEXT = { usePreBuiltImages: false };

// Cache one Template per variant so the file synthesizes each stack only once.
const cache = new Map<string, Template>();
function template(envType: EnvType, prebuilt: boolean): Template {
  const key = `${envType}:${prebuilt}`;
  if (!cache.has(key)) {
    cache.set(key, synthTemplate(envType, prebuilt ? PREBUILT_CONTEXT : LOCAL_CONTEXT));
  }
  return cache.get(key)!;
}

describe('CloudTakStack synth smoke', () => {
  // Each environment, each image path. If the stack stops synthesizing, this
  // is the first thing that goes red.
  it.each([
    ['dev-test', false],
    ['dev-test', true],
    ['prod', false],
    ['prod', true],
  ] as [EnvType, boolean][])(
    'synthesizes for %s (prebuilt images=%s)',
    (envType, prebuilt) => {
      expect(() => template(envType, prebuilt)).not.toThrow();
    }
  );
});

describe('database safety shape', () => {
  it('prod cluster has deletion protection and provisioned instances', () => {
    const t = template('prod', true);

    t.hasResourceProperties('AWS::RDS::DBCluster', {
      Engine: 'aurora-postgresql',
      DeletionProtection: true,
    });

    // prod runs provisioned instances (cdk.json: instanceClass db.t4g.large,
    // instanceCount 2), not serverless. Shipping prod as serverless/single is a
    // real regression.
    t.resourceCountIs('AWS::RDS::DBInstance', 2);
    t.hasResourceProperties('AWS::RDS::DBInstance', {
      DBInstanceClass: 'db.t4g.large',
    });
  });

  it('dev-test cluster is destroyable and provisioned', () => {
    const t = template('dev-test', true);

    // dev-test must NOT carry deletion protection — otherwise teardown of
    // ephemeral environments silently fails.
    t.hasResourceProperties('AWS::RDS::DBCluster', {
      Engine: 'aurora-postgresql',
      DeletionProtection: false,
      ServerlessV2ScalingConfiguration: Match.absent(),
    });

    // dev-test runs one small provisioned writer (cdk.json: db.t4g.medium).
    // Serverless v2 sat at about 3 ACU all day, which cost about 5x as much.
    t.resourceCountIs('AWS::RDS::DBInstance', 1);
    t.hasResourceProperties('AWS::RDS::DBInstance', {
      DBInstanceClass: 'db.t4g.medium',
    });
  });
});

describe('feature-flag-gated wiring: usePreBuiltImages', () => {
  // The flag switches the container image source. We detect the branch from the
  // ECS task-definition container images:
  //  - local build   -> images point at the CDK bootstrap asset repo
  //                      (cdk-hnb659fds-container-assets-...)
  //  - prebuilt (CI)  -> images resolve from the imported BaseInfra ECR repo
  //                      (TAK-<Env>-BaseInfra-EcrArtifactsRepoArn)
  const BOOTSTRAP_ASSET_REPO = 'container-assets';
  const BASEINFRA_ECR_IMPORT = 'BaseInfra-EcrArtifactsRepoArn';

  function containerImagesJson(t: Template): string {
    const resources = t.toJSON().Resources as Record<string, any>;
    const images: unknown[] = [];
    for (const r of Object.values(resources)) {
      if (r.Type === 'AWS::ECS::TaskDefinition') {
        for (const c of r.Properties?.ContainerDefinitions ?? []) {
          images.push(c.Image);
        }
      }
    }
    return JSON.stringify(images);
  }

  it('local build path sources images from CDK Docker assets', () => {
    const images = containerImagesJson(template('dev-test', false));
    expect(images).toContain(BOOTSTRAP_ASSET_REPO);
    expect(images).not.toContain(BASEINFRA_ECR_IMPORT);
  });

  it('prebuilt path sources images from the imported BaseInfra ECR repo', () => {
    const images = containerImagesJson(template('dev-test', true));
    expect(images).toContain(BASEINFRA_ECR_IMPORT);
    expect(images).not.toContain(BOOTSTRAP_ASSET_REPO);
  });
});

describe('cross-stack export contract', () => {
  // Other stacks import these by name. A rename here breaks a consumer stack,
  // so the export names are a contract worth pinning. Names are derived from
  // envConfig.stackName ('Prod') and the stack name ('TAK-Prod-CloudTAK').
  it('exports the names consumer stacks import', () => {
    const t = template('prod', true);
    const outputs = (t.toJSON().Outputs ?? {}) as Record<string, any>;
    const exportNames = Object.values(outputs)
      .map((o) => o.Export?.Name)
      .filter(Boolean);

    const expected = [
      'TAK-Prod-CloudTAK-ApiURL',
      'TAK-Prod-CloudTAK-SigningSecret',
      'TAK-Prod-CloudTAK-MediaSecret',
      'TAK-Prod-CloudTAK-EtlEcrRepoArn',
      'TAK-Prod-CloudTAK-MediaUrl',
      'TAK-Prod-CloudTAK-etl-role',
      'TAK-Prod-CloudTAK-ServiceURL',
      'TAK-Prod-CloudTAK-DatabaseEndpoint',
      'TAK-Prod-CloudTAK-AssetBucket',
    ];

    for (const name of expected) {
      expect(exportNames).toContain(name);
    }
  });
});

describe('alarm wiring', () => {
  // Guards the plumbing in cloudtak-stack.ts: the Alarms construct's new props
  // are optional, so dropping one from the stack would silently remove alarms.
  it('wires hub ALB, target group health, PMTiles and retention alarms', () => {
    const t = template('dev-test', true);
    const names = Object.values(t.findResources('AWS::CloudWatch::Alarm'))
      .map((r: any) => JSON.stringify(r.Properties.AlarmName));
    const has = (fragment: string) => names.some(n => n.includes(fragment));

    for (const fragment of [
      'CloudTAK-Hub-AlarmHTTPCodeELB5XX',
      'CloudTAK-Hub-AlarmP99Latency',
      'CloudTAK-HealthyHostCount',
      'CloudTAK-Stateful-HealthyHostCount',
      'CloudTAK-Hub-HealthyHostCount',
      'CloudTAK-PMTilesLambdaErrors',
      'CloudTAK-PMTilesApiP99Latency',
      'CloudTAK-RetentionFailedInvocations',
      'CloudTAK-RetentionErrors',
    ]) {
      expect(has(fragment)).toBe(true);
    }
    t.hasResourceProperties('AWS::Logs::MetricFilter', { FilterPattern: '"error -"' });
  });

  // FreeLocalStorage is only published for provisioned Aurora, so the alarm must
  // follow the database's instance class. Both profiles are provisioned now, so
  // the serverless case is covered by forcing `instanceClass=db.serverless`.
  it('creates the FreeLocalStorage alarm only for provisioned clusters', () => {
    const count = (t: Template) => Object.values(
      t.findResources('AWS::CloudWatch::Alarm')
    ).filter((r: any) => r.Properties.MetricName === 'FreeLocalStorage').length;
    expect(count(template('dev-test', true))).toBe(1);
    expect(count(template('prod', true))).toBe(1);
    expect(count(synthTemplate('dev-test', {
      ...PREBUILT_CONTEXT,
      instanceClass: 'db.serverless',
    }))).toBe(0);
  });
});

describe('inbound email wiring', () => {
  // Guards the plumbing in cloudtak-stack.ts / cloudtak-api.ts: the Mail
  // construct is only useful if the API, the ETL role and the mail domain all
  // agree with it, and none of that is visible from the construct alone.
  const t = template('dev-test', true);
  const json = JSON.stringify(t.toJSON());

  it('deploys the mail stack and exports what the patched API imports', () => {
    t.resourceCountIs('AWS::SES::MailManagerIngressPoint', 1);
    t.resourceCountIs('AWS::SES::MailManagerRuleSet', 1);
    const outputs = (t.toJSON().Outputs ?? {}) as Record<string, any>;
    const exportNames = Object.values(outputs).map((o) => o.Export?.Name);
    expect(exportNames).toContain('TAK-Dev-CloudTAK-mail-layer-prefix');
    expect(exportNames).toContain('TAK-Dev-CloudTAK-mail-bucket');
    // Webhooks exports the API also imports (siblingExport('webhooks', ...))
    expect(exportNames).toContain('TAK-Dev-CloudTAK-webhooks-api');
    expect(exportNames).toContain('TAK-Dev-CloudTAK-webhooks-role');
  });

  it('sets MAIL_DOMAIN explicitly on the API and hub containers', () => {
    const defs = Object.values(t.findResources('AWS::ECS::TaskDefinition'))
      .flatMap((r: any) => r.Properties.ContainerDefinitions)
      .filter((c: any) => c.Name === 'api'); // stateless and stateful tiers both run the 'api' container
    expect(defs).toHaveLength(2);
    for (const def of defs) {
      const mailDomain = def.Environment.find((e: any) => e.Name === 'MAIL_DOMAIN');
      expect(mailDomain).toBeDefined();
      // mail.<hostname>.<zone>, same derivation as the API's own default
      expect(JSON.stringify(mailDomain.Value)).toMatch(/^\{"Fn::Join":\["",\["mail\.map\.",/);
    }
  });

  it('lets the API task role manage layer email registrations under the layer prefix', () => {
    const statement = Object.values(t.findResources('AWS::IAM::Role'))
      .flatMap((r: any) => r.Properties.Policies ?? [])
      .flatMap((p: any) => p.PolicyDocument.Statement)
      .find((s: any) => Array.isArray(s.Action) && s.Action.includes('ssm:PutParameter'));
    expect(statement).toBeDefined();
    expect([...statement.Action].sort()).toEqual([
      'ssm:AddTagsToResource',
      'ssm:DeleteParameter',
      'ssm:GetParameters',
      'ssm:ListTagsForResource',
      'ssm:PutParameter',
      'ssm:RemoveTagsFromResource'
    ]);
    expect(JSON.stringify(statement.Resource)).toContain(':parameter/TAK-Dev-CloudTAK/mail/layer/*');
  });

  it('lets the ETL role read delivered mail objects', () => {
    // The ETL role is created before the bucket, so the grant lives in a
    // separate policy that references the mail bucket.
    const policies = Object.values(t.findResources('AWS::IAM::Policy')) as any[];
    const grant = policies
      .filter((p) => p.Properties.Roles?.some((r: any) => JSON.stringify(r).includes('EtlRole')))
      .flatMap((p) => p.Properties.PolicyDocument.Statement)
      .find((s: any) => s.Action === 's3:GetObject' && JSON.stringify(s.Resource).includes('MailMailBucket'));
    expect(grant).toBeDefined();
  });

  it('points the MX record at the same mail domain', () => {
    expect(json).toContain('"Type":"MX"');
    t.hasResourceProperties('AWS::Route53::RecordSet', {
      Type: 'MX',
      Name: { 'Fn::Join': ['', ['mail.map.', Match.anyValue(), '.']] }
    });
  });
});

describe('tag key validity', () => {
  // Deploy-time failure class that synth cannot see: SES Mail Manager (and
  // others) reject tag keys outside [a-zA-Z0-9/_+=.:@-]. Stack-level tags
  // (the `tags` stack prop in bin/cdk.ts) are propagated by CloudFormation to
  // every resource, so a bad standard tag breaks the first real deploy.
  const TAG_KEY = /^[a-zA-Z0-9/_+=.:@-]+$/;

  /** Tag keys of a resource, whether Tags is a [{Key,Value}] list or a map. */
  function keysOf(tags: unknown): string[] {
    if (Array.isArray(tags)) return tags.map((t: any) => t?.Key).filter((k) => typeof k === 'string');
    if (tags && typeof tags === 'object') return Object.keys(tags);
    return [];
  }

  it.each(['dev-test', 'prod'] as EnvType[])('%s: stack-level and resource tag keys are valid', (envType) => {
    const { template: t, stackTags } = synthStack(envType, PREBUILT_CONTEXT);

    expect(Object.keys(stackTags).length).toBeGreaterThan(0);
    for (const key of Object.keys(stackTags)) {
      expect(key).toMatch(TAG_KEY);
    }

    const offenders: string[] = [];
    for (const [logicalId, resource] of Object.entries(t.toJSON().Resources as Record<string, any>)) {
      for (const key of [...keysOf(resource.Properties?.Tags), ...keysOf(resource.Properties?.tags)]) {
        if (!TAG_KEY.test(key)) offenders.push(`${logicalId} (${resource.Type}): "${key}"`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps the standard tags on SES Mail Manager resources', () => {
    const t = template('dev-test', true);
    for (const type of ['TrafficPolicy', 'Archive', 'RuleSet', 'IngressPoint']) {
      const resources = Object.values(t.findResources(`AWS::SES::MailManager${type}`)) as any[];
      expect(resources).toHaveLength(1);
      expect(keysOf(resources[0].Properties.Tags)).toEqual(
        expect.arrayContaining(['Project', 'Environment', 'Component', 'ManagedBy', 'EnvironmentType'])
      );
    }
  });
});
