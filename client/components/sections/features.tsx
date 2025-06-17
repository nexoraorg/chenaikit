import { Shield ,Code, Trophy,TrendingUp,TreePine} from 'lucide-react'
import {Card }from '@/components/ui/card'
import React from 'react'
const features = () => {
  return (
    <section className="py-20">
    <div className="container mx-auto px-6">
      <div className="text-center mb-16">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">🚀 Level Up Your Skills</h2>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          Learn real coding. Get rewarded. Prove it on-chain.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
  
        {[
          {
            title: "Soulbound Character NFT",
            desc: "Your identity in the Skillsig universe. Non-transferable proof of your learning journey.",
            icon: <Shield className="w-6 h-6 text-purple-400" />,
          },
          {
            title: "Coding & Logic Quests",
            desc: "Real-world challenges from frontend to Solidity. All auto-validated.",
            icon: <Code className="w-6 h-6 text-blue-400" />,
          },
          {
            title: "Skill Badge NFTs",
            desc: "Earn tradeable NFTs showing specific skills and achievements.",
            icon: <Trophy className="w-6 h-6 text-yellow-400" />,
          },
          {
            title: "Visual Skill Tree",
            desc: "Grow and unlock paths in your personalized skill tree.",
            icon: <TreePine className="w-6 h-6 text-green-400" />,
          },
          {
            title: "Onchain Verification",
            desc: "Your achievements are permanently recorded on-chain for anyone to verify.",
            icon: <Shield className="w-6 h-6 text-red-400" />,
          },
          {
            title: "Dynamic Progression",
            desc: "Your NFT evolves with your skills — changing appearance, stats, and more.",
            icon: <TrendingUp className="w-6 h-6 text-indigo-400" />,
          },
        ].map((card, idx) => (
          <Card
            key={idx}
            className="bg-gray-800/50 border border-gray-700 p-6 hover:bg-gray-800/70 transition-colors"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-white/5">{card.icon}</div>
              <h3 className="text-lg font-semibold">{card.title}</h3>
            </div>
            <p className="text-gray-300">{card.desc}</p>
          </Card>
        ))}
      </div>
    </div>
  </section>
  )
}

export default features