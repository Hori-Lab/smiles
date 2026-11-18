"""Build the practice question bank from the supplied teaching catalogue."""

import csv
from collections import defaultdict, deque
from dataclasses import dataclass
from hashlib import sha256
from itertools import combinations
import json
from pathlib import Path

from rdkit import Chem
from rdkit.Chem import rdDepictor, rdMolDescriptors
from rdkit.Chem.Draw import rdMolDraw2D

ROOT = Path(__file__).resolve().parents[1]
LEVELS = ("beginner", "intermediate", "advanced")
QUESTIONS_PER_LEVEL = 100
DISTRACTOR_COUNT = 6


@dataclass
class Candidate:
    source: str
    smiles: str
    mol: Chem.Mol
    stereo: bool

    @property
    def formula(self):
        return rdMolDescriptors.CalcMolFormula(self.mol)


def split_fragments(mol):
    bonds = [bond.GetIdx() for bond in mol.GetBonds()
             if bond.GetBondType() == Chem.BondType.SINGLE and not bond.IsInRing()]
    for count in (1, 2):
        for cut in combinations(bonds, count):
            fragments = Chem.FragmentOnBonds(mol, cut, addDummies=False)
            yield from Chem.GetMolFrags(fragments, asMols=True)


def substitute_ring_hydrogen(mol):
    for atom in mol.GetAtoms():
        if atom.GetAtomicNum() == 6 and atom.GetIsAromatic() and atom.GetTotalNumHs() == 1:
            edited = Chem.RWMol(mol)
            methyl = edited.AddAtom(Chem.Atom(6))
            edited.AddBond(atom.GetIdx(), methyl, Chem.BondType.SINGLE)
            yield edited.GetMol()


def derivatives(mol, source_smiles):
    yield from split_fragments(mol)
    yield from substitute_ring_hydrogen(mol)
    # These hydroxyethyl ethers have a two-carbon linker suitable for E/Z exercises.
    if source_smiles.startswith("OCCO"):
        for linker in ("O/C=C/O", "O/C=C\\O"):
            yield Chem.MolFromSmiles(linker + source_smiles[4:])


def describe(mol):
    heavy = mol.GetNumHeavyAtoms()
    rings = rdMolDescriptors.CalcNumRings(mol)
    smiles = Chem.MolToSmiles(mol, isomericSmiles=True)
    stereo = any(mark in smiles for mark in "@/\\")
    if heavy < 3 or heavy > 30 or any(
        atom.GetFormalCharge() or atom.GetNumRadicalElectrons() for atom in mol.GetAtoms()
    ):
        return None
    if heavy <= 8 and rings <= 1 and not stereo:
        return "beginner", smiles, stereo
    if heavy <= 15 and rings <= 2 and not stereo:
        return "intermediate", smiles, stereo
    return "advanced", smiles, stereo


def load_sources():
    with (ROOT / "data" / "compounds.csv").open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    sources = []
    for row in rows:
        mol = Chem.MolFromSmiles(row["smiles"])
        if mol is None:
            raise ValueError(f"Invalid source SMILES for {row['id']}")
        sources.append((row["id"], row["smiles"], mol))
    return sources


def question_candidates(sources):
    # Exclude the original connectivity even if a candidate differs only in stereo.
    originals = {Chem.MolToSmiles(mol, isomericSmiles=False) for _, _, mol in sources}
    by_level = {level: {} for level in LEVELS}
    for source, source_smiles, original in sources:
        for mol in derivatives(original, source_smiles):
            Chem.SanitizeMol(mol)
            Chem.AssignStereochemistry(mol, cleanIt=True, force=True)
            result = describe(mol)
            if result is None or Chem.MolToSmiles(mol, isomericSmiles=False) in originals:
                continue
            level, smiles, stereo = result
            by_level[level].setdefault(smiles, Candidate(source, smiles, mol, stereo))
    return by_level


def choose_questions(candidates):
    by_source = defaultdict(deque)
    for candidate in sorted(candidates.values(), key=lambda item: item.smiles):
        by_source[candidate.source].append(candidate)
    # Make sure E/Z derivatives survive the cap and spread the other slots across seeds.
    chosen = [item for item in candidates.values() if "/" in item.smiles or "\\" in item.smiles]
    included = {item.smiles for item in chosen}
    while by_source and len(chosen) < QUESTIONS_PER_LEVEL:
        for source, queue in list(by_source.items()):
            item = queue.popleft()
            if item.smiles not in included:
                chosen.append(item)
            if not queue:
                del by_source[source]
            if len(chosen) == QUESTIONS_PER_LEVEL:
                break
    return chosen[:QUESTIONS_PER_LEVEL]


def draw(candidate, path):
    mol = Chem.MolFromSmiles(candidate.smiles)
    rdDepictor.Compute2DCoords(mol)
    drawer = rdMolDraw2D.MolDraw2DCairo(680, 420)
    options = drawer.drawOptions()
    options.padding = 0.09
    options.bondLineWidth = 2.4
    options.includeMetadata = False
    options.useBWAtomPalette()
    options.setBackgroundColour((1.0, 1.0, 1.0))
    rdMolDraw2D.PrepareAndDrawMolecule(drawer, mol)
    drawer.FinishDrawing()
    path.write_bytes(drawer.GetDrawingText())


def build():
    sources = load_sources()
    candidates = question_candidates(sources)
    output = ROOT / "data" / "processed"
    images = output / "structures"
    images.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for level, pool in candidates.items():
        questions = choose_questions(pool)
        if len(questions) < QUESTIONS_PER_LEVEL:
            raise ValueError(
                f"{level} needs {QUESTIONS_PER_LEVEL} questions, but only "
                f"{len(questions)} eligible derivatives were found"
            )
        manifest[level] = []
        for question in questions:
            formula = question.formula
            heavy_atoms = question.mol.GetNumHeavyAtoms()
            alternatives = sorted(
                (item for item in questions if item.smiles != question.smiles),
                key=lambda item: (item.formula != formula,
                                  abs(item.mol.GetNumHeavyAtoms() - heavy_atoms), item.smiles),
            )[:DISTRACTOR_COUNT]
            if len(alternatives) != DISTRACTOR_COUNT:
                raise ValueError(f"Too few distractors for {question.smiles}")
            identifier = sha256(question.smiles.encode()).hexdigest()[:16]
            filename = f"{identifier}.png"
            draw(question, images / filename)
            manifest[level].append({
                "id": identifier,
                "image": f"structures/{filename}",
                "smiles": question.smiles,
                "stereo": question.stereo,
                "distractors": [item.smiles for item in alternatives],
            })
        print(f"{level}: {len(questions)} questions from {len({q.source for q in questions})} catalogue entries")
    (output / "questions.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    build()
