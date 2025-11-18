#!/usr/bin/env node
const crypto = require('crypto');

function usage() {
  console.log('Usage: node scripts/generate_initdata.js --token BOT_TOKEN [--id 12345] [--first_name John] [--username jdoe] [--lang en]');
  process.exit(1);
}

// tiny arg parser (no external deps)
const raw = process.argv.slice(2);
const argv = {};
for (let i = 0; i < raw.length; i++) {
  const a = raw[i];
  if (a.startsWith('--')) {
    const key = a.slice(2);
    const next = raw[i + 1];
    if (next && !next.startsWith('--')) {
      argv[key] = next;
      i++;
    } else {
      argv[key] = true;
    }
  }
}

const token = argv.token || process.env.BOT_TOKEN;
if (!token) usage();

const user = {
  id: Number(argv.id || 123456789),
  first_name: argv.first_name || 'Test',
  last_name: argv.last_name || 'User',
  username: argv.username || 'testuser',
  language_code: argv.lang || 'en',
};

const auth_date = Math.floor(Date.now() / 1000);

// Build data object (values are raw, not url-encoded) as Telegram expects
const data = {
  user: JSON.stringify(user),
  auth_date: String(auth_date),
};

const keys = Object.keys(data).sort();
const data_check_string = keys.map(k => `${k}=${data[k]}`).join('\n');

// key = SHA256(bot_token)
const keyHash = crypto.createHash('sha256').update(token, 'utf8').digest();
const hmac = crypto.createHmac('sha256', keyHash).update(data_check_string, 'utf8').digest('hex');

// Build initData with URL-encoded values
const parts = [];
for (const k of keys) {
  parts.push(`${k}=${encodeURIComponent(data[k])}`);
}
parts.push(`hash=${hmac}`);

const initData = parts.join('&');
console.log(initData);
