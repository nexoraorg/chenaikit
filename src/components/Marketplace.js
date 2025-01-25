import Navbar from "./Navbar";
import NFTTile from "./NFTTile";
import MarketplaceJSON from "../Marketplace.json";
import Footer from "./Footer"; // Import Footer
import axios from "axios";
import { useState } from "react";
import { GetIpfsUrlFromPinata } from "../utils";

export default function Marketplace() {
    const [data, updateData] = useState([]);
    const [dataFetched, updateFetched] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    async function getAllNFTs() {
        const ethers = require("ethers");
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const contract = new ethers.Contract(MarketplaceJSON.address, MarketplaceJSON.abi, signer);

        let transaction = await contract.getAllNFTs();
        const items = await Promise.all(transaction.map(async (i) => {
            let tokenURI = await contract.tokenURI(i.tokenId);
            tokenURI = GetIpfsUrlFromPinata(tokenURI);
            let meta = await axios.get(tokenURI);
            meta = meta.data;

            let price = ethers.utils.formatUnits(i.price.toString(), "ether");
            let item = {
                price,
                tokenId: i.tokenId.toNumber(),
                seller: i.seller,
                owner: i.owner,
                image: meta.image,
                name: meta.name,
                description: meta.description,
            };
            return item;
        }));

        updateFetched(true);
        updateData(items);
    }

    if (!dataFetched) getAllNFTs();

    // Filter NFTs based on the search query
    const filteredData = data.filter((nft) =>
        nft.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        nft.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div>
            <Navbar />
            <div className="flex flex-col bg-gradient-to-r from-purple-500 via-indigo-600 to-purple-700 items-center mt-10">
                {/* Hero Section */}
                <div className="w-full text-center bg-gradient-to-r from-purple-500 via-indigo-600 to-purple-700 text-white py-10">
                    <h1 className="text-4xl font-bold">Explore, Buy, and Sell NFTs</h1>
                    <p className="text-lg mt-2">Discover unique digital assets and start building your collection today.</p>
                    <div className="mt-4">
                        <input
                            type="text"
                            placeholder="Search NFTs..."
                            className="w-80 p-2 rounded-md text-black"
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* NFT Grid */}
                <div className="flex flex-wrap mt-10 justify-center max-w-screen-xl">
                    {filteredData.length > 0 ? (
                        filteredData.map((value, index) => (
                            <NFTTile data={value} key={index} />
                        ))
                    ) : (
                        <p className="text-white text-lg">No NFTs found matching your search.</p>
                    )}
                </div>
            </div>
            {/* Footer */}
            <Footer />
        </div>
    );
}
