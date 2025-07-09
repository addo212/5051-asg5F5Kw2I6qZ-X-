// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// Login function
document.getElementById('loginBtn').addEventListener('click', () => {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  auth.signInWithEmailAndPassword(email, password)
    .then(() => {
      window.location.href = "dashboard.html";
    })
    .catch(error => {
      document.getElementById('authStatus').textContent = error.message;
    });
});

// Signup function
document.getElementById('signupBtn').addEventListener('click', () => {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  auth.createUserWithEmailAndPassword(email, password)
    .then(() => {
      document.getElementById('authStatus').textContent = "Account created successfully!";
    })
    .catch(error => {
      document.getElementById('authStatus').textContent = error.message;
    });
});

// Check auth state to redirect logged-in users
auth.onAuthStateChanged(user => {
  if (user && window.location.pathname === '/index.html') {
    window.location.href = "dashboard.html";
  }
});

// Add to existing auth.js
if (document.getElementById('logoutBtn')) {
  document.getElementById('logoutBtn').addEventListener('click', () => {
    auth.signOut().then(() => {
      window.location.href = "index.html";
    });
  });
}
