// 로컬 테스트용 JWT 발급 (Component 1 로그인 대신 사용)
// 사용법: node scripts/makeDevToken.js basic      (basic / standard / premium)
import 'dotenv/config';
import jwt from 'jsonwebtoken';

const TEST_USERS = {
  basic:    '11111111-1111-1111-1111-111111111111',
  standard: '22222222-2222-2222-2222-222222222222',
  premium:  '33333333-3333-3333-3333-333333333333',
};

const plan = process.argv[2] ?? 'basic';
if (!TEST_USERS[plan]) {
  console.error('basic / standard / premium 중 하나를 적어 주세요.');
  process.exit(1);
}

const token = jwt.sign({ user_id: TEST_USERS[plan] }, process.env.JWT_SECRET, { expiresIn: '7d' });
console.log(token);