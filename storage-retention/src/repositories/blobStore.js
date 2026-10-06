// 실제 파일(바이트) 저장소
// ⚠ 임시본: 지금은 맥북 폴더(STORAGE_ROOT)에 저장. 팀 GCP 계정이 생기면 GCS 버전으로 교체
//    → 함수 이름(saveFile / deleteFile / exists / getFilePath)만 같게 만들면 서비스 코드는 안 바꿔도 됨
import { mkdir, writeFile, rm, access } from 'node:fs/promises';
import path from 'node:path';

function rootDir() {
  return path.resolve(process.env.STORAGE_ROOT ?? './storage-data');
}

// storage_key → 실제 경로. 저장 폴더 밖으로 나가는 경로(../ 등)는 거부
function toFullPath(storageKey) {
  const root = rootDir();
  const fullPath = path.resolve(root, storageKey);
  if (!fullPath.startsWith(root + path.sep)) {
    throw new Error(`허용되지 않는 storage_key: ${storageKey}`);
  }
  return fullPath;
}

export async function saveFile(storageKey, buffer) {
  const fullPath = toFullPath(storageKey);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, buffer);
}

export async function deleteFile(storageKey) {
  await rm(toFullPath(storageKey), { force: true });
}

export async function exists(storageKey) {
  try {
    await access(toFullPath(storageKey));
    return true;
  } catch {
    return false;
  }
}

export function getFilePath(storageKey) {
  return toFullPath(storageKey);
}