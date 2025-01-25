import Navbar from "./Navbar";
import { useLocation, useParams } from "react-router-dom";
import MarketplaceJSON from "../Marketplace.json";
import axios from "axios";
import { useState } from "react";
import { GetIpfsUrlFromPinata } from "../utils";
import { DollarSign, User, Tag, ShoppingCart, Heart } from "lucide-react"; // Added Heart Icon

export default function NFTPage(props) {
  const [data, updateData] = useState({});
  const [dataFetched, updateDataFetched] = useState(false);
  const [message, updateMessage] = useState("");
  const [currAddress, updateCurrAddress] = useState("0x");
  const [likes, setLikes] = useState(0); // Likes state
  const [liked, setLiked] = useState(false); // Liked state for toggling

  async function getNFTData(tokenId) {
    const ethers = require("ethers");
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const addr = await signer.getAddress();
    let contract = new ethers.Contract(MarketplaceJSON.address, MarketplaceJSON.abi, signer);
    var tokenURI = await contract.tokenURI(tokenId);
    const listedToken = await contract.getListedTokenForId(tokenId);
    tokenURI = GetIpfsUrlFromPinata(tokenURI);
    let meta = await axios.get(tokenURI);
    meta = meta.data;

    let item = {
      price: meta.price,
      tokenId: tokenId,
      seller: listedToken.seller,
      owner: listedToken.owner,
      image: meta.image,
      name: meta.name,
      description: meta.description,
    };
    updateData(item);
    updateDataFetched(true);
    updateCurrAddress(addr);
  }

  async function buyNFT(tokenId) {
    try {
      const ethers = require("ethers");
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      let contract = new ethers.Contract(MarketplaceJSON.address, MarketplaceJSON.abi, signer);
      const salePrice = ethers.utils.parseUnits(data.price, "ether");
      updateMessage("Buying the NFT... Please Wait (Upto 5 mins)");
      let transaction = await contract.executeSale(tokenId, { value: salePrice });
      await transaction.wait();
      alert("You successfully bought the NFT!");
      updateMessage("");
    } catch (e) {
      alert("Upload Error" + e);
    }
  }

  // Toggle like functionality
  const toggleLike = () => {
    setLiked(!liked);
    setLikes(liked ? likes - 1 : likes + 1);
  };

  const params = useParams();
  const tokenId = params.tokenId;
  if (!dataFetched) getNFTData(tokenId);
  if (typeof data.image === "string") data.image = GetIpfsUrlFromPinata(data.image);

  return (
    <div
      className="min-h-screen bg-gradient-to-r from-purple-600 to-blue-500 flex flex-col items-center text-white"
      style={{ fontFamily: "Poppins, sans-serif" }}
    >
    <Navbar />
      <div className="mt-10 flex flex-col items-center w-full">
        <div
          className="w-3/4 max-w-5xl bg-white rounded-3xl shadow-2xl p-10 text-gray-800 flex flex-col items-center transform transition-transform hover:scale-105"
        >
          <img
            src={data.image}
            alt="NFT"
            className="rounded-lg shadow-lg w-3/5 max-w-sm transform transition-transform hover:scale-105"
          />
          <h1 className="text-4xl font-bold mt-5 animate__animated animate__fadeIn animate__delay-1s">
            {data.name || "NFT Name"}
          </h1>
          <p className="mt-4 text-lg text-black text-center animate__animated animate__fadeIn animate__delay-2s">
            {data.description || "NFT Description"}
          </p>
          <div className="grid grid-cols-2 gap-5 w-full mt-8 text-lg ">
            <div className="flex justify-between items-center">
              <DollarSign className="text-black w-5 h-5" />
              <span className="font-semibold text-black">Price:</span>
              <span className="text-black-600">{data.price ? `${data.price} ETH` : "Loading..."}</span>
            </div>
            <div className="flex justify-between items-center">
              <User className="text-white w-5 h-5" />
              <span className="font-semibold text-white">Owner:</span>
              <span className="truncate">{data.owner || "Loading..."}</span>
            </div>
            <div className="flex justify-between items-center">
              <Tag className="text-white w-5 h-5" />
              <span className="font-semibold text-white">Seller:</span>
              <span className="truncate">{data.seller || "Loading..."}</span>
            </div>
          </div>
          <div className="flex justify-between items-center w-full mt-4">
            {/* Like Button */}
            <div
              className={`flex items-center space-x-2 cursor-pointer ${liked ? "text-red-500" : "text-gray-400"}`}
              onClick={toggleLike}
            >
              <Heart className="w-6 h-6" />
              <span className="text-sm">{likes}</span>
            </div>
            {/* Buy Button */}
            {currAddress !== data.owner && currAddress !== data.seller ? (
              <button
                onClick={() => buyNFT(tokenId)}
                className="mt-8 px-10 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-lg flex items-center justify-center gap-2 transform transition-transform hover:scale-105"
              >
                <ShoppingCart className="w-5 h-5" /> Buy this NFT
              </button>
            ) : (
              <p className="mt-8 text-lg text-green-600">You are the owner of this NFT</p>
            )}
          </div>
          {message && <p className="mt-4 text-center text-yellow-500">{message}</p>}
        </div>
      </div>
    </div>
  );
}
