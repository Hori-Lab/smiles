export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export function questionDeck(questions, random = Math.random) {
  let deck = [];
  let previous;
  return () => {
    if (!deck.length) {
      deck = shuffle(questions, random);
      if (deck.length > 1 && deck.at(-1) === previous) {
        const last = deck.length - 1;
        [deck[0], deck[last]] = [deck[last], deck[0]];
      }
    }
    const number = questions.length - deck.length + 1;
    previous = deck.pop();
    return { question: previous, number, total: questions.length };
  };
}

export function choicesFor(question, random = Math.random) {
  const distractors = shuffle(question.distractors, random).slice(0, 3);
  return shuffle([question.smiles, ...distractors], random);
}

export function canonicalSmiles(engine, input) {
  const trimmed = input.trim();
  if (!trimmed || /[\s|{}>]/u.test(trimmed)) return null;

  const molecule = engine.get_mol(trimmed);
  if (!molecule) return null;
  try {
    return molecule.is_valid() ? molecule.get_smiles() : null;
  } finally {
    molecule.delete();
  }
}

export function gradeAnswer(engine, input, expected) {
  if (!input.trim()) return 'empty';
  if (input.trim().length > 512) return 'invalid';
  const actual = canonicalSmiles(engine, input);
  if (!actual) return 'invalid';
  const answer = canonicalSmiles(engine, expected);
  if (!answer) throw new Error('The answer could not be read by RDKit.');
  return actual === answer ? 'correct' : 'incorrect';
}
