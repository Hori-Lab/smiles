"""Check that the processed bank contains only eligible derivatives and usable images."""

import csv
import json
from pathlib import Path

from rdkit import Chem
from rdkit.Chem import rdDepictor
from rdkit.Chem.Draw import rdMolDraw2D

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "processed"
with (ROOT / "data" / "compounds.csv").open(encoding="utf-8-sig", newline="") as handle:
    originals = {
        Chem.MolToSmiles(Chem.MolFromSmiles(row["smiles"]), isomericSmiles=False)
        for row in csv.DictReader(handle)
    }

bank = json.loads((OUTPUT / "questions.json").read_text(encoding="utf-8"))
assert set(bank) == {"beginner", "intermediate", "advanced"}
all_questions = set()
for level, questions in bank.items():
    assert len(questions) == 100, level
    answers = {question["smiles"] for question in questions}
    for question in questions:
        answer = question["smiles"]
        assert answer not in all_questions, question
        all_questions.add(answer)
        mol = Chem.MolFromSmiles(answer)
        assert mol is not None and Chem.MolToSmiles(mol) == answer, question
        assert Chem.MolToSmiles(mol, isomericSmiles=False) not in originals, question
        assert question["stereo"] == any(mark in answer for mark in "@/\\"), question
        options = set(question["distractors"])
        assert len(options) == 6 and options <= answers - {answer}, question
        assert (OUTPUT / question["image"]).read_bytes().startswith(b"\x89PNG\r\n\x1a\n"), question
        if "@" in answer:
            rdDepictor.Compute2DCoords(mol)
            drawn = rdMolDraw2D.PrepareMolForDrawing(mol)
            directions = {Chem.BondDir.BEGINWEDGE, Chem.BondDir.BEGINDASH}
            assert any(bond.GetBondDir() in directions for bond in drawn.GetBonds()), question

stereo_answers = [q["smiles"] for q in bank["advanced"] if q["stereo"]]
assert any("@" in s for s in stereo_answers)
assert any("/" in s for s in stereo_answers)
assert any("\\" in s for s in stereo_answers)
print(f"Verified {len(all_questions)} questions, their distractors and PNGs.")
