import { TestCase, TestStep } from '../parser/parser';
import { TestExecutor } from './executor';
import { performAction } from '../steps/steps';
import config from '../utils/config';
import * as fs from 'fs';
import { CartPage, CheckoutPage, InventoryPage, LoginPage, MenuPage } from '../pom/pages';

jest.mock('../pom/pages', () => {
    return {
        LoginPage: jest.fn(),
        InventoryPage: jest.fn(),
        CartPage: jest.fn(),
        CheckoutPage: jest.fn(),
        MenuPage: jest.fn(),
    };
});

const loginPageMock = {
    open: jest.fn(),
    login: jest.fn(),
    clickLoginButton: jest.fn(),
};

const inventoryPageMock = {
    checkTitle: jest.fn(),
    addToCart: jest.fn(),
    openCart: jest.fn(),
    getProductPrice: jest.fn(),
};

const cartPageMock = {
    checkItemInCart: jest.fn(),
    checkout: jest.fn(),
    checkItemsCount: jest.fn(),
};

const checkoutPageMock = {
    fillInformation: jest.fn(),
    checkItem: jest.fn(),
    checkPriceInTotals: jest.fn(),
    finishOrder: jest.fn(),
    checkOrderFinished: jest.fn(),
};

const menuPageMock = {
    openMenu: jest.fn(),
    logout: jest.fn(),
};

(LoginPage as jest.Mock).mockImplementation(() => loginPageMock);
(InventoryPage as jest.Mock).mockImplementation(() => inventoryPageMock);
(CartPage as jest.Mock).mockImplementation(() => cartPageMock);
(CheckoutPage as jest.Mock).mockImplementation(() => checkoutPageMock);
(MenuPage as jest.Mock).mockImplementation(() => menuPageMock);
jest.mock('../steps/steps');
jest.mock('../utils/config');
jest.mock('fs');
jest.mock('../utils/timestamp');

const mockPerformAction = performAction as jest.Mock;
const mockFs = fs as jest.Mocked<typeof fs>;
const mockConfig = config as jest.Mocked<typeof config>;

