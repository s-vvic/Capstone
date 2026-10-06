// 저장할 수 있는 파일 형식 (NF-C-004 JPG, NF-C-003 MP4)
const MB = 1024 * 1024;

export const FILE_TYPES = Object.freeze({
  image: { extension: 'jpg', mimeType: 'image/jpeg', maxBytes: 5 * MB },
  video: { extension: 'mp4', mimeType: 'video/mp4', maxBytes: 100 * MB },
});

// 파일 맨 앞 바이트(시그니처)로 진짜 JPG / MP4인지 확인 — 확장자만 믿지 않기
export function matchesSignature(fileType, buffer) {
  if (fileType === 'image') {
    // JPG는 FF D8 FF 로 시작
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (fileType === 'video') {
    // MP4는 5~8번째 바이트가 'ftyp'
    return buffer.length >= 8 && buffer.toString('ascii', 4, 8) === 'ftyp';
  }
  return false;
}