const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.cwd();;
const OUTPUT_DIR = path.join(process.cwd(), 'results');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const OUTPUT_JSON_PATH = path.join(PROJECT_ROOT, 'output/output.json');
const TEST_DIR = path.join(PROJECT_ROOT, 'test');
const FEATURES_DIR = path.join(PROJECT_ROOT, 'features');

function getProcessTreeSnapshotCmd(rootPid) {
  const script =
    `$all = Get-CimInstance Win32_Process; ` +
    `$ids = @(${rootPid}); ` +
    `$frontier = @(${rootPid}); ` +
    `while ($frontier.Count -gt 0) { ` +
    `  $children = $all | Where-Object { $frontier -contains $_.ParentProcessId } | Select-Object -ExpandProperty ProcessId; ` +
    `  $new = $children | Where-Object { $ids -notcontains $_ }; ` +
    `  $ids += $new; ` +
    `  $frontier = $new; ` +
    `}; ` +
    `$procs = $all | Where-Object { $ids -contains $_.ProcessId }; ` +
    `$liveProcs = Get-Process -Id $ids -ErrorAction SilentlyContinue; ` +
    `$mem = ($liveProcs | Measure-Object -Property WorkingSet64 -Sum).Sum; ` +
    `$userMs = ($procs | Measure-Object -Property UserModeTime -Sum).Sum / 10000; ` +
    `$sysMs = ($procs | Measure-Object -Property KernelModeTime -Sum).Sum / 10000; ` +
    `Write-Output ('{0},{1},{2}' -f $mem, $userMs, $sysMs)`;
  return `powershell -NoProfile -Command "${script}"`;
}

function sampleProcessTree(rootPid) {
  return new Promise((resolve) => {
    exec(getProcessTreeSnapshotCmd(rootPid), { windowsHide: true }, (err, stdout) => {
      if (err || !stdout) return resolve(null);
      const trimmed = stdout.trim();
      if (!trimmed) return resolve(null);
      const [memStr, userStr, sysStr] = trimmed.split(',');
      const mem = parseFloat(memStr);
      const userMs = parseFloat(userStr);
      const sysMs = parseFloat(sysStr);
      if (Number.isNaN(mem) || Number.isNaN(userMs) || Number.isNaN(sysMs)) return resolve(null);
      resolve({ memBytes: mem, cpuUserMs: userMs, cpuSystemMs: sysMs });
    });
  });
}

function generateConcordiaScripts() {
  return new Promise((resolve, reject) => {
    console.log(' Генерация тестовых скриптов (npx concordia --just-script)...');
    const child = spawn('npx', ['concordia', '--just-script'], {
      cwd: PROJECT_ROOT,
      shell: true,
      stdio: 'inherit'
    });
    child.on('close', (code) => {
      if (code === 0) {
        console.log(' Скрипты сгенерированы.\n');
        resolve();
      } else {
        reject(new Error(`Генерация скриптов завершилась с кодом ${code}`));
      }
    });
    child.on('error', reject);
  });
}

function parseFeatureFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const variants = [];
  let currentScenario = null;
  let currentVariant = null;
  let insideScenario = false;
  let insideVariant = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const scenarioMatch = trimmed.match(/^Scenario:\s*(.+)/);
    if (scenarioMatch) {
      currentScenario = scenarioMatch[1].trim();
      insideScenario = true;
      continue;
    }
    const variantMatch = trimmed.match(/^Variant:\s*(.+)/);
    if (variantMatch && insideScenario) {
      currentVariant = variantMatch[1].trim();
      insideVariant = true;
      if (currentScenario && currentVariant) {
        variants.push({
          scenarioName: currentScenario,
          variantName: currentVariant
        });
      }
      continue;
    }
   }
  if (variants.length === 0 && currentScenario) {
    variants.push({
      scenarioName: currentScenario,
      variantName: null
    });
  }

  return variants;
}

