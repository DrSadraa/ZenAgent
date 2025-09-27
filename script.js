// ===== CHECK ETHEREUM LIBRARY (if not loaded, alert) =====
if (typeof ethers === 'undefined') {
  alert("Ethers.js not loaded! Check HTML <script> tag.");
}

// ===== ZENCHAIN TESTNET CONFIG =====
const ZENCHAIN_TESTNET = {
  chainId: '0x20d8', // 8408 hex
  chainName: 'ZenChain Testnet',
  nativeCurrency: {
    name: 'ZTC',
    symbol: 'ZTC',
    decimals: 18
  },
  rpcUrls: ['https://rpc.zenchain.io'],
  blockExplorerUrls: ['https://explorer.zenchain.io']
};

// ===== CONNECTION با MetaMask =====
let provider;
let signer;
let userAddress;

// Connect wallet
async function connectWallet() {
  if (typeof window.ethereum === 'undefined') {
    alert("MetaMask not found! Install from metamask.io and reload.");
    return;
  }

  if (typeof ethers === 'undefined') {
    alert("Ethers.js not loaded! Reload page.");
    return;
  }

  try {
    // Switch to ZenChain if not already
    const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
    if (currentChainId !== ZENCHAIN_TESTNET.chainId) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: ZENCHAIN_TESTNET.chainId }],
        });
      } catch (switchError) {
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [ZENCHAIN_TESTNET],
          });
        } else {
          throw switchError;
        }
      }
    }

    provider = new ethers.providers.Web3Provider(window.ethereum);
    const accounts = await provider.send("eth_requestAccounts", []); // popup
    signer = provider.getSigner();
    userAddress = accounts[0];
    const connectBtn = document.getElementById("connectBtn");
    if (connectBtn) connectBtn.textContent = `Connected: ${userAddress.slice(0,6)}...`;
    console.log("Connected to ZenChain:", userAddress);
    alert("Connected to ZenChain Testnet!");
  } catch (error) {
    console.error("Connection failed:", error);
    alert("Connection failed! Check MetaMask network and reload page.");
  }
}

// ===== LOADING =====
window.addEventListener("load", () => {
  setTimeout(() => {
    const loading = document.getElementById("loading");
    const app = document.getElementById("app");
    if (loading) loading.style.display = "none";
    if (app) app.style.display = '';
  }, 1500);
});

// ===== CONNECT BUTTON =====
const connectBtn = document.getElementById("connectBtn");
if (connectBtn) connectBtn.addEventListener("click", connectWallet);

// ===== SEND MESSAGE با GAS TX =====
async function sendMessage() {
  const input = document.getElementById("messageInput");
  const messages = document.getElementById("messages");
  const txList = document.getElementById("txList");
  const sendBtn = document.getElementById("sendBtn");

  if (!input || !messages || !txList || !sendBtn || !signer) {
    alert("Connect wallet first!");
    return;
  }

  const text = input.value.trim();
  if (!text) return;

  input.disabled = true;
  sendBtn.disabled = true;

  try {
    // User msg
    const msg = document.createElement("div");
    msg.className = "msg user";
    msg.textContent = "You: " + text;
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;

    // Gas tx (0 ZTC to self)
    const tx = await signer.sendTransaction({
      to: userAddress,
      value: 0,
    });

    console.log("Tx hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("Confirmed:", receipt.transactionHash);

    // Tx log
    const txItem = document.createElement("li");
    txItem.textContent = `Message sent - Tx: ${tx.hash.slice(0,10)}... | Gas: ${receipt.gasUsed}`;
    txList.appendChild(txItem);

    // AI reply (سفارشی: اگر hi باشه، Hi from zenchain!)
    setTimeout(() => {
      const replyMsg = document.createElement("div");
      replyMsg.className = "msg bot";
      let reply = "AI: Message sent on ZenChain! Tx confirmed.";
      if (text.toLowerCase().includes('hi') || text.toLowerCase().includes('سلام')) {
        reply = "AI: Hi from zenchain!";
      }
      replyMsg.textContent = reply;
      messages.appendChild(replyMsg);
      messages.scrollTop = messages.scrollHeight;
    }, 1000);

  } catch (error) {
    console.error("Tx error:", error);
    const errorMsg = document.createElement("div");
    errorMsg.className = "msg bot";
    errorMsg.textContent = "Error: Tx failed. Check ZTC/gas.";
    errorMsg.style.color = "red";
    messages.appendChild(errorMsg);
  } finally {
    input.disabled = false;
    sendBtn.disabled = false;
    input.value = "";
    input.focus();
  }
}

// Event listeners
const sendBtn = document.getElementById("sendBtn");
if (sendBtn) sendBtn.addEventListener("click", sendMessage);

const input = document.getElementById("messageInput");
if (input) input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});
