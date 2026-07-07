const {Given, When, Then} = require('@cucumber/cucumber');
const {chromium} = require('@playwright/test');
const { getPage } = require('../support/hooks');

Given('I open the web application at {string}', async function (url) {
    const page = getPage();
    await page.goto(url, { waitUntil: 'networkidle' });
});


Given('I see the login page with {string} and {string} fields', async function (usernameField, passwordField) {
    const page = getPage();

    const usernameSelector = `[data-test="${usernameField}"]`;
    const passwordSelector = `[data-test="${passwordField}"]`;

    const usernameElement = await page.$(usernameSelector);
    const passwordElement = await page.$(passwordSelector);

    if (!usernameElement) {
        throw new Error(`Поле "${usernameField}" не найдено: ${usernameSelector}`);
    }
    if (!passwordElement) {
        throw new Error(`Поле "${passwordField}" не найдено: ${passwordSelector}`);
    }
});

When('I enter {string} into the {string} field', async function (text, fieldName) {
    const page = getPage();

    const selector = `[data-test="${fieldName}"]`;
    const field = await page.$(selector);
    if (!field) {
        throw new Error(`Поле "${fieldName}" не найдено: ${selector}`);
    }
    await field.fill(text);
});

When('I press the {string} on the form', async function (buttonName) {
    const page = getPage();

    const selector = `[data-test="${buttonName}"]`;
    const button = await page.$(selector);
    if (!button) {
        throw new Error(`Кнопка "${buttonName}" не найдена: ${selector}`);
    }
    await button.click();
});

Then('I should be navigated to a new page', async function () {
    const page = getPage();
    const currentUrl = page.url();

    if (currentUrl === 'https://www.saucedemo.com/') {
        throw new Error(`URL не изменился, остался: ${currentUrl}`);
    }
});

Then('that page should display the title {string}', async function (expectedTitle) {
    const page = getPage();

    const titleSelector = '.title';
    await page.waitForSelector(titleSelector);
    const actualTitle = await page.textContent(titleSelector);

    if (actualTitle.trim() !== expectedTitle) {
        throw new Error(`Ожидали заголовок "${expectedTitle}", получили "${actualTitle}"`);
    }
});

Then('there should be a visible logout or menu button indicating successful login', async function () {
    const page = getPage();

    const menuButton = await page.$('[data-test="react-burger-menu-btn"]');
    if (!menuButton) {
        throw new Error('Кнопка меню/логаута не найдена');
    }

    const isVisible = await menuButton.isVisible();
    if (!isVisible) {
        throw new Error('Кнопка меню существует, но не видима');
    }
});

Given('I am on the {string} page', async function (pageName) {
    const page = getPage();
    const actualTitle = await page.textContent('.title');
    if (actualTitle.trim() !== pageName) {
        throw new Error(`Ожидали, что страница - "${pageName}", а заголовок: "${actualTitle}"`);
    }
});

When('I locate the product {string}', async function (productName) {
    const page = getPage();

    const itemNameLocator = `.inventory_item_name:text-is("${productName}")`;

    await page.waitForSelector(itemNameLocator);

    this.currentProductNameLocator = itemNameLocator;
});

When('I click on {string} for that product', async function (buttonText) {
    const page = getPage();

    const productContainer = await page.locator(this.currentProductNameLocator).locator('xpath=ancestor::div[@class="inventory_item"]');
    const addButton = productContainer.locator('button', {hasText: buttonText});
    await addButton.click();
});

When('I store the displayed price for {string} as {string}', async function (productName, alias) {
    const page = getPage();
    if (!this.productPrices) {
        this.productPrices = {};
    }

    const productContainer = page.locator(`.inventory_item_name:text-is("${productName}")`)
        .locator('xpath=ancestor::div[@class="inventory_item"]');

    const priceText = await productContainer.locator('.inventory_item_price').textContent();
    this.productPrices[alias] = parseFloat(priceText.replace('$', ''));
});

Then('I open the cart page', async function () {
    const page = getPage();

    await page.click('[data-test="shopping-cart-link"]');

    await page.waitForURL(/cart\.html/);
});

Then('the cart should list {string} and {string}', async function (productName1, productName2) {
    const page = getPage();

    const cartItems = await page.$$eval('.inventory_item_name', els => els.map(e => e.textContent.trim()));

    if (!cartItems.includes(productName1)) {
        throw new Error(`В корзине нет продукта "${productName1}". Список: ${cartItems.join(', ')}`);
    }
    if (!cartItems.includes(productName2)) {
        throw new Error(`В корзине нет продукта "${productName2}". Список: ${cartItems.join(', ')}`);
    }
});

Then(
    'the cart should list {string}, {string}, {string}, {string}, {string}',
    async function (
        p1, p2, p3, p4, p5
    ) {
        const page = getPage();
        const cartItems = await page.$$eval(
            '.inventory_item_name',
            els => els.map(e => e.textContent.trim())
        );

        const products = [p1, p2, p3, p4, p5];
        for (const product of products) {
            if (!cartItems.includes(product)) {
                throw new Error(`В корзине нет продукта "${product}". Список: ${cartItems.join(', ')}`);
            }
        }
    }
);

Then('I should see {string}', async function (expectation) {
    const page = getPage();

    const titleElement = await page.$('.title');
    if (titleElement) {
        const actualTitle = await page.textContent('.title');
        if (actualTitle && actualTitle.trim() === expectation) {
            return;
        }
    }
    const errorElement = await page.$('[data-test="error"]');
    if (errorElement) {
        const actualError = await page.textContent('[data-test="error"]');
        if (actualError && actualError.trim() === expectation) {
            return;
        }
    }
    const bodyText = await page.textContent('body');
    if (bodyText && bodyText.includes(expectation)) {
        return;
    }
    throw new Error(`Ожидалось "${expectation}", но не найдено на странице.`);
});