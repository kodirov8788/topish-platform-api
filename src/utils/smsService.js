// src/utils/smsService.js
const axios = require("axios");
const FormData = require("form-data"); // Make sure to install this package

async function getEskizAuthToken() {
  let data = new FormData();
  data.append("email", process.env.ESKIZ_EMAIL);
  data.append("password", process.env.ESKIZ_PASSWORD);

  let config = {
    method: "post",
    url: "https://notify.eskiz.uz/api/auth/login",
    headers: {
      ...data.getHeaders(),
    },
    data: data,
  };

  try {
    const response = await axios(config);
    return response.data.data.token;
  } catch (error) {
    console.error("Error during Eskiz authentication:", error);
    throw error;
  }
}

// Function to validate phone number format (E.164)
function validatePhoneNumber(phone) {
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  return phoneRegex.test(phone);
}

// Function to send local SMS with a custom message
async function sendCustomSms(token, phone, message) {
  if (!validatePhoneNumber(phone)) {
    throw new Error("Invalid phone number format. Ensure it is in E.164 format.");
  }

  const smsData = new FormData();
  smsData.append("mobile_phone", phone); // Ensure phone number is in international format (E.164)
  smsData.append("message", message);
  smsData.append("from", "4546"); // Verify if this is the correct sender ID for international SMS

  let config = {
    method: "post",
    url: "https://notify.eskiz.uz/api/message/sms/send",
    headers: {
      ...smsData.getHeaders(),
      Authorization: `Bearer ${token}`,
    },
    data: smsData,
  };

  try {
    const response = await axios(config);
    console.log("SMS response:", response.data);
  } catch (error) {
    if (error.response) {
      // The request was made and the server responded with a status code
      console.error("Error response data:", error.response.data);
      console.error("Error response status:", error.response.status);
      console.error("Error response headers:", error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      console.error("Error request data:", error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error("Error message:", error.message);
    }
    console.error("Error config:", error.config);
    throw error;
  }
}

// Function to send global SMS with a custom message
function validatePhoneNumber(phone) {
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  return phoneRegex.test(phone);
}

async function checkSmsStatus(token, dispatchId, isGlobal = '0') {
  const formData = new FormData();
  formData.append('dispatch_id', dispatchId);
  formData.append('is_global', isGlobal);

  const config = {
    method: 'post',
    url: 'https://notify.eskiz.uz/api/message/sms/get-dispatch-status',
    headers: {
      ...formData.getHeaders(),
      'Authorization': `Bearer ${token}`
    },
    data: formData
  };

  try {
    const response = await axios(config);
    console.log("SMS status response:", response.data);
    return response.data;
  } catch (error) {
    if (error.response) {
      // The request was made and the server responded with a status code
      console.error("Error response data:", error.response.data);
      console.error("Error response status:", error.response.status);
      console.error("Error response headers:", error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      console.error("Error request data:", error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error("Error message:", error.message);
    }
    console.error("Error config:", error.config);
    throw error;
  }
}

const getTwilioClient = () => {
  const twilio = require("twilio");
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  return twilio(accountSid, authToken);
};


async function sendGlobalSms(phoneNumber, message) {
  try {
    const client = getTwilioClient();
    const response = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber
    });
    console.log(`Message sent successfully: ${response.sid}`);
    return response.sid;
  } catch (error) {
    console.error(`Failed to send message: ${error.message}`);
    throw new Error(`Failed to send message: ${error.message}`);
  }
}

async function checkTwilioMessageStatus(messageSid) {
  try {
    const client = getTwilioClient();
    const message = await client.messages(messageSid).fetch();
    return message.status;
  } catch (error) {
    console.error(`Failed to check SMS status: ${error.message}`);
    throw new Error(`Failed to check SMS status: ${error.message}`);
  }
}

async function makeVoiceCall(phoneNumber, message) {
  try {
    const client = getTwilioClient();
    const response = await client.calls.create({
      twiml: `<Response><Say rate="${0.5}" loop="2" >${message}</Say></Response>`,
      to: phoneNumber,
      from: process.env.TWILIO_PHONE_NUMBER
    });
    console.log(`Voice call initiated successfully: ${response.sid}`);
    return response.sid;
  } catch (error) {
    console.error(`Failed to make voice call: ${error.message}`);
    throw new Error(`Failed to make voice call: ${error.message}`);
  }
}
module.exports = {
  getEskizAuthToken,
  sendCustomSms,
  sendGlobalSms,
  checkSmsStatus,
  checkTwilioMessageStatus,
  makeVoiceCall,
};
