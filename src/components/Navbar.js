import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useLocation } from "react-router";

function Navbar() {
  const [connected, toggleConnect] = useState(false);
  const location = useLocation();
  const [currAddress, updateAddress] = useState("0x");

  // Fetch connected wallet address
  async function getAddress() {
    const ethers = require("ethers");
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const addr = await signer.getAddress();
    updateAddress(addr);
  }

  // Update button styles when connected
  function updateButton() {
    const ethereumButton = document.querySelector(".enableEthereumButton");
    ethereumButton.textContent = "Disconnect Wallet";
    ethereumButton.classList.add("bg-red-500", "hover:bg-red-600");
    ethereumButton.classList.remove("bg-blue-500", "hover:bg-blue-700");
  }

  // Connect to MetaMask
  async function connectWebsite() {
    if (!window.ethereum) {
      alert("MetaMask is not installed. Please install it to connect.");
      return;
    }

    const chainId = await window.ethereum.request({ method: "eth_chainId" });
    if (chainId !== "0xaa36a7") {
      // Switch to Sepolia
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaa36a7" }], // Sepolia's chain ID
      });
    }

    await window.ethereum
      .request({ method: "eth_requestAccounts" })
      .then(() => {
        updateButton();
        getAddress();
        toggleConnect(true);
      })
      .catch((error) => {
        console.error("Error connecting to MetaMask:", error);
      });
  }

  // Disconnect Wallet
  function disconnectWallet() {
    updateAddress("0x");
    toggleConnect(false);
    const ethereumButton = document.querySelector(".enableEthereumButton");
    ethereumButton.textContent = "Connect Wallet";
    ethereumButton.classList.remove("bg-red-500", "hover:bg-red-600");
    ethereumButton.classList.add("bg-blue-500", "hover:bg-blue-700");
  }

  // Handle wallet changes
  useEffect(() => {
    if (!window.ethereum) return;
    if (window.ethereum.isConnected()) {
      getAddress();
      toggleConnect(true);
      updateButton();
    }

    window.ethereum.on("accountsChanged", () => {
      window.location.reload();
    });
  }, []);

  return (
    <div>
      <nav className="w-full fixed top-0 bg-transparent text-white shadow-lg z-10">
        <div className="flex items-center justify-between px-6 py-4">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="text-2xl font-bold">Nexora Marketplace</div>
          </Link>

          {/* Nav Links */}
          <ul className="hidden lg:flex space-x-8 text-lg font-semibold">
            <li>
              <Link
                to="/"
                className={`${
                  location.pathname === "/"
                    ? "border-b-2 border-blue-500"
                    : "hover:border-b-2 hover:border-blue-500"
                }`}
              >
                Home
              </Link>
            </li>
            <li>
              <Link
                to="/marketplace"
                className={`${
                  location.pathname === "/marketplace"
                    ? "border-b-2 border-blue-500"
                    : "hover:border-b-2 hover:border-blue-500"
                }`}
              >
                Marketplace
              </Link>
            </li>
            <li>
              <Link
                to="/sellNFT"
                className={`${
                  location.pathname === "/sellNFT"
                    ? "border-b-2 border-blue-500"
                    : "hover:border-b-2 hover:border-blue-500"
                }`}
              >
                Mint NFT
              </Link>
            </li>
            <li>
              <Link
                to="/profile"
                className={`${
                  location.pathname === "/profile"
                    ? "border-b-2 border-blue-500"
                    : "hover:border-b-2 hover:border-blue-500"
                }`}
              >
                Profile
              </Link>
            </li>
          </ul>

          {/* Connect/Disconnect Wallet Button */}
          <button
            className={`enableEthereumButton px-5 py-2 rounded-lg font-bold text-sm ${
              connected
                ? "bg-red-500 hover:bg-red-600"
                : "bg-blue-500 hover:bg-blue-700"
            }`}
            onClick={connected ? disconnectWallet : connectWebsite}
          >
            {connected ? "Disconnect Wallet" : "Connect Wallet"}
          </button>
        </div>
      </nav>

      {/* Connected Address Display */}
      <div className="text-right px-6 py-2 text-sm text-gray-300 mt-16">
        {currAddress !== "0x" ? (
          <span>
            <span className="text-green-400">Connected:</span>{" "}
            {currAddress.substring(0, 6)}...{currAddress.substring(38)}
          </span>
        ) : (
          <span className="text-red-400">Not Connected</span>
        )}
      </div>
    </div>
  );
}

export default Navbar;
