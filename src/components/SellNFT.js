import { Link } from "react-router-dom"; // Import Link
import { FaTwitter, FaFacebook, FaInstagram } from "react-icons/fa"; // Import social media icons
import { useState } from "react";
import { uploadFileToIPFS, uploadJSONToIPFS } from "../pinata";
import Marketplace from "../Marketplace.json";
import { useLocation } from "react-router";
import { ToastContainer, toast } from "react-toastify"; // Toastify imports
import "react-toastify/dist/ReactToastify.css"; // Toastify styles

export default function SellNFT() {
    const [formParams, updateFormParams] = useState({ name: "", description: "", price: "" });
    const [fileURL, setFileURL] = useState(null);
    const [previewURL, setPreviewURL] = useState(null); // State for preview image
    const ethers = require("ethers");
    const [message, updateMessage] = useState("");
    const location = useLocation();

    async function disableButton() {
        const listButton = document.getElementById("list-button");
        listButton.disabled = true;
        listButton.style.backgroundColor = "grey";
        listButton.style.opacity = 0.3;
    }

    async function enableButton() {
        const listButton = document.getElementById("list-button");
        listButton.disabled = false;
        listButton.style.backgroundColor = "#9333EA";
        listButton.style.opacity = 1;
    }

    async function OnChangeFile(e) {
        const file = e.target.files[0];

        if (file) {
            // Create a preview URL for the selected file
            const preview = URL.createObjectURL(file);
            setPreviewURL(preview);

            // File size validation (<500 KB)
            if (file.size > 500 * 1024) {
                toast.error("File size exceeds 500 KB. Please upload a smaller file.");
                return;
            }

            try {
                disableButton();
                toast.info("Uploading image... please wait!");
                const response = await uploadFileToIPFS(file);
                if (response.success === true) {
                    enableButton();
                    toast.success("Image uploaded successfully!");
                    console.log("Uploaded image to Pinata: ", response.pinataURL);
                    setFileURL(response.pinataURL);
                }
            } catch (e) {
                console.log("Error during file upload", e);
                toast.error("Image upload failed!");
            }
        }
    }

    async function uploadMetadataToIPFS() {
        const { name, description, price } = formParams;
        if (!name || !description || !price || !fileURL) {
            toast.error("Please fill all the fields!");
            return;
        }

        const nftJSON = { name, description, price, image: fileURL };

        try {
            const response = await uploadJSONToIPFS(nftJSON);
            if (response.success === true) {
                console.log("Uploaded JSON to Pinata: ", response);
                return response.pinataURL;
            }
        } catch (e) {
            console.log("Error uploading JSON metadata:", e);
            toast.error("Metadata upload failed!");
        }
    }

    async function listNFT(e) {
        e.preventDefault();

        try {
            const metadataURL = await uploadMetadataToIPFS();
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const signer = provider.getSigner();
            disableButton();
            toast.info("Uploading NFT... please wait!");

            let contract = new ethers.Contract(Marketplace.address, Marketplace.abi, signer);

            const price = ethers.utils.parseUnits(formParams.price, "ether");
            let listingPrice = await contract.getListPrice();
            listingPrice = listingPrice.toString();

            let transaction = await contract.createToken(metadataURL, price, { value: listingPrice });
            await transaction.wait();

            toast.success("Successfully listed your NFT!");
            enableButton();
            updateMessage("");
            updateFormParams({ name: "", description: "", price: "" });
            setPreviewURL(null); // Clear the preview
            window.location.replace("/marketplace");
        } catch (e) {
            console.log("Error listing NFT:", e);
            toast.error("NFT listing failed: " + e.message);
        }
    }

    return (
        <div className="min-h-screen bg-black-transparent text-white flex flex-col">
            <ToastContainer />
            <div className="container mx-auto py-10 flex-grow">
                <div className="max-w-3xl mx-auto bg-gradient-to-r from-purple-500 via-indigo-600 to-purple-700  rounded-lg shadow-lg p-8">
                    <h2 className="text-3xl font-bold text-center text-white mb-6">Mint Your NFT</h2>
                    <form>
                        <div className="mb-6">
                            <label className="block text-white text-sm font-bold mb-2">NFT Name</label>
                            <input
                                type="text"
                                placeholder="Name Your NFT"
                                className="w-full p-3 rounded-lg bg-gray-700 text-gray-200 border border-gray-600 focus:outline-none focus:border-purple-400"
                                onChange={(e) => updateFormParams({ ...formParams, name: e.target.value })}
                                value={formParams.name}
                            />
                        </div>
                        <div className="mb-6">
                            <label className="block text-white text-sm font-bold mb-2">NFT Description</label>
                            <textarea
                                placeholder="Describe Your NFT"
                                className="w-full p-3 rounded-lg bg-gray-700 text-gray-200 border border-gray-600 focus:outline-none focus:border-purple-400"
                                rows="4"
                                onChange={(e) => updateFormParams({ ...formParams, description: e.target.value })}
                                value={formParams.description}
                            />
                        </div>
                        <div className="mb-6">
                            <label className="block text-white text-sm font-bold mb-2">Price (in ETH)</label>
                            <input
                                type="number"
                                placeholder="e.g 0.01 ETH"
                                step="0.01"
                                className="w-full p-3 rounded-lg bg-gray-700 text-gray-200 border border-gray-600 focus:outline-none focus:border-purple-400"
                                onChange={(e) => updateFormParams({ ...formParams, price: e.target.value })}
                                value={formParams.price}
                            />
                        </div>
                        <div className="mb-6">
                            <label className="block text-white text-sm font-bold mb-2">Upload Image (&lt;500 KB)</label>
                            <input
                                type="file"
                                className="w-full bg-gray-700 text-gray-200 border border-gray-600 rounded-lg p-2 focus:outline-none"
                                onChange={OnChangeFile}
                            />
                            {previewURL && (
                                <div className="mt-4">
                                    <p className="text-sm text-white">Preview:</p>
                                    <img src={previewURL} alt="NFT Preview" className="w-64 h-64 shadow-md rounded-lg" />
                                </div>
                            )}
                        </div>
                        <div className="text-center text-red-400 mb-4">{message}</div>
                        <button
                            id="list-button"
                            className="w-full bg-purple-500 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg"
                            onClick={listNFT}
                        >
                            Mint NFT
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
