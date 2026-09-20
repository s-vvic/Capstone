import "./Signup.css";
import {
  signup,
  checkUserId
} from "../../api/authApi";

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const ID_MIN_LENGTH = 4;
const ID_MAX_LENGTH = 20;

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 64;

const ID_PATTERN = /^[A-Za-z0-9]*$/;
const PASSWORD_PATTERN = /^[A-Za-z0-9!@#$%^&*]*$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


function SignUp() {
  const navigate = useNavigate();

  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const [userIdError, setUserIdError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordConfirmError, setPasswordConfirmError] = useState("");
  const [emailError, setEmailError] = useState("");

  // 아이디 중복 확인
  const [isUserIdChecked, setIsUserIdChecked] = useState(false);
  const [userIdCheckMessage, setUserIdCheckMessage] = useState("");
  const [isCheckingId, setIsCheckingId] = useState(false);


  function handleUserIdChange(event) {
    const value = event.target.value;

    setUserId(value);

    // 아이디가 변경되면 중복 확인 다시 필요
    setIsUserIdChecked(false);
    setUserIdCheckMessage("");

    if (!ID_PATTERN.test(value)) {
      setUserIdError(
        "아이디는 영문과 숫자만 사용할 수 있습니다."
      );
      return;
    }

    setUserIdError("");
  }

  function handleEmailChange(event) {
    const value = event.target.value;

    setEmail(value);

    if (!value.trim()) {
      setEmailError("");
      return;
    }

    if (!EMAIL_PATTERN.test(value.trim())) {
      setEmailError("올바른 이메일 형식을 입력해주세요.");
      return;
    }

    setEmailError("");
  }


  async function handleCheckUserId() {
    if (!userId) {
      setUserIdError("아이디를 입력해주세요.");
      return;
    }

    if (
      userId.length < ID_MIN_LENGTH ||
      userId.length > ID_MAX_LENGTH
    ) {
      setUserIdError(
        `아이디는 ${ID_MIN_LENGTH}~${ID_MAX_LENGTH}자로 입력하세요.`
      );
      return;
    }

    if (!ID_PATTERN.test(userId)) {
      setUserIdError(
        "아이디는 영문과 숫자만 사용할 수 있습니다."
      );
      return;
    }

    try {
      setIsCheckingId(true);
      setUserIdError("");
      setUserIdCheckMessage("");

      const data = await checkUserId(userId);

      if (data.available) {
        setIsUserIdChecked(true);
        setUserIdCheckMessage(
          "사용 가능한 아이디입니다."
        );
      } else {
        setIsUserIdChecked(false);
        setUserIdError(
          "이미 사용 중인 아이디입니다."
        );
      }
    } catch (error) {
      console.error(error);

      setIsUserIdChecked(false);
      setUserIdError(
        "아이디 중복 확인에 실패했습니다."
      );
    } finally {
      setIsCheckingId(false);
    }
  }


  function handlePasswordChange(event) {
    const value = event.target.value;

    setPassword(value);

    if (!PASSWORD_PATTERN.test(value)) {
      setPasswordError(
        "비밀번호는 영문, 숫자, 특수문자(!, @, #, $, %, ^, &, *)만 사용할 수 있습니다."
      );
    } else {
      setPasswordError("");
    }

    if (
      passwordConfirm &&
      value !== passwordConfirm
    ) {
      setPasswordConfirmError(
        "비밀번호가 일치하지 않습니다."
      );
    } else {
      setPasswordConfirmError("");
    }
  }


  function handlePasswordConfirmChange(event) {
    const value = event.target.value;

    setPasswordConfirm(value);

    if (!PASSWORD_PATTERN.test(value)) {
      setPasswordConfirmError(
        "사용할 수 없는 문자가 포함되어 있습니다."
      );
      return;
    }

    if (value !== password) {
      setPasswordConfirmError(
        "비밀번호가 일치하지 않습니다."
      );
      return;
    }

    setPasswordConfirmError("");
  }


  async function handleSignUp(event) {
    event.preventDefault();

    if (
      userId.length < ID_MIN_LENGTH ||
      userId.length > ID_MAX_LENGTH
    ) {
      setUserIdError(
        `아이디는 ${ID_MIN_LENGTH}~${ID_MAX_LENGTH}자로 입력하세요.`
      );
      return;
    }

    if (!ID_PATTERN.test(userId)) {
      setUserIdError(
        "아이디는 영문과 숫자만 사용할 수 있습니다."
      );
      return;
    }

    // 중복 확인 여부
    if (!isUserIdChecked) {
      setUserIdError(
        "아이디 중복 확인을 해주세요."
      );
      return;
    }

    //이메일
    if (!email.trim()) {
      setEmailError("이메일을 입력해주세요.");
      return;
    }

    if (!EMAIL_PATTERN.test(email.trim())) {
      setEmailError("올바른 이메일 형식을 입력해주세요.");
      return;
    }

    setEmailError("");

    //비밀번호 검사
    if (
      password.length < PASSWORD_MIN_LENGTH ||
      password.length > PASSWORD_MAX_LENGTH
    ) {
      setPasswordError(
        `비밀번호는 ${PASSWORD_MIN_LENGTH}~${PASSWORD_MAX_LENGTH}자로 입력해주세요.`
      );
      return;
    }

    if (!PASSWORD_PATTERN.test(password)) {
      setPasswordError(
        "비밀번호는 영문, 숫자, 특수문자(!, @, #, $, %, ^, &, *)만 사용할 수 있습니다."
      );
      return;
    }

    if (password !== passwordConfirm) {
      setPasswordConfirmError(
        "비밀번호가 일치하지 않습니다."
      );
      return;
    }


    try {
      await signup(
        userId,
        email,
        password
      );

      navigate("/login");

    } catch (error) {

      // 중복확인 이후 다른 사람이 같은 ID를
      // 먼저 가입한 경우까지 대비
      if (error.code === "DUPLICATE_USER") {
        setIsUserIdChecked(false);
        setUserIdCheckMessage("");

        setUserIdError(
          "이미 사용 중인 아이디입니다."
        );

        return;
      }

      console.error(error);
    }
  }


  return (
    <section className="login-container">

      <h1 className="signup-title">
        회원가입
      </h1>

      <form
        className="signup-form"
        onSubmit={handleSignUp}
        noValidate
      >

        {/* 아이디 */}
        <div className="signup-field">

          <label htmlFor="userId">
            아이디
          </label>

          <div className="signup-id-row">

            <input
              id="userId"
              type="text"
              placeholder="아이디를 입력하세요."
              value={userId}
              maxLength={ID_MAX_LENGTH}
              className={
                userIdError
                  ? "input-error"
                  : ""
              }
              onChange={handleUserIdChange}
            />

            <button
              type="button"
              className="id-check-button"
              onClick={handleCheckUserId}
              disabled={isCheckingId}
            >
              {isCheckingId
                ? "확인 중"
                : "중복 확인"}
            </button>

          </div>

          <span className="signup-guide">
            영문, 숫자 4~20자
          </span>

          {userIdCheckMessage && (
            <p className="signup-success">
              {userIdCheckMessage}
            </p>
          )}

          {userIdError && (
            <p className="signup-error">
              {userIdError}
            </p>
          )}

        </div>


        {/* 이메일 */}
        <div className="signup-field">

          <label htmlFor="email">
            이메일
          </label>

          <input
            id="email"
            type="email"
            placeholder="이메일을 입력하세요"
            value={email}
            className={
              emailError
                ? "input-error"
                : ""
            }
            onChange={handleEmailChange}
          />

          {emailError && (
            <p className="signup-error">
              {emailError}
            </p>
          )}

        </div>


        {/* 비밀번호 */}
        <div className="signup-field">

          <label htmlFor="password">
            비밀번호
          </label>

          <input
            id="password"
            type="password"
            placeholder="비밀번호를 입력하세요"
            value={password}
            maxLength={PASSWORD_MAX_LENGTH}
            className={
              passwordError
                ? "input-error"
                : ""
            }
            onChange={handlePasswordChange}
          />

          <span className="signup-guide">
            영문, 숫자, 특수문자(!, @, #, $, %, ^, &, *) 8~64자
          </span>

          {passwordError && (
            <p className="signup-error">
              {passwordError}
            </p>
          )}

        </div>


        {/* 비밀번호 확인 */}
        <div className="signup-field">

          <label htmlFor="passwordConfirm">
            비밀번호 확인
          </label>

          <input
            id="passwordConfirm"
            type="password"
            placeholder="비밀번호를 다시 입력하세요"
            value={passwordConfirm}
            maxLength={PASSWORD_MAX_LENGTH}
            className={
              passwordConfirmError
                ? "input-error"
                : ""
            }
            onChange={
              handlePasswordConfirmChange
            }
          />

          {passwordConfirmError && (
            <p className="signup-error">
              {passwordConfirmError}
            </p>
          )}

        </div>


        <button
          type="submit"
          className="signup-button"
        >
          회원가입
        </button>

      </form>


      <div className="signup-links">
        <Link to="/login">
          이미 계정이 있으신가요?
        </Link>
      </div>

    </section>
  );
}

export default SignUp;