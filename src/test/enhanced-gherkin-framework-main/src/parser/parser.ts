import * as fs from 'fs';

export type StepType = 'action' | 'if' | 'else' | 'endif' | 'loop' | 'endloop';

export interface TestStep {
    type: StepType;
    action?: string;
    parameters?: string[];
    steps?: TestStep[];
}

export interface TestCase {
    name: string;
    steps: TestStep[];
}

export class EnhancedGherkinParser {
    parseFeature(filePath: string): TestCase[] {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n').map(line => line.trim());
        const testCases: TestCase[] = [];

        let currentTest: TestCase | null = null;
        let currentStepsStack: TestStep[][] = [];
        let currentSteps: TestStep[] = [];

        for (const line of lines) {
            if (line.startsWith('#') || line === '') {
                continue;
            }

            if (line.toLowerCase().startsWith('тест:') || line.toLowerCase().startsWith('test:')) {
                if (currentTest) {
                    testCases.push(currentTest);
                }
                currentTest = { name: line.substring(5).trim(), steps: [] };
                currentSteps = currentTest.steps;
                currentStepsStack = [ currentSteps ];
            } else if (currentTest && line.length > 0) {
                const steps = this.parseStep(line);

                if (steps.type === 'if' || steps.type === 'loop') {
                    steps.steps = [];
                    currentSteps.push(steps);
                    currentStepsStack.push(steps.steps);
                    currentSteps = steps.steps;
                } else if (steps.type === 'else') {
                    currentStepsStack.pop();
                    currentSteps = currentStepsStack[currentStepsStack.length - 1];
                    steps.steps = [];
                    currentSteps.push(steps);
                    currentStepsStack.push(steps.steps);
                    currentSteps = steps.steps;
                } else if (steps.type === 'endif' || steps.type === 'endloop') {
                    currentStepsStack.pop();
                    currentSteps = currentStepsStack[currentStepsStack.length - 1];
                } else {
                    currentSteps.push(steps);
                }
            }
        }

        if (currentTest) {
            testCases.push(currentTest);
        }

        return testCases;
    }

    parseStep(line: string): TestStep {
        const actionLine = line.trim();

        if (actionLine.toLowerCase().startsWith('если ') || actionLine.toLowerCase().startsWith('if ')) {
            const condition = actionLine.substring(4).trim();
            return { type: 'if', action: condition, parameters: [] };
        } else if (actionLine.toLowerCase().startsWith('иначе') || actionLine.toLowerCase().startsWith('else')) {
            return { type: 'else' };
        } else if (actionLine.toLowerCase().startsWith('конецесли') || actionLine.toLowerCase().startsWith('endif')) {
            return { type: 'endif' };
        } else if (actionLine.toLowerCase().startsWith('для каждого ') || actionLine.toLowerCase().startsWith('for each ')) {
            const loopExpression = actionLine.substring(11).trim();
            return { type: 'loop', action: loopExpression, parameters: [] };
        } else if (actionLine.toLowerCase().startsWith('конеццикла') || actionLine.toLowerCase().startsWith('endloop')) {
            return { type: 'endloop' };
        } else {
            const { action, parameters } = this.extractActionAndParameters(actionLine);
            return { type: 'action', action, parameters };
        }
    }

    extractActionAndParameters(line: string): { action: string; parameters: string[] } {
        const regex = /"([^"]+)"|(\d+)|(\{[^}]+\})/g;
        const parameters: string[] = [];
        let match;
        while ((match = regex.exec(line)) !== null) {
            if (match[1] !== undefined) {
                parameters.push(match[1]);
            } else if (match[2] !== undefined) {
                parameters.push(match[2]);
            } else if (match[3] !== undefined) {
                parameters.push(match[3]);
            }
        }
        const action = line.replace(regex, '{}').trim();
        return { action, parameters };
    }
}

