import { TestCase, TestStep } from '../parser/parser';
import { performAction } from '../steps/steps';
import config from '../utils/config';
import path from 'path';
import * as fs from 'node:fs';
import { getFormattedTimestamp } from '../utils/timestamp';

interface StepResult {
    stepNumber: number;
    action: string;
    parameters: string[];
    status: 'passed' | 'failed';
    error?: string;
    screenshotPath?: string;
    videoPath?: string;
}

interface TestResult {
    testName: string;
    steps: StepResult[];
    status: 'passed' | 'failed';
    durationMs: number;
    peakMemoryMB?: number;
    peakCpuUserPercent?: number;
    peakCpuSystemPercent?: number;
}

export class TestExecutor {
    private scenarioStartTime!: number;
    private scenarioEndTime!: number;
    private stepsTiming: { [stepIndex: number]: { start: number, end: number } } = {};
    variables: { [key: string]: any } = {};
    private testResults: TestResult[] = [];

    async executeTestCase(testCase: TestCase) {
        console.log(`\nТест: ${ testCase.name }`);
        this.scenarioStartTime = Date.now();
        const memBefore = process.memoryUsage().heapUsed;
        const cpuBaseline = process.cpuUsage();

        const testResult: TestResult = {
            testName: testCase.name,
            steps: [],
            status: 'passed',
            durationMs: 0
        };

        let memAfter = memBefore;
        let cpuUsage = { user: 0, system: 0 };

        try {
            await this.executeSteps(testCase.steps, testResult);
            this.scenarioEndTime = Date.now();
            testResult.durationMs = this.scenarioEndTime - this.scenarioStartTime;
            console.log(`✅ Тест "${ testCase.name }" успешно пройден.`);
        } catch (error) {
            this.scenarioEndTime = Date.now();
            testResult.status = 'failed';
            testResult.durationMs = this.scenarioEndTime - this.scenarioStartTime;
            console.error(`❌ Тест "${ testCase.name }" провален:`, error);
        } finally {
            memAfter = process.memoryUsage().heapUsed;
            cpuUsage = process.cpuUsage(cpuBaseline);

            const peakMem = Math.max(memBefore, memAfter);
            testResult.peakMemoryMB = parseFloat((peakMem / 1024 / 1024).toFixed(2));

            const duration = testResult.durationMs || 1;
            const cpuUserMs = cpuUsage.user / 1000;
            const cpuSystemMs = cpuUsage.system / 1000;
            testResult.peakCpuUserPercent = parseFloat(((cpuUserMs / duration) * 100).toFixed(2));
            testResult.peakCpuSystemPercent = parseFloat(((cpuSystemMs / duration) * 100).toFixed(2));

            this.logMetricsSummary(testResult);
        }
        this.testResults.push(testResult);
    }

    private logMetricsSummary(testResult: TestResult) {
        console.log(`\n Сводка по метрикам для теста "${testResult.testName}":`);
        console.log(`   Длительность: ${testResult.durationMs} мс`);
        console.log(`   Пик ОЗУ (heapUsed): ${testResult.peakMemoryMB} MB`);
        console.log(`   Пик CPU (User): ${testResult.peakCpuUserPercent} %`);
        console.log(`   Пик CPU (System): ${testResult.peakCpuSystemPercent} %`);
        console.log(`   Статус: ${testResult.status === 'passed' ? '✅ Пройден' : '❌ Провален'}`);
    }

    async executeSteps(steps: TestStep[], testResult: TestResult) {
        for (let index = 0; index < steps.length; index++) {
            await this.executeStep(steps[index], index, testResult);
        }
    }

    async executeStep(step: TestStep, index: number, testResult: TestResult) {
        switch (step.type) {
            case 'action':
                await this.executeAction(step, index, testResult);
                break;
            case 'if':
                await this.executeIf(step, testResult);
                break;
            case 'else':
                break;
            case 'loop':
                await this.executeLoop(step, testResult);
                break;
            case 'endif':
            case 'endloop':
                break;
            default:
                throw new Error(`Неизвестный тип шага: ${ step.type }`);
        }
    }

     async executeAction(step: TestStep, index: number, testResult: TestResult) {
         const parameters = step.parameters?.map(param => this.replaceVariables(param)) || [];
         const action = this.replaceVariables(step.action || '');
         this.stepsTiming[index] = { start: Date.now(), end: 0 };

        const stepResult: StepResult = {
            stepNumber: index + 1,
            action,
            parameters,
            status: 'passed'
        };

        try {
            await performAction(action, parameters);
            this.stepsTiming[index].end = Date.now();

            const parametersString = this.formatParameters(parameters);
            console.log(`✅ Шаг ${ index + 1 }: ${ action }${ parametersString }`);

            testResult.steps.push(stepResult);
        } catch (error: any) {
            this.stepsTiming[index].end = Date.now();

            const parametersString = this.formatParameters(parameters);
            console.error(`❌ Шаг ${ index + 1 } провален: ${ action }${ parametersString }`);

            stepResult.status = 'failed';
            stepResult.error = error.message;
            testResult.steps.push(stepResult);

            testResult.status = 'failed';

            throw error;
        }
    }

