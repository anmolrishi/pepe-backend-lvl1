require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { db } = require('./src/config/firebase');
const dialerService = require('./src/services/dialerService');
const authService = require('./src/services/authService');
const authMiddleware = require('./src/middleware/authMiddleware');
const { collection, addDoc, getDoc, doc } = require('firebase/firestore');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Auth endpoints
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await authService.register(email, password);
    res.json({ uid: user.uid });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await authService.login(email, password);
    res.json({ uid: user.uid });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  try {
    await authService.logout();
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Protected routes
const callerIds = ['caller1', 'caller2', 'caller3', 'caller4', 'caller5', 'caller6', 'caller7'];

callerIds.forEach((callerId) => {
  app.post(`/api/${callerId}`, authMiddleware, async (req, res) => {
    try {
      const {
        to_number,
        first_name,
        address,
        Surplus_Amount,
        GHL_TAG,
        total_fee,
        auction_date,
        final_judgement_amount,
        county,
        owner_name,
        current_date,
        ...additionalFields
      } = req.body;

      if (!to_number) {
        return res.status(400).json({ error: 'to_number is required' });
      }

      const callerNumber = parseInt(callerId.replace('caller', ''));
      const from_number = process.env[`FROM_NUMBER_${callerNumber}`];

      if (!from_number) {
        return res.status(500).json({ error: `FROM_NUMBER_${callerNumber} not configured` });
      }

      const callData = {
        callerId,
        from_number,
        to_number,
        first_name,
        address,
        Surplus_Amount,
        GHL_TAG,
        total_fee,
        auction_date,
        final_judgement_amount,
        county,
        owner_name,
        current_date,
        timestamp: new Date(),
        dialStatus: 'not_dialed',
        ...additionalFields
      };

      const docRef = await addDoc(collection(db, 'calls'), callData);
      
      await dialerService.incrementContactCount();
      dialerService.startPolling();

      res.json({
        success: true,
        message: 'Contact stored successfully',
        documentId: docRef.id
      });

    } catch (error) {
      console.error(`Error in ${callerId}:`, error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  });
});

app.get('/api/metrics', authMiddleware, async (req, res) => {
  try {
    const metricsDoc = await getDoc(doc(db, 'metrics', 'dialer'));
    res.json(metricsDoc.exists() ? metricsDoc.data() : {
      contactsReceived: 0,
      contactsDialed: 0,
      pendingContacts: 0
    });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching metrics' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});