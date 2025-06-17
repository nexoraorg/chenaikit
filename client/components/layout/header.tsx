import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { TreePine, Wallet } from 'lucide-react'

const header = () => {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-800/50 bg-gray-900/80 backdrop-blur-xl">
    <div className="container mx-auto px-6 py-4">
      <nav className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* <Image src="/skillsig-logo.svg" alt="Skillsig" width={40} height={40} /> */}
          <TreePine/>
          <span className="text-xl font-bold">Skillsig</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/leaderboard" className="text-gray-300 hover:text-white transition-colors">
            Leaderboard
          </Link>
          <Link href="/community" className="text-gray-300 hover:text-white transition-colors">
            Community
          </Link>
          <Button variant="outline" size="sm" className="border-gray-600 text-gray-100 hover:bg-gray-800">
            <Wallet className="w-4 h-4 mr-2" />
            Connect Wallet
          </Button>
        </div>
      </nav>
    </div>
  </header>
  )
}

export default header