Feature: User authorization

  Scenario Outline: Login with different users
    Given I open the web application at "https://www.saucedemo.com"
    When I enter "<username>" into the "username" field
    And I enter "<password>" into the "password" field
    And I press the "login-button" on the form
    Then I should see "<expectation>"
    Examples:
      | username       | password     | expectation                                         |
      | standard_user  | secret_sauce | Products                                            |
      | locked_out_user| secret_sauce | Epic sadface: Sorry, this user has been locked out. |