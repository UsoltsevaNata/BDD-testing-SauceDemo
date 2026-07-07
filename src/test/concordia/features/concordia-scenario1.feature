#language: en

Feature: User Authorization

  UI Element: usernameField
  - id is "#user-name"

  UI Element: passwordField
  - id is "#password"

  UI Element: loginButton
  - id is "#login-button"

  Scenario: Login with different users
  Variant: combined_login
    Given I am on the page "https://www.saucedemo.com"
    When I fill {usernameField} with "locked_out_user"
    And I fill {passwordField} with "secret_sauce"
    And I click on {loginButton}
    Then I see "Epic sadface: Sorry, this user has been locked out."
    And I fill {usernameField} with "standard_user"
    And I fill {passwordField} with "secret_sauce"
    And I click on {loginButton}
    Then I see "Products"