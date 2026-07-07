import { Page } from 'playwright';

export async function getPerformanceMetrics(page: Page) {
    const metrics = await page.evaluate(() => JSON.stringify(window.performance.getEntries()));
    return JSON.parse(metrics);
}
