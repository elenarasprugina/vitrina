# Метки бота Host по печатям (её таблица, 21.10.2026)

Бот Host — имя в панели: «Настройки» → контакты → Host (сейчас `thirteenmirrors_host_bot`).
Кнопка ведёт на `https://t.me/<бот>?start=<метка>`; бот видит, с какой кнопки пришёл человек. О человеке витрина ничего не передаёт.

**Ставится само** (сделано 21.10): карточка маршрута узнаёт печать по **названию маршрута** в библиотеке (ё/е и регистр не важны)
и, если у кнопки «Метка Host» пустая, подставляет:
- форматы «Наблюдение» / «Путешествие» / «Погружение» (кнопка вида «Написать») → `<печать>_observation` / `_journey` / `_immersion`;
- «Задать вопрос» на заглушке «скоро» → `<печать>_question`.

Своя метка в поле «Метка Host» главнее. Формат с действием «Открыть страницу» метку не получает — он ведёт на страницу.
В панели пустое поле показывает серым, какая метка поставится. Код — `HOST_SEALS` / `hostAuto` в `assets/vitrina.js` (панель берёт `M13.hostAuto`).
Новой кнопки «Вопрос» на полном обороте нет — её решение 21.10: не нужна.

| Печать / маршрут | Наблюдение | Путешествие | Погружение | Вопрос |
|---|---|---|---|---|
| Красный Дракон | red_dragon_observation | red_dragon_journey | red_dragon_immersion | red_dragon_question |
| Белый Ветер | white_wind_observation | white_wind_journey | white_wind_immersion | white_wind_question |
| Синяя Ночь | blue_night_observation | blue_night_journey | blue_night_immersion | blue_night_question |
| Жёлтое Семя | yellow_seed_observation | yellow_seed_journey | yellow_seed_immersion | yellow_seed_question |
| Красный Змей | red_serpent_observation | red_serpent_journey | red_serpent_immersion | red_serpent_question |
| Белый Соединитель Миров | white_worldbridger_observation | white_worldbridger_journey | white_worldbridger_immersion | white_worldbridger_question |
| Синяя Рука | blue_hand_observation | blue_hand_journey | blue_hand_immersion | blue_hand_question |
| Жёлтая Звезда | yellow_star_observation | yellow_star_journey | yellow_star_immersion | yellow_star_question |
| Красная Луна | red_moon_observation | red_moon_journey | red_moon_immersion | red_moon_question |
| Белая Собака | white_dog_observation | white_dog_journey | white_dog_immersion | white_dog_question |
| Синяя Обезьяна | blue_monkey_observation | blue_monkey_journey | blue_monkey_immersion | blue_monkey_question |
| Жёлтый Человек | yellow_human_observation | yellow_human_journey | yellow_human_immersion | yellow_human_question |
| Красный Небесный Странник | red_skywalker_observation | red_skywalker_journey | red_skywalker_immersion | red_skywalker_question |
| Белый Волшебник | white_wizard_observation | white_wizard_journey | white_wizard_immersion | white_wizard_question |
| Синий Орёл | blue_eagle_observation | blue_eagle_journey | blue_eagle_immersion | blue_eagle_question |
| Жёлтый Воин | yellow_warrior_observation | yellow_warrior_journey | yellow_warrior_immersion | yellow_warrior_question |
| Красная Земля | red_earth_observation | red_earth_journey | red_earth_immersion | red_earth_question |
| Белое Зеркало | white_mirror_observation | white_mirror_journey | white_mirror_immersion | white_mirror_question |
| Синяя Буря | blue_storm_observation | blue_storm_journey | blue_storm_immersion | blue_storm_question |
| Жёлтое Солнце | yellow_sun_observation | yellow_sun_journey | yellow_sun_immersion | yellow_sun_question |
