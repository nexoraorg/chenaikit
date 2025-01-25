import { Link } from "react-router-dom"; 
import Navbar from "./Navbar";
import { useLocation, useParams } from 'react-router-dom';
import MarketplaceJSON from "../Marketplace.json";
import axios from "axios";
import { useState, useEffect } from "react";
import NFTTile from "./NFTTile";
import { FaEthereum, FaWallet, FaImages } from 'react-icons/fa';
import { BsFillExclamationCircleFill } from 'react-icons/bs';
import Footer from "./Footer";

export default function Profile() {
    const [data, updateData] = useState([]);
    const [dataFetched, updateFetched] = useState(false);
    const [address, updateAddress] = useState("0x");
    const [totalPrice, updateTotalPrice] = useState("0");

    useEffect(() => {
        if (!dataFetched) {
            getNFTData();
        }
    }, [dataFetched]);

    async function getNFTData() {
        const ethers = require("ethers");
        let sumPrice = 0;
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const addr = await signer.getAddress();

        let contract = new ethers.Contract(MarketplaceJSON.address, MarketplaceJSON.abi, signer);

        let transaction = await contract.getMyNFTs();

        const items = await Promise.all(transaction.map(async (i) => {
            const tokenURI = await contract.tokenURI(i.tokenId);
            let meta = await axios.get(tokenURI);
            meta = meta.data;

            let price = ethers.utils.formatUnits(i.price.toString(), 'ether');
            let item = {
                price,
                tokenId: i.tokenId.toNumber(),
                seller: i.seller,
                owner: i.owner,
                image: meta.image,
                name: meta.name,
                description: meta.description,
            };
            sumPrice += Number(price);
            return item;
        }));

        updateData(items);
        updateFetched(true);
        updateAddress(addr);
        updateTotalPrice(sumPrice.toPrecision(3));
    }

    return (
        <div className="min-h-screen bg-grey-900 text-white">
            <Navbar />
            <div className="container mx-auto py-10 px-5">
                <div className="bg-gradient-to-r from-purple-500 via-indigo-600 to-purple-700 p-6 rounded-lg shadow-lg mb-10">
                    <h2 className="text-3xl font-bold text-center text-white mb-5">Profile Overview</h2>
                    <div className="flex flex-col sm:flex-row justify-between items-center text-center sm:text-left mb-5">
                        <div className="flex items-center">
                            <FaWallet className="text-2xl text-purple-300 mr-2" />
                            <div>
                                <h3 className="font-semibold text-lg text-purple-400">Wallet Address</h3>
                                <p>{address}</p>
                            </div>
                        </div>
                        <div className="flex items-center mt-5 sm:mt-0">
                            <FaImages className="text-2xl text-purple-300 mr-2" />
                            <div>
                                <h3 className="font-semibold text-lg text-purple-400">No. of NFTs</h3>
                                <p>{data.length}</p>
                            </div>
                        </div>
                        <div className="flex items-center mt-5 sm:mt-0">
                            <FaEthereum className="text-2xl text-purple-300 mr-2" />
                            <div>
                                <h3 className="font-semibold text-lg text-purple-400">Total Value</h3>
                                <p>{totalPrice} ETH</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="text-center mb-10 bg-gradient-to-r from-purple-500 via-indigo-600 to-purple-700">
                    <h3 className="text-2xl font-bold text-purple-300">Your NFTs</h3>
                    <div className="flex justify-center flex-wrap max-w-screen-xl mx-auto mt-6">
                        {data.map((value, index) => {
                            return <NFTTile data={value} key={index} />;
                        })}
                    </div>
                    {data.length === 0 && (
                        <p className="mt-6 text-xl text-red-400 flex items-center justify-center">
                            <BsFillExclamationCircleFill className="mr-2" /> Oops, No NFT data to display (Are you logged in?)
                        </p>
                    )}
                </div>
            </div>
            <Footer/>
        </div>
    );
};
