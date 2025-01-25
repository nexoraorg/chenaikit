import { Link } from "react-router-dom";
import { FaTwitter, FaFacebook, FaInstagram } from "react-icons/fa";
import { FaPaintBrush, FaShoppingCart, FaUser } from "react-icons/fa"; // Import icons for the cards
import Navbar from "./Navbar";
import Footer from "./Footer";

function HomePage() {
  return (
    <div className="min-h-screen bg-transparent text-white">
      <Navbar />
      
      {/* Hero Section */}
      <section className="py-20">
        <div className="container mx-auto px-6 text-center">
          <h1 className="text-4xl md:text-6xl font-bold">
            Welcome to Nexora Marketplace
          </h1>
          <p className="mt-6 text-lg md:text-xl">
            Discover, buy, sell, and mint NFTs on the decentralized web.
          </p>
          <div className="mt-10">
            <Link
              to="/marketplace"
              className="px-8 py-3 bg-blue-500 hover:bg-blue-600 text-lg rounded-md font-bold transition shadow-lg text-white"
            >
              Explore Marketplace
            </Link>
            <Link
              to="/sellNFT"
              className="ml-4 px-8 py-3 bg-purple-500 hover:bg-purple-600 text-lg rounded-md font-bold transition shadow-lg text-white"
            >
              Mint NFT
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 white-900 text-white">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-8">Features of Nexora</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Mint NFTs Card */}
            <Link
              to="/sellNFT"
              className="p-6 bg-gradient-to-br from-purple-700 to-purple-900 shadow-lg rounded-md hover:scale-105 transition-transform duration-300"
            >
              <FaPaintBrush size={40} className="mx-auto mb-4 text-yellow-300" />
              <h3 className="text-xl font-semibold mb-4">Mint NFTs</h3>
              <p className="text-gray-200">
                Easily create and list your NFTs on the blockchain with a few clicks.
              </p>
            </Link>

            {/* Marketplace Card */}
            <Link
              to="/marketplace"
              className="p-6 bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg rounded-md hover:scale-105 transition-transform duration-300"
            >
              <FaShoppingCart size={40} className="mx-auto mb-4 text-white" />
              <h3 className="text-xl font-semibold mb-4">Marketplace</h3>
              <p className="text-gray-200">
                Discover and trade NFTs securely on our decentralized platform.
              </p>
            </Link>

            {/* Profile Management Card */}
            <Link
              to="/profile"
              className="p-6 bg-gradient-to-br from-purple-700 to-purple-900 shadow-lg rounded-md hover:scale-105 transition-transform duration-300"
            >
              <FaUser size={40} className="mx-auto mb-4 text-orange-300" />
              <h3 className="text-xl font-semibold mb-4">Profile Management</h3>
              <p className="text-gray-200">
                Manage your account, view your collections, and track your activity.
              </p>
            </Link>
          </div>
        </div>
      </section>
      
      <Footer />
    </div>
  );
}

export default HomePage;
