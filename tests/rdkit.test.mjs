import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import initialiseRDKit from '@rdkit/rdkit';
import { canonicalSmiles, gradeAnswer } from '../site/practice.mjs';

const engine = await initialiseRDKit();

test('grades structure, syntax, and both kinds of stereochemistry', () => {
  for (const [submitted, expected, result] of [
    [' OCC ', 'CCO', 'correct'],
    ['[H]OCC', 'CCO', 'correct'],
    ['C1=CC=CC=C1', 'c1ccccc1', 'correct'],
    ['COC', 'CCO', 'incorrect'],
    ['C1CC', 'CCO', 'invalid'],
    ['C(C)(C)(C)(C)C', 'CCO', 'invalid'],
    ['CCO ethanol', 'CCO', 'invalid'],
    ['  ', 'CCO', 'empty'],
    ['N[C@H](C(=O)O)C', 'C[C@H](N)C(=O)O', 'correct'],
    ['C[C@@H](N)C(=O)O', 'C[C@H](N)C(=O)O', 'incorrect'],
    ['CC(N)C(=O)O', 'C[C@H](N)C(=O)O', 'incorrect'],
    ['C\\C=C\\O', 'C/C=C/O', 'correct'],
    ['C/C=C\\O', 'C/C=C/O', 'incorrect'],
    ['CC=CO', 'C/C=C/O', 'incorrect'],
  ]) {
    assert.equal(gradeAnswer(engine, submitted, expected), result, `${submitted} vs ${expected}`);
  }
});

test('all built answers and distractors are chemically distinct within a question', async () => {
  const bank = JSON.parse(await readFile(new URL('../dist/data/questions.json', import.meta.url)));
  for (const questions of Object.values(bank)) {
    for (const question of questions) {
      const candidates = [question.smiles, ...question.distractors].map((item) => canonicalSmiles(engine, item));
      assert.equal(candidates.length, 7);
      assert.ok(candidates.every(Boolean), question.id);
      assert.equal(new Set(candidates).size, 7, question.id);
      const data = await readFile(new URL(`../dist/data/${question.image}`, import.meta.url));
      assert.equal(data.subarray(1, 4).toString(), 'PNG', question.id);
    }
  }
});
