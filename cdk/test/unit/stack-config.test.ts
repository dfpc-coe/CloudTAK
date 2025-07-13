import { MOCK_CONFIGS } from '../__fixtures__/mock-configs';

describe('Stack Configuration', () => {
  it('validates dev-test configuration structure', () => {
    const config = MOCK_CONFIGS.DEV_TEST;
    
    expect(config.stackName).toBe('DevTest');
    expect(config.database).toBeDefined();
    expect(config.ecs).toBeDefined();
    expect(config.cloudtak).toBeDefined();
  });
});