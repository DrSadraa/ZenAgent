// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { ethers } = require('ethers');

const app = express();
app.use(cors());
app.use(express.json());

// config from .env
const PORT = process.env.PORT || 3000;
const ETH_RPC_URL = process.env.ETH_RPC_URL; // RPC URL for your testnet (Sepolia/ZenChain testnet)
const AGENT_CONTRACT_ADDRESS = process.env.AGENT_CONTRACT_ADDRESS; // deployed AgentPay contract
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const REQUIRED_CONFIRMATIONS = parseInt(process.env.REQUIRED_CONFIRMATIONS || '1', 10);
const SKIP_ONCHAIN_VERIFY = process.env.SKIP_ONCHAIN_VERIFY === 'true'; // for dev/testing

if (!ETH_RPC_URL) throw new Error('ETH_RPC_URL not set in .env');
if (!AGENT_CONTRACT_ADDRESS) throw new Error('AGENT_CONTRACT_ADDRESS not set in .env');
if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set in .env');

// Provider & minimal ABI to parse MessagePaid event
const provider = new ethers.providers.JsonRpcProvider(ETH_RPC_URL);
const agentAbi = [
  "event MessagePaid(address indexed user, uint256 fee, bytes32 messageId)"
];
const agentInterface = new ethers.utils.Interface(agentAbi);

// Helper: verify tx contains MessagePaid(user, messageId)
async function verifyPaymentTx(txHash, expectedUser, expectedMessageIdHex) {
  const tx = await provider.getTransaction(txHash);
  if (!tx) throw new Error('Transaction not found on chain');
  if (tx.from.toLowerCase() !== expectedUser.toLowerCase()) throw new Error('Transaction sender does not match user address');

  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt || receipt.status !== 1) throw new Error('Transaction failed or not mined yet');

  // optional: check confirmations
  const blockNumber = await provider.getBlockNumber();
  if ((blockNumber - receipt.blockNumber) < REQUIRED_CONFIRMATIONS) {
    throw new Error(`Not enough confirmations (${blockNumber - receipt.blockNumber}/${REQUIRED_CONFIRMATIONS})`);
  }

  // parse logs for MessagePaid event
  for (const log of receipt.logs) {
    try {
      const parsed = agentInterface.parseLog(log);
      if (parsed && parsed.name === 'MessagePaid') {
        const evUser = parsed.args.user;
        const evMessageId = parsed.args.messageId; // bytes32 hex string
        // normalize both hex strings (lowercase)
        const evMidHex = ethers.utils.hexlify(evMessageId).toLowerCase();
        const expectedHex = ethers.utils.hexlify(expectedMessageIdHex).toLowerCase();
        if (evUser.toLowerCase() === expectedUser.toLowerCase() && evMidHex === expectedHex) {
          return true;
        }
      }
    } catch (e) {
      // not this event — ignore
    }
  }
  return false;
}

// OpenAI helper (chat completion using gpt-3.5-turbo)
async function askOpenAI(message) {
  const body = {
    model: "gpt-3.5-turbo",
    messages: [
      { role: "system", content: "You are ZenChain AI assistant. Answer concisely and helpfully." },
      { role: "user", content: message }
    ],
    max_tokens: 700,
    temperature: 0.6
  };

  const resp = await axios.post('https://api.openai.com/v1/chat/completions', body, {
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    timeout: 30000
  });

  const answer = resp.data?.choices?.[0]?.message?.content;
  return answer || null;
}

// POST /ask
// body: { message, messageId (hex), txHash, userAddress }
// if SKIP_ONCHAIN_VERIFY=true you can call with only { message } for dev
app.post('/ask', async (req, res) => {
  try {
    const { message, messageId, txHash, userAddress } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });

    if (!SKIP_ONCHAIN_VERIFY) {
      if (!messageId || !txHash || !userAddress) {
        return res.status(400).json({ error: 'messageId, txHash and userAddress are required for on-chain verification' });
      }
      // verify tx
      let ok = false;
      try {
        ok = await verifyPaymentTx(txHash, userAddress, messageId);
      } catch (e) {
        console.error('Payment verification error:', e.message);
        return res.status(402).json({ error: 'Payment verification failed: ' + e.message });
      }
      if (!ok) return res.status(402).json({ error: 'Payment event not found in transaction logs' });
    }

    // Call OpenAI to get answer
    const answer = await askOpenAI(message);
    if (!answer) return res.status(500).json({ error: 'AI returned empty answer' });

    // Optionally: here you can log the question/answer + txHash to DB for audit

    return res.json({ answer });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'server error' });
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT} (SKIP_ONCHAIN_VERIFY=${SKIP_ONCHAIN_VERIFY})`);
});
