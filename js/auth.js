// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// Login function
document.getElementById('loginBtn')?.addEventListener('click', () => {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  auth.signInWithEmailAndPassword(email, password)
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
  
  auth.createUserWithEmailAndPassword(email, password)
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
auth.onAuthStateChanged(user => {
  const isOnLoginPage = window.location.pathname.includes('index.html') || 
                        window.location.pathname === '/';
  
  if (user && isOnLoginPage) {
    window.location.href = "dashboard.html";
  }
});

// Logout handler (optional chaining)
document.getElementById('logoutBtn')?.addEventListener('click', () => {
  auth.signOut().then(() => {
    window.location.href = "index.html";
  });
});
