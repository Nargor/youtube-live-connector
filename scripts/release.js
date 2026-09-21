'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ENV_PATH = path.join(__dirname, '..', '.env');
const NPMRC_PATH = path.join(__dirname, '..', '.npmrc');

// 1. Check and load .env file
if (!fs.existsSync(ENV_PATH)) {
  const template = `# Paste your npm publish / automation token below:\nNPM_TOKEN=\n`;
  fs.writeFileSync(ENV_PATH, template, 'utf8');
  console.error('⚠️  ไม่พบไฟล์ .env หรือยังไม่ได้ระบุ NPM_TOKEN');
  console.error('📝 ได้สร้างไฟล์ .env ให้แล้ว กรุณาใส่ Token ในบรรทัด:');
  console.error('   NPM_TOKEN=your_npm_token_here');
  console.error('   จากนั้นรัน: npm run release อีกครั้ง');
  process.exit(1);
}

try {
  process.loadEnvFile(ENV_PATH);
} catch (e) {
  // Fallback if loadEnvFile fails
  const content = fs.readFileSync(ENV_PATH, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [k, ...v] = trimmed.split('=');
      process.env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
    }
  }
}

const token = process.env.NPM_TOKEN || process.env.NODE_AUTH_TOKEN || process.env.TOKEN;

if (!token) {
  console.error('⚠️  ไม่พบ NPM_TOKEN ในไฟล์ .env');
  console.error('📝 กรุณาเปิดไฟล์ .env แล้วใส่ Token ในรูปแบบ:');
  console.error('   NPM_TOKEN=npm_xxxxxxxxxxxxxxxxxxxx');
  process.exit(1);
}

console.log('🚀 กำลังเตรียม Release ขึ้น npm...');
console.log('🔑 ตรวจพบ NPM Token จาก .env เรียบร้อย');

// 2. Write temporary .npmrc with the token
const npmrcContent = `//registry.npmjs.org/:_authToken=${token}\nregistry=https://registry.npmjs.org/\n`;
fs.writeFileSync(NPMRC_PATH, npmrcContent, 'utf8');

const pkg = require('../package.json');

// Check for OTP flag from CLI arguments e.g. `npm run release -- --otp=123456` or `process.env.OTP`
const otpArg = process.argv.find(a => a.startsWith('--otp=')) || (process.env.OTP ? `--otp=${process.env.OTP}` : '');

// Check for --tag flag from CLI arguments, or automatically infer for prerelease versions (e.g. 1.0.4-beta -> --tag beta)
let tagArg = '';
const explicitTag = process.argv.find(a => a.startsWith('--tag='));
if (explicitTag) {
  tagArg = explicitTag;
} else if (process.argv.includes('--tag')) {
  const idx = process.argv.indexOf('--tag');
  if (process.argv[idx + 1]) {
    tagArg = `--tag ${process.argv[idx + 1]}`;
  }
} else if (pkg.version && pkg.version.includes('-')) {
  // Prerelease version e.g. "1.0.4-beta" -> infer tag "beta"
  const prereleaseTag = pkg.version.split('-')[1].split('.')[0].replace(/[^a-zA-Z0-9_-]/g, '') || 'beta';
  tagArg = `--tag ${prereleaseTag}`;
}

const publishCmd = ['npm publish', tagArg, otpArg].filter(Boolean).join(' ');

try {
  console.log(`📦 กำลังรัน ${publishCmd}...`);
  execSync(publishCmd, {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_AUTH_TOKEN: token,
      NPM_TOKEN: token
    }
  });

  console.log('\n🎉 Release เวอร์ชันใหม่ขึ้น npm สำเร็จเรียบร้อยแล้ว!');
} catch (err) {
  console.error('\n❌ เกิดข้อผิดพลาดในการ Publish:', err.message);
  process.exit(1);
} finally {
  // Cleanup temporary .npmrc
  if (fs.existsSync(NPMRC_PATH)) {
    try {
      fs.unlinkSync(NPMRC_PATH);
    } catch (e) {}
  }
}