function buildNameMapping() {
  const mapping = {};

  const featureFiles = fs.readdirSync(FEATURES_DIR).filter(f => f.endsWith('.feature'));
  for (const featureFile of featureFiles) {
    const baseName = path.basename(featureFile, '.feature');
    const jsFile = path.join(TEST_DIR, baseName + '.js');
    if (!fs.existsSync(jsFile)) continue;

    const featureVariants = parseFeatureFile(path.join(FEATURES_DIR, featureFile));
    const jsContent = fs.readFileSync(jsFile, 'utf-8');
    const jsMatches = jsContent.matchAll(/Scenario\s*\(\s*["'`](.*?)["'`]/g);
    const jsNames = [];
    for (const match of jsMatches) {
      if (match[1]) jsNames.push(match[1].trim());
    }

    const count = Math.min(featureVariants.length, jsNames.length);
    for (let i = 0; i < count; i++) {
      const fv = featureVariants[i];
      let correctName;
      if (fv.variantName) {
        const suffix = jsNames[i].includes(' - 1') ? ' - 1' : '';
        correctName = `${fv.scenarioName} | ${fv.variantName}${suffix}`;
      } else {
        correctName = fv.scenarioName;
      }
      mapping[jsNames[i]] = correctName;
    }
  }

  return mapping;
}

function runSingleTest(testName, scriptFilePath) {
  return new Promise((resolve) => {
    if (fs.existsSync(OUTPUT_JSON_PATH)) fs.unlinkSync(OUTPUT_JSON_PATH);

    let peakMemoryBytes = 0;
    let peakCpuUserMs = 0;
    let peakCpuSystemMs = 0;
    let interval;
    let stopped = false;
    let isPolling = false;

    const escapedTestName = testName.replace(/"/g, '\\"');
    const command = `npx concordia --just-run --script-file "${scriptFilePath}" --script-grep "${escapedTestName}"`;

    const child = exec(command, {
      cwd: PROJECT_ROOT,
      windowsHide: true,
    });

    const poll = async () => {
      if (stopped || isPolling) return;
      isPolling = true;
      try {
        const sample = await sampleProcessTree(child.pid);
        if (stopped) return;
        if (sample) {
          if (sample.memBytes > peakMemoryBytes) peakMemoryBytes = sample.memBytes;
          if (sample.cpuUserMs > peakCpuUserMs) peakCpuUserMs = sample.cpuUserMs;
          if (sample.cpuSystemMs > peakCpuSystemMs) peakCpuSystemMs = sample.cpuSystemMs;
        }
      } catch (e) {}
      isPolling = false;
    };

    interval = setInterval(poll, 200);

    child.on('close', (code) => {
      stopped = true;
      clearInterval(interval);

      let status = 'failed';
      let durationMs = 0;

      if (fs.existsSync(OUTPUT_JSON_PATH)) {
        try {
          const raw = fs.readFileSync(OUTPUT_JSON_PATH, 'utf-8');
          const data = JSON.parse(raw);
          const collectResult = (suite) => {
            for (const t of suite.tests || []) {
              if (t.title.trim() === testName) {
                status = t.state === 'passed' ? 'passed' : 'failed';
                durationMs = t.duration || 0;
              }
            }
            for (const sub of suite.suites || []) collectResult(sub);
          };
          for (const root of data.results || []) collectResult(root);
        } catch (e) {}
      }

      resolve({
        testName,
        status,
        durationMs,
        peakMemoryMB: peakMemoryBytes / 1024 / 1024,
        peakCpuUserMs: peakCpuUserMs,
        peakCpuSystemMs: peakCpuSystemMs
      });
    });

    child.on('error', (err) => {
      stopped = true;
      clearInterval(interval);
      resolve({
        testName,
        status: 'failed',
        durationMs: 0,
        peakMemoryMB: 0,
        peakCpuUserMs: 0,
        peakCpuSystemMs: 0
      });
    });
  });
}

async function runOnePass(runNumber) {
  console.log(`\n🏃 Прогон ${runNumber} из 25...`);

  const nameMapping = buildNameMapping();

  const tests = [];
  const files = fs.readdirSync(TEST_DIR).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const fullPath = path.join(TEST_DIR, file);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const matches = content.matchAll(/Scenario\s*\(\s*["'`](.*?)["'`]/g);
    for (const match of matches) {
      if (match[1]) {
        const wrongName = match[1].trim();
        const correctName = nameMapping[wrongName] || wrongName;
        tests.push({
          wrongName: wrongName,
          correctName: correctName,
          filePath: fullPath
        });
      }
    }
  }

  if (tests.length === 0) {
    console.error('Не найдено тестов');
    return null;
  }

  const testResults = [];

  for (let i = 0; i < tests.length; i++) {
    const { wrongName, correctName, filePath } = tests[i];
    process.stdout.write(`⏳ [${i + 1}/${tests.length}] "${correctName}"... `);

    const result = await runSingleTest(wrongName, filePath);
    result.testName = correctName;
    testResults.push(result);

    console.log(`(${result.durationMs} мс, ОЗУ: ${result.peakMemoryMB.toFixed(2)} MB)`);
  }

  const totalTests = testResults.length;
  const passed = testResults.filter(r => r.status === 'passed').length;
  const failed = testResults.filter(r => r.status === 'failed').length;
  const sumDuration = testResults.reduce((s, r) => s + r.durationMs, 0);
  const avgMemory = totalTests > 0 ? testResults.reduce((s, r) => s + r.peakMemoryMB, 0) / totalTests : 0;
  const maxMemory = totalTests > 0 ? Math.max(...testResults.map(r => r.peakMemoryMB)) : 0;
  const avgCpuUser = totalTests > 0 ? testResults.reduce((s, r) => s + r.peakCpuUserMs, 0) / totalTests : 0;
  const avgCpuSystem = totalTests > 0 ? testResults.reduce((s, r) => s + r.peakCpuSystemMs, 0) / totalTests : 0;

  const summary = {
    totalTests,
    passed,
    failed,
    sumDurationMs: sumDuration,
    avgPeakMemoryMB: avgMemory,
    maxPeakMemoryMB: maxMemory,
    avgPeakCpuUserMs: avgCpuUser,
    avgPeakCpuSystemMs: avgCpuSystem
  };

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logData = { timestamp, run: runNumber, summary, testResults };
  const outputFile = path.join(OUTPUT_DIR, `concordia-metric-${timestamp}-run${runNumber}.json`);

  fs.writeFileSync(outputFile, JSON.stringify(logData, null, 2), 'utf-8');

  console.log(`\n Результаты прогона ${runNumber} сохранены: ${outputFile}`);
  console.log(` Сводка прогона: Passed: ${summary.passed}, Failed: ${summary.failed}, Длительность: ${summary.sumDurationMs} мс`);

  return { summary, logData };
}

async function main() {
  console.log('Запуск тестирования ConcordiaLang (25 прогонов)');
  await generateConcordiaScripts();

  const allRunSummaries = [];

  for (let run = 1; run < 26; run++) {
    const result = await runOnePass(run);
    if (result) {
      allRunSummaries.push(result.summary);
    }
  }

  console.log('\n\n ИТОГОВАЯ СВОДКА ПО 25 ПРОГОНАМ:');
  const totalRuns = allRunSummaries.length;
  if (totalRuns === 0) {
    console.log('Нет данных');
    return;
  }

  const avgPassed = allRunSummaries.reduce((s, r) => s + r.passed, 0) / totalRuns;
  const avgFailed = allRunSummaries.reduce((s, r) => s + r.failed, 0) / totalRuns;
  const avgDuration = allRunSummaries.reduce((s, r) => s + r.sumDurationMs, 0) / totalRuns;
  const avgMemory = allRunSummaries.reduce((s, r) => s + r.avgPeakMemoryMB, 0) / totalRuns;
  const avgCpuUser = allRunSummaries.reduce((s, r) => s + r.avgPeakCpuUserMs, 0) / totalRuns;
  const avgCpuSystem = allRunSummaries.reduce((s, r) => s + r.avgPeakCpuSystemMs, 0) / totalRuns;

  const overallSummary = {
    totalRuns,
    avgPassed,
    avgFailed,
    avgDurationMs: avgDuration,
    avgPeakMemoryMB: avgMemory,
    avgPeakCpuUserMs: avgCpuUser,
    avgPeakCpuSystemMs: avgCpuSystem,
    allRunSummaries
  };

  const overallTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const overallFile = path.join(OUTPUT_DIR, `concordia-overall-${overallTimestamp}.json`);
  fs.writeFileSync(overallFile, JSON.stringify(overallSummary, null, 2), 'utf-8');

  console.log(`\nОбщая сводка сохранена: ${overallFile}`);
  console.log(`- Всего прогонов: ${totalRuns}`);
  console.log(`- Среднее Passed: ${avgPassed.toFixed(1)}`);
  console.log(`- Среднее Failed: ${avgFailed.toFixed(1)}`);
  console.log(`- Средняя длительность: ${avgDuration.toFixed(0)} мс`);
  console.log(`- Средний пик ОЗУ: ${avgMemory.toFixed(2)} MB`);
  console.log(`- Средний CPU User: ${avgCpuUser.toFixed(0)} мс`);
  console.log(`- Средний CPU System: ${avgCpuSystem.toFixed(0)} мс`);
}

main().catch(console.error);
