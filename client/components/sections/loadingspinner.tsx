import React from "react";

const Spinner = () => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white bg-opacity-70 z-[9999]">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 border-4 border-t-transparent border-blue-500 rounded-full animate-spin shadow-md"></div>
        <div className="absolute inset-1 border-4 border-t-transparent border-blue-300 rounded-full animate-spin-slower"></div>
      </div>
    </div>
  );
};

export default Spinner;
