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
  'mnemonics',
  'conversations'
];

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = true] = arg.replace(/^--/, '').split('=');
    return [key, value];
  })
);

const voice = args.get('voice') || 'ja-JP-NanamiNeural';
const speakerAVoice = args.get('voice-a') || 'ja-JP-KeitaNeural';
const speakerBVoice = args.get('voice-b') || 'ja-JP-NanamiNeural';
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
  return item.audioText || item.front || item.symbol || item.jp;
}

function hashText(text) {
  return createHash('sha1').update(text).digest('hex').slice(0, 10);
}

function audioPathForItem(groupName, item, index) {
  const id = String(index + 1).padStart(3, '0');
  return `audio/${groupName}/${id}-${hashText(textForItem(item))}.mp3`;
}

function audioPathForConversationLine(conversation, line, index) {
  const id = String(index + 1).padStart(2, '0');
  return `audio/conversations/${conversation.id}/${id}-${line.speaker.toLowerCase()}-${hashText(textForItem(line))}.mp3`;
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

function generateAudio(edgeTts, text, outputPath, selectedVoice = voice) {
  mkdirSync(dirname(outputPath), { recursive: true });

  const result = spawnSync(edgeTts.command, [
    ...edgeTts.baseArgs,
    '--voice', selectedVoice,
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

function voiceForConversationLine(line) {
  if (line.voice) return line.voice;
  return line.speaker === 'A' ? speakerAVoice : speakerBVoice;
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

  if (groupName === 'conversations') {
    for (const conversation of items) {
      for (const [index, line] of conversation.lines.entries()) {
        if (generated >= limit) break;

        const text = textForItem(line);
        if (!text) {
          skipped++;
          continue;
        }

        const relativeAudioPath = line.audio || audioPathForConversationLine(conversation, line, index);
        const outputPath = join(process.cwd(), relativeAudioPath);
        line.audio = relativeAudioPath;
        line.voice = line.voice || voiceForConversationLine(line);
        changed = true;

        if (!force && hasUsableAudio(outputPath)) {
          skipped++;
          continue;
        }

        console.log(`Gerando ${relativeAudioPath}: ${text}`);
        generateAudio(edgeTts, text, outputPath, line.voice);
        generated++;
      }
    }

    if (changed) {
      writeJson(jsonPath, items);
    }

    continue;
  }

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
