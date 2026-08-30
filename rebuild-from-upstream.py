"""
Regenerates src/packs/feats/werecreature-dedication.json from a fresh
checkout of the upstream foundryvtt/pf2e repo, re-applying the
Weredragon patch. Use this if the pf2e system updates its version of
Werecreature Dedication (e.g. new errata, new automation) and you want
to pick up those changes without manually re-diffing the file.

Usage:
    git clone --depth 1 --filter=blob:none --sparse \
        https://github.com/foundryvtt/pf2e.git /tmp/pf2e-repo
    cd /tmp/pf2e-repo
    git sparse-checkout set --no-cone \
        packs/pf2e/feats/archetype/werecreature
    cd -
    python3 rebuild-from-upstream.py /tmp/pf2e-repo

Then run `node build.mjs` as usual to recompile the compendium.
"""
import json
import random
import string
import sys
from pathlib import Path


def gen_id(n=16):
    chars = string.ascii_letters + string.digits
    return "".join(random.choice(chars) for _ in range(n))


def patch(upstream_repo: Path):
    src = upstream_repo / "packs/pf2e/feats/archetype/werecreature/werecreature-dedication.json"
    with open(src) as f:
        item = json.load(f)

    item["_id"] = gen_id()
    item.pop("folder", None)

    if "Homebrew:" not in item["system"]["description"]["value"]:
        item["system"]["description"]["value"] = (
            "<p><em>Homebrew: this is the official Werecreature Dedication feat "
            "with a homebrew \"Weredragon\" type added to the table. Drag this "
            "version onto your sheet instead of the core system's copy.</em></p>"
            + item["system"]["description"]["value"]
        )

    rules = item["system"]["rules"]

    choice_set = next(r for r in rules if r.get("key") == "ChoiceSet")
    if not any(c["value"] == "weredragon" for c in choice_set["choices"]):
        choice_set["choices"].append({"label": "Weredragon (Homebrew)", "value": "weredragon"})

    desc_alt = next(
        r for r in rules if r.get("key") == "ItemAlteration" and r.get("property") == "description"
    )
    if not any("weredragon" in json.dumps(v.get("predicate", [])) for v in desc_alt["value"]):
        desc_alt["value"].append(
            {
                "predicate": ["werecreature:weredragon"],
                "text": (
                    "Your hybrid and animal shapes are covered in small, hard scales, "
                    "with vestigial wings that let you glide short distances. You gain "
                    "a land Speed of 25 feet and a fly Speed of 10 feet, plus jaws and "
                    "claw unarmed attacks. As with a werebat, you must begin and end "
                    "each of your turns on a solid surface while flying or you fall."
                ),
            }
        )

    rules.append(
        {
            "key": "BaseSpeed",
            "predicate": ["werecreature:weredragon", {"or": ["change-shape:hybrid", "change-shape:animal"]}],
            "selector": "land",
            "value": 25,
        }
    )
    rules.append(
        {
            "key": "BaseSpeed",
            "predicate": ["werecreature:weredragon", {"or": ["change-shape:hybrid", "change-shape:animal"]}],
            "selector": "fly",
            "value": 10,
        }
    )
    rules.append(
        {
            "category": "unarmed",
            "damage": {"base": {"damageType": "piercing", "dice": 1, "die": "d8"}},
            "group": "brawling",
            "img": "systems/pf2e/icons/unarmed-attacks/jaws.webp",
            "key": "Strike",
            "label": "Jaws",
            "predicate": ["werecreature:weredragon", {"or": ["change-shape:hybrid", "change-shape:animal"]}],
            "slug": "jaws",
            "traits": ["unarmed"],
        }
    )
    rules.append(
        {
            "category": "unarmed",
            "damage": {"base": {"damageType": "slashing", "dice": 1, "die": "d6"}},
            "group": "brawling",
            "img": "systems/pf2e/icons/unarmed-attacks/claw.webp",
            "key": "Strike",
            "label": "Claw",
            "predicate": ["werecreature:weredragon", {"or": ["change-shape:hybrid", "change-shape:animal"]}],
            "slug": "claw",
            "traits": ["agile", "unarmed"],
        }
    )

    # Make the feat self-sufficient for the "Humanoid" option in the change-shape
    # dropdown, rather than relying on it merging in from the separately granted
    # shared Change Shape action item.
    roll_option = next(
        r for r in rules if r.get("key") == "RollOption" and r.get("option") == "change-shape"
    )
    if not any(s.get("value") == "humanoid" for s in roll_option["suboptions"]):
        roll_option["suboptions"].insert(
            0,
            {
                "label": "PF2E.NPCAbility.ChangeShape.Form.Humanoid.Humanoid",
                "predicate": [{"not": "non-humanoid-change-shape"}],
                "value": "humanoid",
            },
        )

    item["name"] = "Werecreature Dedication"
    item["_key"] = f"!items!{item['_id']}"
    item.setdefault("sort", 0)
    item.setdefault("ownership", {"default": 0})
    item.setdefault("flags", {})
    item.setdefault("effects", [])
    item["type"] = "feat"

    out_path = Path(__file__).parent / "src/packs/feats/werecreature-dedication.json"
    with open(out_path, "w") as f:
        json.dump(item, f, indent=2, ensure_ascii=False)
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python3 rebuild-from-upstream.py /path/to/pf2e-repo-checkout")
        sys.exit(1)
    patch(Path(sys.argv[1]))
