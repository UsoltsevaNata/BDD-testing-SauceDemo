import { EnhancedGherkinParser, TestCase, TestStep } from './parser';
import * as fs from 'fs';

jest.mock('fs');

describe('EnhancedGherkinParser', () => {
    const parser = new EnhancedGherkinParser();
    const mockFs = fs.readFileSync as jest.Mock;

    beforeEach(() => {
        mockFs.mockClear();
    });

    const runParserTest = (content: string): TestCase[] => {
        mockFs.mockReturnValue(content);
        return parser.parseFeature('test.feature');
    };

    describe('Russian Inputs', () => {
        it('should parse simple action with parameters', () => {
            const testCases = runParserTest(`
                Тест: Simple Test
                Действие: Нажать кнопку "Submit"
                Проверить что заголовок равен "Welcome" за 5 секунд
            `);

            expect(testCases[0].steps).toHaveLength(2);
            expect(testCases[0].steps[0]).toEqual({
                type: 'action',
                action: 'Действие: Нажать кнопку {}',
                parameters: ['Submit']
            });
            expect(testCases[0].steps[1]).toEqual({
                type: 'action',
                action: 'Проверить что заголовок равен {} за {} секунд',
                parameters: ['Welcome', '5']
            });
        });

        it('should handle if-else-endif structure', () => {
            const testCases = runParserTest(`
                Тест: Condition Test
                Если пользователь авторизован
                    Действие: Проверить элемент "Dashboard"
                    Если экран mobile
                        Действие: Свернуть меню
                    Иначе
                        Действие: Развернуть меню
                    КонецЕсли
                Иначе
                    Действие: Нажать "Login"
                КонецЕсли
            `);

            const steps = testCases[0].steps;
            expect(steps[0].type).toBe('if');
            expect((steps[0] as TestStep).steps).toHaveLength(3);

            const nestedAction = (steps[0] as TestStep).steps![0];
            expect(nestedAction.type).toBe('action');
            expect(nestedAction.action).toContain('Проверить элемент');
            expect(nestedAction.parameters).toContain('Dashboard');

            const nestedIf = (steps[0] as TestStep).steps![1];
            expect(nestedIf.type).toBe('if');
            expect(nestedIf.steps).toHaveLength(1);
            expect(nestedIf.steps![0].action).toContain('Свернуть меню');

            const nestedElse = (steps[0] as TestStep).steps![2];
            expect(nestedElse.type).toBe('else');
            expect(nestedElse.steps).toHaveLength(1);
            expect(nestedElse.steps![0].action).toContain('Развернуть меню');

            expect(steps[1].type).toBe('else');
            expect(steps[1].steps).toHaveLength(1);
        });

        it('should handle loop structure', () => {
            const testCases = runParserTest(`
                Тест: Loop Test
                Для каждого item в списке
                    Действие: Обработать элемент "item"
                    Если элемент активен
                        Действие: Кликнуть элемент
                    КонецЕсли
                КонецЦикла
            `);

            const steps = testCases[0].steps;
            expect(steps[0].type).toBe('loop');
            expect(steps[0].steps).toHaveLength(2);
            expect(steps[0].steps![0].type).toBe('action');
            expect(steps[0].steps![1].type).toBe('if');
        });

        it('should parse multiple test cases', () => {
            const testCases = runParserTest(`
                Тест: First Test
                Действие: Шаг 1

                Тест: Second Test
                Действие: Шаг 2
            `);

            expect(testCases).toHaveLength(2);
            expect(testCases[0].name).toBe('First Test');
            expect(testCases[1].name).toBe('Second Test');
        });

        it('should ignore comments and empty lines', () => {
            const testCases = runParserTest(`
                # Это комментарий
                Тест: Comment Test
                
                Если условие
                    # Вложенный комментарий
                    Действие: Пропустить
                КонецЕсли
            `);

            expect(testCases[0].steps[0].type).toBe('if');
            expect(testCases[0].steps[0].steps).toHaveLength(1);
            expect(testCases[0].steps[0].steps![0].type).toBe('action');
        });

        it('should handle complex nested structures', () => {
            const testCases = runParserTest(`
                Тест: Complex Test
                Если уровень 1
                    Действие: Шаг 1
                    Если уровень 2
                        Для каждого элемента
                            Действие: Обработать
                        КонецЦикла
                    КонецЕсли
                    Действие: Шаг 2
                КонецЕсли
            `);

            const rootIf = testCases[0].steps[0];
            expect(rootIf.type).toBe('if');
            expect(rootIf.steps).toHaveLength(3);

            const nestedIf = rootIf.steps![1];
            expect(nestedIf.type).toBe('if');
            expect(nestedIf.steps).toHaveLength(1);

            const loop = nestedIf.steps![0];
            expect(loop.type).toBe('loop');
            expect(loop.steps).toHaveLength(1);
        });

        it('should handle multiple else branches', () => {
            const testCases = runParserTest(`
                Тест: Multi Else Test
                Если условие 1
                    Действие: Шаг 1
                Иначе если условие 2
                    Действие: Шаг 2
                Иначе
                    Действие: Шаг 3
                КонецЕсли
            `);

            const steps = testCases[0].steps;
            expect(steps[0].type).toBe('if');
            expect(steps[1].type).toBe('else');
            expect(steps[2].type).toBe('else');

            expect(steps[0].steps).toHaveLength(1);
            expect(steps[1].steps).toHaveLength(1);
            expect(steps[2].steps).toHaveLength(1);
        });

        it('should parse parameters correctly', () => {
            const testCases = runParserTest(`
                Тест: Params Test
                Действие: Ввести "Логин" в поле "Username" за 10 секунд
            `);

            const steps = testCases[0].steps[0];
            expect(steps.parameters).toEqual(['Логин', 'Username', '10']);
            expect(steps.action).toBe('Действие: Ввести {} в поле {} за {} секунд');
        });

        it('should handle mixed case keywords', () => {
            const testCases = runParserTest(`
                ТЕСТ: Case Insensitive Test
                ЕСЛИ условие
                    ДЕЙСТВИЕ: Тест
                КОНЕЦЕСЛИ
            `);

            expect(testCases[0].name).toBe('Case Insensitive Test');
            expect(testCases[0].steps[0].type).toBe('if');
        });
    });

    describe('English Inputs', () => {
        it('should parse simple action with parameters', () => {
            const testCases = runParserTest(`
                Test: Simple Test
                Action: Click the "Submit" button
                Verify that the title equals "Welcome" in 5 seconds
            `);

            expect(testCases[0].steps).toHaveLength(2);
            expect(testCases[0].steps[0]).toEqual({
                type: 'action',
                action: 'Action: Click the {} button',
                parameters: ['Submit']
            });
            expect(testCases[0].steps[1]).toEqual({
                type: 'action',
                action: 'Verify that the title equals {} in {} seconds',
                parameters: ['Welcome', '5']
            });
        });

        it('should handle if-else-endif structure', () => {
            const testCases = runParserTest(`
                Test: Condition Test
                If the user is authenticated
                    Action: Check the element "Dashboard"
                    If the screen is mobile
                        Action: Collapse the menu
                    Else
                        Action: Expand the menu
                    EndIf
                Else
                    Action: Click "Login"
                EndIf
            `);

            const steps = testCases[0].steps;
            expect(steps[0].type).toBe('if');
            expect((steps[0] as TestStep).steps).toHaveLength(3);

            const nestedAction = (steps[0] as TestStep).steps![0];
            expect(nestedAction.type).toBe('action');
            expect(nestedAction.action).toContain('Check the element');
            expect(nestedAction.parameters).toContain('Dashboard');

            const nestedIf = (steps[0] as TestStep).steps![1];
            expect(nestedIf.type).toBe('if');
            expect(nestedIf.steps).toHaveLength(1);
            expect(nestedIf.steps![0].action).toContain('Collapse the menu');

            const nestedElse = (steps[0] as TestStep).steps![2];
            expect(nestedElse.type).toBe('else');
            expect(nestedElse.steps).toHaveLength(1);
            expect(nestedElse.steps![0].action).toContain('Expand the menu');

            expect(steps[1].type).toBe('else');
            expect(steps[1].steps).toHaveLength(1);
        });

        it('should handle loop structure', () => {
            const testCases = runParserTest(`
                Test: Loop Test
                For each item in the list
                    Action: Process the "item" element
                    If the element is active
                        Action: Click the element
                    EndIf
                EndLoop
            `);

            const steps = testCases[0].steps;
            expect(steps[0].type).toBe('loop');
            expect(steps[0].steps).toHaveLength(2);
            expect(steps[0].steps![0].type).toBe('action');
            expect(steps[0].steps![1].type).toBe('if');
        });

        it('should parse multiple test cases', () => {
            const testCases = runParserTest(`
                Test: First Test
                Action: Step 1

                Test: Second Test
                Action: Step 2
            `);

            expect(testCases).toHaveLength(2);
            expect(testCases[0].name).toBe('First Test');
            expect(testCases[1].name).toBe('Second Test');
        });

        it('should ignore comments and empty lines', () => {
            const testCases = runParserTest(`
                # This is a comment
                Test: Comment Test
                
                If condition
                    # Nested comment
                    Action: Skip
                EndIf
            `);

            expect(testCases[0].steps[0].type).toBe('if');
            expect(testCases[0].steps[0].steps).toHaveLength(1);
            expect(testCases[0].steps[0].steps![0].type).toBe('action');
        });

        it('should handle complex nested structures', () => {
            const testCases = runParserTest(`
                Test: Complex Test
                If level 1
                    Action: Step 1
                    If level 2
                        For each element
                            Action: Process
                        EndLoop
                    EndIf
                    Action: Step 2
                EndIf
            `);

            const rootIf = testCases[0].steps[0];
            expect(rootIf.type).toBe('if');
            expect(rootIf.steps).toHaveLength(3);

            const nestedIf = rootIf.steps![1];
            expect(nestedIf.type).toBe('if');
            expect(nestedIf.steps).toHaveLength(1);

            const loop = nestedIf.steps![0];
            expect(loop.type).toBe('loop');
            expect(loop.steps).toHaveLength(1);
        });

        it('should handle multiple else branches', () => {
            const testCases = runParserTest(`
                Test: Multi Else Test
                If condition 1
                    Action: Step 1
                Else If condition 2
                    Action: Step 2
                Else
                    Action: Step 3
                EndIf
            `);

            const steps = testCases[0].steps;
            expect(steps[0].type).toBe('if');
            expect(steps[1].type).toBe('else');
            expect(steps[2].type).toBe('else');

            expect(steps[0].steps).toHaveLength(1);
            expect(steps[1].steps).toHaveLength(1);
            expect(steps[2].steps).toHaveLength(1);
        });

        it('should parse parameters correctly', () => {
            const testCases = runParserTest(`
                Test: Params Test
                Action: Enter "Login" into the "Username" field in 10 seconds
            `);

            const steps = testCases[0].steps[0];
            expect(steps.parameters).toEqual(['Login', 'Username', '10']);
            expect(steps.action).toBe('Action: Enter {} into the {} field in {} seconds');
        });

        it('should handle mixed case keywords', () => {
            const testCases = runParserTest(`
                TEST: Case Insensitive Test
                IF condition
                    ACTION: Test
                ENDIF
            `);

            expect(testCases[0].name).toBe('Case Insensitive Test');
            expect(testCases[0].steps[0].type).toBe('if');
        });
    });
});
