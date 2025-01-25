import React from 'react';
import { Routes, Route } from "react-router-dom";
import Home from "./components/Home";
import Marketplace from './components/Marketplace';
import SellNFT from './components/SellNFT';
import Profile from './components/Profile';
import NFTPage from './components/NFTpage';
import Navbar from './components/Navbar';
import Footer from './components/Footer';

function App() {
  return (
    <div className="container">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/nftPage/:tokenId" element={<NFTPage />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/sellNFT" element={<SellNFT />} /> 
      </Routes>
      <Footer />
    </div>
  );
}

export default App;