    private formatParameters(parameters: string[]): string {
        const filteredParameters = parameters.filter(param => param && param !== '{}');
        return filteredParameters.length > 0 ? ` [${ filteredParameters.join(', ') }]` : '';
    }

    async executeIf(step: TestStep, testResult: TestResult) {
         const condition = step.action || '';
         const conditionResult = await this.evaluateCondition(condition);
        if (conditionResult) {
            if (step.steps) {
                await this.executeSteps(step.steps, testResult);
            }
        } else {
            const elseStep = step.steps?.find(s => s.type === 'else');
            if (elseStep && elseStep.steps) {
                await this.executeSteps(elseStep.steps, testResult);
            }
        }
    }


    async executeLoop(step: TestStep, testResult: TestResult) {
        const loopExpression = this.replaceVariables(step.action || '');
        const items = await this.getLoopItems(loopExpression);

        for (const item of items) {
            let varName = '';
            if (loopExpression.includes(' в ')) {
                varName = loopExpression.split(' в ')[0].trim();
            } else if (loopExpression.includes(' in ')) {
                varName = loopExpression.split(' in ')[0].trim();
            } else {
                throw new Error(`Не удалось извлечь имя переменной из цикла: ${loopExpression}`);
            }
            this.variables[varName.trim()] = item;
            if (typeof item === 'string' && item.includes(';')) {
                const parts = item.split(';');
                this.variables['значение'] = parts[0]?.trim();
                this.variables['ожидание'] = parts[1]?.trim();
                this.variables['тип'] = parts[2]?.trim();
            }

            if (step.steps) {
                const updatedSteps = step.steps.map(innerStep => {
                    const newParams = (innerStep.parameters || []).map(p => this.replaceVariables(p));
                    const newAction = innerStep.action ? this.replaceVariables(innerStep.action) : undefined;
                    return {
                        ...innerStep,
                        action: newAction,
                        parameters: newParams
                    };
                });
                await this.executeSteps(updatedSteps, testResult);
            }
        }
    }

    replaceVariables(text: string): string {
        return text.replace(/\{(.*?)}/g, (match, p1) => {
            const value = this.variables[p1.trim()];
            return value !== undefined ? value : match;
        });
    }

    async evaluateCondition(condition: string): Promise<boolean> {
        if (condition.startsWith('заголовок страницы содержит ')) {
            const expectedText = condition.substring(28).replace(/"/g, '');
            const actualTitle = await this.variables['pageTitle'];
            return (actualTitle || '').includes(expectedText);
        } else if (condition.startsWith('page title contains ')) {
            const expectedText = condition.substring(20).replace(/"/g, '');
            const actualTitle = await this.variables['pageTitle'];
            return (actualTitle || '').includes(expectedText);
        }
        const match = condition.match(/\{(.*?)\}\s*equals\s*"([^"]+)"/);
        if (match) {
            const varName = match[1].trim();
            const expectedValue = match[2];
            const actualValue = this.variables[varName];
            return actualValue === expectedValue;
        }

        return false;
    }

    async getLoopItems(loopExpression: string): Promise<any[]> {
        const matchRu = loopExpression.match(/(.*?) в \[(.*)]/);
        if (matchRu) {
            return matchRu[2].split(',').map(item => item.trim().replace(/"/g, ''));
        } else {
            const matchEn = loopExpression.match(/(.*?) in \[(.*)]/);
            if (matchEn) {
                return matchEn[2].split(',').map(item => item.trim().replace(/"/g, ''));
            }
        }
        throw new Error(`Неверное выражение цикла: ${ loopExpression }`);
    }

    finalizeLogs() {
        if (!config.logging.enabled) return;
        if (this.testResults.length === 0) return;

        const timestamp = getFormattedTimestamp();
        const logFilename = `logs-${ timestamp }.json`;
        const logPath = path.resolve(config.logging.outputPath, logFilename);
        const logDir = path.dirname(logPath);

        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        const summary = {
            totalTests: this.testResults.length,
            passed: this.testResults.filter(r => r.status === 'passed').length,
            failed: this.testResults.filter(r => r.status === 'failed').length,
            sumDurationMs: this.testResults.reduce((sum, r) => sum + r.durationMs, 0),
            avgPeakMemoryMB: this.testResults.reduce((sum, r) => sum + (r.peakMemoryMB || 0), 0) / this.testResults.length,
            avgCpuUserPercent: this.testResults.reduce((sum, r) => sum + (r.peakCpuUserPercent || 0), 0) / this.testResults.length,
            avgCpuSystemPercent: this.testResults.reduce((sum, r) => sum + (r.peakCpuSystemPercent || 0), 0) / this.testResults.length,
            maxCpuUserPercent: Math.max(...this.testResults.map(r => r.peakCpuUserPercent || 0)),
            maxCpuSystemPercent: Math.max(...this.testResults.map(r => r.peakCpuSystemPercent || 0)),
        };

        const logData = {
            timestamp,
            summary,
            testResults: this.testResults
        };

        fs.writeFileSync(logPath, JSON.stringify(logData, null, 2), 'utf-8');
        console.log(`Логи тестов сохранены по пути: ${ logPath }`);
    }
}
