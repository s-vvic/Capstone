
export async function login(userId, password) {
  const response = await fetch("/api/login", {
    method: "POST",
    headers: {
        "Content-Type": "application/json"
    },
    body:
    JSON.stringify({
        userId,
        password
    })
  });

  if (response.status === 401) {
    const error = new Error("INVALID_CREDENTIALS");
          //INVALID_CREDENTIALS는 상태 코드 401에 프론트가 네이밍
    error.code ="INVALID_CREDENTIALS";
    throw error;
  }

  if (!response.ok) {
    const error = new Error("LOGIN_FAILED");
    error.code = "LOGIN_FAILED";
    throw error;
  }
  return await response.json();
}

export async function checkUserId(userId) {
  const response = await fetch(
    `/api/signup/check-id?userId=${encodeURIComponent(userId)}`,
    {
      method: "GET"
    }
  );

  if (!response.ok) {
    const error = new Error("ID_CHECK_FAILED");
    error.code = "ID_CHECK_FAILED";
    throw error;
  }
  return await response.json();
}

export async function signup(userId, email, password) {
  const response = await fetch("/api/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ 
      userId,
      email,
      password
    })
  });

  if (response.status === 409) {
    const error = new Error("DUPLICATE_USER");
    error.code = "DUPLICATE_USER";
    throw error;
  }

  if (!response.ok) {
    const error = new Error("SIGNUP_FAILED");
    error.code = "SIGNUP_FAILED";
    throw error;
  }

  return await response.json();
}