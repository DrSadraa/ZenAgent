// Check for dark mode preference
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.body.classList.add('dark');
  document.querySelector('#darkToggle i').classList.replace('fa-moon', 'fa-sun');
}

// Dark toggle
document.getElementById('darkToggle').addEventListener('click', () => {
  document.body.classList.toggle('dark');
  const icon = document.querySelector('#darkToggle i');
  icon.classList.toggle('fa-moon');
  icon.classList.toggle('fa-sun');
});

// ===== ETHEREUM & ZENCHAIN =====
if (typeof ethers === 'undefined') alert("Ethers.js not loaded!");

const ZENCHAIN_TESTNET = {
  chainId: '0x20d8',
  chainName: 'ZenChain Testnet',
  nativeCurrency: { name: 'ZTC', symbol: 'ZTC', decimals: 18 },
  rpcUrls: ['https://rpc.zenchain.io'],
  blockExplorerUrls: ['https://explorer.zenchain.io']
};

let provider, signer, userAddress, wins = localStorage.getItem('zenWins') || 0;
document.getElementById('score').textContent = `Wins: ${wins}`;

// Connect wallet
async function connectWallet() {
  if (!window.ethereum) return alert("MetaMask not found!");
  try {
    const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
    if (currentChainId !== ZENCHAIN_TESTNET.chainId) {
      try {
        await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: ZENCHAIN_TESTNET.chainId }] });
      } catch (switchError) {
        if (switchError.code === 4902) {
          await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [ZENCHAIN_TESTNET] });
        } else throw switchError;
      }
    }
    provider = new ethers.providers.Web3Provider(window.ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();
    userAddress = accounts[0];
    document.getElementById("connectBtn").textContent = `Connected: ${userAddress.slice(0,6)}...`;
    alert("Connected to ZenChain!");
  } catch (error) {
    console.error(error);
    alert("Connection failed!");
  }
}

// Loading screen
window.addEventListener("load", () => {
  setTimeout(() => {
    document.getElementById("loading").style.display = "none";
    document.getElementById("app").style.display = "block";
  }, 1500);
});

document.getElementById("connectBtn").addEventListener("click", connectWallet);

// Send message
async function sendMessage() {
  const input = document.getElementById("messageInput");
  const messages = document.getElementById("messages");
  const txList = document.getElementById("txList");
  const sendBtn = document.getElementById("sendBtn");

  if (!signer) return alert("Connect wallet!");
  const text = input.value.trim();
  if (!text) return;

  input.disabled = true;
  sendBtn.disabled = true;
  sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

  try {
    const msg = document.createElement("div");
    msg.className = "msg user";
    msg.textContent = "You: " + text;
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;

    const tx = await signer.sendTransaction({ to: userAddress, value: 0 });
    const receipt = await tx.wait();

    const txItem = document.createElement("li");
    txItem.innerHTML = `Message - <a href="${ZENCHAIN_TESTNET.blockExplorerUrls[0]}/tx/${tx.hash}" target="_blank">Tx: ${tx.hash.slice(0,10)}...</a> | Gas: ${receipt.gasUsed}`;
    txList.appendChild(txItem);

    setTimeout(() => {
      const replyMsg = document.createElement("div");
      replyMsg.className = "msg bot";
      let reply = "AI: Transaction confirmed on ZenChain! Ready for more?";
      if (text.toLowerCase().includes('wallet')) reply = "AI: Your wallet is secure – check the sidebar for balance.";
      if (text.toLowerCase().includes('flip')) reply = "AI: Try the coin flip game on the right!";
      replyMsg.textContent = reply;
      messages.appendChild(replyMsg);
      messages.scrollTop = messages.scrollHeight;
    }, 1000);

  } catch (error) {
    console.error(error);
    const errorMsg = document.createElement("div");
    errorMsg.className = "msg bot";
    errorMsg.textContent = "Error: Transaction failed. Check gas settings.";
    errorMsg.style.color = "red";
    messages.appendChild(errorMsg);
  } finally {
    input.disabled = false;
    sendBtn.disabled = false;
    sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
    input.value = "";
    input.focus();
  }
}

document.getElementById("sendBtn").addEventListener("click", sendMessage);
document.getElementById("messageInput").addEventListener("keydown", (e) => { if (e.key === "Enter") sendMessage(); });

// Coin flip
async function flipCoin() {
  const flipBtn = document.getElementById("flipBtn");
  const txList = document.getElementById("txList");
  const coinAnimation = document.getElementById("coinAnimation");
  const flipResult = document.getElementById("flipResult");
  const shareBtn = document.getElementById("shareBtn");

  if (!signer) return alert("Connect wallet!");

  flipBtn.disabled = true;
  coinAnimation.classList.remove("flip-heads", "flip-tails", "spinContinuous");
  flipResult.textContent = "Flipping...";
  shareBtn.style.display = "none";

  try {
    const tx = await signer.sendTransaction({ to: userAddress, value: 0 });
    const receipt = await tx.wait();

    const randomNumber = ethers.BigNumber.from(receipt.blockHash).mod(2).toNumber();
    const result = randomNumber === 0 ? "Heads" : "Tails";
    const animationClass = randomNumber === 0 ? "flip-heads" : "flip-tails";

    if (randomNumber === 0) wins++;
    localStorage.setItem('zenWins', wins);
    document.getElementById('score').textContent = `Wins: ${wins}`;

    coinAnimation.classList.add(animationClass);

    setTimeout(() => {
      flipResult.textContent = `Result: ${result}`;
      shareBtn.style.display = "block";
      shareBtn.onclick = () => navigator.share 
        ? navigator.share({ title: 'ZenChain Flip', text: `I got ${result}! TX: ${tx.hash.slice(0,10)}...` }) 
        : alert(`Share: I got ${result}!`);
      setTimeout(() => {
        coinAnimation.classList.remove("flip-heads", "flip-tails");
        coinAnimation.classList.add("spinContinuous");
        flipResult.textContent = "Spinning...";
      }, 3000);
    }, 2000);

    const txItem = document.createElement("li");
    txItem.innerHTML = `Flip - <a href="${ZENCHAIN_TESTNET.blockExplorerUrls[0]}/tx/${tx.hash}" target="_blank">Tx: ${tx.hash.slice(0,10)}...</a> | Result: ${result}`;
    txList.appendChild(txItem);

  } catch (error) {
    console.error(error);
    flipResult.textContent = "Error!";
    coinAnimation.classList.add("spinContinuous");
  } finally {
    flipBtn.disabled = false;
  }
}

document.getElementById("flipBtn").addEventListener("click", flipCoin);
