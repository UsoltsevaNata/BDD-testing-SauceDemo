import { getFormattedTimestamp } from './timestamp';

describe('getFormattedTimestamp', () => {
    const RealDate = Date;

    beforeAll(() => {
        // @ts-ignore
        global.Date = class extends RealDate {
            constructor() {
                super('2024-01-15T09:30:45');
            }

            static now() {
                return new RealDate('2024-01-15T09:30:45').getTime();
            }
        };
    });

    afterAll(() => {
        global.Date = RealDate;
    });

    it('should handle single-digit values', () => {
        // @ts-ignore
        global.Date = class extends RealDate {
            constructor() {
                super('2024-02-05T03:04:05');
            }

            static now() {
                return new RealDate('2024-02-05T03:04:05').getTime();
            }
        };

        expect(getFormattedTimestamp()).toBe('20240205-030405');
    });

    it('should handle end of year', () => {
        // @ts-ignore
        global.Date = class extends RealDate {
            constructor() {
                super('2023-12-31T23:59:59');
            }

            static now() {
                return new RealDate('2023-12-31T23:59:59').getTime();
            }
        };

        expect(getFormattedTimestamp()).toBe('20231231-235959');
    });

    it('should pad zeros correctly', () => {
        // @ts-ignore
        global.Date = class extends RealDate {
            constructor() {
                super('2024-01-01T00:00:00');
            }

            static now() {
                return new RealDate('2024-01-01T00:00:00').getTime();
            }
        };

        expect(getFormattedTimestamp()).toBe('20240101-000000');
    });
});
