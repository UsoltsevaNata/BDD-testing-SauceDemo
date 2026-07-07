#language: en
Feature: Adding Multiple Items
  UI Element: usernameField
  - id is "#user-name"
  UI Element: passwordField
  - id is "#password"
  UI Element: loginButton
  - id is "#login-button"
  UI Element: addToCartBackpack
  - id is "#add-to-cart-sauce-labs-backpack"
  UI Element: addToCartBikeLight
  - id is "#add-to-cart-sauce-labs-bike-light"
  UI Element: addToCartBoltTShirt
  - id is "#add-to-cart-sauce-labs-bolt-t-shirt"
  UI Element: addToCartFleeceJacket
  - id is "#add-to-cart-sauce-labs-fleece-jacket"
  UI Element: addToCartOnesie
  - id is "#add-to-cart-sauce-labs-onesie"
  UI Element: cartLink
  - id is ".shopping_cart_link"
  Scenario: Add 5 different items to the cart
  Variant: add_five_items
    Given I am on the page "https://www.saucedemo.com"
    When I see "Username"
    And I see "Password"
    And  I fill {usernameField} with "standard_user"
    And I fill {passwordField} with "secret_sauce"
    And I click on button "Login"
    And I see "Sauce Labs Backpack"
    And  I click {addToCartBackpack}
    And  I see "Sauce Labs Bike Light"
    And I click {addToCartBikeLight}
    And  I see "Sauce Labs Bolt T-Shirt"
    And I click {addToCartBoltTShirt}
    And  I see "Sauce Labs Fleece Jacket"
    And I click {addToCartFleeceJacket}
    And  I see "Sauce Labs Onesie"
    And I click {addToCartOnesie}
    And I click {cartLink}
    Then I see "Sauce Labs Backpack"
    And  I see "Sauce Labs Bike Light"
    And  I see "Sauce Labs Bolt T-Shirt"
    And  I see "Sauce Labs Fleece Jacket"
    And  I see "Sauce Labs Onesie"

