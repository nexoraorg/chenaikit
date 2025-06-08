import React from 'react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Zap } from 'lucide-react'
import { TreePine } from 'lucide-react'
import { ArrowRight } from 'lucide-react'
import { Users } from 'lucide-react'
import Link from 'next/link'

const hero = () => {
  return (
    <section className="relative overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-t from-transparent to-green-500/5" />
    <div className="container mx-auto px-6 py-20 text-center">
      <div className="max-w-4xl mx-auto">
        <Badge variant="secondary" className="mb-6 bg-green-500/10 text-green-400 border-green-500/20">
          <Zap className="w-3 h-3 mr-1" />
          Web3 Gaming Platform
        </Badge>
        <h1 className="text-5xl sm:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-gray-100 to-green-400 bg-clip-text text-transparent">
          🌲 Skillsig
        </h1>
        <p className="text-xl sm:text-2xl text-gray-300 mb-4 max-w-3xl mx-auto leading-relaxed">
          Complete coding quests, earn NFT achievements, and evolve your on-chain dev character.
        </p>
        <p className="text-lg text-green-400 font-medium mb-12 italic">
          Learn. Prove. Evolve.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
          <Link href="/game">
            <Button size="lg" className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 text-lg">
              <TreePine className="w-5 h-5 mr-2" />
              Enter the Skill Tree
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
          <Link href="/community">
            <Button variant="outline" size="lg" className="border-gray-600 text-gray-100 hover:bg-gray-800 px-8 py-4 text-lg">
              <Users className="w-5 h-5 mr-2" />
              Join Community
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-8 max-w-md mx-auto">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">1.2K+</div>
            <div className="text-sm text-gray-400">Active Players</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">50+</div>
            <div className="text-sm text-gray-400">Quests</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400">25K+</div>
            <div className="text-sm text-gray-400">NFTs Minted</div>
          </div>
        </div>
      </div>
    </div>
  </section>
  )
}

export default hero