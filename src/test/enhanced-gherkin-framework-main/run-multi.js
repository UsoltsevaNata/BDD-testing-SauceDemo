import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RUNS = 25;
const LOGS_DIR = path.join(process.cwd(), 'test-results', 'logs');

if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
}

console.log(` Запуск ${RUNS} прогонов тестов для Enhanced Gherkin...\n`);

for (let i = 0; i < RUNS; i++) {
    const runIndex = i + 1;
    console.log(` Прогон ${runIndex} из ${RUNS}...`);
    try {
        execSync('pnpm run-tests', {
            stdio: 'inherit',
            env: { ...process.env}
        });
        console.log(` Прогон ${runIndex} завершён успешно.`);
    } catch (error) {
        console.error(` Прогон ${runIndex} завершился с ошибкой (код ${error.status}).`);
    }
}

console.log(`\n Все ${RUNS} прогонов выполнены.`);

console.log('\n Запуск агрегации статистики...');
try {
    execSync('node aggregate-stats.js', { stdio: 'inherit' });
    console.log(' Агрегация завершена.');
} catch (error) {
    console.error(' Ошибка при агрегации статистики:', error.message);
}
