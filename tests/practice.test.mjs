import assert from 'node:assert/strict';
import test from 'node:test';
import { choicesFor, questionDeck } from '../site/practice.mjs';

test('a difficulty deck visits each question once and avoids repeats at the boundary', () => {
  const next = questionDeck(['A', 'B', 'C'], () => 0);
  const first = Array.from({ length: 3 }, next);
  const second = Array.from({ length: 3 }, next);
  assert.deepEqual(first.map(({ question }) => question).sort(), ['A', 'B', 'C']);
  assert.deepEqual(second.map(({ question }) => question).sort(), ['A', 'B', 'C']);
  assert.deepEqual(first.map(({ number }) => number), [1, 2, 3]);
  assert.notEqual(first.at(-1).question, second[0].question);
});

test('four-choice questions include one answer and three distinct distractors', () => {
  const question = { smiles: 'COC', distractors: ['CCC', 'CCO', 'CCN', 'CCF', 'C=C', 'C#C'] };
  const choices = choicesFor(question, () => 0);
  assert.equal(choices.length, 4);
  assert.equal(new Set(choices).size, 4);
  assert.equal(choices.filter((item) => item === question.smiles).length, 1);
  assert.ok(choices.every((item) => item === question.smiles || question.distractors.includes(item)));
});
