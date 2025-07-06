import { generateStandardTags } from '../../../lib/utils/tag-helpers';
import { MOCK_CONFIGS } from '../../__fixtures__/mock-configs';

describe('Tag Helpers', () => {
  it('generates standard tags for dev-test', () => {
    const tags = generateStandardTags(
      MOCK_CONFIGS.DEV_TEST,
      'dev-test',
      { project: 'TAK.NZ', component: 'CloudTAK' }
    );
    
    expect(tags).toEqual(
      expect.objectContaining({
        'Project': 'TAK.NZ',
        'Component': 'CloudTAK',
        'Environment': 'DevTest',
        'ManagedBy': 'CDK'
      })
    );
  });

  it('generates standard tags for production', () => {
    const tags = generateStandardTags(
      MOCK_CONFIGS.PROD,
      'prod'
    );
    
    expect(tags).toEqual(
      expect.objectContaining({
        'Project': 'TAK',
        'Component': 'CloudTAK',
        'Environment': 'Prod',
        'Environment Type': 'Prod'
      })
    );
  });
});