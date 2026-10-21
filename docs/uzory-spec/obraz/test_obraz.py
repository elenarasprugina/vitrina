import itertools
import re

import obraz_runner as o

C = o.load_content()
PLACES = C["places"]

# слова-указания, которых в текстах быть не должно (отрицания вроде «не нужно» допустимы)
FORBIDDEN = ["вам нужно", "вам стоит", "стоит вам", "вы должны", "попробуйте", "сделайте",
             "необходимо", "обязаны", "научитесь", "помните, что", "чтобы стать"]


def all_texts(node, out=None):
    out = [] if out is None else out
    if isinstance(node, dict):
        for k, v in node.items():
            if k in ("text", "closing_question", "label") or k.startswith("text_") or k == "key":
                if isinstance(v, str):
                    out.append(v)
            all_texts(v, out)
    elif isinstance(node, list):
        for x in node:
            all_texts(x, out)
    elif isinstance(node, str):
        out.append(node)
    return out


def test_structure_complete():
    assert set(PLACES) == {"dom", "tropinka", "derevo", "pole"}
    leaves = 0
    for p in PLACES.values():
        assert p["label"] and p["text"] and p["closing_question"]
        assert len(p["details"]) == 3
        for d in p["details"].values():
            assert d["label"] and d["text"]
            assert len(d["deep"]) == 2
            for x in d["deep"].values():
                assert x["label"] and x["text"]
                leaves += 1
    assert leaves == 24


def test_step_options_match_answer_texts():
    steps = {s["id"]: s for s in C["steps"]}
    for sid in ("first", "body", "life"):
        ids = {opt["id"] for opt in steps[sid]["options"]}
        assert ids == set(C["answers"][sid]), sid
    assert {opt["id"] for opt in steps["add"]["options"]} == set(C["answers"]["add"])
    assert {opt["id"] for opt in steps["place"]["options"]} == set(PLACES) | {"outside"}
    assert {opt["id"] for opt in steps["name"]["options"]} == {"n1", "n2", "n3", "own"}


def test_every_full_path_renders():
    n = 0
    for pid, p in PLACES.items():
        for did, d in p["details"].items():
            for xid in d["deep"]:
                res = o.build_result({"first": "quiet", "place": pid, "detail": did, "deep": xid,
                                      "body": "breath", "add": "own", "life": "alone",
                                      "name": "n1"} | {"add": {"id": "own", "text": "чай"}}, C)
                txt = o.to_text(res)
                assert "{" not in txt and "}" not in txt
                assert d["text"] in res["lines"] and d["deep"][xid]["text"] in res["lines"]
                assert res["closing_question"] == p["closing_question"]
                n += 1
    assert n == 24


def test_skips_never_break_and_never_show_orphans():
    steps = ["first", "place", "detail", "deep", "body", "add", "life", "name"]
    full = {"first": "sad", "place": "tropinka", "detail": "povorot", "deep": "kusty",
            "body": "heavy", "add": "someone", "life": "none", "name": "n3"}
    for mask in itertools.product([True, False], repeat=len(steps)):
        a = {s: full[s] for s, keep in zip(steps, mask) if keep}
        res = o.build_result(a, C)
        txt = o.to_text(res)
        assert "{" not in txt and "}" not in txt
        assert res["card_name"] == "Свет, который ждёт"
        assert res["closing_question"] and res["footer"]
        d = PLACES["tropinka"]["details"]["povorot"]
        if "place" not in a:
            # без места нельзя показывать ни деталь, ни уточнение
            assert d["text"] not in res["lines"]
            assert d["deep"]["kusty"]["text"] not in res["lines"]
            assert res["closing_question"] == C["generic_closing_question"]
        if "detail" not in a:
            assert d["deep"]["kusty"]["text"] not in res["lines"]


def test_empty_answers():
    res = o.build_result({}, C)
    assert res["lines"] == []
    assert res["reveal"] == C["reveal"]["text_if_skipped"]


def test_outside_and_own_text():
    res = o.build_result({"place": "outside", "name": {"id": "own", "text": "Мой вечер"},
                          "add": {"id": "own", "text": "кота"}}, C)
    assert any("со стороны" in l for l in res["lines"])
    assert any("Мой вечер" in l for l in res["lines"])
    assert any("кота" in l for l in res["lines"])
    assert res["reveal"] == C["reveal"]["text_if_other"]
    assert res["closing_question"] == C["outside_closing_question"]
    # пустой собственный текст не ломает сборку и ничего не выводит
    res2 = o.build_result({"name": {"id": "own", "text": "  "}, "add": {"id": "own"}}, C)
    assert res2["lines"] == []


def test_name_match_logic():
    assert o.build_result({"name": "n1"}, C)["reveal"] == C["reveal"]["text_if_match"]
    assert o.build_result({"name": "n2"}, C)["reveal"] == C["reveal"]["text_if_other"]


def test_deterministic_and_support_variety():
    a = {"first": "warm", "place": "dom"}
    assert o.build_result(a, C)["support"] == o.build_result(dict(a), C)["support"]
    seen = {o.build_result({"first": f, "place": p}, C)["support"]
            for f in ("warm", "quiet", "sad", "anxious", "curious", "unknown")
            for p in PLACES}
    assert len(seen) >= 3


def test_reflection_saved_not_echoed():
    res = o.build_result({"reflect": "  мои слова  "}, C)
    assert res["reflection"] == "мои слова"
    assert res["reflection_ack"] == C["reflection_ack"]
    assert not any("мои слова" in l for l in res["lines"])
    res2 = o.build_result({"reflect": "   "}, C)
    assert res2["reflection"] is None and res2["reflection_ack"] is None
    assert {s["id"] for s in C["steps"]} >= {"reflect"}


def test_voice_rules():
    shown = {k: v for k, v in C.items() if k != "voice_rules"}  # правила для редакторов — не показываются людям
    for t in all_texts(shown):
        low = t.lower()
        for w in FORBIDDEN:
            assert w not in low, (w, t)
    # длина строки результата — чтобы помещалась в сообщение бота
    for pid, p in PLACES.items():
        assert len(p["text"]) <= 160
        for d in p["details"].values():
            assert len(d["text"]) <= 170
            for x in d["deep"].values():
                assert len(x["text"]) <= 170, x["text"]


def test_no_double_spaces_or_stray_quotes():
    for t in all_texts(C):
        assert "  " not in t and not t.startswith(" ") and not t.endswith(" "), t
        assert t.count("«") == t.count("»"), t


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok", name)
