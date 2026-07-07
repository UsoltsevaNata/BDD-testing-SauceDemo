const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(process.cwd(), 'test-results', 'logs');
const OUTPUT_DIR = path.join(process.cwd(), 'aggregated-stats');
const Z_CRITICAL = 1.96;

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function getLogFiles() {
    if (!fs.existsSync(LOGS_DIR)) return [];
    return fs.readdirSync(LOGS_DIR)
        .filter(f => f.startsWith('logs-') && f.endsWith('.json'))
        .map(f => path.join(LOGS_DIR, f))
        .sort();
}

function readLogFile(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (e) {
        console.warn(` Не удалось прочитать ${filePath}:`, e.message);
        return null;
    }
}

function computeStats(data) {
    const n = data.length;
    if (n === 0) return { mean: 0, variance: 0, std: 0, sem: 0, ciLower: 0, ciUpper: 0, min: 0, max: 0 };
    const mean = data.reduce((s, v) => s + v, 0) / n;
    const variance = data.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
    const std = Math.sqrt(variance);
    const sem = std / Math.sqrt(n);
    const margin = Z_CRITICAL * sem;
    return {
        mean,
        variance,
        std,
        sem,
        ciLower: mean - margin,
        ciUpper: mean + margin,
        min: Math.min(...data),
        max: Math.max(...data),
    };
}

