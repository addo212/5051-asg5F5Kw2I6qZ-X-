// js/profile.js

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, updateProfile, updateEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Global variables
let userId;
let userData;

// Initialize on auth state change
onAuthStateChanged(auth, (user) => {
    if (user) {
        userId = user.uid;
        initializeProfile();
        setupEventListeners();
    } else {
        window.location.href = "index.html";
    }
});

// Initialize profile page
async function initializeProfile() {
    try {
        // Load user data
        userData = await loadUserData(userId);
        
        if (!userData) {
            console.error("User data not found!");
            return;
        }
        
        // Update profile information
        updateProfileDisplay();
        
        // Populate form fields
        populateFormFields();
        
        // Setup theme toggle
        setupThemeToggle();
        
    } catch (error) {
        console.error("Error initializing profile:", error);
    }
}

// Load user data from Firestore
async function loadUserData(userId) {
    try {
        const userDocRef = doc(db, "users", userId);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
            return userDoc.data();
        } else {
            console.log("No user data found!");
            return null;
        }
    } catch (error) {
        console.error("Error loading user data:", error);
        throw error;
    }
}

// Update user profile in Firestore and Auth
async function updateUserProfile(userId, profileData) {
    try {
        // Update in Firestore
        const userDocRef = doc(db, "users", userId);
        await updateDoc(userDocRef, profileData);
        
        // Update in Auth if displayName is provided
        if (profileData.displayName) {
            await updateProfile(auth.currentUser, {
                displayName: profileData.displayName
            });
        }
        
        return true;
    } catch (error) {
        console.error("Error updating user profile:", error);
        throw error;
    }
}

// Update user password
async function updateUserPassword(currentPassword, newPassword) {
    try {
        const user = auth.currentUser;
        
        // Re-authenticate user before changing password
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        
        // Update password
        await updatePassword(user, newPassword);
        
        return true;
    } catch (error) {
        console.error("Error updating password:", error);
        throw error;
    }
}

