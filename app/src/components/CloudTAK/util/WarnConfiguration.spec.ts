import { beforeEach, describe, expect, it, vi } from 'vitest';

const isNativePlatform = vi.fn(() => false);

vi.mock('../../../utils/capacitor.ts', () => ({
    isNativePlatform: () => isNativePlatform()
}));

import { isPermissionsWarningDismissed, setPermissionsWarningDismissed } from './WarnConfiguration.vue';

describe('WarnConfiguration permissions dismissal', () => {
    beforeEach(() => {
        vi.mocked(localStorage.getItem).mockReset();
        vi.mocked(localStorage.setItem).mockReset();
        isNativePlatform.mockReturnValue(false);
    });

    it('is not dismissed by default', () => {
        vi.mocked(localStorage.getItem).mockReturnValue(null);
        expect(isPermissionsWarningDismissed()).toBe(false);
    });

    it('persists and reads the dismissal on web', () => {
        setPermissionsWarningDismissed();
        expect(localStorage.setItem).toHaveBeenCalledWith('cloudtak-permissions-dismissed', 'true');

        vi.mocked(localStorage.getItem).mockReturnValue('true');
        expect(isPermissionsWarningDismissed()).toBe(true);
    });

    it('never persists or honours the dismissal on native', () => {
        isNativePlatform.mockReturnValue(true);

        setPermissionsWarningDismissed();
        expect(localStorage.setItem).not.toHaveBeenCalled();

        vi.mocked(localStorage.getItem).mockReturnValue('true');
        expect(isPermissionsWarningDismissed()).toBe(false);
    });
});
