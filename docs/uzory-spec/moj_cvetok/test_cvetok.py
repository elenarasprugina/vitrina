import itertools

import cvetok_runner as r

C = r.load_content()
H = r.load_help()
FLOWERS = {f["id"]: f for f in C["flowers"]}

FORBIDDEN = ["вам нужно", "вам стоит", "стоит вам", "вы должны", "попробуйте", "сделайте",
             "необходимо", "обязаны", "научитесь", "помните, что", "чтобы стать"]

BASE = {"viewpoint": "inside", "pick_mode": "choose", "flower": "romashka", "place": "sun",
        "care": "self", "lamps": {"light": "enough"}, "says": "fine", "reflect": "слова"}


def shown_texts(node, out=None):
    out = [] if out is None else out
    if isinstance(node, dict):
        for k, v in node.items():
            if k in ("voice_rules", "image", "random_note", "doNotConclude", "status_note"):
                continue
            shown_texts(v, out)
    elif isinstance(node, list):
        for x in node:
            shown_texts(x, out)
    elif isinstance(node, str):
        out.append(node)
    return out


def test_twelve_flowers_with_texts():
    assert len(C["flowers"]) == 12
    assert len({f["id"] for f in C["flowers"]}) == 12
    for f in C["flowers"]:
        assert f["nom"] and f["nom_cap"] and f["text"] and f["image_brief"]
        assert f["nom_cap"].lower() == f["nom"]


def test_step_options_match_answer_texts():
    steps = {s["id"]: s for s in C["steps"]}
    assert {o["id"] for o in steps["place"]["options"]} == set(C["answers"]["place"])
    assert {o["id"] for o in steps["care"]["options"]} == set(C["answers"]["care"])
    assert {o["id"] for o in steps["says"]["options"]} == set(C["answers"]["says"])
    lamp_rows = {x["id"] for x in steps["lamps"]["rows"]}
    lm = C["answers"]["lamps"]
    assert lamp_rows == set(lm["few"]) == set(lm["many"]) == set(lm["enough_labels"])
    assert {o["id"] for o in steps["lamps"]["options"]} == {"enough", "few", "many", "unknown"}


def test_all_flower_place_care_combinations():
    n = 0
    for fid, place, care in itertools.product(FLOWERS, C["answers"]["place"], C["answers"]["care"]):
        res = r.build_result({"flower": fid, "place": place, "care": care}, C, H)
        txt = r.to_text(res)
        assert "{" not in txt and "}" not in txt
        assert FLOWERS[fid]["text"] in res["lines"]
        assert FLOWERS[fid]["nom_cap"] in res["title"]
        n += 1
    assert n == 12 * 7 * 5


def test_all_lamp_combinations():
    rows = list(C["answers"]["lamps"]["few"])
    for combo in itertools.product(["enough", "few", "many", "unknown", None], repeat=5):
        lamps = {k: v for k, v in zip(rows, combo) if v}
        res = r.build_result({"flower": "pion", "lamps": lamps}, C, H)
        txt = r.to_text(res)
        assert "{" not in txt and "}" not in txt
        has_issue = any(v in ("few", "many") for v in lamps.values())
        assert (C["answers"]["lamps"]["weather_note"] in res["lines"]) == has_issue
        if len(lamps) == 5 and all(v == "enough" for v in lamps.values()):
            assert C["answers"]["lamps"]["all_enough"] in res["lines"]


def test_enough_line_grammar():
    res = r.build_result({"lamps": {"light": "enough", "water": "enough", "space": "enough"}}, C)
    assert "Цветку хватает: света, воды и места." in res["lines"]
    res = r.build_result({"lamps": {"soil": "enough"}}, C)
    assert "Цветку хватает: опоры." in res["lines"]


def test_skips_never_break():
    steps = ["viewpoint", "pick_mode", "flower", "place", "care", "lamps", "says", "reflect"]
    full = dict(BASE, lamps={"light": "few", "water": "many"})
    for mask in itertools.product([True, False], repeat=len(steps)):
        a = {s: full[s] for s, keep in zip(steps, mask) if keep}
        res = r.build_result(a, C, H)
        txt = r.to_text(res)
        assert "{" not in txt and "}" not in txt
        assert res["closing_question"] and res["footer"] and res["help"]
        if "flower" not in a:
            assert res["title"] == C["reveal"]["title_if_skipped"]
            assert res["reveal"] == C["reveal"]["text_if_skipped"]
            assert not any("Другого такого нет" in l for l in res["lines"])


def test_empty_answers():
    res = r.build_result({}, C, H)
    assert res["lines"] == [] and res["reflection"] is None and res["reflection_ack"] is None


def test_own_flower_and_own_words():
    res = r.build_result({"flower": {"id": "own", "text": "Колокольчик"},
                          "says": {"id": "own", "text": "я здесь"}}, C, H)
    assert "Колокольчик" in res["title"]
    assert any("Колокольчик" in l for l in res["lines"])
    assert any("я здесь" in l for l in res["lines"])
    assert res["flower"] == "Колокольчик"
    # пустой собственный текст: цветок «свой» без названия считается пропущенным
    res2 = r.build_result({"flower": {"id": "own", "text": "  "}}, C, H)
    assert res2["title"] == C["reveal"]["title_if_skipped"]
    # фигурные скобки в тексте человека не ломают сборку
    res3 = r.build_result({"flower": {"id": "own", "text": "{x}"},
                           "says": {"id": "own", "text": "{y} {0}"}}, C, H)
    assert "{x}" in res3["title"] and any("{y} {0}" in l for l in res3["lines"])


def test_reflection_saved_not_echoed():
    res = r.build_result({"reflect": "  мои слова  "}, C, H)
    assert res["reflection"] == "мои слова"
    assert res["reflection_ack"] == C["reflection_ack"]
    assert not any("мои слова" in l for l in res["lines"])
    assert r.build_result({"reflect": "   "}, C, H)["reflection"] is None


def test_viewpoint_changes_only_closing_question():
    a = dict(BASE)
    inside = r.build_result(dict(a, viewpoint="inside"), C, H)
    outside = r.build_result(dict(a, viewpoint="outside"), C, H)
    assert inside["lines"] == outside["lines"]
    assert inside["closing_question"] != outside["closing_question"]
    assert r.build_result(dict(a, viewpoint="bogus"), C, H)["viewpoint"] == "inside"


def test_help_block_always_present_and_flagged():
    res = r.build_result({}, C, H)
    assert res["help"]["contacts"] and res["help"]["abroad_line"]
    assert "ПРОВЕРКА" in res["help"]["status"]
    assert "112" in r.to_text(res)


def test_voice_rules_and_lengths():
    for t in shown_texts({k: v for k, v in C.items()}):
        low = t.lower()
        for w in FORBIDDEN:
            assert w not in low, (w, t)
        assert "  " not in t and t == t.strip(), t
        assert t.count("«") == t.count("»"), t
    for f in C["flowers"]:
        assert len(f["text"]) <= 130, f["text"]
    for group in ("place", "care", "says"):
        for k, t in C["answers"][group].items():
            assert len(t) <= 160, (group, k, t)


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok", name)
