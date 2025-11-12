// Password toggle
const togglePassword = document.getElementById("togglePassword");
const passwordField = document.getElementById("password");
const loader = document.querySelector(".loader");

if (togglePassword && passwordField) {
  togglePassword.addEventListener("click", () => {
    const isPassword = passwordField.type === "password";
    passwordField.type = isPassword ? "text" : "password";
    togglePassword.textContent = isPassword ? "🙈" : "👁";
  });
}

// Show loading spinner when form is submitted
const form = document.getElementById("loginForm");
if (form) {
  form.addEventListener("submit", () => {
    if (loader) {
      loader.classList.add("show");
    }
  });
}
