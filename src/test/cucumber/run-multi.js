const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const RUNS = 25;
const LOG_DIR = path.join(__dirname, 'test-results', 'logs');

if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

console.log(`Запуск ${RUNS} прогонов тестов для SauceDemo...\n`);

for (let i = 0; i < RUNS; i++) {
    console.log(` Прогон ${i + 1} из ${RUNS}...`);
    try {
        execSync('pnpm exec cucumber-js features/**/*.feature', {
            stdio: 'inherit',
            env: { ...process.env }
        });
        console.log(`Прогон ${i + 1} завершён успешно.`);
    } catch (error) {
        console.error(`Прогон ${i + 1} завершился с ошибкой (код ${error.status}).`);
    }
}

console.log(`\nВсе ${RUNS} прогонов выполнены.`);

console.log('\nЗапуск агрегации статистики...');
try {
    execSync('node aggregate-stats.js', { stdio: 'inherit' });
    console.log(' Агрегация завершена.');
} catch (error) {
    console.error(' Ошибка при агрегации статистики:', error.message);
}