describe('TestExecutor', () => {
    let executor: TestExecutor;
    const consoleLog = console.log;
    const consoleError = console.error;

    beforeEach(() => {
        executor = new TestExecutor();
        mockPerformAction.mockClear();
        mockFs.writeFileSync.mockClear();
        mockFs.mkdirSync.mockClear();
        mockConfig.logging = {
            enabled: false,
            outputPath: './test-results/logs'
        };

        console.log = jest.fn();
        console.error = jest.fn();
    });

    afterAll(() => {
        console.log = consoleLog;
        console.error = consoleError;
    });

    const createTestCase = (steps: TestStep[], name = 'Test Case'): TestCase => ({
        name,
        steps
    });

    const createActionStep = (action: string, parameters: string[] = []): TestStep => ({
        type: 'action',
        action,
        parameters
    });

    describe('executeTestCase', () => {
        it('should execute successful test case and log results', async () => {
            const testCase = createTestCase([
                createActionStep('Действие: Открыть страницу', [ 'https://site.com' ]),
                createActionStep('Действие: Нажать кнопку', [ 'Submit' ])
            ]);

            await executor.executeTestCase(testCase);

            expect(executor['testResults']).toHaveLength(1);
            const result = executor['testResults'][0];
            expect(result.status).toBe('passed');
            expect(result.steps).toHaveLength(2);
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('успешно пройден'));
        });

        it('should handle failed test case and log error', async () => {
            const error = new Error('Action failed');
            mockPerformAction.mockRejectedValueOnce(error);
            const testCase = createTestCase([ createActionStep('Действие: Упавший шаг') ]);

            await executor.executeTestCase(testCase);

            const result = executor['testResults'][0];
            expect(result.status).toBe('failed');
            expect(result.steps[0].error).toBe(error.message);
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('провален'));
        });
    });

    describe('executeSteps', () => {
        it('should execute steps with if-else structure', async () => {
            jest.spyOn(executor as any, 'evaluateCondition').mockResolvedValueOnce(true);

            const testCase = createTestCase([ {
                type: 'if',
                action: 'условие',
                steps: [ createActionStep('Действие: If branch') ]
            } ]);

            await executor.executeTestCase(testCase);

            expect(mockPerformAction).toHaveBeenCalledWith('Действие: If branch', []);
        });

        it('should execute else steps when condition is false', async () => {
            jest.spyOn(executor as any, 'evaluateCondition').mockResolvedValueOnce(false);

            const testCase = createTestCase([
                {
                    type: 'if',
                    action: 'условие',
                    steps: [
                        createActionStep('Действие: If branch'),
                        {
                            type: 'else',
                            action: '',
                            steps: [
                                createActionStep('Действие: Else branch')
                            ]
                        }
                    ]
                }
            ]);

            await executor.executeTestCase(testCase);

            expect(mockPerformAction).toHaveBeenCalledTimes(1);
            expect(mockPerformAction).toHaveBeenCalledWith('Действие: Else branch', []);

            expect(executor['testResults']).toHaveLength(1);
            const result = executor['testResults'][0];
            expect(result.status).toBe('passed');

            expect(result.steps).toHaveLength(1);
            expect(result.steps[0].action).toBe('Действие: Else branch');
            expect(result.steps[0].status).toBe('passed');

            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('успешно пройден'));
        });

        it('should ignore else steps when they are not part of an if', async () => {
            const testCase = createTestCase([
                {
                    type: 'else',
                    action: '',
                    steps: [
                        createActionStep('Действие: Else вне if')
                    ]
                }
            ]);

            await executor.executeTestCase(testCase);

            expect(mockPerformAction).not.toHaveBeenCalled();

            expect(executor['testResults']).toHaveLength(1);
            const result = executor['testResults'][0];
            expect(result.status).toBe('passed');
            expect(result.steps).toHaveLength(0);

            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('успешно пройден'));
        });

        it('should ignore endif steps', async () => {
            const testCase = createTestCase([
                createActionStep('Действие: Шаг до endif'),
                {
                    type: 'endif',
                    action: '',
                    parameters: []
                },
                createActionStep('Действие: Шаг после endif')
            ]);

            await executor.executeTestCase(testCase);

            expect(mockPerformAction).toHaveBeenCalledTimes(2);
            expect(mockPerformAction).toHaveBeenNthCalledWith(1, 'Действие: Шаг до endif', []);
            expect(mockPerformAction).toHaveBeenNthCalledWith(2, 'Действие: Шаг после endif', []);

            expect(executor['testResults']).toHaveLength(1);
            const result = executor['testResults'][0];
            expect(result.status).toBe('passed');

            expect(result.steps).toHaveLength(2);
            expect(result.steps[0].action).toBe('Действие: Шаг до endif');
            expect(result.steps[0].status).toBe('passed');
            expect(result.steps[1].action).toBe('Действие: Шаг после endif');
            expect(result.steps[1].status).toBe('passed');

            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('успешно пройден'));
        });

        it('should ignore endloop steps', async () => {
            const testCase = createTestCase([
                createActionStep('Действие: Шаг до endloop'),
                {
                    type: 'endloop',
                    action: '',
                    parameters: []
                },
                createActionStep('Действие: Шаг после endloop')
            ]);

            await executor.executeTestCase(testCase);

            expect(mockPerformAction).toHaveBeenCalledTimes(2);
            expect(mockPerformAction).toHaveBeenNthCalledWith(1, 'Действие: Шаг до endloop', []);
            expect(mockPerformAction).toHaveBeenNthCalledWith(2, 'Действие: Шаг после endloop', []);

            expect(executor['testResults']).toHaveLength(1);
            const result = executor['testResults'][0];
            expect(result.status).toBe('passed');

            expect(result.steps).toHaveLength(2);
            expect(result.steps[0].action).toBe('Действие: Шаг до endloop');
            expect(result.steps[0].status).toBe('passed');
            expect(result.steps[1].action).toBe('Действие: Шаг после endloop');
            expect(result.steps[1].status).toBe('passed');

            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('успешно пройден'));
        });

        it('should handle loop structure', async () => {
            const testCase = createTestCase([ {
                type: 'loop',
                action: 'item в ["one","two"]',
                steps: [ createActionStep('Обработать элемент') ]
            } ]);

            await executor.executeTestCase(testCase);

            expect(mockPerformAction).toHaveBeenCalledTimes(2);
            expect(executor.variables['item']).toBe('two');
        });
    });

    describe('variable substitution', () => {
        it('should replace variables in parameters', async () => {
            executor.variables = { username: 'test' };
            const testCase = createTestCase([
                createActionStep('Действие: Войти как {username}', [ '{username}' ])
            ]);

            await executor.executeTestCase(testCase);

            expect(mockPerformAction).toHaveBeenCalledWith(
                'Действие: Войти как test',
                [ 'test' ]
            );
        });
    });

    describe('logging and reporting', () => {
        it('should report steps timings', async () => {
            const testCase = createTestCase([
                createActionStep('Шаг 1'),
                createActionStep('Шаг 2')
            ]);

            await executor.executeTestCase(testCase);

            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('Время выполнения сценария')
            );
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('Длительность (мс)')
            );
        });
    });

    describe('condition evaluation', () => {
        it('should evaluate page title condition', async () => {
            executor.variables.pageTitle = 'Welcome Page';
            const result = await executor['evaluateCondition']('заголовок страницы содержит Welcome');
            expect(result).toBe(true);
        });

        it('should evaluate page title condition', async () => {
            executor.variables.pageTitle = 'Welcome Page';
            const result = await executor['evaluateCondition']('page title contains Welcome');
            expect(result).toBe(true);
        });

        it('should return true for non-page title conditions', async () => {
            const condition = 'другие условия';

            const result = await executor['evaluateCondition'](condition);
            expect(result).toBe(true);
        });
    });

    describe('loop processing', () => {
        it('should parse loop expression correctly', async () => {
            const items = await executor['getLoopItems']('item в ["a","b"]');
            expect(items).toEqual([ 'a', 'b' ]);
        });

        it('should throw an error for invalid loop expressions', async () => {
            const invalidLoopExpression = 'invalid expression';

            await expect(executor['getLoopItems'](invalidLoopExpression))
                .rejects
                .toThrow(`Неверное выражение цикла: ${invalidLoopExpression}`);
        });
    });
});