// Update profile display with user data
function updateProfileDisplay() {
    // Get user data
    const displayName = userData?.displayName || auth.currentUser?.displayName || 'User';
    const email = userData?.email || auth.currentUser?.email || 'user@example.com';
    const photoURL = userData?.photoURL || auth.currentUser?.photoURL;
    const creationTime = auth.currentUser?.metadata?.creationTime;
    
    // Update profile avatar
    const profileAvatar = document.getElementById('profileAvatar');
    if (profileAvatar) {
        if (photoURL) {
            profileAvatar.src = photoURL;
        } else {
            // Use initials as avatar if no photo URL
            profileAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random&color=fff&size=128`;
        }
    }
    
    // Update all user name elements
    const userNameElements = document.querySelectorAll('.user-name');
    userNameElements.forEach(element => {
        element.textContent = displayName;
    });
    
    // Update all user email elements
    const userEmailElements = document.querySelectorAll('.user-email');
    userEmailElements.forEach(element => {
        element.textContent = email;
    });
    
    // Update profile information
    document.getElementById('profileName').textContent = displayName;
    document.getElementById('profileEmail').textContent = email;
    
    // Format and display join date
    if (creationTime) {
        const joinDate = new Date(creationTime);
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('profileJoinDate').textContent = joinDate.toLocaleDateString('en-US', options);
    }
}

// Populate form fields with user data
function populateFormFields() {
    const displayName = userData?.displayName || auth.currentUser?.displayName || '';
    const email = userData?.email || auth.currentUser?.email || '';
    
    // Split display name into first and last name (best guess)
    const nameParts = displayName.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    
    // Set form field values
    document.getElementById('firstName').value = userData?.firstName || firstName;
    document.getElementById('lastName').value = userData?.lastName || lastName;
    document.getElementById('displayName').value = displayName;
    document.getElementById('email').value = email;
}

// Setup theme toggle
function setupThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;
    
    // Set initial state based on current theme
    const currentTheme = document.documentElement.getAttribute('data-theme');
    themeToggle.checked = currentTheme === 'dark';
    
    // Add event listener
    themeToggle.addEventListener('change', function() {
        const newTheme = this.checked ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });
}

// Setup event listeners
function setupEventListeners() {
    // Personal info form submission
    const personalInfoForm = document.getElementById('personalInfoForm');
    if (personalInfoForm) {
        personalInfoForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const firstName = document.getElementById('firstName').value.trim();
            const lastName = document.getElementById('lastName').value.trim();
            const displayName = document.getElementById('displayName').value.trim() || `${firstName} ${lastName}`.trim();
            
            try {
                await updateUserProfile(userId, {
                    displayName,
                    firstName,
                    lastName
                });
                
                // Reload user data and update display
                userData = await loadUserData(userId);
                updateProfileDisplay();
                
                showToast('Profile updated successfully!', 'success');
            } catch (error) {
                console.error('Error updating profile:', error);
                showToast('Failed to update profile. Please try again.', 'error');
            }
        });
    }
    
    // Security form submission
    const securityForm = document.getElementById('securityForm');
    if (securityForm) {
        securityForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            // Validate passwords
            if (newPassword !== confirmPassword) {
                showToast('New passwords do not match!', 'error');
                return;
            }
            
            if (newPassword.length < 6) {
                showToast('Password must be at least 6 characters long!', 'error');
                return;
            }
            
            try {
                await updateUserPassword(currentPassword, newPassword);
                
                // Clear form
                document.getElementById('currentPassword').value = '';
                document.getElementById('newPassword').value = '';
                document.getElementById('confirmPassword').value = '';
                
                showToast('Password updated successfully!', 'success');
            } catch (error) {
                console.error('Error updating password:', error);
                
                // Show specific error message
                if (error.code === 'auth/wrong-password') {
                    showToast('Current password is incorrect.', 'error');
                } else if (error.code === 'auth/requires-recent-login') {
                    showToast('Please log out and log back in before changing your password.', 'error');
                } else {
                    showToast(`Failed to update password: ${error.message}`, 'error');
                }
            }
        });
    }
    
    // Change avatar button
    const changeAvatarBtn = document.getElementById('changeAvatarBtn');
    if (changeAvatarBtn) {
        changeAvatarBtn.addEventListener('click', () => {
            // This would typically open a file picker or avatar selection modal
            showToast('Avatar change functionality will be implemented soon!', 'info');
        });
    }
    
    // Edit profile button
    const editProfileBtn = document.getElementById('editProfileBtn');
    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', () => {
            // Scroll to the personal info form
            document.getElementById('personalInfoForm').scrollIntoView({ behavior: 'smooth' });
        });
    }
    
    // Mobile menu toggle
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const mobileNav = document.getElementById('mobileNav');
    const mobileNavClose = document.getElementById('mobileNavClose');

    if (mobileMenuToggle && mobileNav && mobileNavClose) {
        mobileMenuToggle.addEventListener('click', function() {
            mobileNav.classList.add('active');
        });

        mobileNavClose.addEventListener('click', function() {
            mobileNav.classList.remove('active');
        });
    }

    // User menu toggle
    const userMenuBtn = document.getElementById('userMenu');
    if (userMenuBtn) {
        userMenuBtn.addEventListener('click', function() {
            this.classList.toggle('active');
        });

        // Close user menu when clicking outside
        document.addEventListener('click', function(event) {
            if (!userMenuBtn.contains(event.target)) {
                userMenuBtn.classList.remove('active');
            }
        });
    }

    // Notifications toggle
    const notificationsBtn = document.getElementById('notificationsBtn');
    if (notificationsBtn) {
        notificationsBtn.addEventListener('click', function() {
            this.classList.toggle('active');
        });

        // Close notifications when clicking outside
        document.addEventListener('click', function(event) {
            if (!notificationsBtn.contains(event.target)) {
                notificationsBtn.classList.remove('active');
            }
        });
    }
    
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to logout?')) {
                try {
                    await auth.signOut();
                    window.location.href = "index.html";
                } catch (error) {
                    console.error('Error signing out:', error);
                    showToast('Failed to sign out. Please try again.', 'error');
                }
            }
        });
    }
    
    // Mobile logout button
    const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
    if (mobileLogoutBtn) {
        mobileLogoutBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to logout?')) {
                try {
                    await auth.signOut();
                    window.location.href = "index.html";
                } catch (error) {
                    console.error('Error signing out:', error);
                    showToast('Failed to sign out. Please try again.', 'error');
                }
            }
        });
    }
    
    // Back button (already works with href, no JS needed)
}

// Show toast notification
function showToast(message, type = 'info') {
    // Check if toast container exists, if not create it
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Add icon based on type
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    if (type === 'warning') icon = 'exclamation-triangle';
    
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas fa-${icon}"></i>
        </div>
        <div class="toast-content">${message}</div>
        <button class="toast-close">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Add to container
    toastContainer.appendChild(toast);
    
    // Add close functionality
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
        toast.classList.add('toast-hiding');
        setTimeout(() => {
            toast.remove();
        }, 300);
    });
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.add('toast-hiding');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 300);
        }
    }, 5000);
    
    // Animate in
    setTimeout(() => {
        toast.classList.add('toast-visible');
    }, 10);
}

// Add toast styles dynamically if not already in the document
function addToastStyles() {
    if (!document.getElementById('toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            .toast-container {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-width: 300px;
            }
            
            .toast {
                background-color: var(--bg-secondary);
                color: var(--text-primary);
                border-left: 4px solid var(--accent-color);
                border-radius: var(--border-radius-md);
                padding: 12px;
                display: flex;
                align-items: center;
                box-shadow: var(--card-shadow);
                transform: translateX(100%);
                opacity: 0;
                transition: transform 0.3s ease, opacity 0.3s ease;
            }
            
            .toast-visible {
                transform: translateX(0);
                opacity: 1;
            }
            
            .toast-hiding {
                transform: translateX(100%);
                opacity: 0;
            }
            
            .toast-icon {
                margin-right: 12px;
                font-size: 1.2rem;
                color: var(--accent-color);
            }
            
            .toast-content {
                flex-grow: 1;
                font-size: 0.9rem;
            }
            
            .toast-close {
                background: none;
                border: none;
                color: var(--text-tertiary);
                cursor: pointer;
                padding: 0;
                font-size: 0.9rem;
                margin-left: 12px;
            }
            
            .toast-close:hover {
                color: var(--text-primary);
            }
            
            .toast-success {
                border-left-color: var(--success-color);
            }
            
            .toast-success .toast-icon {
                color: var(--success-color);
            }
            
            .toast-error {
                border-left-color: var(--danger-color);
            }
            
            .toast-error .toast-icon {
                color: var(--danger-color);
            }
            
            .toast-warning {
                border-left-color: var(--warning-color);
            }
            
            .toast-warning .toast-icon {
                color: var(--warning-color);
            }
            
            @media (max-width: 576px) {
                .toast-container {
                    left: 20px;
                    right: 20px;
                    max-width: none;
                }
                
                .toast {
                    width: 100%;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// Call this when the script loads
addToastStyles()
