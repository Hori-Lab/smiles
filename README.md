# Miles of SMILES

Practice writing SMILES from chemical structures at <https://hori-lab.github.io/smiles>.

Choose a difficulty and answer in **Multiple choice** or **Free text**. Select **OK** after each answer to continue.

## Run locally

Use Conda or Mamba to create a dedicated environment.

```sh
conda env create -f environment.yml
conda activate smiles-practice
npm ci --ignore-scripts
npm run build
npm test
npm run preview
```

Open `http://127.0.0.1:8000/` in a browser. The build writes generated question data and PNGs to `data/processed/` and assembles the website in `dist/`. The preview serves only `dist/`.

## Question bank

`data/compounds.csv` contains some example compounds. At build time, RDKit derives connected, hydrogen-capped fragments by cutting one or two non-ring single bonds, adds a methyl group at eligible aromatic positions, and makes E/Z variants from selected hydroxyethyl ethers. The build excludes structures with the same connectivity as any catalogue entry. It deduplicates candidates by canonical isomeric SMILES and selects 100 questions for each difficulty.

- **Beginner** contains structures with 3–8 heavy atoms, up to one ring and no specified stereochemistry.
- **Intermediate** covers the remaining structures with up to 15 heavy atoms, up to two rings and no specified stereochemistry.
- **Advanced** includes larger structures, more complex ring systems or specified stereochemistry.

The browser shuffles each difficulty's question bank and draws three distractors per multiple-choice question. The answer checker loads RDKit.js on the first visit to Free text. It compares the canonical isomeric SMILES of the submitted and expected structures on the student's device. Equivalent atom orderings and aromatic representations are accepted. A different tautomer, protonation state or stereochemical specification is graded as a different structure.

