document.addEventListener("DOMContentLoaded", function () {
  function setToken(token) {
    localStorage.setItem("jwt_token", token);
    document.cookie = `jwt_token=${token}; path=/; max-age=86400`;
  }

  function getToken() {
    return localStorage.getItem("jwt_token");
  }

  function removeToken() {
    localStorage.removeItem("jwt_token");
    document.cookie = "jwt_token=; path=/; max-age=0";
  }

  function isLoggedIn() {
    const token = getToken();
    if (!token) {
      return false;
    }

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const exp = payload.exp;
      const isValid = exp * 1000 > Date.now();
      return isValid;
    } catch (error) {
      console.error("Error parsing token", error);
      return false;
    }
  }

  function getCurrentUser() {
    const token = getToken();
    if (!token) {
      return null;
    }

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return {
        id: payload.id,
        name: payload.name,
        username: payload.username,
        email: payload.email,
        phone: payload.phone,
      };
    } catch (error) {
      console.error("Error parsing token", error);
      return null;
    }
  }

  function addAuthHeader(headers = {}) {
    const token = getToken();
    if (token) {
      return {
        ...headers,
        Authorization: `Bearer ${token}`,
      };
    }
    return headers;
  }

  const checkAuthState = () => {
    if (isLoggedIn()) {
      if (
        window.location.pathname === "/login" ||
        window.location.pathname === "/register"
      ) {
        window.location.href = "/home";
      }
    } else {
      const protectedRoutes = ["/home", "/settings", "/ai-chat", "/calendar"];
      const currentPath = window.location.pathname;

      if (
        protectedRoutes.some(
          (route) =>
            currentPath === route || currentPath.startsWith(route + "/")
        )
      ) {
        window.location.href = "/login";
      }
    }
  };
  if (!window.location.search.includes("nocheck=true")) {
    checkAuthState();
  }
  window.addEventListener("load", function () {
    sessionStorage.removeItem("redirecting");
  });

  const alertDangerDivs = document.querySelectorAll(
    ".alert.bg-light-danger, .alert.alert-danger"
  );
  alertDangerDivs.forEach((div) => {
    if (div.textContent.trim() === "") {
      div.style.display = "none";
    }
  });

  const errorMeta = document.querySelector('meta[name="error-message"]');
  if (errorMeta && errorMeta.getAttribute("content")) {
    const errorMessage = errorMeta.getAttribute("content");
    const alertDiv = document.querySelector(".alert.bg-light-danger");
    if (alertDiv) {
      alertDiv.textContent = errorMessage;
      alertDiv.style.display = "block";
    }
  }
  const registerForm = document.querySelector(
    'form[action="/api/auth/register"]'
  );
  if (registerForm) {
    registerForm.addEventListener("submit", function (e) {
      e.preventDefault();

      const nameInput = registerForm.querySelector('input[name="name"]');
      const usernameInput = registerForm.querySelector(
        'input[name="username"]'
      );
      const emailInput = registerForm.querySelector('input[name="email"]');
      const phoneInput = registerForm.querySelector('input[name="phone"]');
      const passwordInput = registerForm.querySelector(
        'input[name="password"]'
      );
      const acceptCheckbox = registerForm.querySelector('input[name="acept"]');

      let isValid = true;
      clearErrors();
      if (!nameInput.value.trim()) {
        showError(nameInput, "Vui lòng nhập họ và tên");
        isValid = false;
      }
      if (!usernameInput.value.trim()) {
        showError(usernameInput, "Vui lòng nhập tên đăng nhập");
        isValid = false;
      } else if (usernameInput.value.trim().length < 6) {
        showError(usernameInput, "Tên đăng nhập phải có ít nhất 6 ký tự");
        isValid = false;
      }
      if (!isValidEmail(emailInput.value)) {
        showError(emailInput, "Vui lòng nhập đúng định dạng email");
        isValid = false;
      }
      if (!isValidPhone(phoneInput.value)) {
        showError(
          phoneInput,
          "Vui lòng nhập đúng số điện thoại (ít nhất 10 chữ số)"
        );
        isValid = false;
      }
      if (passwordInput.value.length < 6) {
        showError(passwordInput, "Mật khẩu phải có ít nhất 6 ký tự");
        isValid = false;
      }
      if (!acceptCheckbox.checked) {
        showError(acceptCheckbox, "Bạn phải đồng ý với điều khoản sử dụng");
        isValid = false;
      }

      if (!isValid) {
        const alertDiv = registerForm.querySelector(".alert.bg-light-danger");
        if (alertDiv) {
          alertDiv.textContent = "Vui lòng kiểm tra lại thông tin đăng ký";
          alertDiv.style.display = "block";
        }
        return;
      }

      const formData = {
        name: nameInput.value.trim(),
        username: usernameInput.value.trim(),
        email: emailInput.value.trim(),
        phone: phoneInput.value.trim(),
        password: passwordInput.value,
      };

      fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success && data.token) {
            setToken(data.token);

            if (window.flashMessage && data.message) {
              window.flashMessage.success(data.message);
            }

            setTimeout(() => {
              window.location.href = "/home";
            }, 1000);
          } else {
            const alertDiv = registerForm.querySelector(
              ".alert.bg-light-danger"
            );
            if (alertDiv) {
              alertDiv.textContent =
                data.message || "Đăng ký thất bại. Vui lòng thử lại sau.";
              alertDiv.style.display = "block";
            }

            if (window.flashMessage && data.message) {
              window.flashMessage.error(data.message);
            }
          }
        })
        .catch((error) => {
          console.error("Register error:", error);
          const alertDiv = registerForm.querySelector(".alert.bg-light-danger");
          if (alertDiv) {
            alertDiv.textContent =
              "Đã xảy ra lỗi khi đăng ký. Vui lòng thử lại sau.";
            alertDiv.style.display = "block";
          }
        });
    });
  }

  const loginForm = document.querySelector('form[action="/api/auth/login"]');
  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      sessionStorage.removeItem("login_loop_count");
      sessionStorage.removeItem("redirect_history");

      const usernameInput = loginForm.querySelector('input[name="username"]');
      const passwordInput = loginForm.querySelector('input[name="password"]');

      let isValid = true;
      clearErrors();
      if (!usernameInput.value.trim()) {
        showError(usernameInput, "Vui lòng nhập tên đăng nhập");
        isValid = false;
      }
      if (!passwordInput.value) {
        showError(passwordInput, "Vui lòng nhập mật khẩu");
        isValid = false;
      }

      if (!isValid) {
        const alertDiv = loginForm.querySelector(".alert.bg-light-danger");
        if (alertDiv) {
          alertDiv.textContent = "Vui lòng nhập đầy đủ thông tin đăng nhập";
          alertDiv.style.display = "block";
        }
        return;
      }

      fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: usernameInput.value.trim(),
          password: passwordInput.value,
        }),
        credentials: "include",
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success && data.token) {
            localStorage.setItem("jwt_token", data.token);
            sessionStorage.setItem("jwt_token", data.token);

            document.cookie = `jwt_token=${data.token}; path=/; max-age=${
              60 * 60 * 24
            }; SameSite=Lax`;

            if (window.flashMessage && data.message) {
              window.flashMessage.success(data.message);
            }

            setTimeout(() => {
              const redirectTo =
                document.querySelector('input[name="redirectTo"]')?.value ||
                "/home";
              window.location.href = redirectTo;
            }, 500);
          } else {
            const alertDiv = loginForm.querySelector(".alert.bg-light-danger");
            if (alertDiv) {
              alertDiv.textContent =
                data.message || "Đăng nhập thất bại. Vui lòng thử lại sau.";
              alertDiv.style.display = "block";
            }

            if (window.flashMessage && data.message) {
              window.flashMessage.error(data.message);
            }
          }
        })
        .catch((error) => {
          console.error("Login fetch error:", error);
          const alertDiv = loginForm.querySelector(".alert.bg-light-danger");
          if (alertDiv) {
            alertDiv.textContent =
              "Đã xảy ra lỗi khi đăng nhập. Vui lòng thử lại sau.";
            alertDiv.style.display = "block";
          }
        });
    });
  }

  const logoutBtn = document.querySelector('[data-action="logout"]');
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function (e) {
      e.preventDefault();
      fetch("/api/auth/logout", {
        method: "GET",
        credentials: "include",
      })
        .then((response) => response.json())
        .then((data) => {
          localStorage.removeItem("jwt_token");
          sessionStorage.removeItem("jwt_token");
          document.cookie = "jwt_token=; path=/; max-age=0";
          document.cookie = "token=; path=/; max-age=0";
          document.cookie =
            "jwt_token=; path=/; max-age=0; domain=" + window.location.hostname;
          document.cookie =
            "token=; path=/; max-age=0; domain=" + window.location.hostname;

          if (window.flashMessage) {
            window.flashMessage.success(
              data.message || "Đăng xuất thành công. Hẹn gặp lại!"
            );
          }
          window.location.href = "/login?logged_out=true";
        })
        .catch((error) => {
          console.error("Logout error:", error);
          localStorage.removeItem("jwt_token");
          sessionStorage.removeItem("jwt_token");
          document.cookie = "jwt_token=; path=/; max-age=0";
          document.cookie = "token=; path=/; max-age=0";
          window.location.href = "/login?force_logout=true";
        });
    });
  }
  const profileForm = document.querySelector(
    'form[action="/api/user/update-profile"]'
  );
  if (profileForm) {
    profileForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const nameInput = profileForm.querySelector('input[name="name"]');
      const usernameInput = profileForm.querySelector('input[name="username"]');
      const emailInput = profileForm.querySelector('input[name="email"]');
      const phoneInput = profileForm.querySelector('input[name="phone"]');
      const alertDiv = profileForm.querySelector(".alert.alert-danger");

      let isValid = true;
      clearErrors();

      if (!nameInput.value.trim()) {
        showError(nameInput, "Vui lòng nhập họ và tên");
        isValid = false;
      }
      if (!usernameInput.value.trim()) {
        showError(usernameInput, "Vui lòng nhập tên đăng nhập");
        isValid = false;
      } else if (usernameInput.value.trim().length < 6) {
        showError(usernameInput, "Tên đăng nhập phải có ít nhất 6 ký tự");
        isValid = false;
      }
      if (!isValidEmail(emailInput.value)) {
        showError(emailInput, "Vui lòng nhập đúng định dạng email");
        isValid = false;
      }
      if (!isValidPhone(phoneInput.value)) {
        showError(
          phoneInput,
          "Vui lòng nhập đúng số điện thoại (ít nhất 10 chữ số)"
        );
        isValid = false;
      }

      if (!isValid) {
        if (alertDiv) {
          alertDiv.textContent = "Vui lòng kiểm tra lại thông tin cập nhật";
          alertDiv.style.display = "block";
        }
        const btn = document.getElementById("update-profile-btn");
        if (btn) {
          const spinner = btn.querySelector(".spinner-border");
          if (spinner) spinner.classList.add("d-none");
          btn.disabled = false;
        }

        if (window.flashMessage) {
          window.flashMessage.error("Vui lòng kiểm tra lại thông tin cập nhật");
        }
        return;
      }
      const btn = document.getElementById("update-profile-btn");
      if (btn) {
        const spinner = btn.querySelector(".spinner-border");
        if (spinner) spinner.classList.remove("d-none");
        btn.disabled = true;
      }

      fetch("/api/user/update-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...addAuthHeader(),
        },
        body: JSON.stringify({
          name: nameInput.value.trim(),
          username: usernameInput.value.trim(),
          email: emailInput.value.trim(),
          phone: phoneInput.value.trim(),
        }),
      })
        .then((response) => response.json())
        .then((data) => {
          if (btn) {
            const spinner = btn.querySelector(".spinner-border");
            if (spinner) spinner.classList.add("d-none");
            btn.disabled = false;
          }

          if (data.success) {
            if (data.token) {
              setToken(data.token);
            }
            if (window.flashMessage) {
              window.flashMessage.success(
                data.message || "Cập nhật thông tin thành công!"
              );
            }
            setTimeout(() => {
              window.location.reload();
            }, 1500);
          } else {
            if (alertDiv) {
              alertDiv.textContent = data.message;
              alertDiv.style.display = "block";
            }
            if (window.flashMessage) {
              window.flashMessage.error(
                data.message || "Cập nhật thông tin thất bại!"
              );
            }
          }
        })
        .catch((error) => {
          console.error("Update profile error:", error);
          if (btn) {
            const spinner = btn.querySelector(".spinner-border");
            if (spinner) spinner.classList.add("d-none");
            btn.disabled = false;
          }

          if (alertDiv) {
            alertDiv.textContent = "Đã xảy ra lỗi khi cập nhật thông tin";
            alertDiv.style.display = "block";
          }
          if (window.flashMessage) {
            window.flashMessage.error("Đã xảy ra lỗi khi cập nhật thông tin");
          }
        });
    });
  }
  const passwordForm = document.querySelector(
    'form[action="/api/user/change-password"]'
  );
  if (passwordForm) {
    passwordForm.addEventListener("submit", function (e) {
      e.preventDefault();

      const currentPasswordInput = passwordForm.querySelector(
        'input[name="currentPassword"]'
      );
      const newPasswordInput = passwordForm.querySelector(
        'input[name="newPassword"]'
      );
      const confirmPasswordInput = passwordForm.querySelector(
        'input[name="confirmPassword"]'
      );
      const alertDiv = passwordForm.querySelector(".alert.alert-danger");

      let isValid = true;
      clearErrors();

      if (!currentPasswordInput.value) {
        showError(currentPasswordInput, "Vui lòng nhập mật khẩu hiện tại");
        isValid = false;
      }
      if (newPasswordInput.value.length < 6) {
        showError(newPasswordInput, "Mật khẩu mới phải có ít nhất 6 ký tự");
        isValid = false;
      }
      if (confirmPasswordInput.value !== newPasswordInput.value) {
        showError(
          confirmPasswordInput,
          "Mật khẩu xác nhận không khớp với mật khẩu mới"
        );
        isValid = false;
      }

      if (!isValid) {
        if (alertDiv) {
          alertDiv.textContent = "Vui lòng kiểm tra lại thông tin đổi mật khẩu";
          alertDiv.style.display = "block";
        }

        const btn = document.getElementById("change-password-btn");
        if (btn) {
          const spinner = btn.querySelector(".spinner-border");
          if (spinner) spinner.classList.add("d-none");
          btn.disabled = false;
        }

        if (window.flashMessage) {
          window.flashMessage.error(
            "Vui lòng kiểm tra lại thông tin đổi mật khẩu"
          );
        }
        return;
      }
      const btn = document.getElementById("change-password-btn");
      if (btn) {
        const spinner = btn.querySelector(".spinner-border");
        if (spinner) spinner.classList.remove("d-none");
        btn.disabled = true;
      }

      fetch("/api/user/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...addAuthHeader(),
        },
        body: JSON.stringify({
          currentPassword: currentPasswordInput.value,
          newPassword: newPasswordInput.value,
          confirmPassword: confirmPasswordInput.value,
        }),
      })
        .then((response) => response.json())
        .then((data) => {
          if (btn) {
            const spinner = btn.querySelector(".spinner-border");
            if (spinner) spinner.classList.add("d-none");
            btn.disabled = false;
          }

          if (data.success) {
            if (window.flashMessage) {
              window.flashMessage.success(
                data.message || "Đổi mật khẩu thành công!"
              );
            }
            passwordForm.reset();
            if (alertDiv) {
              alertDiv.style.display = "none";
            }
          } else {
            if (alertDiv) {
              alertDiv.textContent = data.message;
              alertDiv.style.display = "block";
            }
            if (window.flashMessage) {
              window.flashMessage.error(
                data.message || "Đổi mật khẩu thất bại!"
              );
            }
          }
        })
        .catch((error) => {
          console.error("Change password error:", error);
          if (btn) {
            const spinner = btn.querySelector(".spinner-border");
            if (spinner) spinner.classList.add("d-none");
            btn.disabled = false;
          }

          if (alertDiv) {
            alertDiv.textContent = "Đã xảy ra lỗi khi đổi mật khẩu";
            alertDiv.style.display = "block";
          }
          if (window.flashMessage) {
            window.flashMessage.error("Đã xảy ra lỗi khi đổi mật khẩu");
          }
        });
    });
  }
  function showError(input, message) {
    const formGroup = input.closest(".form-group") || input.closest(".mb-3");
    
    if (formGroup) {
      const error = document.createElement("div");
      error.className = "text-danger mt-1";
      error.innerText = message;
      formGroup.appendChild(error);
    } else {
      const error = document.createElement("div");
      error.className = "text-danger mt-1";
      error.innerText = message;
      input.parentNode.appendChild(error);
    }
    
    input.classList.add("is-invalid");
  }
  function clearErrors() {
    document.querySelectorAll(".text-danger").forEach((el) => el.remove());
    document
      .querySelectorAll(".is-invalid")
      .forEach((el) => el.classList.remove("is-invalid"));
  }
  function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }
  function isValidPhone(phone) {
    return /^\d{10,}$/.test(phone);
  }
});

function showLoadingState(formSelector, buttonId) {
  const form = document.querySelector(formSelector);
  if (form) {
    form.addEventListener("submit", function () {
      const btn = document.getElementById(buttonId);
      if (btn) {
        const spinner = btn.querySelector(".spinner-border");
        if (spinner) spinner.classList.remove("d-none");
        btn.disabled = true;

        setTimeout(() => {
          if (btn.disabled) {
            const formHasError = form.querySelector(
              ".alert.alert-danger:not([style*='none'])"
            );
            if (formHasError) {
              if (spinner) spinner.classList.add("d-none");
              btn.disabled = false;
            }
          }
        }, 5000);
      }
    });
  }
}

showLoadingState(
  'form[action="/api/user/change-password"]',
  "change-password-btn"
);
showLoadingState(
  'form[action="/api/user/update-profile"]',
  "update-profile-btn"
);
