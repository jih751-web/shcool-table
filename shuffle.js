
import { fortunes } from './src/data/fortunes.js'; // Note: might need adjustment for local run
import fs from 'fs';

const shuffle = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const shuffledFortunes = {
  money: shuffle([...fortunes.money]),
  love: shuffle([...fortunes.love]),
  health: shuffle([...fortunes.health]),
  advice: shuffle([...fortunes.advice])
};

const content = `export const fortunes: Record<string, string[]> = ${JSON.stringify(shuffledFortunes, null, 2)};\n`;
fs.writeFileSync('./src/data/fortunes.ts', content);
console.log('Shuffled successfully');
