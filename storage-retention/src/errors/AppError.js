// 서비스에서 "의도한 오류"를 던질 때 쓰는 클래스
// 예: throw new AppError(ERROR_CODES.NOT_FOUND, '파일을 찾을 수 없습니다.');
// ⚠ 임시본: Component 1의 AppError.js를 받으면 그 파일로 교체
export class AppError extends Error {
  constructor(errorCode, message) {
    super(message);
    this.status = errorCode.status;
    this.code = errorCode.code;
  }
}