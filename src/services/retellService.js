const axios = require('axios');

const createPhoneCall = async (fromNumber, toNumber, agentId, retellApiKey, retries = 0) => {
  const data = {
    from_number: fromNumber,
    to_number: "+" + toNumber,
    override_agent_id: agentId
  };

  try {
    const response = await axios.post(
      "https://api.retellai.com/v2/create-phone-call",
      data,
      {
        headers: {
          Authorization: `Bearer ${retellApiKey}`,
          "Content-Type": "application/json"
        },
        timeout: 10000
      }
    );
    return response.data;
  } catch (error) {
    if (retries < 3) {
      const delay = Math.pow(2, retries) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      return createPhoneCall(fromNumber, toNumber, agentId, retellApiKey, retries + 1);
    }
    throw error;
  }
};

const getConcurrencyStatus = async (retellApiKey) => {
  try {
    const response = await axios.get(
      "https://api.retellai.com/get-concurrency",
      {
        headers: {
          Authorization: `Bearer ${retellApiKey}`,
        },
        timeout: 10000,
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching concurrency status:", error.message);
    return null;
  }
};

module.exports = { createPhoneCall, getConcurrencyStatus };