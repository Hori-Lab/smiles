import { choicesFor, gradeAnswer, questionDeck } from './practice.mjs';

const byId = (id) => document.getElementById(id);
const practice = byId('practice');
const loadState = byId('load-state');
const loadMessage = byId('load-message');
const retryQuestions = byId('retry-questions');
const structure = byId('structure-image');
const imageError = byId('image-error');
const heading = byId('structure-heading');
const choices = byId('choices');
const form = byId('answer-form');
const input = byId('smiles-input');
const check = byId('check-answer');
const engineStatus = byId('engine-status');
const retryEngine = byId('retry-engine');
const next = byId('next-question');
const feedback = byId('feedback-card');
const resultMessage = byId('result-message');
const answerExample = byId('answer-example');
const catalogueUrl = new URL('./data/questions.json', import.meta.url);
const rdkitUrl = new URL('./vendor/RDKit_minimal.js', import.meta.url);
const difficulties = ['beginner', 'intermediate', 'advanced'];
let mode = 'choice';
let difficulty = 'beginner';
let decks;
let current;
let answered = false;
let engine;
let enginePromise;

async function loadQuestions() {
  loadState.hidden = false;
  retryQuestions.hidden = true;
  loadMessage.textContent = 'Loading questions…';
  try {
    const response = await fetch(catalogueUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const questions = await response.json();
    decks = Object.fromEntries(difficulties.map((level) => {
      if (!questions[level]?.length) throw new Error(`Missing ${level} questions`);
      return [level, questionDeck(questions[level])];
    }));
    showQuestion();
    practice.hidden = false;
    loadState.hidden = true;
  } catch (error) {
    console.error(error);
    loadMessage.textContent = 'The questions could not be loaded.';
    retryQuestions.hidden = false;
  }
}

async function initialiseEngine() {
  if (!window.initRDKitModule) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = rdkitUrl.href;
      script.onload = resolve;
      script.onerror = () => {
        script.remove();
        reject(new Error('RDKit script could not load.'));
      };
      document.head.append(script);
    });
  }
  return window.initRDKitModule({ locateFile: (name) => new URL(name, rdkitUrl).href });
}

function loadEngine() {
  if (engine || enginePromise) return;
  retryEngine.hidden = true;
  engineStatus.textContent = 'Loading the answer checker…';
  enginePromise = initialiseEngine()
    .then((module) => {
      engine = module;
      engineStatus.textContent = '';
      check.disabled = answered;
    })
    .catch((error) => {
      console.error(error);
      engineStatus.textContent = 'The answer checker could not be loaded.';
      retryEngine.hidden = false;
    })
    .finally(() => { enginePromise = undefined; });
}

function clearFeedback() {
  feedback.hidden = true;
  answerExample.hidden = true;
  resultMessage.textContent = '';
  byId('correct-smiles').textContent = '';
  input.removeAttribute('aria-invalid');
}

function loadStructure() {
  imageError.hidden = true;
  structure.hidden = false;
  structure.src = new URL(current.image, catalogueUrl).href;
}

function showQuestion() {
  const { question, number, total } = decks[difficulty]();
  current = question;
  answered = false;
  next.hidden = true;
  clearFeedback();
  byId('progress').textContent = `Question ${number} of ${total}`;
  byId('stereo-hint').hidden = !question.stereo;
  loadStructure();

  const multipleChoice = mode === 'choice';
  byId('answer-heading').textContent = multipleChoice ? 'Choose the SMILES' : 'Write the SMILES';
  byId('answer-instructions').textContent = multipleChoice
    ? 'Select the SMILES that matches the structure.'
    : 'Enter a SMILES for the structure shown.';
  choices.hidden = !multipleChoice;
  form.hidden = multipleChoice;
  input.disabled = false;
  input.value = '';
  check.disabled = !engine;
  choices.replaceChildren();
  if (multipleChoice) {
    const options = choicesFor(question);
    const letters = 'ABCD';
    const correctIndex = options.indexOf(question.smiles);
    options.forEach((smiles, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'choice';
      const letter = document.createElement('span');
      letter.className = 'choice-index';
      letter.textContent = letters[index];
      const value = document.createElement('code');
      value.textContent = smiles;
      button.append(letter, value);
      button.addEventListener('click', () => {
        const correct = index === correctIndex;
        button.dataset.selected = correct ? 'correct' : 'incorrect';
        if (!correct) choices.children[correctIndex].classList.add('correct-answer');
        finishAnswer(correct ? 'Correct.' : `Incorrect. The correct answer is ${letters[correctIndex]}.`, correct);
      });
      choices.append(button);
    });
  } else {
    loadEngine();
  }
}

function showFeedback(message, result, reveal = false) {
  feedback.dataset.result = result;
  resultMessage.textContent = message;
  if (reveal) byId('correct-smiles').textContent = current.smiles;
  answerExample.hidden = !reveal;
  feedback.hidden = false;
}

function finishAnswer(message, correct, reveal = false) {
  answered = true;
  for (const button of choices.children) button.disabled = true;
  input.disabled = true;
  check.disabled = true;
  showFeedback(message, correct ? 'correct' : 'incorrect', reveal);
  next.hidden = false;
  next.focus();
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (answered || !engine) return;
  clearFeedback();
  let result;
  try {
    result = gradeAnswer(engine, input.value, current.smiles);
  } catch (error) {
    console.error(error);
    showFeedback('The answer could not be checked. Try again.', 'input');
    return;
  }
  if (result === 'empty') {
    input.setAttribute('aria-invalid', 'true');
    showFeedback('Enter a SMILES to check your answer.', 'input');
    input.focus();
  } else if (result === 'invalid') {
    finishAnswer('Invalid SMILES. Check the syntax.', false, true);
  } else if (result === 'incorrect') {
    finishAnswer('Incorrect. This SMILES describes a different structure.', false, true);
  } else {
    finishAnswer('Correct.', true);
  }
});

practice.addEventListener('change', (event) => {
  const { name, value } = event.target;
  if (name === 'mode') mode = value;
  else if (name === 'difficulty') difficulty = value;
  else return;
  showQuestion();
});

structure.addEventListener('error', () => {
  structure.hidden = true;
  imageError.hidden = false;
});
byId('retry-image').addEventListener('click', loadStructure);
retryQuestions.addEventListener('click', loadQuestions);
retryEngine.addEventListener('click', loadEngine);
input.addEventListener('input', () => {
  if (!answered && !feedback.hidden) clearFeedback();
});
next.addEventListener('click', () => {
  showQuestion();
  heading.focus();
});
loadQuestions();
