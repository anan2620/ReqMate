#!/usr/bin/env node
/**
 * 生成 GitHub Release 正文（markdown）。
 *
 * 用法：
 *   node scripts/release-notes.mjs                 # 用 HEAD 上的 tag
 *   node scripts/release-notes.mjs v1.1.1          # 指定 tag
 *   node scripts/release-notes.mjs v1.1.1 > notes.md
 *
 * 变更清单取「上一个 tag..本次 tag」之间的非 merge 提交，按 conventional commit
 * 的 type 分节。安装包文件名按 tauri.conf.json 的 productName + 版本号推导，
 * 与 tauri 的打包产物命名规则一致。
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function gitSoft(args) {
  try {
    return git(args);
  } catch {
    return '';
  }
}

const tag = process.argv[2] || process.env.GITHUB_REF_NAME || gitSoft(['describe', '--tags', '--abbrev=0']);
if (!tag) {
  console.error('无法确定 tag，请显式传入（如 v1.1.1）');
  process.exit(1);
}

const version = tag.replace(/^v/, '');

// owner/repo，用于拼下载链接
const repoSlug = (() => {
  const url = gitSoft(['remote', 'get-url', 'origin']);
  const m = url.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
  return m ? `${m[1]}/${m[2]}` : process.env.GITHUB_REPOSITORY || 'anan2620/ReqMate';
})();

const productName = (() => {
  try {
    const conf = JSON.parse(readFileSync(join(root, 'apps/desktop/src-tauri/tauri.conf.json'), 'utf8'));
    return conf.productName || 'ReqMate';
  } catch {
    return 'ReqMate';
  }
})();

const prevTag = gitSoft(['describe', '--tags', '--abbrev=0', `${tag}^`]);

// 收集提交：[{ type, subject, short }]
const commits = (() => {
  const range = prevTag ? `${prevTag}..${tag}` : tag;
  const raw = gitSoft(['log', '--no-merges', '--pretty=format:%s%x1f%h%x1e', range]);
  if (!raw) return [];
  return raw
    .split('\x1e')
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => {
      const [subject, short] = row.split('\x1f');
      const m = subject.match(/^(\w+)(\([^)]*\))?!?:\s*(.*)$/);
      return {
        type: m ? m[1].toLowerCase() : 'other',
        subject: m ? m[3] : subject,
        short,
      };
    });
})();

const SECTIONS = [
  ['feat', 'Features'],
  ['fix', 'Fixes'],
  ['perf', 'Performance'],
  ['refactor', 'Refactoring'],
  ['ci', 'CI & Build'],
  ['build', 'CI & Build'],
  ['docs', 'Documentation'],
  ['style', 'Other'],
  ['test', 'Other'],
  ['chore', 'Other'],
  ['other', 'Other'],
];

const base = `https://github.com/${repoSlug}/releases/download/${tag}`;
const installers = [
  ['macOS (Apple Silicon)', `${base}/${productName}_${version}_aarch64.dmg`],
  ['macOS (Intel)', `${base}/${productName}_${version}_x64.dmg`],
  ['Windows', `${base}/${productName}_${version}_x64-setup.exe`],
  ['Linux (.AppImage)', `${base}/${productName}_${version}_amd64.AppImage`],
  ['Linux (.deb)', `${base}/${productName}_${version}_amd64.deb`],
];

const lines = [];
lines.push(`## ${productName} ${tag}`, '');
lines.push('Local-first API development platform — desktop installers for every platform.', '');

lines.push('### Installers', '');
lines.push('| Platform | Download |', '| --- | --- |');
for (const [label, url] of installers) {
  lines.push(`| ${label} | [\`${url.split('/').pop()}\`](${url}) |`);
}
lines.push('');
lines.push(
  'Updater artifacts (`*.sig`) and `latest.json` are published alongside the installers; ' +
    'the in-app updater picks them up automatically.',
  ''
);

lines.push("### What's changed", '');
if (commits.length === 0) {
  lines.push('_No commit list available for this tag._', '');
} else {
  const usedTitles = new Set();
  for (const [type, title] of SECTIONS) {
    const items = commits.filter((c) => c.type === type);
    if (items.length === 0 || usedTitles.has(title)) continue;
    usedTitles.add(title);
    lines.push(`#### ${title}`, '');
    for (const c of items) lines.push(`- ${c.subject} (${c.short})`);
    lines.push('');
  }
}

if (prevTag) {
  lines.push(`**Full changelog**: https://github.com/${repoSlug}/compare/${prevTag}...${tag}`, '');
} else {
  lines.push(`**Full changelog**: https://github.com/${repoSlug}/commits/${tag}`, '');
}

process.stdout.write(`${lines.join('\n').trimEnd()}\n`);
