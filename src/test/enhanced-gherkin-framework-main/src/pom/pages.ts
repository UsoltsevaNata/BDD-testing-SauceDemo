import { Page } from 'playwright';
import { expect } from 'chai';

export class BasePage {
    constructor(protected page: Page) {
    }

    async open(url: string) {
        await this.page.goto(url);
    }

    async click(selector: string) {
        await this.page.click(selector);
    }

    async type(selector: string, text: string) {
        await this.page.fill(selector, text);
    }

    async getText(selector: string): Promise<string> {
        const txt = await this.page.textContent(selector);
        return (txt || '').trim();
    }

    async checkTextEquals(selector: string, expectedText: string) {
        const actualText = await this.getText(selector);
        expect(actualText).to.equal(expectedText);
    }

    async checkTextContains(selector: string, expectedText: string) {
        const actualText = await this.getText(selector);
        expect(actualText).to.include(expectedText);
    }
}

export class LoginPage extends BasePage {
    async login(username: string, password: string) {
        await this.type('#user-name', username);
        await this.type('#password', password);
    }

    async clickLoginButton() {
        await this.page.waitForSelector('#login-button', { state: 'visible' });
        await this.page.click('#login-button');
    }
}

export class InventoryPage extends BasePage {
    async checkOnProductsPage() {
        await this.checkTitle('Products');
    }

    async addToCart(productSelectorPart: string) {
        await this.click(`#add-to-cart-${ productSelectorPart }`);
    }

    async openCart() {
        await this.click('.shopping_cart_link');
    }

    async checkTitle(expectedTitle: string) {
        await this.checkTextEquals('.title', expectedTitle);
    }

    async getProductPrice(productName: string): Promise<string> {
        const priceSelector = `.inventory_item:has-text("${productName}") .inventory_item_price`;
        return await this.getText(priceSelector);
    }
}

export class CartPage extends BasePage {
    async checkItemInCart(itemName: string) {
        await this.checkTextEquals('.inventory_item_name', itemName);
    }

    async checkout() {
        await this.click('#checkout');
    }

    async checkItemsCount(expectedCount: number) {
        const items = await this.page.$$('.cart_item');
        expect(items.length).to.equal(expectedCount,
            `Ожидалось товаров: ${expectedCount}, а найдено: ${items.length}`);
    }
}

export class CheckoutPage extends BasePage {
    async fillInformation(firstName: string, lastName: string, postalCode: string) {
        await this.type('#first-name', firstName);
        await this.type('#last-name', lastName);
        await this.type('#postal-code', postalCode);
        await this.click('#continue');
    }

    async checkItem(itemName: string) {
        await this.checkTextEquals('.inventory_item_name', itemName);
    }

    async checkPriceInTotals(expectedSubstring: string) {
        await this.checkTextContains('.summary_subtotal_label', expectedSubstring);
    }

    async finishOrder() {
        await this.click('#finish');
    }

    async checkOrderFinished(message: string) {
        await this.checkTextEquals('.complete-header', message);
    }
}

export class MenuPage extends BasePage {
    async openMenu() {
        await this.click('#react-burger-menu-btn');
    }

    async logout() {
        await this.click('#logout_sidebar_link');
    }
}
