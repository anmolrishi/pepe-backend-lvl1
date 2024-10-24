const pLimit = require('p-limit');
const { db } = require('../config/firebase');
const { createPhoneCall, getConcurrencyStatus } = require('./retellService');
const { collection, query, where, limit: firestoreLimit, getDocs, updateDoc, doc, setDoc } = require('firebase/firestore');

class DialerService {
  constructor() {
    this.isPolling = false;
    this.contactsReceived = 0;
    this.contactsDialed = 0;
    this.limit = pLimit(25);
  }

  async incrementContactCount() {
    this.contactsReceived++;
    await this.updateMetrics();
  }

  async updateMetrics() {
    const metricsRef = doc(db, 'metrics', 'dialer');
    await setDoc(metricsRef, {
      contactsReceived: this.contactsReceived,
      contactsDialed: this.contactsDialed,
      pendingContacts: this.contactsReceived - this.contactsDialed,
      lastUpdated: new Date()
    });
  }

  async startPolling() {
    if (this.isPolling) return;
    this.isPolling = true;
    this.pollContacts();
  }

  async pollContacts() {
    while (this.isPolling && (this.contactsReceived > this.contactsDialed)) {
      try {
        console.log('Polling for undailed contacts...');
        
        const concurrencyStatus = await getConcurrencyStatus(process.env.RETELL_API_KEY);
        const availableConcurrency = concurrencyStatus ? 
          (concurrencyStatus.concurrency_limit - concurrencyStatus.current_concurrency) : 10;

        if (availableConcurrency <= 0) {
          console.log('No available concurrency. Waiting...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }

        const q = query(
          collection(db, 'calls'),
          where('dialStatus', '==', 'not_dialed'),
          firestoreLimit(availableConcurrency)
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          console.log('No undailed contacts found');
          await new Promise(resolve => setTimeout(resolve, 120000));
          continue;
        }

        const dialPromises = snapshot.docs.map(docSnapshot => 
          this.limit(async () => {
            const contact = docSnapshot.data();
            const docRef = doc(db, 'calls', docSnapshot.id);
            
            try {
              const callResponse = await createPhoneCall(
                contact.from_number,
                contact.to_number,
                process.env[`AGENT_ID_${contact.callerId.replace('caller', '')}`],
                process.env.RETELL_API_KEY
              );

              await updateDoc(docRef, {
                dialStatus: 'dialed',
                callId: callResponse.call_id,
                dialedAt: new Date()
              });

              this.contactsDialed++;
              await this.updateMetrics();

              console.log(`Successfully dialed contact: ${docSnapshot.id}`);
            } catch (error) {
              console.error(`Error dialing contact ${docSnapshot.id}:`, error);
              await updateDoc(docRef, {
                dialStatus: 'failed',
                error: error.message,
                failedAt: new Date()
              });
            }
          })
        );

        await Promise.allSettled(dialPromises);

        if (this.contactsReceived <= this.contactsDialed) {
          console.log('All contacts have been dialed. Stopping polling.');
          this.isPolling = false;
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 120000));

      } catch (error) {
        console.error('Error in polling loop:', error);
        await new Promise(resolve => setTimeout(resolve, 120000));
      }
    }
  }
}

module.exports = new DialerService();