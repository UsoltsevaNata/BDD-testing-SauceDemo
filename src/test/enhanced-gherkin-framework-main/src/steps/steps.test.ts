import { getVariable, performAction, setVariable } from './steps';
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

describe('performAction', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        setVariable('username', undefined);
        setVariable('firstName', undefined);
        setVariable('lastName', undefined);
        setVariable('postalCode', undefined);
        setVariable('price', undefined);
    });

    // Тесты для русских действий
    describe('Russian Actions', () => {
        it('должен установить переменную username', async () => {
            await performAction('Ввести имя пользователя', [ 'test_user' ]);
            expect(getVariable('username')).toBe('test_user');
        });

        it('должен вызвать метод login', async () => {
            setVariable('username', 'test_user');
            loginPageMock.login.mockResolvedValueOnce(undefined);

            await performAction('Ввести пароль', [ 'password123' ]);

            expect(loginPageMock.login).toHaveBeenCalledWith('test_user', 'password123');
        });

        it('должен открыть страницу', async () => {
            await performAction('Открыть страницу', [ 'https://example.com' ]);
            expect(loginPageMock.open).toHaveBeenCalledWith('https://example.com');
        });

        it('должен нажать кнопку входа', async () => {
            await performAction('Нажать на кнопку входа', []);
            expect(loginPageMock.clickLoginButton).toHaveBeenCalled();
        });

        it('должен проверить заголовок страницы', async () => {
            await performAction('Должен увидеть заголовок', [ 'Магазин' ]);
            expect(inventoryPageMock.checkTitle).toHaveBeenCalledWith('Магазин');
        });

        it('должен добавить товар в корзину', async () => {
            await performAction('Добавить товар Телефон в корзину', [ 'Телефон' ]);
            expect(inventoryPageMock.addToCart).toHaveBeenCalledWith('телефон');
        });

        it('должен открыть корзину', async () => {
            await performAction('Открыть корзину', []);
            expect(inventoryPageMock.openCart).toHaveBeenCalled();
        });

        it('должен проверить товар в корзине', async () => {
            await performAction('Должен увидеть товар в корзине Телефон', [ 'Телефон' ]);
            expect(cartPageMock.checkItemInCart).toHaveBeenCalledWith('Телефон');
        });

        it('должен перейти к оформлению заказа', async () => {
            await performAction('Перейти к оформлению заказа', []);
            expect(cartPageMock.checkout).toHaveBeenCalled();
        });

        it('должен ввести имя, фамилию и индекс перед оформлением', async () => {
            setVariable('firstName', 'Иван');
            setVariable('lastName', 'Иванов');
            setVariable('postalCode', '123456');

            await performAction('Продолжить оформление', []);
            expect(checkoutPageMock.fillInformation).toHaveBeenCalledWith('Иван', 'Иванов', '123456');
        });

        it('должен завершить заказ', async () => {
            await performAction('Завершить заказ', []);
            expect(checkoutPageMock.finishOrder).toHaveBeenCalled();
        });

        it('должен выйти из системы', async () => {
            await performAction('Выйти из системы', []);
            expect(menuPageMock.logout).toHaveBeenCalled();
        });

        it('должен запомнить цену товара', async () => {
            inventoryPageMock.getProductPrice.mockResolvedValueOnce('1999 руб.');

            await performAction('Запомнить цену товара Телефон как price', [ 'Телефон', 'price' ]);
            expect(getVariable('price')).toBe('1999 руб.');
        });

        it('должен проверить количество товаров в корзине', async () => {
            await performAction('Должен увидеть количество товаров', [ '3' ]);
            expect(cartPageMock.checkItemsCount).toHaveBeenCalledWith(3);
        });

        it('должен проверить товар в итогах заказа', async () => {
            await performAction('Должен увидеть товар в заказе Телефон', [ 'Телефон' ]);
            expect(checkoutPageMock.checkItem).toHaveBeenCalledWith('Телефон');
        });

        it('должен проверить цену в итогах заказа', async () => {
            await performAction('Должен увидеть в итогах заказа 1999 руб.', [ '1999 руб.' ]);
            expect(checkoutPageMock.checkPriceInTotals).toHaveBeenCalledWith('1999 руб.');
        });

        it('должен проверить сообщение о завершении заказа', async () => {
            await performAction('Должен увидеть сообщение о завершении', [ 'Спасибо за покупку!' ]);
            expect(checkoutPageMock.checkOrderFinished).toHaveBeenCalledWith('Спасибо за покупку!');
        });

        it('должен открыть меню', async () => {
            await performAction('Открыть меню', []);
            expect(menuPageMock.openMenu).toHaveBeenCalled();
        });

        it('должен выбросить ошибку, если имя пользователя не было введено до ввода пароля', async () => {
            setVariable('username', undefined);

            await expect(performAction('Ввести пароль', [ 'password123' ])).rejects.toThrow('Имя пользователя не было введено до ввода пароля.');
        });

        it('должен выбросить ошибку, если не все данные покупателя были введены до продолжения оформления', async () => {
            setVariable('lastName', 'Иванов');
            setVariable('postalCode', '123456');
            await expect(performAction('Продолжить оформление', [])).rejects.toThrow('Не все данные покупателя были введены до продолжения оформления.');

            jest.clearAllMocks();

            setVariable('firstName', 'Иван');
            setVariable('postalCode', '123456');
            setVariable('lastName', undefined);
            await expect(performAction('Продолжить оформление', [])).rejects.toThrow('Не все данные покупателя были введены до продолжения оформления.');

            jest.clearAllMocks();

            setVariable('firstName', 'Иван');
            setVariable('lastName', 'Иванов');
            setVariable('postalCode', undefined);
            await expect(performAction('Продолжить оформление', [])).rejects.toThrow('Не все данные покупателя были введены до продолжения оформления.');

            jest.clearAllMocks();

            setVariable('firstName', undefined);
            setVariable('lastName', undefined);
            setVariable('postalCode', undefined);
            await expect(performAction('Продолжить оформление', [])).rejects.toThrow('Не все данные покупателя были введены до продолжения оформления.');
        });

        it('должен установить переменную firstName', async () => {
            await performAction('Ввести имя', ['Иван']);
            expect(getVariable('firstName')).toBe('Иван');
        });

        it('должен установить переменную lastName', async () => {
            await performAction('Ввести фамилию', ['Иванов']);
            expect(getVariable('lastName')).toBe('Иванов');
        });

        it('должен установить переменную postalCode', async () => {
            await performAction('Ввести почтовый индекс', ['123456']);
            expect(getVariable('postalCode')).toBe('123456');
        });

        it('должен выбросить ошибку при неизвестном действии', async () => {
            const unknownActions = [
                'Нажать на неизвестную кнопку',
                'Выполнить неизвестную операцию',
                'Перейти на неизвестную страницу',
                'Неизвестное действие'
            ];

            for (const action of unknownActions) {
                await expect(performAction(action, [])).rejects.toThrow(`Неизвестное действие: ${action}`);
            }
        });
    });

    // Тесты для английских действий
    describe('English Actions', () => {
        it('should set the username variable', async () => {
            await performAction('Enter username', [ 'test_user' ]);
            expect(getVariable('username')).toBe('test_user');
        });

        it('should call the login method', async () => {
            setVariable('username', 'test_user');
            loginPageMock.login.mockResolvedValueOnce(undefined);

            await performAction('Enter password', [ 'password123' ]);

            expect(loginPageMock.login).toHaveBeenCalledWith('test_user', 'password123');
        });

        it('should open the page', async () => {
            await performAction('Open page', [ 'https://example.com' ]);
            expect(loginPageMock.open).toHaveBeenCalledWith('https://example.com');
        });

        it('should click the login button', async () => {
            await performAction('Click login button', []);
            expect(loginPageMock.clickLoginButton).toHaveBeenCalled();
        });

        it('should verify the page title', async () => {
            await performAction('Should see title', [ 'Store' ]);
            expect(inventoryPageMock.checkTitle).toHaveBeenCalledWith('Store');
        });

        it('should add product to cart', async () => {
            await performAction('Add product Phone to cart', [ 'Phone' ]);
            expect(inventoryPageMock.addToCart).toHaveBeenCalledWith('phone');
        });

        it('should open the cart', async () => {
            await performAction('Open cart', []);
            expect(inventoryPageMock.openCart).toHaveBeenCalled();
        });

        it('should verify product in cart', async () => {
            await performAction('Should see product in cart Phone', [ 'Phone' ]);
            expect(cartPageMock.checkItemInCart).toHaveBeenCalledWith('Phone');
        });

        it('should proceed to checkout', async () => {
            await performAction('Proceed to checkout', []);
            expect(cartPageMock.checkout).toHaveBeenCalled();
        });

        it('should enter first name, last name, and postal code before checkout', async () => {
            setVariable('firstName', 'John');
            setVariable('lastName', 'Doe');
            setVariable('postalCode', '12345');

            await performAction('Continue checkout', []);
            expect(checkoutPageMock.fillInformation).toHaveBeenCalledWith('John', 'Doe', '12345');
        });

        it('should finish the order', async () => {
            await performAction('Finish order', []);
            expect(checkoutPageMock.finishOrder).toHaveBeenCalled();
        });

        it('should logout', async () => {
            await performAction('Logout', []);
            expect(menuPageMock.logout).toHaveBeenCalled();
        });

        it('should remember the product price', async () => {
            inventoryPageMock.getProductPrice.mockResolvedValueOnce('1999 USD');

            await performAction('Remember product price Phone as price', [ 'Phone', 'price' ]);
            expect(getVariable('price')).toBe('1999 USD');
        });

        it('should verify the number of items in the cart', async () => {
            await performAction('Should see number of items', [ '3' ]);
            expect(cartPageMock.checkItemsCount).toHaveBeenCalledWith(3);
        });

        it('should verify product in order', async () => {
            await performAction('Should see product in order Phone', [ 'Phone' ]);
            expect(checkoutPageMock.checkItem).toHaveBeenCalledWith('Phone');
        });

        it('should verify price in order totals', async () => {
            await performAction('Should see in order totals 1999 USD', [ '1999 USD' ]);
            expect(checkoutPageMock.checkPriceInTotals).toHaveBeenCalledWith('1999 USD');
        });

        it('should verify the order completion message', async () => {
            await performAction('Should see order completion message', [ 'Thank you for your purchase!' ]);
            expect(checkoutPageMock.checkOrderFinished).toHaveBeenCalledWith('Thank you for your purchase!');
        });

        it('should open the menu', async () => {
            await performAction('Open menu', []);
            expect(menuPageMock.openMenu).toHaveBeenCalled();
        });

        it('should set the firstName variable', async () => {
            await performAction('Enter first name', ['John']);
            expect(getVariable('firstName')).toBe('John');
        });

        it('should set the lastName variable', async () => {
            await performAction('Enter last name', ['Doe']);
            expect(getVariable('lastName')).toBe('Doe');
        });

        it('should set the postalCode variable', async () => {
            await performAction('Enter postal code', ['12345']);
            expect(getVariable('postalCode')).toBe('12345');
        });
    });
});
