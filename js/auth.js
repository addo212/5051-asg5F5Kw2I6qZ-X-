// auth.js
import { auth } from './database.js'; // Impor auth dari database.js
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } 
from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

// ============================================================================
// Loading state function
// ============================================================================
function setLoading(isLoading, buttonId = 'loginBtn') {
  const button = document.getElementById(buttonId);
  if (button) {
    if (isLoading) {
      button.textContent = buttonId === 'loginBtn' ? "Logging in..." : "Signing up...";
      button.disabled = true;
    } else {
      button.textContent = buttonId === 'loginBtn' ? "Login" : "Sign Up";
      button.disabled = false;
    }
  }
}

// ============================================================================
// Login function
// ============================================================================
document.getElementById('loginBtn')?.addEventListener('click', (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  if (!email || !password) {
    document.getElementById('authStatus').textContent = "Please enter both email and password";
    return;
  }
  
  setLoading(true);
  signInWithEmailAndPassword(auth, email, password)
    .then(() => {
      window.location.href = "dashboard.html";
    })
    .catch(error => {
      let errorMessage;
      if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
        errorMessage = "Wrong password or email. Try again.";
      } else if (error.code === "auth/user-not-found") {
        errorMessage = "Email not registered.";
      } else {
        errorMessage = "An error occurred. Please try again.";
        console.error("Login Error:", error);
      }
      document.getElementById('authStatus').textContent = errorMessage;
    })
    .finally(() => setLoading(false));
});

// ============================================================================
// Signup function
// ============================================================================
document.getElementById('signupBtn')?.addEventListener('click', () => {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  if (!email || !password) {
    document.getElementById('authStatus').textContent = "Please enter both email and password";
    return;
  }
  
  setLoading(true, 'signupBtn');
  createUserWithEmailAndPassword(auth, email, password)
    .then(() => {
      document.getElementById('authStatus').textContent = "Account created successfully! Please log in.";
    })
    .catch(error => {
      let errorMessage;
      if (error.code === "auth/email-already-in-use") {
        errorMessage = "Email already registered.";
      } else {
        errorMessage = "An error occurred during sign up.";
        console.error("Signup Error:", error);
      }
      document.getElementById('authStatus').textContent = errorMessage;
    })
    .finally(() => setLoading(false, 'signupBtn'));
});

// ============================================================================
// Auth state listener (untuk redirect)
// ============================================================================
onAuthStateChanged(auth, user => {
  const isOnLoginPage = window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/');
  
  if (user && isOnLoginPage) {
    window.location.href = "dashboard.html";
  }
});

// ============================================================================
// Logout handler
// ============================================================================
document.getElementById('logoutBtn')?.addEventListener('click', () => {
  signOut(auth).then(() => {
    window.location.href = "index.html";
  }).catch(error => {
    console.error("Error signing out:", error);
  });
});
