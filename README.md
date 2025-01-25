Nexora NFT Marketplace
Nexora is a full-stack decentralized application (DApp) built to enable users to mint, buy, and sell NFTs (Non-Fungible Tokens) seamlessly.
Powered by Ethereum, React, and Hardhat, the marketplace offers a clean and intuitive interface alongside robust backend functionality.

Features
NFT Minting: Create NFTs directly from the UI, with metadata stored on IPFS.
NFT Listing: List your NFTs for sale on the marketplace.
Buy and Sell: Secure transactions using Ethereum smart contracts.
Wallet Integration: Easily connect your MetaMask wallet using Web3Modal.
Responsive Design: Optimized for both desktop and mobile users.

Tech Stack
Frontend
React.js: For the user interface.
React Router: For managing routes within the app.
TailwindCSS: For a modern, responsive design.
React Icons: To include scalable vector icons.
React Toastify: For in-app notifications.
Smart Contracts
Solidity: To build Ethereum smart contracts.
Hardhat: For development, testing, and deploying contracts.
OpenZeppelin Contracts: For secure, audited contract standards (ERC721).

Backend
IPFS: Used for decentralized metadata storage via Pinata.
Ethers.js: For interaction with the Ethereum blockchain.
Installation and Setup
Follow these steps to set up the project on your local machine.

Prerequisites
Ensure you have the following installed:

Node.js: (v14 or later) Download Node.js
npm or yarn: Comes with Node.js
MetaMask: Browser wallet extension Get MetaMask

Clone the Repository
git clone https://github.com/Gellu06/Nexora-NFT-Marketplace.git
cd Nexora-NFT-Marketplace

Install Dependencies
npm install
Start the Development Server
npm start
npm run build
Smart Contract Deployment

Setup Environment Variables:
Create a .env file and add the following:
ALCHEMY_API_KEY=your-alchemy-key
PRIVATE_KEY=your-wallet-private-key
Compile the Contracts:

npx hardhat compile
Deploy to Ethereum Testnet:
npx hardhat run scripts/deploy.js --network sepolia
Replace sepolia with your desired network.

Key Dependencies
React: Frontend framework
Hardhat: Ethereum development environment
Ethers.js: For blockchain interactions
OpenZeppelin Contracts: Standardized ERC-721 contracts
Web3Modal: Simplifies wallet connections
TailwindCSS: For beautiful, responsive UI

How to Use
Connect Your Wallet: Use the "Connect Wallet" button.
Mint NFTs: Upload an image, provide metadata, and mint your NFT.
List for Sale: Set a price and list your NFT for sale.
Buy NFTs: Browse available NFTs and purchase them using ETH.
Known Issues and Limitations
Images must be less than 500 KB for upload.
Currently supports Ethereum-based networks (Rinkeby, Mainnet, etc.).
Ensure sufficient ETH balance for gas fees.

Contribution
Feel free to contribute to this project. Fork the repo, make changes, and submit a pull request.

License
This project is licensed under the MIT License.

Contact
If you have any questions or suggestions, feel free to reach out:

GitHub: Gellu06

