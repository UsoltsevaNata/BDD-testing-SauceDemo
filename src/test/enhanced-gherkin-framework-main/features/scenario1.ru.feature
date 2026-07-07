Тест: Авторизация разных пользователей
Открыть страницу "https://www.saucedemo.com"
Для каждого случая в ["locked_out_user;Epic sadface","standard_user;Products"]
Ввести имя пользователя {значение}
Ввести пароль "secret_sauce"
Нажать на кнопку входа
Если {ожидание} равно "Products"
Должен увидеть заголовок "Products"
Иначе
Должен увидеть ошибку "Epic sadface: Sorry, this user has been locked out."
КонецЕсли
КонецЦикла
