"""
Сборка результата «Моего цветка» из ответов. Без внешних зависимостей, ничего не хранит.

answers — словарь «id шага → ответ».
  простые шаги:   "place": "sun"
  свой текст:     "flower": {"id": "own", "text": "Колокольчик"}
  матрица:        "lamps": {"light": "enough", "water": "few", ...}
  рефлексия:      "reflect": "любой текст"
Пропущенный шаг просто отсутствует (или None).
"""
import json
import zlib
from pathlib import Path

HERE = Path(__file__).parent
CONTENT_PATH = HERE / "moj_cvetok.json"
# Файл контактов лежит либо рядом (все файлы в одной папке), либо в соседней папке obshchee
_HELP_NEXT = HERE / "kontakty_pomoshchi.json"
_HELP_SIBLING = HERE.parent / "obshchee" / "kontakty_pomoshchi.json"
HELP_PATH = _HELP_NEXT if _HELP_NEXT.exists() else _HELP_SIBLING


def load_content(path: Path = CONTENT_PATH) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def load_help(path: Path = HELP_PATH):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None


def _pick(answers: dict, key: str):
    v = answers.get(key)
    if v is None:
        return None, None
    if isinstance(v, dict):
        return v.get("id"), (v.get("text") or "").strip() or None
    return v, None


def _join(parts):
    if len(parts) <= 1:
        return "".join(parts)
    return ", ".join(parts[:-1]) + " и " + parts[-1]


def build_result(answers: dict, content: dict, help_content=None) -> dict:
    a = content["answers"]
    flowers = {f["id"]: f for f in content["flowers"]}
    lines = []
    title = content["reveal"]["title_if_skipped"]
    reveal = content["reveal"]["text_if_skipped"]

    viewpoint, _ = _pick(answers, "viewpoint")
    viewpoint = viewpoint if viewpoint in ("inside", "outside") else "inside"
    pick_mode, _ = _pick(answers, "pick_mode")

    # цветок
    fid, ftext = _pick(answers, "flower")
    flower_label = None
    if fid in flowers:
        f = flowers[fid]
        title = a["listed_flower"]["title"].format(nom_cap=f["nom_cap"])
        lines.append(f["text"])
        reveal = content["reveal"]["text"]
        flower_label = f["nom"]
    elif fid == "own" and ftext:
        title = a["own_flower"]["title"].format(text=ftext)
        lines.append(a["own_flower"]["text"].format(text=ftext))
        reveal = content["reveal"]["text"]
        flower_label = ftext

    # место и забота
    place, _ = _pick(answers, "place")
    if place in a["place"]:
        lines.append(a["place"][place])
    care, _ = _pick(answers, "care")
    if care in a["care"]:
        lines.append(a["care"][care])

    # лампочки
    lamps = answers.get("lamps") or {}
    lm = a["lamps"]
    enough = [lm["enough_labels"][k] for k in lm["enough_labels"] if lamps.get(k) == "enough"]
    few_many = [(k, "few") for k in lm["few"] if lamps.get(k) == "few"] + \
               [(k, "many") for k in lm["many"] if lamps.get(k) == "many"]
    if len(enough) == len(lm["enough_labels"]):
        lines.append(lm["all_enough"])
    elif enough:
        lines.append(lm["enough_template"].format(list=_join(enough)))
    for k, kind in few_many:
        lines.append(lm[kind][k])
    if few_many:
        lines.append(lm["weather_note"])

    # слова цветка
    says, says_text = _pick(answers, "says")
    if says == "own":
        if says_text:
            lines.append(a["says"]["own"].format(text=says_text))
    elif says in a["says"]:
        lines.append(a["says"][says])

    # единственность — только если цветок выбран
    if fid in flowers:
        lines.append(a["listed_flower"]["unique"].format(nom=flowers[fid]["nom"]))
    elif fid == "own" and ftext:
        lines.append(a["own_flower"]["unique"].format(text=ftext))

    # рефлексия — для записи; человеку показываем только подтверждение
    reflection = answers.get("reflect")
    reflection = reflection.strip() if isinstance(reflection, str) and reflection.strip() else None

    seed = json.dumps(answers, sort_keys=True, ensure_ascii=False).encode("utf-8")
    support = content["support_lines"][zlib.crc32(seed) % len(content["support_lines"])]

    return {
        "title": title,
        "lines": lines,
        "reveal": reveal,
        "support": support,
        "closing_question": content["closing_question"][viewpoint],
        "reflection": reflection,
        "reflection_ack": content["reflection_ack"] if reflection else None,
        "pick_mode": pick_mode,
        "viewpoint": viewpoint,
        "flower": flower_label,
        "help": help_content if content.get("show_help") == "always" else None,
        "footer": content["footer"],
        "actions": content["actions"],
    }


def to_text(res: dict) -> str:
    out = [res["title"], ""] + res["lines"] + ["", res["reveal"], "", res["support"], ""]
    if res["reflection_ack"]:
        out += [res["reflection_ack"], ""]
    out += ["Вопрос с собой:", res["closing_question"], "", res["footer"]]
    if res["help"]:
        h = res["help"]
        out += ["", h["title"], h["text"]]
        out += [f"{c['phone']} — {c['label']} ({c['note']})" for c in h["contacts"]]
        out += [h["abroad_line"]]
    return "\n".join(out)


if __name__ == "__main__":
    demo = {
        "viewpoint": "inside", "pick_mode": "choose", "flower": "pion", "place": "fence",
        "care": "self",
        "lamps": {"light": "enough", "water": "enough", "soil": "few", "warmth": "few",
                  "space": "enough"},
        "says": "quiet", "reflect": "Хочется просто помолчать.",
    }
    print(to_text(build_result(demo, load_content(), load_help())))
