Feature: Adding multiple items

  Scenario: Add 10 different items to the cart
    Given I open the web application at "https://www.saucedemo.com"
    And I see the login page with "username" and "password" fields
    When I enter "standard_user" into the "username" field
    And I enter "secret_sauce" into the "password" field
    And I press the "login-button" on the form
    Then I should be navigated to a new page
    And that page should display the title "Products"
    Given I am on the "Products" page

    When I locate the product "Sauce Labs Backpack"
    And I click on "Add to cart" for that product
    And I store the displayed price for "Sauce Labs Backpack" as "price1"

    When I locate the product "Sauce Labs Bike Light"
    And I click on "Add to cart" for that product
    And I store the displayed price for "Sauce Labs Bike Light" as "price2"

    When I locate the product "Sauce Labs Bolt T-Shirt"
    And I click on "Add to cart" for that product
    And I store the displayed price for "Sauce Labs Bolt T-Shirt" as "price3"

    When I locate the product "Sauce Labs Fleece Jacket"
    And I click on "Add to cart" for that product
    And I store the displayed price for "Sauce Labs Fleece Jacket" as "price4"

    When I locate the product "Sauce Labs Onesie"
    And I click on "Add to cart" for that product
    And I store the displayed price for "Sauce Labs Onesie" as "price5"

    Then I open the cart page
    And the cart should list "Sauce Labs Backpack", "Sauce Labs Bike Light", "Sauce Labs Bolt T-Shirt", "Sauce Labs Fleece Jacket", "Sauce Labs Onesie"
