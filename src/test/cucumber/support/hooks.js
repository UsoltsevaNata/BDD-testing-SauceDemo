const { BeforeAll, AfterAll, Before, After } = require('@cucumber/cucumber');
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

let browser;
let context;
let page;
let startTime;
let startCpu;
let peakMemory = 0;

BeforeAll(async function () {
    browser = await chromium.launch({ headless: true });
});

Before(async function () {
    startTime = Date.now();
    context = await browser.newContext();
    page = await context.newPage();
    global.__page = page;
    startCpu = process.cpuUsage();
    peakMemory = process.memoryUsage().heapUsed;
});

After(async function (hookParameter) {
    const duration = Date.now() - startTime;
    const cpuUsage = process.cpuUsage(startCpu);
    const memAfter = process.memoryUsage().heapUsed;
    if (memAfter > peakMemory) peakMemory = memAfter;
    const memPeakMB = peakMemory / 1024 / 1024;

    const cpuUserMs = cpuUsage.user / 1000;
    const cpuSystemMs = cpuUsage.system / 1000;

    const cpuUserPercent = (cpuUserMs / duration) * 100;
    const cpuSystemPercent = (cpuSystemMs / duration) * 100;

    if (page) await page.close();
    if (context) await context.close();
    context = null;
    page = null;

    const testName = hookParameter?.pickle?.name || 'unknown';
    const status = hookParameter?.result?.status === 'PASSED' ? 'passed' : 'failed';

    if (!global.__metrics) global.__metrics = [];
    global.__metrics.push({
        testName,
        status,
        durationMs: duration,
        peakMemoryMB: memPeakMB,
        cpuUserPercent: cpuUserPercent,
        cpuSystemPercent: cpuSystemPercent,
    });
});

AfterAll(async function () {
    if (context) await context.close();
    if (browser) await browser.close();

    const testResults = global.__metrics || [];
    const outputDir = path.resolve(process.cwd(), 'test-results', 'logs');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const summary = testResults.length > 0 ? {
        totalTests: testResults.length,
        passed: testResults.filter(r => r.status === 'passed').length,
        failed: testResults.filter(r => r.status === 'failed').length,
        sumDurationMs: testResults.reduce((sum, r) => sum + r.durationMs, 0),
        avgPeakMemoryMB: testResults.reduce((sum, r) => sum + (r.peakMemoryMB || 0), 0) / testResults.length,
        maxPeakMemoryMB: Math.max(...testResults.map(r => r.peakMemoryMB || 0)),
        avgCpuUserPercent: testResults.reduce((sum, r) => sum + (r.cpuUserPercent || 0), 0) / testResults.length,
        avgCpuSystemPercent: testResults.reduce((sum, r) => sum + (r.cpuSystemPercent || 0), 0) / testResults.length,
        maxCpuUserPercent: Math.max(...testResults.map(r => r.cpuUserPercent || 0)),
        maxCpuSystemPercent: Math.max(...testResults.map(r => r.cpuSystemPercent || 0)),
    } : {
        totalTests: 0, passed: 0, failed: 0, sumDurationMs: 0,
        avgPeakMemoryMB: 0, maxPeakMemoryMB: 0,
        avgCpuUserPercent: 0, avgCpuSystemPercent: 0,
        maxCpuUserPercent: 0, maxCpuSystemPercent: 0,
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logData = { timestamp, summary, testResults };

    const reportPath = path.join(outputDir, `logs-${timestamp}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(logData, null, 2), 'utf-8');
    console.log(`📊 Метрики сохранены в ${reportPath}`);
});

function getPage() {
    return global.__page;
}

module.exports = { getPage };
