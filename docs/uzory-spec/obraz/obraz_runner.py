"""
Сборка результата ассоциативного опросника «Образ» из ответов.
Без внешних зависимостей, ничего не хранит.

answers — словарь «id шага → id варианта»; для вариантов со своим текстом
передаётся {"id": "own", "text": "..."}.
Пропущенный шаг просто отсутствует в словаре (или значение None).
"""
import json
import zlib
from pathlib import Path

CONTENT_PATH = Path(__file__).with_name("obraz_svet_v_okne.json")


def load_content(path: Path = CONTENT_PATH) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _pick(answers: dict, key: str):
    """Возвращает (id, text) ответа или (None, None), если шаг пропущен."""
    v = answers.get(key)
    if v is None:
        return None, None
    if isinstance(v, dict):
        return v.get("id"), (v.get("text") or "").strip() or None
    return v, None


def build_result(answers: dict, content: dict) -> dict:
    ans, places = content["answers"], content["places"]
    lines = []

    # 1. первое ощущение
    first, _ = _pick(answers, "first")
    if first:
        lines.append(ans["first"][first])

    # 2. место → деталь → уточнение (деталь и уточнение возможны только после места)
    place, _ = _pick(answers, "place")
    detail, _ = _pick(answers, "detail")
    deep, _ = _pick(answers, "deep")
    closing = content["generic_closing_question"]

    if place == "outside":
        lines.append(ans["place"]["outside"])
        closing = content["outside_closing_question"]
    elif place in places:
        p = places[place]
        lines.append(p["text"])
        closing = p["closing_question"]
        if detail in p["details"]:
            d = p["details"][detail]
            lines.append(d["text"])
            if deep in d["deep"]:
                lines.append(d["deep"][deep]["text"])

    # 3. тело
    body, _ = _pick(answers, "body")
    if body:
        lines.append(ans["body"][body])

    # 4. что добавить
    add, add_text = _pick(answers, "add")
    if add == "own":
        if add_text:
            lines.append(ans["add"]["own"].format(text=add_text))
    elif add:
        lines.append(ans["add"][add])

    # 5. связь с жизнью
    life, _ = _pick(answers, "life")
    if life:
        lines.append(ans["life"][life])

    # 6. название: сначала слова человека, потом название карты
    name, name_text = _pick(answers, "name")
    r = content["reveal"]
    if name == "own" and name_text:
        lines.append(ans["name"]["chosen"].format(name=name_text))
        reveal = r["text_if_other"]
    elif name in ("n1", "n2", "n3"):
        label = next(o["label"] for o in content["steps"] if o["id"] == "name"
                     for o in o["options"] if o["id"] == name)
        lines.append(ans["name"]["chosen"].format(name=label))
        reveal = r["text_if_match"] if name == "n1" else r["text_if_other"]
    else:
        reveal = r["text_if_skipped"]

    # 7. поддерживающая строка — выбирается стабильно по набору ответов
    seed = json.dumps(answers, sort_keys=True, ensure_ascii=False).encode("utf-8")
    support = content["support_lines"][zlib.crc32(seed) % len(content["support_lines"])]

    # 8. рефлексия — для записи; человеку показываем только подтверждение
    reflection = answers.get("reflect")
    reflection = reflection.strip() if isinstance(reflection, str) and reflection.strip() else None

    return {
        "title": content["title"],
        "lines": lines,
        "reflection": reflection,
        "reflection_ack": content["reflection_ack"] if reflection else None,
        "reveal": reveal,
        "card_name": r["card_name"],
        "key": r["key"],
        "support": support,
        "closing_question": closing,
        "footer": content["footer"],
        "actions": content["actions"],
    }


def to_text(res: dict) -> str:
    out = [res["title"], ""] + res["lines"] + ["", res["reveal"], res["key"], "",
                                               res["support"], ""]
    if res["reflection_ack"]:
        out += [res["reflection_ack"], ""]
    out += ["Вопрос с собой:", res["closing_question"], "", res["footer"]]
    return "\n".join(out)


if __name__ == "__main__":
    demo = {
        "first": "warm",
        "place": "dom",
        "detail": "okno",
        "deep": "svet_vnutri",
        "body": "warm_chest",
        "add": "light",
        "life": "close",
        "name": "n2",
    }
    print(to_text(build_result(demo, load_content())))
