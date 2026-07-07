// Generated with ❤ by Concordia
// source: C:/IdeaProjects/Test-Automation-for-Swag-Labs-main/BDD_with_selenium/concordia/features/scenario2.testcase
//
// THIS IS A GENERATED FILE - MODIFICATIONS CAN BE LOST !

const assert = require("assert").strict;

Feature("Unknown feature");

Scenario("Unknown scenario | check_two_items - 1", async ({I}) => {
    I.amOnPage("https://www.saucedemo.com"); // (13,3)
    I.fillField('#user-name', "standard_user"); // (14,3)
    I.fillField('#password', "secret_sauce"); // (15,5)
    I.click("Login"); // (16,5)
    I.click('#add-to-cart-sauce-labs-backpack'); // (17,3)
    I.click('#add-to-cart-sauce-labs-bike-light'); // (18,5)
    I.click('.shopping_cart_link'); // (19,5)
    I.see("Sauce Labs Backpack"); // (20,3)
    I.see("Sauce Labs Bike Light"); // (21,5)
});

