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
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw);
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
            console.error(`В папке ${LOGS_DIR} не найдено файлов logs-*.json`);
            return;
        }

        console.log(` Найдено ${files.length} файлов логов.`);




        const summaries = [];
        const allTestEntries = [];

        for (const file of filteredFiles) {
            const data = readLogFile(file);
            if (!data) continue;
            if (data.summary) summaries.push(data.summary);
            if (data.testResults) {
                for (const test of data.testResults) {
                    allTestEntries.push({
                        testName: test.testName,
                        durationMs: test.durationMs,
                        peakMemoryMB: test.peakMemoryMB,
                        cpuUserPercent: test.peakCpuUserPercent,
                        cpuSystemPercent: test.peakCpuSystemPercent,
                        status: test.status,
                    });
                }
            }
        }

        if (summaries.length === 0) {
            console.warn(' Не удалось извлечь summary ни из одного файла.');
            return;
        }

        const aggSummary = {
            totalTests: summaries[0].totalTests,
            passed: summaries.reduce((s, v) => s + v.passed, 0) / summaries.length,
            failed: summaries.reduce((s, v) => s + v.failed, 0) / summaries.length,
            sumDurationMs: summaries.reduce((s, v) => s + v.sumDurationMs, 0) / summaries.length,
            avgPeakMemoryMB: summaries.reduce((s, v) => s + v.avgPeakMemoryMB, 0) / summaries.length,
            maxPeakMemoryMB: summaries.reduce((s, v) => s + v.maxPeakMemoryMB, 0) / summaries.length,
        };

        const perRunCpu = [];
        for (const file of filteredFiles) {
            const data = readLogFile(file);
            if (!data || !data.testResults) continue;
            const cpuUserVals = data.testResults.map(t => t.peakCpuUserPercent).filter(v => v !== undefined && v !== null);
            const cpuSystemVals = data.testResults.map(t => t.peakCpuSystemPercent).filter(v => v !== undefined && v !== null);
            if (cpuUserVals.length > 0) {
                const avgUser = cpuUserVals.reduce((s, v) => s + v, 0) / cpuUserVals.length;
                const avgSystem = cpuSystemVals.reduce((s, v) => s + v, 0) / cpuSystemVals.length;
                perRunCpu.push({ user: avgUser, system: avgSystem });
            }
        }

        const avgCpuUser = perRunCpu.reduce((s, v) => s + v.user, 0) / perRunCpu.length;
        const avgCpuSystem = perRunCpu.reduce((s, v) => s + v.system, 0) / perRunCpu.length;

        function getCIField(field) {
            const values = summaries.map(s => s[field]).filter(v => v !== undefined && v !== null);
            return computeStats(values);
        }

        const summaryCI = {
            sumDurationMs: getCIField('sumDurationMs'),
            avgPeakMemoryMB: getCIField('avgPeakMemoryMB'),
            maxPeakMemoryMB: getCIField('maxPeakMemoryMB'),
        };

        const cpuUserVals = perRunCpu.map(v => v.user);
        const cpuSystemVals = perRunCpu.map(v => v.system);
        const cpuUserStats = computeStats(cpuUserVals);
        const cpuSystemStats = computeStats(cpuSystemVals);

        const testGroups = {};
        for (const entry of allTestEntries) {
            if (!testGroups[entry.testName]) testGroups[entry.testName] = [];
            testGroups[entry.testName].push(entry);
        }

        const testStats = [];
        for (const [testName, entries] of Object.entries(testGroups)) {
            const durationData = entries.map(e => e.durationMs).filter(v => v !== undefined);
            const memData = entries.map(e => e.peakMemoryMB).filter(v => v !== undefined);
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
        console.log(`Агрегированная статистика сохранена в ${outputFile}`);

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
        if (testStats.length > 5) console.log(`  ... и ещё ${testStats.length - 5} тестов. Полные данные в JSON-файле.`);

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
        console.log(`\n CSV-версия сохранена в ${csvFile}`);

    } catch (error) {
        console.error('Ошибка при выполнении:', error);
    }
}

main();
