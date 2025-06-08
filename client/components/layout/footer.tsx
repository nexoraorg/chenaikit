import React from 'react'
import Link from 'next/link'
const footer = () => {
  return (
    <footer className="border-t border-gray-700 bg-gray-900 py-8">
    <div className="container mx-auto px-6 flex flex-col sm:flex-row justify-between items-center text-gray-400 text-sm">
      <p>&copy; {new Date().getFullYear()} Skillsig. All rights reserved.</p>
      <div className="flex gap-4 mt-4 sm:mt-0">
        <Link href="/terms" className="hover:text-white">
          Terms
        </Link>
        <Link href="/privacy" className="hover:text-white">
          Privacy
        </Link>
        <Link href="/community" className="hover:text-white">
          Discord
        </Link>
      </div>
    </div>
  </footer>
  )
}

export default footer