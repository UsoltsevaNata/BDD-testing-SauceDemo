// Generated with ❤ by Concordia
// source: C:/IdeaProjects/Test-Automation-for-Swag-Labs-main/BDD_with_selenium/concordia/features/scenario1.testcase
//
// THIS IS A GENERATED FILE - MODIFICATIONS CAN BE LOST !

const assert = require("assert").strict;

Feature("Unknown feature");

Scenario("Unknown scenario | standard_user_login - 1", async ({I}) => {
    I.amOnPage("https://www.saucedemo.com"); // (13,3)
    I.fillField('#user-name', "standard_user"); // (14,3)
    I.fillField('#password', "secret_sauce"); // (15,5)
    I.click("Login"); // (16,5)
    I.see("Products"); // (17,3)
});

