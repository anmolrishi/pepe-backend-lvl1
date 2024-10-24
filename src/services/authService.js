const { auth } = require('../config/firebase');
const { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} = require('firebase/auth');

class AuthService {
  async login(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error) {
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  async register(email, password) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error) {
      throw new Error(`Registration failed: ${error.message}`);
    }
  }

  async logout() {
    try {
      await signOut(auth);
    } catch (error) {
      throw new Error(`Logout failed: ${error.message}`);
    }
  }

  getCurrentUser() {
    return auth.currentUser;
  }
}

module.exports = new AuthService();