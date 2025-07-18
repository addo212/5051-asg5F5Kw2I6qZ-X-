// js/profile.js

import { auth, loadUserData, updateUserProfile, updateUserPassword } from './database.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

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
        
    } catch (error) {
        console.error("Error initializing profile:", error);
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
    if (profileAvatar && photoURL) {
        profileAvatar.src = photoURL;
    }
    
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
    document.getElementById('firstName').value = firstName;
    document.getElementById('lastName').value = lastName;
    document.getElementById('displayName').value = displayName;
    document.getElementById('email').value = email;
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
                
                alert('Profile updated successfully!');
            } catch (error) {
                console.error('Error updating profile:', error);
                alert('Failed to update profile. Please try again.');
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
                alert('New passwords do not match!');
                return;
            }
            
            if (newPassword.length < 6) {
                alert('Password must be at least 6 characters long!');
                return;
            }
            
            try {
                await updateUserPassword(currentPassword, newPassword);
                
                // Clear form
                document.getElementById('currentPassword').value = '';
                document.getElementById('newPassword').value = '';
                document.getElementById('confirmPassword').value = '';
                
                alert('Password updated successfully!');
            } catch (error) {
                console.error('Error updating password:', error);
                alert(`Failed to update password: ${error.message}`);
            }
        });
    }
    
    // Change avatar button
    const changeAvatarBtn = document.getElementById('changeAvatarBtn');
    if (changeAvatarBtn) {
        changeAvatarBtn.addEventListener('click', () => {
            // This would typically open a file picker or avatar selection modal
            alert('Avatar change functionality would be implemented here.');
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
}
