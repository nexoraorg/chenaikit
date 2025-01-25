import { Link } from "react-router-dom"; // Import Link from react-router-dom
import { FaTwitter, FaFacebook, FaInstagram } from "react-icons/fa"; // Import social media icons

function Footer() {
  return (
    <footer className="py-8 bg-gradient-to-br from-purple-900 via-indigo-900 to-purple-800 text-white">
      <div className="container mx-auto px-6">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <div className="text-lg font-bold">Nexora Marketplace</div>

          {/* Quick Links */}
          <div className="space-x-6">
            <Link to="/" className="hover:text-gray-300">
              Home
            </Link>
            <Link to="/marketplace" className="hover:text-gray-300">
              Marketplace
            </Link>
            <Link to="/sellNFT" className="hover:text-gray-300">
              Mint NFT
            </Link>
            <Link to="/profile" className="hover:text-gray-300">
              Profile
            </Link>
          </div>
        </div>

        {/* Social Media Links */}
        <div className="mt-6 flex justify-center space-x-6">
          <Link to="#" className="text-white hover:text-blue-400">
            <FaTwitter size={24} />
          </Link>
          <Link to="#" className="text-white hover:text-blue-600">
            <FaFacebook size={24} />
          </Link>
          <Link to="#" className="text-white hover:text-pink-500">
            <FaInstagram size={24} />
          </Link>
        </div>

        {/* Footer Text */}
        <div className="text-center mt-6">
          <p>© 2025 Nexora Marketplace. All Rights Reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
