import { BrowserRouter as Router, Link } from "react-router-dom";
import { GetIpfsUrlFromPinata } from "../utils";
import { useState } from "react";
import { FaHeart } from "react-icons/fa";  // Using Font Awesome Heart Icon

function NFTTile(data) {
  const newTo = {
    pathname: "/nftPage/" + data.data.tokenId,
  };

  const IPFSUrl = GetIpfsUrlFromPinata(data.data.image);

  // States to handle like functionality
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(data.data.likes || 0);

  const toggleLike = () => {
    setLiked(!liked);
    setLikes(liked ? likes - 1 : likes + 1);
  };

  // Shorten the account address to show only the first 6 and last 4 characters
  const shortenedAccount = `${data.data.owner.slice(0, 6)}...${data.data.owner.slice(-4)}`;

  return (
    <Link to={newTo}>
      <div className="border-2 ml-12 mt-5 mb-12 flex flex-col items-center rounded-lg w-48 md:w-72 shadow-2xl transform transition-all duration-500 hover:scale-105 hover:shadow-xl group">
        {/* Image Section */}
        <img
          src={IPFSUrl}
          alt={data.data.name}
          className="w-72 h-80 rounded-lg object-cover transition-transform duration-500 group-hover:scale-110"
        />

        {/* NFT Details */}
        <div className="text-white w-full p-2 bg-gradient-to-t from-[#454545] to-transparent rounded-lg pt-5 -mt-20">
          <strong className="text-xl">{data.data.name}</strong>
          <p className="text-sm mt-2">{data.data.description}</p>
        </div>

        {/* Account and Like Section */}
        <div className="flex justify-between items-center w-full p-2 mt-4 bg-gray-800 rounded-b-lg">
          {/* Owner's Avatar */}
          <div className="flex items-center space-x-2">
            <img
              src={data.data.ownerImage || "/default-avatar.png"}
              alt="Owner Avatar"
              className="w-8 h-8 rounded-full border-2 border-gray-600"
            />
            <p className="text-sm text-gray-300">{shortenedAccount}</p> {/* Shortened account address */}
          </div>

          {/* Like Button */}
          <div
            className={`flex items-center space-x-2 cursor-pointer ${liked ? "text-red-500" : "text-gray-400"}`}
            onClick={toggleLike}
          >
            <FaHeart className="text-lg" />
            <span className="text-sm">{likes}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default NFTTile;
