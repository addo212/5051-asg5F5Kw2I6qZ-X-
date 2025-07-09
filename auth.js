// Initialize Firebase (paste your config here)
const firebaseConfig = {
  apiKey: "AIzaSyBSwh3Qj-rmHIbDFP63VY3omfjXa7XFqhw",
  authDomain: "adlan-money-trancker.firebaseapp.com",
  projectId: "adlan-money-trancker",
  storageBucket: "adlan-money-trancker.appspot.com",
  messagingSenderId: "686344739681",
  appId: "1:686344739681:web:ad4fa48709e96c3ae30320"
};

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
