#language: en

Feature: Cart Price Check

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

  UI Element: cartLink
  - id is ".shopping_cart_link"

  Scenario: Authorized user checks total item price
  Variant: check_two_items
    Given I am on the page "https://www.saucedemo.com"
    When I see "Username"
    And I see "Password"
    And I fill {usernameField} with "standard_user"
    And I fill {passwordField} with "secret_sauce"
    And I click on button "Login"
    And I see "Sauce Labs Backpack"
    And I click {addToCartBackpack}
    And I see "Sauce Labs Bike Light"
    And I click {addToCartBikeLight}
    And I click {cartLink}
    Then I see "Sauce Labs Backpack"
    And I see "Sauce Labs Bike Light"