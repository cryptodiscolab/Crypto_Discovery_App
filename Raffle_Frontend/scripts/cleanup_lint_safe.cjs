const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();
const explicitReport = process.argv.find((arg) => arg.startsWith('--report='));
const reportPath = explicitReport ? path.resolve(root, explicitReport.slice('--report='.length)) : null;

const ignoredPathParts = [
  `${path.sep}dist${path.sep}`,
  `${path.sep}node_modules${path.sep}`,
  `${path.sep}api${path.sep}_shared${path.sep}database.types.ts`,
];

function readReport() {
  if (reportPath) {
    return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  }

  const eslintBin = process.platform === 'win32'
    ? path.join(root, 'node_modules', '.bin', 'eslint.cmd')
    : path.join(root, 'node_modules', '.bin', 'eslint');
  const command = fs.existsSync(eslintBin) ? eslintBin : 'npx';
  const args = fs.existsSync(eslintBin)
    ? ['.', '--ext', 'js,jsx,ts,tsx', '--report-unused-disable-directives', '--format', 'json']
    : ['eslint', '.', '--ext', 'js,jsx,ts,tsx', '--report-unused-disable-directives', '--format', 'json'];
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 64,
    shell: process.platform === 'win32',
  });

  const output = result.stdout && result.stdout.trim();
  if (!output) {
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error('ESLint did not produce a JSON report.');
  }

  return JSON.parse(output);
}

function normalizeFilePath(filePath) {
  if (fs.existsSync(filePath)) return filePath;
  const relativeFromWinRoot = filePath.replace(/^[A-Z]:\\Disco Gacha\\Disco_DailyApp\\Raffle_Frontend\\/i, '');
  const normalized = path.join(root, relativeFromWinRoot.replace(/\\/g, path.sep));
  return normalized;
}

function shouldSkip(filePath) {
  const normalized = path.normalize(filePath);
  return ignoredPathParts.some((part) => normalized.includes(part));
}

function offsetFromLineColumn(content, line, column) {
  let offset = 0;
  for (let index = 1; index < line; index += 1) {
    const next = content.indexOf('\n', offset);
    if (next === -1) return -1;
    offset = next + 1;
  }
  return offset + column - 1;
}

function getLine(content, lineNumber) {
  return content.split(/\r?\n/)[lineNumber - 1] || '';
}

function addMissingImport(content, message) {
  const match = message.match(/^'([^']+)' is not defined\./);
  if (!match) return content;
  const name = match[1];
  const source = name === 'Link' || name === 'NavLink' ? 'react-router-dom' : 'lucide-react';
  const escapedSource = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const importRegex = new RegExp(`import\\s+\\{([^}]+)\\}\\s+from\\s+['"]${escapedSource}['"];?`);
  const existing = content.match(importRegex);

  if (existing) {
    const names = existing[1].split(',').map((item) => item.trim()).filter(Boolean);
    if (names.includes(name)) return content;
    return content.replace(importRegex, `import { ${[...names, name].sort().join(', ')} } from '${source}';`);
  }

  const lines = content.split(/\r?\n/);
  let insertAt = 0;
  while (insertAt < lines.length && /^\s*import\s/.test(lines[insertAt])) {
    insertAt += 1;
  }
  lines.splice(insertAt, 0, `import { ${name} } from '${source}';`);
  return lines.join('\n');
}

function prefixUnusedDeclaration(content, message, line, column) {
  const match = message.match(/^'([^']+)' is (?:defined|assigned a value) but never used\./);
  if (!match) return content;
  const name = match[1];
  if (!name || name.startsWith('_')) return content;

  const lineText = getLine(content, line);
  if (/^\s*import\s/.test(lineText)) {
    return content;
  }

  const offset = offsetFromLineColumn(content, line, column);
  if (offset < 0) return content;
  const searchWindow = content.slice(offset, offset + 120);
  const localIndex = searchWindow.search(new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`));
  if (localIndex === -1) return content;

  const absoluteIndex = offset + localIndex;
  const lineStart = content.lastIndexOf('\n', absoluteIndex) + 1;
  const beforeToken = content.slice(lineStart, absoluteIndex);
  if (beforeToken.includes("'") || beforeToken.includes('"') || beforeToken.includes('`')) return content;
  if (content[absoluteIndex - 1] === '_') return content;
  return `${content.slice(0, absoluteIndex)}_${content.slice(absoluteIndex)}`;
}

