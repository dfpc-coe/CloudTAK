describe('Constants', () => {
  it('can import constants without hanging', () => {
    const constants = require('../../../lib/utils/constants');
    expect(constants.DATABASE_CONSTANTS).toBeDefined();
    expect(constants.CLOUDTAK_CONSTANTS).toBeDefined();
  });
});