function main() {
    try {
        const files = getLogFiles();
        if (files.length === 0) {
            console.error(` В папке ${LOGS_DIR} не найдено файлов logs-*.json`);
            return;
        }


        console.log(`Найдено ${files.length} файлов, используется ${filteredFiles.length} прогонов.\n`);

        const runSummaries = [];
        const allTestEntries = [];
        const runCpuAverages = [];

        for (const file of filteredFiles) {
            const data = readLogFile(file);
            if (!data) continue;
            if (data.summary) runSummaries.push(data.summary);

            const fileMap = {};
            if (data.testResults) {
                for (const test of data.testResults) {
                    const name = test.testName;
                    if (!fileMap[name]) {
                        fileMap[name] = {
                            durationMs: 0,
                            peakMemoryMB: 0,
                            cpuUserPercent: 0,
                            cpuSystemPercent: 0,
                            status: 'passed',
                        };
                    }
                    fileMap[name].durationMs += test.durationMs || 0;
                    const mem = test.peakMemoryMB || 0;
                    if (mem > fileMap[name].peakMemoryMB) fileMap[name].peakMemoryMB = mem;
                    const cpuUser = test.cpuUserPercent !== undefined ? test.cpuUserPercent : 0;
                    const cpuSystem = test.cpuSystemPercent !== undefined ? test.cpuSystemPercent : 0;
                    if (cpuUser > fileMap[name].cpuUserPercent) fileMap[name].cpuUserPercent = cpuUser;
                    if (cpuSystem > fileMap[name].cpuSystemPercent) fileMap[name].cpuSystemPercent = cpuSystem;
                    if (test.status === 'failed') fileMap[name].status = 'failed';
                }
            }

            const runIndex = filteredFiles.indexOf(file);
            for (const [testName, merged] of Object.entries(fileMap)) {
                allTestEntries.push({
                    runIndex,
                    testName,
                    durationMs: merged.durationMs,
                    peakMemoryMB: merged.peakMemoryMB,
                    cpuUserPercent: merged.cpuUserPercent,
                    cpuSystemPercent: merged.cpuSystemPercent,
                    status: merged.status,
                });
            }

            const userVals = Object.values(fileMap).map(t => t.cpuUserPercent).filter(v => v > 0);
            const sysVals = Object.values(fileMap).map(t => t.cpuSystemPercent).filter(v => v > 0);
            const avgUser = userVals.length ? userVals.reduce((a,b) => a+b, 0) / userVals.length : 0;
            const avgSys = sysVals.length ? sysVals.reduce((a,b) => a+b, 0) / sysVals.length : 0;
            runCpuAverages.push({ user: avgUser, system: avgSys });
        }

        if (runSummaries.length === 0) {
            console.warn(' Не удалось извлечь summary ни из одного файла.');
            return;
        }

        const aggSummary = {
            totalTests: runSummaries[0].totalTests,
            passed: runSummaries.reduce((s, v) => s + v.passed, 0) / runSummaries.length,
            failed: runSummaries.reduce((s, v) => s + v.failed, 0) / runSummaries.length,
            sumDurationMs: runSummaries.reduce((s, v) => s + v.sumDurationMs, 0) / runSummaries.length,
            avgPeakMemoryMB: runSummaries.reduce((s, v) => s + v.avgPeakMemoryMB, 0) / runSummaries.length,
            maxPeakMemoryMB: runSummaries.reduce((s, v) => s + v.maxPeakMemoryMB, 0) / runSummaries.length,
        };

        const avgCpuUser = runCpuAverages.length? runCpuAverages.reduce((s, v) => s + v.user, 0) / runCpuAverages.length: 0;
        const avgCpuSystem = runCpuAverages.length? runCpuAverages.reduce((s, v) => s + v.system, 0) / runCpuAverages.length: 0;

        function getCIField(field) {
            const values = runSummaries.map(s => s[field]).filter(v => v !== undefined && v !== null);
            return computeStats(values);
        }
        const summaryCI = {
            sumDurationMs: getCIField('sumDurationMs'),
            avgPeakMemoryMB: getCIField('avgPeakMemoryMB'),
            maxPeakMemoryMB: getCIField('maxPeakMemoryMB'),
        };

        const cpuUserVals = runCpuAverages.map(v => v.user);
        const cpuSystemVals = runCpuAverages.map(v => v.system);
        const cpuUserStats = computeStats(cpuUserVals);
        const cpuSystemStats = computeStats(cpuSystemVals);

        const testGroups = {};
        for (const entry of allTestEntries) {
            if (!testGroups[entry.testName]) testGroups[entry.testName] = [];
            testGroups[entry.testName].push(entry);
        }

        const testStats = [];
        for (const [testName, entries] of Object.entries(testGroups)) {
            const durationData = entries.map(e => e.durationMs);
            const memData = entries.map(e => e.peakMemoryMB);
            const cpuUserData = entries.map(e => e.cpuUserPercent).filter(v => v !== undefined && v !== null);
            const cpuSystemData = entries.map(e => e.cpuSystemPercent).filter(v => v !== undefined && v !== null);
            const statusCount = entries.reduce((acc, e) => { acc[e.status] = (acc[e.status] || 0) + 1; return acc; }, {});

            testStats.push({
                testName,
                count: entries.length,
                statusCount,
                duration: computeStats(durationData),
                memory: computeStats(memData),
                cpuUser: computeStats(cpuUserData),
                cpuSystem: computeStats(cpuSystemData),
            });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const result = {
            timestamp,
            config: {
                totalLogFiles: files.length,
                usedLogFiles: filteredFiles.length,
                confidenceLevel: 0.95,
                criticalValue: Z_CRITICAL,
            },
            summaryAcrossRuns: {
                avgSummary: {
                    ...aggSummary,
                    avgCpuUserPercent: avgCpuUser,
                    avgCpuSystemPercent: avgCpuSystem,
                },
                confidenceIntervals: {
                    ...summaryCI,
                    avgCpuUserPercent: cpuUserStats,
                    avgCpuSystemPercent: cpuSystemStats,
                },
            },
            testStats,
        };

        const outputFile = path.join(OUTPUT_DIR, `aggregated-stats-${timestamp}.json`);
        fs.writeFileSync(outputFile, JSON.stringify(result, null, 2), 'utf-8');
        console.log(` JSON сохранён: ${outputFile}`);

        console.log('\n Сводка по прогонам:');
        console.log(` Количество прогонов: ${filteredFiles.length}`);
        console.log(` Средняя суммарная длительность: ${aggSummary.sumDurationMs.toFixed(0)} мс (ДИ: ${summaryCI.sumDurationMs.ciLower.toFixed(0)} – ${summaryCI.sumDurationMs.ciUpper.toFixed(0)})`);
        console.log(` Среднее пиковое ОЗУ: ${aggSummary.avgPeakMemoryMB.toFixed(2)} MB (ДИ: ${summaryCI.avgPeakMemoryMB.ciLower.toFixed(2)} – ${summaryCI.avgPeakMemoryMB.ciUpper.toFixed(2)})`);
        console.log(` Средний CPU User: ${avgCpuUser.toFixed(2)} % (ДИ: ${cpuUserStats.ciLower.toFixed(2)} – ${cpuUserStats.ciUpper.toFixed(2)})`);
        console.log(` Средний CPU System: ${avgCpuSystem.toFixed(2)} % (ДИ: ${cpuSystemStats.ciLower.toFixed(2)} – ${cpuSystemStats.ciUpper.toFixed(2)})`);

        console.log(`\n Статистика по ${testStats.length} тестам (выборочно первые 5):`);
        testStats.slice(0, 5).forEach((t, i) => {
            console.log(`  ${i+1}. ${t.testName}`);
            console.log(`  Длительность: сред. ${t.duration.mean.toFixed(0)} мс, ДИ: [${t.duration.ciLower.toFixed(0)}, ${t.duration.ciUpper.toFixed(0)}]`);
            console.log(`  ОЗУ: сред. ${t.memory.mean.toFixed(2)} MB, ДИ: [${t.memory.ciLower.toFixed(2)}, ${t.memory.ciUpper.toFixed(2)}]`);
            console.log(`  CPU User: сред. ${t.cpuUser.mean.toFixed(2)} %, ДИ: [${t.cpuUser.ciLower.toFixed(2)}, ${t.cpuUser.ciUpper.toFixed(2)}]`);
            console.log(`  CPU System: сред. ${t.cpuSystem.mean.toFixed(2)} %, ДИ: [${t.cpuSystem.ciLower.toFixed(2)}, ${t.cpuSystem.ciUpper.toFixed(2)}]`);
        });
        if (testStats.length > 5) console.log(`  ... и ещё ${testStats.length - 5} тестов.`);

        console.log(`\n ИТОГ:`);
        console.log(`  Суммарная длительность: ${aggSummary.sumDurationMs.toFixed(0)} мс (ДИ: ${summaryCI.sumDurationMs.ciLower.toFixed(0)} – ${summaryCI.sumDurationMs.ciUpper.toFixed(0)})`);
        console.log(`  Среднее пиковое ОЗУ: ${aggSummary.avgPeakMemoryMB.toFixed(2)} MB (ДИ: ${summaryCI.avgPeakMemoryMB.ciLower.toFixed(2)} – ${summaryCI.avgPeakMemoryMB.ciUpper.toFixed(2)})`);
        console.log(`  Средний CPU User: ${avgCpuUser.toFixed(2)} % (ДИ: ${cpuUserStats.ciLower.toFixed(2)} – ${cpuUserStats.ciUpper.toFixed(2)})`);
        console.log(`  Средний CPU System: ${avgCpuSystem.toFixed(2)} % (ДИ: ${cpuSystemStats.ciLower.toFixed(2)} – ${cpuSystemStats.ciUpper.toFixed(2)})`);

        const csvLines = [
            ['Название теста', 'Кол-во прогонов',
             'Длительность_среднее', 'Длительность_дисперсия', 'Длительность_ДИ_нижн', 'Длительность_ДИ_верхн',
             'ОЗУ_среднее', 'ОЗУ_дисперсия', 'ОЗУ_ДИ_нижн', 'ОЗУ_ДИ_верхн',
             'CPU_User_среднее_%', 'CPU_User_дисперсия', 'CPU_User_ДИ_нижн_%', 'CPU_User_ДИ_верхн_%',
             'CPU_System_среднее_%', 'CPU_System_дисперсия', 'CPU_System_ДИ_нижн_%', 'CPU_System_ДИ_верхн_%']
        ];
        for (const t of testStats) {
            csvLines.push([
                t.testName,
                t.count,
                t.duration.mean, t.duration.variance, t.duration.ciLower, t.duration.ciUpper,
                t.memory.mean, t.memory.variance, t.memory.ciLower, t.memory.ciUpper,
                t.cpuUser.mean, t.cpuUser.variance, t.cpuUser.ciLower, t.cpuUser.ciUpper,
                t.cpuSystem.mean, t.cpuSystem.variance, t.cpuSystem.ciLower, t.cpuSystem.ciUpper,
            ]);
        }
        csvLines.push([
            'Итогово:',
            filteredFiles.length,
            aggSummary.sumDurationMs,
            summaryCI.sumDurationMs.variance,
            summaryCI.sumDurationMs.ciLower,
            summaryCI.sumDurationMs.ciUpper,
            aggSummary.avgPeakMemoryMB,
            summaryCI.avgPeakMemoryMB.variance,
            summaryCI.avgPeakMemoryMB.ciLower,
            summaryCI.avgPeakMemoryMB.ciUpper,
            avgCpuUser,
            cpuUserStats.variance,
            cpuUserStats.ciLower,
            cpuUserStats.ciUpper,
            avgCpuSystem,
            cpuSystemStats.variance,
            cpuSystemStats.ciLower,
            cpuSystemStats.ciUpper,
        ]);

        const csvContent = csvLines.map(row => row.join(',')).join('\n');
        const csvFile = path.join(OUTPUT_DIR, `aggregated-stats-${timestamp}.csv`);
        fs.writeFileSync(csvFile, csvContent, 'utf-8');
        console.log(`\n CSV-версия сохранена: ${csvFile}`);

    } catch (error) {
        console.error(' Ошибка при выполнении:', error);
    }
}

main();
