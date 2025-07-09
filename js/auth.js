import firebaseConfig from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } 
from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Login function
document.getElementById('loginBtn')?.addEventListener('click', () => {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
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
    });
});

// Signup function
document.getElementById('signupBtn')?.addEventListener('click', () => {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
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
    });
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
  signOut(auth).then(() => {
    window.location.href = "index.html";
  });
});
