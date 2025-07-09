import firebaseConfig from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } 
from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Loading state function
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

// Login function
document.getElementById('loginBtn')?.addEventListener('click', (e) => {
  e.preventDefault(); // Prevent default form submission
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  // Simple validation
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
      let errorMessage = error.message;
      if (error.code === "auth/wrong-password") {
        errorMessage = "Wrong password. Try again.";
      } else if (error.code === "auth/user-not-found") {
        errorMessage = "Email not registered.";
      }
      document.getElementById('authStatus').textContent = errorMessage;
    })
    .finally(() => setLoading(false));
});

// Signup function
document.getElementById('signupBtn')?.addEventListener('click', () => {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  // Simple validation
  if (!email || !password) {
    document.getElementById('authStatus').textContent = "Please enter both email and password";
    return;
  }
  
  setLoading(true, 'signupBtn');
  createUserWithEmailAndPassword(auth, email, password)
    .then(() => {
      document.getElementById('authStatus').textContent = "Account created successfully!";
    })
    .catch(error => {
      let errorMessage = error.message;
      if (error.code === "auth/email-already-in-use") {
        errorMessage = "Email already registered.";
      }
      document.getElementById('authStatus').textContent = errorMessage;
    })
    .finally(() => setLoading(false, 'signupBtn'));
});

// Auth state listener
onAuthStateChanged(auth, user => {
  const isOnLoginPage = window.location.pathname.includes('index.html') || 
                        window.location.pathname === '/';
  
  if (user && isOnLoginPage) {
    window.location.href = "dashboard.html";
  }
});

// Logout handler
document.getElementById('logoutBtn')?.addEventListener('click', () => {
  console.log("Logout button clicked"); // Debugging
  signOut(auth).then(() => {
    window.location.href = "index.html";
  }).catch(error => {
    console.error("Error signing out:", error);
  });
});

// Check if we're on dashboard and log auth state
if (window.location.pathname.includes('dashboard.html')) {
  console.log("On dashboard, auth state:", auth.currentUser);
}
