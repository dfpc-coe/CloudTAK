import { MOCK_CONFIGS } from '../../__fixtures__/mock-configs';

describe('ConfigValidator', () => {
  it('can import config validator', () => {
    const { ConfigValidator } = require('../../../lib/utils/config-validator');
    expect(ConfigValidator).toBeDefined();
    expect(ConfigValidator.validateEnvironmentConfig).toBeDefined();
  });

  it('validates valid configuration', () => {
    const { ConfigValidator } = require('../../../lib/utils/config-validator');
    
    expect(() => {
      ConfigValidator.validateEnvironmentConfig(MOCK_CONFIGS.DEV_TEST, 'dev-test');
    }).not.toThrow();
  });

  it('throws error for missing stackName', () => {
    const { ConfigValidator } = require('../../../lib/utils/config-validator');
    const invalidConfig = { ...MOCK_CONFIGS.DEV_TEST };
    delete (invalidConfig as any).stackName;

    expect(() => {
      ConfigValidator.validateEnvironmentConfig(invalidConfig, 'dev-test');
    }).toThrow('stackName is required');
  });

  it('throws error for missing database config', () => {
    const { ConfigValidator } = require('../../../lib/utils/config-validator');
    const invalidConfig = { ...MOCK_CONFIGS.DEV_TEST };
    delete (invalidConfig as any).database;

    expect(() => {
      ConfigValidator.validateEnvironmentConfig(invalidConfig, 'dev-test');
    }).toThrow('database configuration is required');
  });

  it('throws error for missing ecs config', () => {
    const { ConfigValidator } = require('../../../lib/utils/config-validator');
    const invalidConfig = { ...MOCK_CONFIGS.DEV_TEST };
    delete (invalidConfig as any).ecs;

    expect(() => {
      ConfigValidator.validateEnvironmentConfig(invalidConfig, 'dev-test');
    }).toThrow('ecs configuration is required');
  });

  it('throws error for missing cloudtak config', () => {
    const { ConfigValidator } = require('../../../lib/utils/config-validator');
    const invalidConfig = { ...MOCK_CONFIGS.DEV_TEST };
    delete (invalidConfig as any).cloudtak;

    expect(() => {
      ConfigValidator.validateEnvironmentConfig(invalidConfig, 'dev-test');
    }).toThrow('cloudtak.hostname is required in environment configuration');
  });
});