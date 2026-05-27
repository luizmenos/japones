import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const dataFiles = [
  'hiragana',
  'katakana',
  'kanji',
  'verbs',
  'adjectives',
  'particles',
  'words',
  'phrases',
  'mnemonics'
];

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = true] = arg.replace(/^--/, '').split('=');
    return [key, value];
  })
);

const voice = args.get('voice') || 'ja-JP-NanamiNeural';
const rate = args.get('rate') || '-8%';
const force = args.has('force');
const limit = args.has('limit') ? Number(args.get('limit')) : Infinity;
const only = args.has('only') ? String(args.get('only')).split(',') : dataFiles;

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

function textForItem(item) {
  return item.audioText || item.front || item.symbol;
}

function hashText(text) {
  return createHash('sha1').update(text).digest('hex').slice(0, 10);
}

function audioPathForItem(groupName, item, index) {
  const id = String(index + 1).padStart(3, '0');
  return `audio/${groupName}/${id}-${hashText(textForItem(item))}.mp3`;
}

function hasUsableAudio(path) {
  return existsSync(path) && statSync(path).size > 0;
}

function commandWorks(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  return result.status === 0;
}

function getEdgeTtsCommand() {
  if (process.env.EDGE_TTS_BIN) {
    return { command: process.env.EDGE_TTS_BIN, baseArgs: [] };
  }

  if (commandWorks('edge-tts', ['--version'])) {
    return { command: 'edge-tts', baseArgs: [] };
  }

  if (commandWorks('python3', ['-m', 'edge_tts', '--version'])) {
    return { command: 'python3', baseArgs: ['-m', 'edge_tts'] };
  }

  throw new Error('edge-tts nao foi encontrado. Tente: pip3 install edge-tts');
}

function generateAudio(edgeTts, text, outputPath) {
  mkdirSync(dirname(outputPath), { recursive: true });

  const result = spawnSync(edgeTts.command, [
    ...edgeTts.baseArgs,
    '--voice', voice,
    `--rate=${rate}`,
    '--text', text,
    '--write-media', outputPath
  ], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `Falha gerando ${outputPath}`);
  }
}

const edgeTts = getEdgeTtsCommand();
let generated = 0;
let skipped = 0;

for (const groupName of only) {
  if (!dataFiles.includes(groupName)) {
    throw new Error(`Grupo desconhecido: ${groupName}`);
  }

  const jsonPath = `data/${groupName}.json`;
  const items = readJson(jsonPath);
  let changed = false;

  for (const [index, item] of items.entries()) {
    if (generated >= limit) break;

    const text = textForItem(item);
    if (!text) {
      skipped++;
      continue;
    }

    const relativeAudioPath = item.audio || audioPathForItem(groupName, item, index);
    const outputPath = join(process.cwd(), relativeAudioPath);
    item.audio = relativeAudioPath;
    changed = true;

    if (!force && hasUsableAudio(outputPath)) {
      skipped++;
      continue;
    }

    console.log(`Gerando ${relativeAudioPath}: ${text}`);
    generateAudio(edgeTts, text, outputPath);
    generated++;
  }

  if (changed) {
    writeJson(jsonPath, items);
  }
}

console.log(`Audio pronto. Gerados: ${generated}. Pulados: ${skipped}.`);
