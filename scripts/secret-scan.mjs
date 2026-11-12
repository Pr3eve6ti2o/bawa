import { spawnSync } from 'node:child_process';
import { lstatSync, readFileSync, readdirSync, readlinkSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

const excludedTrees = [
  'apps/web/dist', 'apps/android/app/build', 'apps/android/.gradle',
];

// Never scanned: version-control internals are not source files (git
// never lists them as tracked files either).
function alwaysExcluded(file) {
  return file.split('/').some(part => part === '.git');
}

// Directories the filesystem walk never descends into, even in the
// git-failure fallback: dependency trees are not scanned by walking.
// (Tracked files under them are still collected via git ls-files and
// scanned by the filter below.)
function neverTraverse(file) {
  return file.split('/').some(part => part === 'node_modules' || part === '.git');
}

function excluded(file, trackedOrUnknown) {
  // Tracked files are always scanned, whatever directory they are in
  // (T43 c3b §3 / r2a Fix 5): a force-added tracked file under a build
  // tree or node_modules must still fail the gate. Only untracked files
  // get the dependency/build-tree exclusions.
  return alwaysExcluded(file) ||
    (!trackedOrUnknown && (
      file.split('/').some(part => part === 'node_modules') ||
      excludedTrees.some(tree => file === tree || file.startsWith(`${tree}/`)) ||
      file === 'reports' ||
      file.startsWith('reports/') ||
      /\.(?:log|png)$/.test(file)
    ));
}

function inspect(root, file) {
  const parts = file.split('/');
  if (isAbsolute(file) || parts.some(part => !part || part === '.' || part === '..')) {
    throw new Error('Invalid repository path');
  }
  let absolute = root;
  for (let index = 0; index < parts.length; index += 1) {
    absolute = join(absolute, parts[index]);
    const stat = lstatSync(absolute);
    if (index === parts.length - 1) return { absolute, stat };
    if (!stat.isDirectory()) throw new Error('Non-directory parent');
  }
}

function readText(root, file) {
  const { absolute, stat } = inspect(root, file);
  if (stat.isDirectory()) return null; // Submodule gitlinks are not text files.
  // Inspect the tracked symlink text, never the contents of its target.
  if (stat.isSymbolicLink()) return readlinkSync(absolute, 'utf8');
  if (!stat.isFile()) throw new Error('Not a regular file');
  const data = readFileSync(absolute);
  // Recognise BOM-marked UTF-16 before applying the binary NUL-byte check.
  if (data[0] === 0xff && data[1] === 0xfe) {
    return new TextDecoder('utf-16le', { fatal: true }).decode(data);
  }
  if (data[0] === 0xfe && data[1] === 0xff) {
    return new TextDecoder('utf-16be', { fatal: true }).decode(data);
  }
  return data.includes(0) ? null : data.toString('utf8');
}

function* walk(root, directory, onReadError) {
  let entries;
  try {
    let absolute = root;
    if (directory) {
      const inspected = inspect(root, directory);
      if (!inspected.stat.isDirectory()) throw new Error('Not a directory');
      absolute = inspected.absolute;
    }
    entries = readdirSync(absolute, { withFileTypes: true });
  } catch {
    onReadError(directory || '.');
    return;
  }

  for (const entry of entries) {
    const file = directory ? `${directory}/${entry.name}` : entry.name;
    // Defer untracked-only exclusions until tracking status is known.
    // In particular, suffix-named directories must still be traversed.
    if (neverTraverse(file)) continue;
    if (entry.isDirectory()) yield* walk(root, file, onReadError);
    else yield file; // Symlinks are collected, never traversed.
  }
}

function gitFiles(root, args) {
  try {
    const result = spawnSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 64 * 1024 * 1024,
    });
    if (result.error || result.status !== 0 || result.signal ||
        typeof result.stdout !== 'string') {
      return null;
    }
    return result.stdout.split('\0').filter(Boolean);
  } catch {
    return null;
  }
}