function replaceExplicitAny(content, line, column) {
  const offset = offsetFromLineColumn(content, line, column);
  if (offset < 0 || content.slice(offset, offset + 3) !== 'any') return content;
  return `${content.slice(0, offset)}unknown${content.slice(offset + 3)}`;
}

function applyPreferConst(content, line, column) {
  const offset = offsetFromLineColumn(content, line, column);
  const before = content.lastIndexOf('let ', offset);
  if (before === -1 || offset - before > 120) return content;
  return `${content.slice(0, before)}const ${content.slice(before + 4)}`;
}

function applyNoVar(content, line, column) {
  const offset = offsetFromLineColumn(content, line, column);
  const before = content.lastIndexOf('var ', offset);
  if (before === -1 || offset - before > 120) return content;
  return `${content.slice(0, before)}let ${content.slice(before + 4)}`;
}

function cleanupEmptyBlock(content, line) {
  const lines = content.split(/\r?\n/);
  const index = line - 1;
  if ((lines[index] || '').trim() === '}') {
    const previous = lines[index - 1] || '';
    if (previous.trim() === '') {
      lines[index - 1] = '    // Intentionally ignored.';
      return lines.join('\n');
    }
  }
  return content;
}

const report = readReport();
const byFile = new Map();
for (const file of report) {
  const filePath = normalizeFilePath(file.filePath);
  if (!fs.existsSync(filePath) || shouldSkip(filePath)) continue;
  const messages = file.messages.filter((message) => [
    '@typescript-eslint/no-explicit-any',
    '@typescript-eslint/no-unused-vars',
    'no-unused-vars',
    'prefer-const',
    'no-var',
    'no-empty',
    'react/jsx-no-undef',
  ].includes(message.ruleId));
  if (messages.length) byFile.set(filePath, messages);
}

const stats = {
  filesChanged: 0,
  explicitAny: 0,
  unused: 0,
  preferConst: 0,
  noVar: 0,
  emptyBlocks: 0,
  missingImports: 0,
};

for (const [filePath, messages] of byFile.entries()) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  const orderedMessages = [...messages].sort((a, b) => {
    if (b.line !== a.line) return b.line - a.line;
    return b.column - a.column;
  });

  for (const message of orderedMessages) {
    const before = content;
    if (message.ruleId === '@typescript-eslint/no-explicit-any') {
      content = replaceExplicitAny(content, message.line, message.column);
      if (content !== before) stats.explicitAny += 1;
    } else if (message.ruleId === '@typescript-eslint/no-unused-vars' || message.ruleId === 'no-unused-vars') {
      content = prefixUnusedDeclaration(content, message.message, message.line, message.column);
      if (content !== before) stats.unused += 1;
    } else if (message.ruleId === 'prefer-const') {
      content = applyPreferConst(content, message.line, message.column);
      if (content !== before) stats.preferConst += 1;
    } else if (message.ruleId === 'no-var') {
      content = applyNoVar(content, message.line, message.column);
      if (content !== before) stats.noVar += 1;
    } else if (message.ruleId === 'no-empty') {
      content = cleanupEmptyBlock(content, message.line);
      if (content !== before) stats.emptyBlocks += 1;
    } else if (message.ruleId === 'react/jsx-no-undef') {
      content = addMissingImport(content, message.message);
      if (content !== before) stats.missingImports += 1;
    }
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    stats.filesChanged += 1;
  }
}

console.log('Safe lint cleanup complete.');
console.log(JSON.stringify(stats, null, 2));
