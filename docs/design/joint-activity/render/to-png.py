"""Convert out/<name>.rgba (+ .json size) to a 3x nearest-neighbour PNG: python3 to-png.py split-islet kyoto ..."""
import json, sys
from PIL import Image
for name in sys.argv[1:]:
    m = json.load(open(f"out/{name}.json"))
    im = Image.frombytes("RGBA", (m["w"], m["h"]), open(f"out/{name}.rgba", "rb").read())
    im.resize((m["w"] * 3, m["h"] * 3), Image.NEAREST).save(f"out/{name}.png")