function collectFiles(root, onReadError) {
  const trackedList = gitFiles(root, ['ls-files', '-z']);
  const untrackedList = gitFiles(root, [
    'ls-files', '--others', '--exclude-standard', '-z',
  ]);
  const tracked = new Set(trackedList ?? []);
  const untracked = new Set(untrackedList ?? []);
  const generated = new Set();
  const files = new Set([...tracked, ...untracked]);

  if (trackedList === null || untrackedList === null) {
    // If either Git listing fails, walk conservatively without ignore rules.
    // This also covers generated/ when present.
    for (const file of walk(root, '', onReadError)) files.add(file);
  } else {
    try {
      // Use lstat through inspect so a symlink named generated is not followed.
      if (inspect(root, 'generated').stat.isDirectory()) {
        for (const file of walk(root, 'generated', onReadError)) {
          files.add(file);
          generated.add(file);
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') onReadError('generated');
    }
  }

  return [...files].filter(file => {
    // Without a tracked list, only paths explicitly identified as untracked
    // may receive the untracked-only exclusions. Unknown paths are scanned.
    // Files collected from the generated/ walk are scanned in full: the
    // gate scans generated/ when present, including its .log/.png files.
    const trackedOrUnknown = tracked.has(file) || generated.has(file) ||
      (trackedList === null && !untracked.has(file));
    return !excluded(file, trackedOrUnknown);
  }).sort();
}

// Shared alternation for pattern 2 (used four times in one RegExp, so
// it is defined once and cannot drift between the branches).
const seedKeyAlternatives = String.raw`mnemonic(?:[_ -]?(?:words|phrase))?|recovery[_ -]?phrase|seed(?:[_ -]?phrase)?|priv(?:ate)?[_ -]?key(?:[_ -]?hex)?|secret[_ -]?key|passphrase`;

export const secretPatterns = [
  // T44-F1: every documented private extended-key prefix, not just
  // xprv/zprv. The repo's own redaction policy lists xprv, yprv, zprv,
  // Yprv, Zprv, tprv, uprv, vprv (docs/05-watch-only/README.md,
  // docs/14-wallet-app-implementation/README.md); the gate previously
  // missed yprv/tprv/vprv/uprv/Yprv/Zprv entirely, so such a literal
  // committed cleanly. Base58 run length 100+ as before.
  /[xyzYZuUvVtT]prv[1-9A-HJ-NP-Za-km-z]{100,}/,
  // T44-F2 (s4b re-audit): WIF private keys — 51 or 52 Base58
  // characters. 51: uncompressed (5) and testnet uncompressed (9);
  // 52: compressed mainnet (K/L) and testnet (c). The first fix
  // covered 51-char 5/K/L only and missed compressed and testnet WIF.
  /\b[5KL9c][1-9A-HJ-NP-Za-km-z]{50,51}\b/,
  // T44-F3 (s4b re-audit): seed-material assignment spellings. The
  // first fix covered the spellings but the anchor missed the forms
  // secrets actually take in committed code: declarations, exports,
  // member assignments and JSON objects with a quoted key and a
  // quoted value. Aliases added:
  // privkey / priv_key, private-key, private_key_hex,
  // recovery_phrase, passphrase. Four branches: (A) a declaration
  // whose value must be a literal (quote, backtick or [), so a
  // legitimate const mnemonic = w.mnemonic() does not flag; (B) the
  // plain anchored form, any value, which is why the reviewed
  // call-value lines stay in the allowlist; (C) a member assignment
  // with a literal value; (D) an object property at a line start,
  // { or , boundary, quoted or unquoted key, literal value — this
  // is what catches an unquoted property key (s8 High: the old
  // quoted-key branch missed unquoted properties) and a property
  // on its own line of pretty-printed JSON (s9 High: the { or ,
  // must be on the same line as the key, so an indented property
  // was missed) while NOT flagging a ternary such as "mnemonic" :
  // "seed" (s8 Low: the old branch matched any quoted key
  // followed by a colon, including ternary operands). The member
  // branch (C) accepts = only (s9 Low: a member followed by a
  // colon is a ternary, e.g. wallet.mnemonic : "", not an
  // assignment).
  // The separator cannot be part of == (lookahead), so comparisons
  // do not flag. Deliberately NOT covered: generic credential words
  // (password, api_key, token, bare secret) — the gate's contract is
  // wallet seed material, and those words appear legitimately in
  // tests and docs. Multiline values (key on one line, value on the
  // next) and indirect references (const mnemonic = getMnemonic())
  // are not detected: the gate is line-based and literal-based.
  new RegExp(
    String.raw`^\s*(?:(?:export|const|let|var)\s+){1,2}(${seedKeyAlternatives})\s*[:=](?!=)\s*["'\x60\[]|^\s*(${seedKeyAlternatives})\s*[:=](?!=)\s*\S+|\.(${seedKeyAlternatives})\s*=(?!=)\s*["'\x60\[]|(?:^|\{|,)\s*["']?(${seedKeyAlternatives})["']?\s*:\s*["'\x60\[]`,
    "i",
  ),
  // T43 c3b §2 / r2a Fix 5: PEM private-key blocks. The header alone
  // is enough to flag: a committed PEM block is key material whatever
  // its body holds. (The pattern text itself does not match: the
  // source line carries a regex alternation between BEGIN and
  // PRIVATE KEY, not the literal header.)
  /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/,
  // T43 c3b §2 / r2a Fix 5: a 64-or-longer hex value next to a key or
  // seed name — a data key, a seed hex, or entropy — within 32
  // non-hex characters, either order. A bare 64-hex string is
  // deliberately NOT flagged: the tree legitimately contains public
  // SHA-256 digests and public keys, and hex length alone cannot tell
  // a secret from a hash (r2a §3). Seed hex in a declaration is also
  // caught by pattern 2 only when the name spells seed_phrase; the
  // seed_hex spelling needs this contextual pattern.
  new RegExp(
    String.raw`(?:BAWA_DATA_KEY(?:_HEX)?|data[_ -]?key|seed[_ -]?(?:hex|phrase)?|entropy)[^0-9a-fA-F]{0,32}[0-9a-fA-F]{64,}(?![0-9a-fA-F])|\b[0-9a-fA-F]{64,}(?![0-9a-fA-F])[^0-9a-fA-F]{0,32}(?:BAWA_DATA_KEY(?:_HEX)?|data[_ -]?key|seed[_ -]?(?:hex|phrase)?|entropy)`,
    'i',
  ),
];

// T43 c3b §2 / r2a Fix 5: BIP-39 mnemonic literals. The 2048-word
// English list is embedded below (published BIP-39 wordlist, copied
// verbatim from bip_utils; 8 words per source line, so no line of the
// list itself holds the 12-word run the detector flags). Any line with
// 12 or more consecutive list words is flagged, unless the run is one
// of the known published test vectors below, or that vector with at
// most one extra word attached — prose such as "15-word" and a
// following passphrase cell ("word" and "empty" are themselves BIP-39
// words) make the documented vector read as a 16-word run. A longer
// run that merely starts with a vector (e.g. a 24-word run built on
// the 15-word vector) still fails: the extra words are real mnemonic
// material (r2a §2).
const BIP39_WORDS = new Set([
  'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract',
  'absurd', 'abuse', 'access', 'accident', 'account', 'accuse', 'achieve', 'acid',
  'acoustic', 'acquire', 'across', 'act', 'action', 'actor', 'actress', 'actual',
  'adapt', 'add', 'addict', 'address', 'adjust', 'admit', 'adult', 'advance',
  'advice', 'aerobic', 'affair', 'afford', 'afraid', 'again', 'age', 'agent',
  'agree', 'ahead', 'aim', 'air', 'airport', 'aisle', 'alarm', 'album',
  'alcohol', 'alert', 'alien', 'all', 'alley', 'allow', 'almost', 'alone',
  'alpha', 'already', 'also', 'alter', 'always', 'amateur', 'amazing', 'among',
  'amount', 'amused', 'analyst', 'anchor', 'ancient', 'anger', 'angle', 'angry',
  'animal', 'ankle', 'announce', 'annual', 'another', 'answer', 'antenna', 'antique',
  'anxiety', 'any', 'apart', 'apology', 'appear', 'apple', 'approve', 'april',
  'arch', 'arctic', 'area', 'arena', 'argue', 'arm', 'armed', 'armor',
  'army', 'around', 'arrange', 'arrest', 'arrive', 'arrow', 'art', 'artefact',
  'artist', 'artwork', 'ask', 'aspect', 'assault', 'asset', 'assist', 'assume',
  'asthma', 'athlete', 'atom', 'attack', 'attend', 'attitude', 'attract', 'auction',
  'audit', 'august', 'aunt', 'author', 'auto', 'autumn', 'average', 'avocado',
  'avoid', 'awake', 'aware', 'away', 'awesome', 'awful', 'awkward', 'axis',
  'baby', 'bachelor', 'bacon', 'badge', 'bag', 'balance', 'balcony', 'ball',
  'bamboo', 'banana', 'banner', 'bar', 'barely', 'bargain', 'barrel', 'base',
  'basic', 'basket', 'battle', 'beach', 'bean', 'beauty', 'because', 'become',
  'beef', 'before', 'begin', 'behave', 'behind', 'believe', 'below', 'belt',
  'bench', 'benefit', 'best', 'betray', 'better', 'between', 'beyond', 'bicycle',
  'bid', 'bike', 'bind', 'biology', 'bird', 'birth', 'bitter', 'black',
  'blade', 'blame', 'blanket', 'blast', 'bleak', 'bless', 'blind', 'blood',
  'blossom', 'blouse', 'blue', 'blur', 'blush', 'board', 'boat', 'body',
  'boil', 'bomb', 'bone', 'bonus', 'book', 'boost', 'border', 'boring',
  'borrow', 'boss', 'bottom', 'bounce', 'box', 'boy', 'bracket', 'brain',
  'brand', 'brass', 'brave', 'bread', 'breeze', 'brick', 'bridge', 'brief',
  'bright', 'bring', 'brisk', 'broccoli', 'broken', 'bronze', 'broom', 'brother',
  'brown', 'brush', 'bubble', 'buddy', 'budget', 'buffalo', 'build', 'bulb',
  'bulk', 'bullet', 'bundle', 'bunker', 'burden', 'burger', 'burst', 'bus',
  'business', 'busy', 'butter', 'buyer', 'buzz', 'cabbage', 'cabin', 'cable',
  'cactus', 'cage', 'cake', 'call', 'calm', 'camera', 'camp', 'can',
  'canal', 'cancel', 'candy', 'cannon', 'canoe', 'canvas', 'canyon', 'capable',
  'capital', 'captain', 'car', 'carbon', 'card', 'cargo', 'carpet', 'carry',
  'cart', 'case', 'cash', 'casino', 'castle', 'casual', 'cat', 'catalog',
  'catch', 'category', 'cattle', 'caught', 'cause', 'caution', 'cave', 'ceiling',
  'celery', 'cement', 'census', 'century', 'cereal', 'certain', 'chair', 'chalk',
  'champion', 'change', 'chaos', 'chapter', 'charge', 'chase', 'chat', 'cheap',
  'check', 'cheese', 'chef', 'cherry', 'chest', 'chicken', 'chief', 'child',
  'chimney', 'choice', 'choose', 'chronic', 'chuckle', 'chunk', 'churn', 'cigar',
  'cinnamon', 'circle', 'citizen', 'city', 'civil', 'claim', 'clap', 'clarify',
  'claw', 'clay', 'clean', 'clerk', 'clever', 'click', 'client', 'cliff',
  'climb', 'clinic', 'clip', 'clock', 'clog', 'close', 'cloth', 'cloud',
  'clown', 'club', 'clump', 'cluster', 'clutch', 'coach', 'coast', 'coconut',
  'code', 'coffee', 'coil', 'coin', 'collect', 'color', 'column', 'combine',
  'come', 'comfort', 'comic', 'common', 'company', 'concert', 'conduct', 'confirm',
  'congress', 'connect', 'consider', 'control', 'convince', 'cook', 'cool', 'copper',
  'copy', 'coral', 'core', 'corn', 'correct', 'cost', 'cotton', 'couch',
  'country', 'couple', 'course', 'cousin', 'cover', 'coyote', 'crack', 'cradle',
  'craft', 'cram', 'crane', 'crash', 'crater', 'crawl', 'crazy', 'cream',
  'credit', 'creek', 'crew', 'cricket', 'crime', 'crisp', 'critic', 'crop',
  'cross', 'crouch', 'crowd', 'crucial', 'cruel', 'cruise', 'crumble', 'crunch',
  'crush', 'cry', 'crystal', 'cube', 'culture', 'cup', 'cupboard', 'curious',
  'current', 'curtain', 'curve', 'cushion', 'custom', 'cute', 'cycle', 'dad',
  'damage', 'damp', 'dance', 'danger', 'daring', 'dash', 'daughter', 'dawn',
  'day', 'deal', 'debate', 'debris', 'decade', 'december', 'decide', 'decline',
  'decorate', 'decrease', 'deer', 'defense', 'define', 'defy', 'degree', 'delay',
  'deliver', 'demand', 'demise', 'denial', 'dentist', 'deny', 'depart', 'depend',
  'deposit', 'depth', 'deputy', 'derive', 'describe', 'desert', 'design', 'desk',
  'despair', 'destroy', 'detail', 'detect', 'develop', 'device', 'devote', 'diagram',
  'dial', 'diamond', 'diary', 'dice', 'diesel', 'diet', 'differ', 'digital',
  'dignity', 'dilemma', 'dinner', 'dinosaur', 'direct', 'dirt', 'disagree', 'discover',
  'disease', 'dish', 'dismiss', 'disorder', 'display', 'distance', 'divert', 'divide',
  'divorce', 'dizzy', 'doctor', 'document', 'dog', 'doll', 'dolphin', 'domain',
  'donate', 'donkey', 'donor', 'door', 'dose', 'double', 'dove', 'draft',
  'dragon', 'drama', 'drastic', 'draw', 'dream', 'dress', 'drift', 'drill',
  'drink', 'drip', 'drive', 'drop', 'drum', 'dry', 'duck', 'dumb',
  'dune', 'during', 'dust', 'dutch', 'duty', 'dwarf', 'dynamic', 'eager',
  'eagle', 'early', 'earn', 'earth', 'easily', 'east', 'easy', 'echo',
  'ecology', 'economy', 'edge', 'edit', 'educate', 'effort', 'egg', 'eight',
  'either', 'elbow', 'elder', 'electric', 'elegant', 'element', 'elephant', 'elevator',
  'elite', 'else', 'embark', 'embody', 'embrace', 'emerge', 'emotion', 'employ',
  'empower', 'empty', 'enable', 'enact', 'end', 'endless', 'endorse', 'enemy',
  'energy', 'enforce', 'engage', 'engine', 'enhance', 'enjoy', 'enlist', 'enough',
  'enrich', 'enroll', 'ensure', 'enter', 'entire', 'entry', 'envelope', 'episode',
  'equal', 'equip', 'era', 'erase', 'erode', 'erosion', 'error', 'erupt',
  'escape', 'essay', 'essence', 'estate', 'eternal', 'ethics', 'evidence', 'evil',
  'evoke', 'evolve', 'exact', 'example', 'excess', 'exchange', 'excite', 'exclude',
  'excuse', 'execute', 'exercise', 'exhaust', 'exhibit', 'exile', 'exist', 'exit',
  'exotic', 'expand', 'expect', 'expire', 'explain', 'expose', 'express', 'extend',
  'extra', 'eye', 'eyebrow', 'fabric', 'face', 'faculty', 'fade', 'faint',
  'faith', 'fall', 'false', 'fame', 'family', 'famous', 'fan', 'fancy',
  'fantasy', 'farm', 'fashion', 'fat', 'fatal', 'father', 'fatigue', 'fault',
  'favorite', 'feature', 'february', 'federal', 'fee', 'feed', 'feel', 'female',
  'fence', 'festival', 'fetch', 'fever', 'few', 'fiber', 'fiction', 'field',
  'figure', 'file', 'film', 'filter', 'final', 'find', 'fine', 'finger',
  'finish', 'fire', 'firm', 'first', 'fiscal', 'fish', 'fit', 'fitness',
  'fix', 'flag', 'flame', 'flash', 'flat', 'flavor', 'flee', 'flight',
  'flip', 'float', 'flock', 'floor', 'flower', 'fluid', 'flush', 'fly',
  'foam', 'focus', 'fog', 'foil', 'fold', 'follow', 'food', 'foot',
  'force', 'forest', 'forget', 'fork', 'fortune', 'forum', 'forward', 'fossil',
  'foster', 'found', 'fox', 'fragile', 'frame', 'frequent', 'fresh', 'friend',
  'fringe', 'frog', 'front', 'frost', 'frown', 'frozen', 'fruit', 'fuel',
  'fun', 'funny', 'furnace', 'fury', 'future', 'gadget', 'gain', 'galaxy',
  'gallery', 'game', 'gap', 'garage', 'garbage', 'garden', 'garlic', 'garment',
  'gas', 'gasp', 'gate', 'gather', 'gauge', 'gaze', 'general', 'genius',
  'genre', 'gentle', 'genuine', 'gesture', 'ghost', 'giant', 'gift', 'giggle',
  'ginger', 'giraffe', 'girl', 'give', 'glad', 'glance', 'glare', 'glass',
  'glide', 'glimpse', 'globe', 'gloom', 'glory', 'glove', 'glow', 'glue',
  'goat', 'goddess', 'gold', 'good', 'goose', 'gorilla', 'gospel', 'gossip',
  'govern', 'gown', 'grab', 'grace', 'grain', 'grant', 'grape', 'grass',
  'gravity', 'great', 'green', 'grid', 'grief', 'grit', 'grocery', 'group',
  'grow', 'grunt', 'guard', 'guess', 'guide', 'guilt', 'guitar', 'gun',
  'gym', 'habit', 'hair', 'half', 'hammer', 'hamster', 'hand', 'happy',
  'harbor', 'hard', 'harsh', 'harvest', 'hat', 'have', 'hawk', 'hazard',
  'head', 'health', 'heart', 'heavy', 'hedgehog', 'height', 'hello', 'helmet',
  'help', 'hen', 'hero', 'hidden', 'high', 'hill', 'hint', 'hip',
  'hire', 'history', 'hobby', 'hockey', 'hold', 'hole', 'holiday', 'hollow',
  'home', 'honey', 'hood', 'hope', 'horn', 'horror', 'horse', 'hospital',
  'host', 'hotel', 'hour', 'hover', 'hub', 'huge', 'human', 'humble',
  'humor', 'hundred', 'hungry', 'hunt', 'hurdle', 'hurry', 'hurt', 'husband',
  'hybrid', 'ice', 'icon', 'idea', 'identify', 'idle', 'ignore', 'ill',
  'illegal', 'illness', 'image', 'imitate', 'immense', 'immune', 'impact', 'impose',
  'improve', 'impulse', 'inch', 'include', 'income', 'increase', 'index', 'indicate',
  'indoor', 'industry', 'infant', 'inflict', 'inform', 'inhale', 'inherit', 'initial',
  'inject', 'injury', 'inmate', 'inner', 'innocent', 'input', 'inquiry', 'insane',
  'insect', 'inside', 'inspire', 'install', 'intact', 'interest', 'into', 'invest',
  'invite', 'involve', 'iron', 'island', 'isolate', 'issue', 'item', 'ivory',
  'jacket', 'jaguar', 'jar', 'jazz', 'jealous', 'jeans', 'jelly', 'jewel',
  'job', 'join', 'joke', 'journey', 'joy', 'judge', 'juice', 'jump',
  'jungle', 'junior', 'junk', 'just', 'kangaroo', 'keen', 'keep', 'ketchup',
  'key', 'kick', 'kid', 'kidney', 'kind', 'kingdom', 'kiss', 'kit',
  'kitchen', 'kite', 'kitten', 'kiwi', 'knee', 'knife', 'knock', 'know',
  'lab', 'label', 'labor', 'ladder', 'lady', 'lake', 'lamp', 'language',
  'laptop', 'large', 'later', 'latin', 'laugh', 'laundry', 'lava', 'law',
  'lawn', 'lawsuit', 'layer', 'lazy', 'leader', 'leaf', 'learn', 'leave',
  'lecture', 'left', 'leg', 'legal', 'legend', 'leisure', 'lemon', 'lend',
  'length', 'lens', 'leopard', 'lesson', 'letter', 'level', 'liar', 'liberty',
  'library', 'license', 'life', 'lift', 'light', 'like', 'limb', 'limit',
  'link', 'lion', 'liquid', 'list', 'little', 'live', 'lizard', 'load',
  'loan', 'lobster', 'local', 'lock', 'logic', 'lonely', 'long', 'loop',
  'lottery', 'loud', 'lounge', 'love', 'loyal', 'lucky', 'luggage', 'lumber',
  'lunar', 'lunch', 'luxury', 'lyrics', 'machine', 'mad', 'magic', 'magnet',
  'maid', 'mail', 'main', 'major', 'make', 'mammal', 'man', 'manage',
  'mandate', 'mango', 'mansion', 'manual', 'maple', 'marble', 'march', 'margin',
  'marine', 'market', 'marriage', 'mask', 'mass', 'master', 'match', 'material',
  'math', 'matrix', 'matter', 'maximum', 'maze', 'meadow', 'mean', 'measure',
  'meat', 'mechanic', 'medal', 'media', 'melody', 'melt', 'member', 'memory',
  'mention', 'menu', 'mercy', 'merge', 'merit', 'merry', 'mesh', 'message',
  'metal', 'method', 'middle', 'midnight', 'milk', 'million', 'mimic', 'mind',
  'minimum', 'minor', 'minute', 'miracle', 'mirror', 'misery', 'miss', 'mistake',
  'mix', 'mixed', 'mixture', 'mobile', 'model', 'modify', 'mom', 'moment',
  'monitor', 'monkey', 'monster', 'month', 'moon', 'moral', 'more', 'morning',
  'mosquito', 'mother', 'motion', 'motor', 'mountain', 'mouse', 'move', 'movie',
  'much', 'muffin', 'mule', 'multiply', 'muscle', 'museum', 'mushroom', 'music',
  'must', 'mutual', 'myself', 'mystery', 'myth', 'naive', 'name', 'napkin',
  'narrow', 'nasty', 'nation', 'nature', 'near', 'neck', 'need', 'negative',
  'neglect', 'neither', 'nephew', 'nerve', 'nest', 'net', 'network', 'neutral',
  'never', 'news', 'next', 'nice', 'night', 'noble', 'noise', 'nominee',
  'noodle', 'normal', 'north', 'nose', 'notable', 'note', 'nothing', 'notice',
  'novel', 'now', 'nuclear', 'number', 'nurse', 'nut', 'oak', 'obey',
  'object', 'oblige', 'obscure', 'observe', 'obtain', 'obvious', 'occur', 'ocean',
  'october', 'odor', 'off', 'offer', 'office', 'often', 'oil', 'okay',
  'old', 'olive', 'olympic', 'omit', 'once', 'one', 'onion', 'online',
  'only', 'open', 'opera', 'opinion', 'oppose', 'option', 'orange', 'orbit',
  'orchard', 'order', 'ordinary', 'organ', 'orient', 'original', 'orphan', 'ostrich',
  'other', 'outdoor', 'outer', 'output', 'outside', 'oval', 'oven', 'over',
  'own', 'owner', 'oxygen', 'oyster', 'ozone', 'pact', 'paddle', 'page',
  'pair', 'palace', 'palm', 'panda', 'panel', 'panic', 'panther', 'paper',
  'parade', 'parent', 'park', 'parrot', 'party', 'pass', 'patch', 'path',
  'patient', 'patrol', 'pattern', 'pause', 'pave', 'payment', 'peace', 'peanut',
  'pear', 'peasant', 'pelican', 'pen', 'penalty', 'pencil', 'people', 'pepper',
  'perfect', 'permit', 'person', 'pet', 'phone', 'photo', 'phrase', 'physical',
  'piano', 'picnic', 'picture', 'piece', 'pig', 'pigeon', 'pill', 'pilot',
  'pink', 'pioneer', 'pipe', 'pistol', 'pitch', 'pizza', 'place', 'planet',
  'plastic', 'plate', 'play', 'please', 'pledge', 'pluck', 'plug', 'plunge',
  'poem', 'poet', 'point', 'polar', 'pole', 'police', 'pond', 'pony',
  'pool', 'popular', 'portion', 'position', 'possible', 'post', 'potato', 'pottery',
  'poverty', 'powder', 'power', 'practice', 'praise', 'predict', 'prefer', 'prepare',
  'present', 'pretty', 'prevent', 'price', 'pride', 'primary', 'print', 'priority',
  'prison', 'private', 'prize', 'problem', 'process', 'produce', 'profit', 'program',
  'project', 'promote', 'proof', 'property', 'prosper', 'protect', 'proud', 'provide',
  'public', 'pudding', 'pull', 'pulp', 'pulse', 'pumpkin', 'punch', 'pupil',
  'puppy', 'purchase', 'purity', 'purpose', 'purse', 'push', 'put', 'puzzle',
  'pyramid', 'quality', 'quantum', 'quarter', 'question', 'quick', 'quit', 'quiz',
  'quote', 'rabbit', 'raccoon', 'race', 'rack', 'radar', 'radio', 'rail',
  'rain', 'raise', 'rally', 'ramp', 'ranch', 'random', 'range', 'rapid',
  'rare', 'rate', 'rather', 'raven', 'raw', 'razor', 'ready', 'real',
  'reason', 'rebel', 'rebuild', 'recall', 'receive', 'recipe', 'record', 'recycle',
  'reduce', 'reflect', 'reform', 'refuse', 'region', 'regret', 'regular', 'reject',
  'relax', 'release', 'relief', 'rely', 'remain', 'remember', 'remind', 'remove',
  'render', 'renew', 'rent', 'reopen', 'repair', 'repeat', 'replace', 'report',
  'require', 'rescue', 'resemble', 'resist', 'resource', 'response', 'result', 'retire',
  'retreat', 'return', 'reunion', 'reveal', 'review', 'reward', 'rhythm', 'rib',
  'ribbon', 'rice', 'rich', 'ride', 'ridge', 'rifle', 'right', 'rigid',
  'ring', 'riot', 'ripple', 'risk', 'ritual', 'rival', 'river', 'road',
  'roast', 'robot', 'robust', 'rocket', 'romance', 'roof', 'rookie', 'room',
  'rose', 'rotate', 'rough', 'round', 'route', 'royal', 'rubber', 'rude',
  'rug', 'rule', 'run', 'runway', 'rural', 'sad', 'saddle', 'sadness',
  'safe', 'sail', 'salad', 'salmon', 'salon', 'salt', 'salute', 'same',
  'sample', 'sand', 'satisfy', 'satoshi', 'sauce', 'sausage', 'save', 'say',
  'scale', 'scan', 'scare', 'scatter', 'scene', 'scheme', 'school', 'science',
  'scissors', 'scorpion', 'scout', 'scrap', 'screen', 'script', 'scrub', 'sea',
  'search', 'season', 'seat', 'second', 'secret', 'section', 'security', 'seed',
  'seek', 'segment', 'select', 'sell', 'seminar', 'senior', 'sense', 'sentence',
  'series', 'service', 'session', 'settle', 'setup', 'seven', 'shadow', 'shaft',
  'shallow', 'share', 'shed', 'shell', 'sheriff', 'shield', 'shift', 'shine',
  'ship', 'shiver', 'shock', 'shoe', 'shoot', 'shop', 'short', 'shoulder',
  'shove', 'shrimp', 'shrug', 'shuffle', 'shy', 'sibling', 'sick', 'side',
  'siege', 'sight', 'sign', 'silent', 'silk', 'silly', 'silver', 'similar',
  'simple', 'since', 'sing', 'siren', 'sister', 'situate', 'six', 'size',
  'skate', 'sketch', 'ski', 'skill', 'skin', 'skirt', 'skull', 'slab',
  'slam', 'sleep', 'slender', 'slice', 'slide', 'slight', 'slim', 'slogan',
  'slot', 'slow', 'slush', 'small', 'smart', 'smile', 'smoke', 'smooth',
  'snack', 'snake', 'snap', 'sniff', 'snow', 'soap', 'soccer', 'social',
  'sock', 'soda', 'soft', 'solar', 'soldier', 'solid', 'solution', 'solve',
  'someone', 'song', 'soon', 'sorry', 'sort', 'soul', 'sound', 'soup',
  'source', 'south', 'space', 'spare', 'spatial', 'spawn', 'speak', 'special',
  'speed', 'spell', 'spend', 'sphere', 'spice', 'spider', 'spike', 'spin',
  'spirit', 'split', 'spoil', 'sponsor', 'spoon', 'sport', 'spot', 'spray',
  'spread', 'spring', 'spy', 'square', 'squeeze', 'squirrel', 'stable', 'stadium',
  'staff', 'stage', 'stairs', 'stamp', 'stand', 'start', 'state', 'stay',
  'steak', 'steel', 'stem', 'step', 'stereo', 'stick', 'still', 'sting',
  'stock', 'stomach', 'stone', 'stool', 'story', 'stove', 'strategy', 'street',
  'strike', 'strong', 'struggle', 'student', 'stuff', 'stumble', 'style', 'subject',
  'submit', 'subway', 'success', 'such', 'sudden', 'suffer', 'sugar', 'suggest',
  'suit', 'summer', 'sun', 'sunny', 'sunset', 'super', 'supply', 'supreme',
  'sure', 'surface', 'surge', 'surprise', 'surround', 'survey', 'suspect', 'sustain',
  'swallow', 'swamp', 'swap', 'swarm', 'swear', 'sweet', 'swift', 'swim',
  'swing', 'switch', 'sword', 'symbol', 'symptom', 'syrup', 'system', 'table',
  'tackle', 'tag', 'tail', 'talent', 'talk', 'tank', 'tape', 'target',
  'task', 'taste', 'tattoo', 'taxi', 'teach', 'team', 'tell', 'ten',
  'tenant', 'tennis', 'tent', 'term', 'test', 'text', 'thank', 'that',
  'theme', 'then', 'theory', 'there', 'they', 'thing', 'this', 'thought',
  'three', 'thrive', 'throw', 'thumb', 'thunder', 'ticket', 'tide', 'tiger',
  'tilt', 'timber', 'time', 'tiny', 'tip', 'tired', 'tissue', 'title',
  'toast', 'tobacco', 'today', 'toddler', 'toe', 'together', 'toilet', 'token',
  'tomato', 'tomorrow', 'tone', 'tongue', 'tonight', 'tool', 'tooth', 'top',
  'topic', 'topple', 'torch', 'tornado', 'tortoise', 'toss', 'total', 'tourist',
  'toward', 'tower', 'town', 'toy', 'track', 'trade', 'traffic', 'tragic',
  'train', 'transfer', 'trap', 'trash', 'travel', 'tray', 'treat', 'tree',
  'trend', 'trial', 'tribe', 'trick', 'trigger', 'trim', 'trip', 'trophy',
  'trouble', 'truck', 'true', 'truly', 'trumpet', 'trust', 'truth', 'try',
  'tube', 'tuition', 'tumble', 'tuna', 'tunnel', 'turkey', 'turn', 'turtle',
  'twelve', 'twenty', 'twice', 'twin', 'twist', 'two', 'type', 'typical',
  'ugly', 'umbrella', 'unable', 'unaware', 'uncle', 'uncover', 'under', 'undo',
  'unfair', 'unfold', 'unhappy', 'uniform', 'unique', 'unit', 'universe', 'unknown',
  'unlock', 'until', 'unusual', 'unveil', 'update', 'upgrade', 'uphold', 'upon',
  'upper', 'upset', 'urban', 'urge', 'usage', 'use', 'used', 'useful',
  'useless', 'usual', 'utility', 'vacant', 'vacuum', 'vague', 'valid', 'valley',
  'valve', 'van', 'vanish', 'vapor', 'various', 'vast', 'vault', 'vehicle',
  'velvet', 'vendor', 'venture', 'venue', 'verb', 'verify', 'version', 'very',
  'vessel', 'veteran', 'viable', 'vibrant', 'vicious', 'victory', 'video', 'view',
  'village', 'vintage', 'violin', 'virtual', 'virus', 'visa', 'visit', 'visual',
  'vital', 'vivid', 'vocal', 'voice', 'void', 'volcano', 'volume', 'vote',
  'voyage', 'wage', 'wagon', 'wait', 'walk', 'wall', 'walnut', 'want',
  'warfare', 'warm', 'warrior', 'wash', 'wasp', 'waste', 'water', 'wave',
  'way', 'wealth', 'weapon', 'wear', 'weasel', 'weather', 'web', 'wedding',
  'weekend', 'weird', 'welcome', 'west', 'wet', 'whale', 'what', 'wheat',
  'wheel', 'when', 'where', 'whip', 'whisper', 'wide', 'width', 'wife',
  'wild', 'will', 'win', 'window', 'wine', 'wing', 'wink', 'winner',
  'winter', 'wire', 'wisdom', 'wise', 'wish', 'witness', 'wolf', 'woman',
  'wonder', 'wood', 'wool', 'word', 'work', 'world', 'worry', 'worth',
  'wrap', 'wreck', 'wrestle', 'wrist', 'write', 'wrong', 'yard', 'year',
  'yellow', 'you', 'young', 'youth', 'zebra', 'zero', 'zone', 'zoo',
]);

// Published test-vector mnemonics, never for funds. Each is exempt
// as a complete word run on the line, or with at most one extra word
// attached (see the header comment above).
const knownMnemonicVectors = [
  // Trust Wallet Core 15-word example (tools/hdwallet-gen/generate.js).
  'ripple scissors kick mammal hire column oak again sun offer wealth tomorrow wagon turn fatal',
  // BIP-39 12-word vector, zero entropy (128-bit).
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
  // BIP-39 24-word vector, zero entropy (256-bit).
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art',
  // Hardhat account #0 (test/differential_test.py).
  'test test test test test test test test test test test junk',
];

// A run is exempt only when it is a known published test vector, or
// that vector with at most one extra word attached (see the header
// comment above). The vector must appear as a contiguous subsequence
// of the run.
function isExemptMnemonicRun(run) {
  for (const vector of knownMnemonicVectors) {
    const words = vector.split(' ');
    if (run.length < words.length || run.length > words.length + 1) continue;
    for (let offset = 0; offset + words.length <= run.length; offset += 1) {
      if (words.every((word, i) => run[offset + i] === word)) return true;
    }
  }
  return false;
}

function hasMnemonicRun(line) {
  const tokens = line.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  let run = [];
  const checkRun = () => {
    if (run.length >= 12 && !isExemptMnemonicRun(run)) {
      return true;
    }
    return false;
  };
  for (const token of tokens) {
    if (BIP39_WORDS.has(token)) {
      run.push(token);
    } else {
      if (checkRun()) return true;
      run = [];
    }
  }
  return checkRun();
}

// Known published BIP-32 test vectors ("test vector, never for funds"):
// TV1 root xprv, TV5 bad-checksum xprv, the abandon-mnemonic zprv, and the
// TV1 path xprv (seed 000102..., m/0'/1/2'/2/1000000000).
// Stripped from a line before the xprv/zprv patterns are tested, so any
// OTHER private extended key literal anywhere still fails the gate.
export const knownTestVectors = [
  'xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi',
  'xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHL',
  'zprvAdG4iTXWBoARxkkzNpNh8r6Qag3irQB8PzEMkAFeTRXxHpbF9z4QgEvBRmfvqWvGp42t42nvgGpNgYSJA9iefm1yYNZKEm7z6qUWCroSQnE',
  'xprvA41z7zogVVwxVSgdKUHDy1SKmdb533PjDz7J6N6mV6uS3ze1ai8FHa8kmHScGpWmj4WggLyQjgPie1rFSruoUihUZREPSL39UNdE3BBDu76',
];

// Exceptions apply only to these exact trimmed statements, not entire files.
// The test_make_wallet.py statement is reviewed at all three occurrences.
export const secretAllowlist = [
  {
    file: 'tools/decrypt_seed.py',
    pattern: 2,
    line: 'mnemonic = decrypt(args.path, key)',
  },
  {
    file: 'test/differential_test.py',
    pattern: 2,
    line: 'MNEMONIC = (',
  },
  {
    file: 'test/differential_test.py',
    pattern: 2,
    line: 'seed = Bip39SeedGenerator(MNEMONIC).Generate()',
  },
  {
    file: 'test/test_make_wallet.py',
    pattern: 2,
    line: 'mnemonic = " ".join(["abandon"] * 23 + ["art"])',
  },
  // test/fixture-oracle.py (T09): the same published 15-word fixture
  // vector and the same two statements already exempted for
  // test/differential_test.py above (F-26). The seed line occurs twice
  // (lines 62, 236); one entry covers both, as with test_make_wallet.
  {
    file: 'test/fixture-oracle.py',
    pattern: 2,
    line: 'MNEMONIC = (',
  },
  {
    file: 'test/fixture-oracle.py',
    pattern: 2,
    line: 'seed = Bip39SeedGenerator(MNEMONIC).Generate()',
  },
  // T35 (local signing): wallet-core SigningInput protobuf field
  // assignments. The value is a runtime variable (a Uint8Array/Buffer
  // holding a temporary key), never a literal secret. Pattern 2
  // branch B flags any privateKey: line, so these exact statements
  // are exempted; a different line text (e.g. with a literal key)
  // still fails the gate. One entry covers the three identical
  // 'privateKey: priv,' occurrences in local-signing.mjs.
  {
    file: 'tests/mainnet-signing.test.mjs',
    pattern: 2,
    line: 'privateKey: priv(1),',
  },
  {
    file: 'tools/mainnet-signing/local-signing.mjs',
    pattern: 2,
    line: 'privateKey: [priv],',
  },
  {
    file: 'tools/mainnet-signing/local-signing.mjs',
    pattern: 2,
    line: 'privateKey: priv,',
  },
];

const displayPath = file => JSON.stringify(file).slice(1, -1);

/**
 * Scan a repository without logging matching text or filesystem error details.
 * Line 0 denotes a path that could not be read or enumerated safely.
 */
export function secretScan(root) {
  let passed = true;
  const unreadable = new Set();
  const reportUnreadable = file => {
    passed = false;
    if (unreadable.has(file)) return;
    unreadable.add(file);
    console.error(`  ${displayPath(file)}:0`);
  };

  for (const file of collectFiles(root, reportUnreadable)) {
    let text;
    try {
      text = readText(root, file);
    } catch {
      reportUnreadable(file);
      continue;
    }
    if (text === null) continue;

    const lines = text.split(/\r\n?|\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const trimmed = line.trim();
      const scrubbed = knownTestVectors.reduce(
        (value, vector) => value.split(vector).join(''),
        line,
      );
      const patternHit = secretPatterns.some((pattern, patternIndex) => {
        const allowed = secretAllowlist.some(entry =>
          entry.file === file &&
          entry.pattern === patternIndex &&
          entry.line === trimmed);
        if (allowed) return false;
        // Patterns 0/1 (private extended keys, WIF) test the scrubbed
        // line; patterns 2-4 test the raw line.
        return pattern.test(patternIndex < 2 ? scrubbed : line);
      });
      // Pattern 5 (T43): a 12+ consecutive BIP-39 word run. The
      // allowlist is per exact line, as for the regex patterns.
      const wordRunHit = hasMnemonicRun(line) && !secretAllowlist.some(entry =>
        entry.file === file && entry.pattern === 5 && entry.line === trimmed);
      if (patternHit || wordRunHit) {
        // Report locations only, never the matching text.
        console.error(`  ${displayPath(file)}:${index + 1}`);
        passed = false;
      }
    }
  }
  return passed;
}
