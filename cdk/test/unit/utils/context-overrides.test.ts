import { App } from 'aws-cdk-lib';
import { applyContextOverrides } from '../../../lib/utils/context-overrides';
import { MOCK_CONFIGS } from '../../__fixtures__/mock-configs';

describe('Context Overrides', () => {
  it('applies context overrides from app context', () => {
    const app = new App({
      context: {
        taskCpu: 1024,
        taskMemory: 2048,
        stackName: 'OverriddenStack'
      }
    });

    const result = applyContextOverrides(app, MOCK_CONFIGS.DEV_TEST);
    
    expect(result.ecs.taskCpu).toBe(1024);
    expect(result.ecs.taskMemory).toBe(2048);
    expect(result.stackName).toBe('OverriddenStack');
  });

  it('preserves base config when no overrides provided', () => {
    const app = new App();

    const result = applyContextOverrides(app, MOCK_CONFIGS.DEV_TEST);
    
    expect(result.ecs.taskCpu).toBe(MOCK_CONFIGS.DEV_TEST.ecs.taskCpu);
    expect(result.ecs.taskMemory).toBe(MOCK_CONFIGS.DEV_TEST.ecs.taskMemory);
    expect(result.stackName).toBe(MOCK_CONFIGS.DEV_TEST.stackName);
  });
});